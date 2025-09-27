"""
Authentication middleware for FastAPI
"""

from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from auth.authentication import get_user_role, parse_auth_header
from utils.logging import log_debug, log_info

security = HTTPBasic()


class User:
    """User class"""

    def __init__(self, username: str, role: str):
        """Initialize user with username and role"""
        self.username = username
        self.role = role


def get_current_user(request: Request) -> Optional[User]:
    """Get current user from request"""
    request_id = getattr(request.state, "request_id", "unknown")

    # Log all headers for debugging
    log_debug(
        "Auth check - all headers",
        {"request_id": request_id, "headers": dict(request.headers)},
    )

    auth_header = request.headers.get("authorization")
    log_debug(
        "Auth check - authorization header",
        {
            "request_id": request_id,
            "auth_header_present": auth_header is not None,
            "auth_header_value": (
                auth_header[:20] + "..."
                if auth_header and len(auth_header) > 20
                else auth_header
            ),
        },
    )

    if not auth_header:
        log_debug("Auth check - no authorization header", {"request_id": request_id})
        return None

    credentials = parse_auth_header(auth_header)
    if not credentials:
        log_debug(
            "Auth check - failed to parse auth header",
            {"request_id": request_id, "auth_header": auth_header},
        )
        return None

    username, password = credentials
    log_debug(
        "Auth check - parsed credentials",
        {
            "request_id": request_id,
            "username": username,
            "password_length": len(password) if password else 0,
        },
    )

    role = get_user_role(username, password)
    log_debug(
        "Auth check - role lookup result",
        {"request_id": request_id, "username": username, "role": role},
    )

    if role:
        log_debug(
            "Auth check - user authenticated successfully",
            {"request_id": request_id, "username": username, "role": role},
        )
        return User(username, role)

    log_debug(
        "Auth check - authentication failed",
        {
            "request_id": request_id,
            "username": username,
            "reason": "invalid_credentials",
        },
    )
    return None


def require_auth(request: Request) -> User:
    """Require any valid user (admin or uploader)"""
    user = get_current_user(request)

    if not user:
        log_debug(
            "Authentication denied - no valid credentials",
            {
                "request_id": getattr(request.state, "request_id", "unknown"),
                "ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "unknown"),
            },
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    log_debug(
        "Authentication successful",
        {
            "request_id": getattr(request.state, "request_id", "unknown"),
            "username": user.username,
            "role": user.role,
            "ip": request.client.host if request.client else "unknown",
        },
    )

    return user


def require_admin(request: Request) -> User:
    """Require admin access"""
    user = get_current_user(request)

    if not user:
        log_debug(
            "Admin access denied - no auth header",
            {
                "request_id": getattr(request.state, "request_id", "unknown"),
                "ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "unknown"),
            },
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    if user.role != "admin":
        log_info(
            "Admin access denied - insufficient privileges",
            {
                "request_id": getattr(request.state, "request_id", "unknown"),
                "username": user.username,
                "role": user.role,
                "ip": request.client.host if request.client else "unknown",
            },
        )
        raise HTTPException(
            status_code=401,
            detail="Admin access required",
        )

    log_info(
        "Admin access granted",
        {
            "request_id": getattr(request.state, "request_id", "unknown"),
            "username": user.username,
            "ip": request.client.host if request.client else "unknown",
        },
    )

    return user


def require_uploader(request: Request) -> User:
    """Require upload access (admin or uploader users)"""
    user = get_current_user(request)

    if not user:
        log_debug(
            "Upload access denied - no auth header",
            {
                "request_id": getattr(request.state, "request_id", "unknown"),
                "ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "unknown"),
            },
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    if user.role not in ["admin", "uploader"]:
        log_info(
            "Upload access denied - insufficient privileges",
            {
                "request_id": getattr(request.state, "request_id", "unknown"),
                "username": user.username,
                "role": user.role,
                "ip": request.client.host if request.client else "unknown",
            },
        )
        raise HTTPException(
            status_code=403,
            detail="Upload access required",
        )

    log_info(
        "Upload access granted",
        {
            "request_id": getattr(request.state, "request_id", "unknown"),
            "username": user.username,
            "role": user.role,
            "ip": request.client.host if request.client else "unknown",
        },
    )

    return user
