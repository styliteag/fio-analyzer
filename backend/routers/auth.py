"""
Browser login: POST /api/auth/login checks the password once and sets the HttpOnly session
cookie, so the frontend never stores the password. POST /api/auth/logout ends the session.
Scripts keep using HTTP Basic.
"""

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from auth.authentication import get_user_role
from auth.middleware import User, require_auth
from auth.sessions import (
    COOKIE_NAME,
    CSRF_HEADER,
    CSRF_VALUE,
    MAX_FAILED_LOGINS,
    clear_failed_logins,
    create_session,
    delete_session,
    lifetime_seconds,
    try_login_attempt,
)
from config.settings import settings
from database.connection import get_optional_db
from utils.logging import log_info

router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=1024)


def _require_csrf(request: Request) -> None:
    if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(status_code=403, detail="Missing CSRF header")


def _secure(request: Request) -> bool:
    if settings.cookie_secure in ("true", "1", "yes"):
        return True
    if settings.cookie_secure in ("false", "0", "no"):
        return False
    forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    return (forwarded or request.url.scheme) == "https"


def _database(db: Optional[sqlite3.Connection]) -> sqlite3.Connection:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not ready")
    return db


@router.post(
    "/login",
    summary="Log In",
    description="Check username and password once and start a browser session: an HttpOnly, SameSite=Strict "
    f"cookie `{COOKIE_NAME}` (Secure over HTTPS) valid for SESSION_LIFETIME_HOURS (default 48). Requires the header "
    f"`{CSRF_HEADER}: {CSRF_VALUE}`. The session ends earlier on logout or when the user's password or role changes.",
    responses={
        401: {"description": "Invalid username or password"},
        403: {"description": "Missing CSRF header"},
        429: {"description": f"{MAX_FAILED_LOGINS} failed logins from this address for this user within 5 minutes"},
    },
)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Optional[sqlite3.Connection] = Depends(get_optional_db),
):
    # Plain def: FastAPI runs it in the threadpool, so the bcrypt check never blocks the event loop
    _require_csrf(request)
    client = request.client.host if request.client else "unknown"
    throttle_key = f"{client}|{body.username}"
    if not try_login_attempt(throttle_key):
        raise HTTPException(status_code=429, detail="Too many failed logins, try again in a few minutes")
    role = get_user_role(body.username, body.password)
    if not role:
        log_info("Login failed", {"username": body.username, "ip": client})
        raise HTTPException(status_code=401, detail="Invalid username or password")
    clear_failed_logins(throttle_key)
    database = _database(db)
    previous = request.cookies.get(COOKIE_NAME)
    if previous:
        delete_session(database, previous)
    token, expires_at = create_session(database, body.username, role)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=lifetime_seconds(),
        path="/",
        httponly=True,
        samesite="strict",
        secure=_secure(request),
    )
    log_info("Login", {"username": body.username, "role": role})
    return {"username": body.username, "role": role, "expires_at": expires_at.isoformat()}


@router.post(
    "/logout",
    summary="Log Out",
    description=f"End the browser session and clear the cookie. Requires the header `{CSRF_HEADER}: {CSRF_VALUE}`.",
)
def logout(
    request: Request,
    response: Response,
    user: User = Depends(require_auth),
    db: Optional[sqlite3.Connection] = Depends(get_optional_db),
):
    _require_csrf(request)
    token = request.cookies.get(COOKIE_NAME)
    if token and db is not None:
        delete_session(db, token)
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="strict", secure=_secure(request))
    log_info("Logout", {"username": user.username})
    return {"message": "Logged out"}
