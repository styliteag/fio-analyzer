"""
Authentication middleware for FastAPI
"""

from typing import Optional
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from auth.authentication import get_user_role, parse_auth_header
from utils.logging import log_info


security = HTTPBasic()


class User:
    """User class"""
    def __init__(self, username: str, role: str):
        self.username = username
        self.role = role


def get_current_user(request: Request) -> Optional[User]:
    """Get current user from request"""
    auth_header = request.headers.get("authorization")
    if not auth_header:
        return None
    
    credentials = parse_auth_header(auth_header)
    if not credentials:
        return None
    
    username, password = credentials
    role = get_user_role(username, password)
    
    if role:
        return User(username, role)
    
    return None


def require_auth(request: Request) -> User:
    """Require any valid user (admin or uploader)"""
    user = get_current_user(request)
    
    if not user:
        log_info("Authentication denied - no valid credentials", {
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown")
        })
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    log_info("Authentication successful", {
        "request_id": getattr(request.state, 'request_id', 'unknown'),
        "username": user.username,
        "role": user.role,
        "ip": request.client.host if request.client else "unknown"
    })
    
    return user


def require_admin(request: Request) -> User:
    """Require admin access"""
    user = get_current_user(request)
    
    if not user:
        log_info("Admin access denied - no auth header", {
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown")
        })
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    if user.role != "admin":
        log_info("Admin access denied - insufficient privileges", {
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "username": user.username,
            "role": user.role,
            "ip": request.client.host if request.client else "unknown"
        })
        raise HTTPException(
            status_code=401,
            detail="Admin access required",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    log_info("Admin access granted", {
        "request_id": getattr(request.state, 'request_id', 'unknown'),
        "username": user.username,
        "ip": request.client.host if request.client else "unknown"
    })
    
    return user