"""
Authentication system with htpasswd support
"""

import base64
import bcrypt
from typing import Optional, Dict, Tuple
from pathlib import Path

from config.settings import settings
from utils.logging import log_info, log_error, log_warning, log_debug


def parse_htpasswd(file_path: Path) -> Optional[Dict[str, str]]:
    """Parse htpasswd file"""
    if not file_path.exists():
        log_warning(f"htpasswd file not found", {"file_path": str(file_path)})
        return None
    
    try:
        content = file_path.read_text()
        users = {}
        
        for line in content.split('\n'):
            line = line.strip()
            if line and ':' in line:
                username, hash_value = line.split(':', 1)
                if username and hash_value:
                    users[username] = hash_value
        
        user_count = len(users)
        log_debug("htpasswd file parsed successfully", {
            "file_path": str(file_path),
            "user_count": user_count,
            "users": list(users.keys())
        })
        
        return users if user_count > 0 else None
    
    except Exception as error:
        log_error("Error reading htpasswd file", error, {"file_path": str(file_path)})
        return None


def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against hash"""
    try:
        if hash_value.startswith('$2y$') or hash_value.startswith('$2a$') or hash_value.startswith('$2b$'):
            # Bcrypt format
            return bcrypt.checkpw(password.encode('utf-8'), hash_value.encode('utf-8'))
        elif hash_value.startswith('$apr1$'):
            # Apache MD5 - not implemented
            log_warning("Apache MD5 format not supported", {
                "suggestion": "Please recreate .htpasswd with bcrypt (-B flag)"
            })
            return False
        else:
            # Plain text (insecure)
            log_warning("Using plain text password (insecure)", {
                "suggestion": "Please use bcrypt hashed passwords"
            })
            return password == hash_value
    except Exception as e:
        log_error("Error verifying password", e)
        return False


def is_admin_user(username: str, password: str) -> bool:
    """Check if user has admin privileges"""
    htpasswd_users = parse_htpasswd(settings.htpasswd_path)
    if not htpasswd_users or username not in htpasswd_users:
        log_debug("Admin authentication failed", {
            "username": username,
            "reason": "no_htpasswd_file" if not htpasswd_users else "user_not_found"
        })
        return False
    
    hash_value = htpasswd_users[username]
    is_valid = verify_password(password, hash_value)
    
    log_debug("Admin authentication attempt", {
        "username": username,
        "success": is_valid
    })
    
    return is_valid


def is_uploader_user(username: str, password: str) -> bool:
    """Check if user has upload-only privileges"""
    htuploaders_users = parse_htpasswd(settings.htuploaders_path)
    if not htuploaders_users or username not in htuploaders_users:
        log_debug("Uploader authentication failed", {
            "username": username,
            "reason": "no_htuploaders_file" if not htuploaders_users else "user_not_found"
        })
        return False
    
    hash_value = htuploaders_users[username]
    is_valid = verify_password(password, hash_value)
    
    log_debug("Uploader authentication attempt", {
        "username": username,
        "success": is_valid
    })
    
    return is_valid


def get_user_role(username: str, password: str) -> Optional[str]:
    """Get user role"""
    if is_admin_user(username, password):
        return "admin"
    elif is_uploader_user(username, password):
        return "uploader"
    return None


def parse_auth_header(auth_header: str) -> Optional[Tuple[str, str]]:
    """Parse Basic Auth header"""
    if not auth_header or not auth_header.startswith('Basic '):
        return None
    
    try:
        credentials = base64.b64decode(auth_header[6:]).decode('utf-8')
        if ':' not in credentials:
            return None
        
        username, password = credentials.split(':', 1)
        return username, password
    except Exception as e:
        log_error("Error parsing auth header", e)
        return None