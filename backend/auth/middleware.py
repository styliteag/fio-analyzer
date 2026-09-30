"""
Authentication middleware for FastAPI

A request authenticates with HTTP Basic (scripts such as fio-test.sh) or with the browser
session cookie set by POST /api/auth/login. Cookie-authenticated writes must carry the CSRF
header. Authenticated users without the needed role get 403, never 401: clients log out on 401.
"""

import sqlite3
from typing import Optional, Sequence

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBasic

from auth.authentication import get_user_role, parse_auth_header
from auth.sessions import COOKIE_NAME, CSRF_HEADER, CSRF_VALUE, clear_failed_logins, session_user, try_login_attempt
from database.connection import get_optional_db
from utils.logging import log_debug, log_info

security = HTTPBasic()

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")
READ_ROLES = ("admin", "viewer")


class User:
    """User class"""

    def __init__(self, username: str, role: str):
        """Initialize user with username and role"""
        self.username = username
        self.role = role


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _basic_user(request: Request, auth_header: str) -> Optional[User]:
    credentials = parse_auth_header(auth_header)
    if not credentials:
        log_debug("Auth check - failed to parse auth header", {"request_id": _request_id(request), "auth_header_prefix": auth_header.split(" ", 1)[0]})
        return None
    username, password = credentials
    # Same throttle as the browser login: Basic auth must not allow unlimited password guesses
    throttle_key = f"{request.client.host if request.client else 'unknown'}|{username}"
    if not try_login_attempt(throttle_key):
        raise HTTPException(status_code=429, detail="Too many failed logins, try again in a few minutes")
    role = get_user_role(username, password)
    log_debug("Auth check - basic", {"request_id": _request_id(request), "username": username, "role": role})
    if not role:
        return None
    clear_failed_logins(throttle_key)
    return User(username, role)


def _session_user(request: Request, db: Optional[sqlite3.Connection]) -> Optional[User]:
    token = request.cookies.get(COOKIE_NAME)
    if not token or db is None:
        return None
    found = session_user(db, token)
    if found is None:
        log_debug("Auth check - invalid or expired session", {"request_id": _request_id(request)})
        return None
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        log_info("Cookie-authenticated write without CSRF header", {"request_id": _request_id(request), "username": found[0]})
        raise HTTPException(status_code=403, detail="Missing CSRF header")
    return User(*found)


def get_current_user(request: Request, db: Optional[sqlite3.Connection] = None) -> Optional[User]:
    """User from the Authorization header (Basic) or, without one, from the session cookie"""
    auth_header = request.headers.get("authorization")
    if auth_header:
        return _basic_user(request, auth_header)
    return _session_user(request, db)


def _require(request: Request, db: Optional[sqlite3.Connection], roles: Optional[Sequence[str]], denied: str) -> User:
    user = get_current_user(request, db)
    if not user:
        log_debug("Access denied - no valid credentials", {"request_id": _request_id(request), "ip": request.client.host if request.client else "unknown"})
        raise HTTPException(status_code=401, detail="Authentication required")
    if roles is not None and user.role not in roles:
        log_info("Access denied - insufficient privileges", {"request_id": _request_id(request), "username": user.username, "role": user.role})
        # 403 (not 401): the user is authenticated, and clients log out on 401
        raise HTTPException(status_code=403, detail=denied)
    return user


def require_auth(request: Request, db: Optional[sqlite3.Connection] = Depends(get_optional_db)) -> User:
    """Require any valid user"""
    return _require(request, db, None, "")


def require_admin(request: Request, db: Optional[sqlite3.Connection] = Depends(get_optional_db)) -> User:
    """Require admin access"""
    return _require(request, db, ("admin",), "Admin access required")


def require_uploader(request: Request, db: Optional[sqlite3.Connection] = Depends(get_optional_db)) -> User:
    """Require upload access (admin or uploader users)"""
    return _require(request, db, ("admin", "uploader"), "Upload access required")


def require_viewer(request: Request, db: Optional[sqlite3.Connection] = Depends(get_optional_db)) -> User:
    """Require read access (admin or read-only viewer users)"""
    return _require(request, db, READ_ROLES, "Read access required")
