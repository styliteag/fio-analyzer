"""
Authentication system with htpasswd support
"""

import base64
import hashlib
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import bcrypt

from config.settings import settings
from utils.logging import log_debug, log_error, log_warning

# Authentication cache (username_hash -> (role, timestamp))
_auth_cache: Dict[str, Tuple[str, float]] = {}
_cache_duration = 300  # 5 minutes cache
_MAX_CACHE_ENTRIES = 1000
_cache_lock = threading.Lock()
_dummy_hash: Optional[bytes] = None


def _burn_bcrypt(password: str) -> None:
    """A bcrypt check with the cost of a real one (hash created on first use)."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = bcrypt.hashpw(b"fio-analyzer-dummy", bcrypt.gensalt())
    bcrypt.checkpw(password.encode("utf-8")[:72], _dummy_hash)


def _role_files_version() -> str:
    """Modification times of all role files, so edits (also by manage_users.py) invalidate the cache."""
    versions = []
    for path in (settings.htpasswd_path, settings.htuploaders_path, settings.htviewers_path):
        try:
            versions.append(str(path.stat().st_mtime_ns))
        except OSError:
            versions.append("-")
    return ",".join(versions)


def _get_cache_key(username: str, password: str) -> str:
    """Generate cache key for username/password combination and the current role files"""
    return hashlib.sha256(f"{username}:{password}:{_role_files_version()}".encode()).hexdigest()


def clear_auth_cache() -> None:
    """Forget cached roles, e.g. after users or roles changed."""
    with _cache_lock:
        _auth_cache.clear()


def parse_htpasswd(file_path: Path) -> Optional[Dict[str, str]]:
    """Parse htpasswd file"""
    if not file_path.exists():
        log_warning("htpasswd file not found", {"file_path": str(file_path)})
        return None

    try:
        content = file_path.read_text()
        users = {}

        for line in content.split("\n"):
            line = line.strip()
            if line and ":" in line:
                username, hash_value = line.split(":", 1)
                if username and hash_value:
                    users[username] = hash_value

        user_count = len(users)
        log_debug(
            "htpasswd file parsed successfully",
            {
                "file_path": str(file_path),
                "user_count": user_count,
                "users": list(users.keys()),
            },
        )

        return users if user_count > 0 else None

    except Exception as error:
        log_error("Error reading htpasswd file", error, {"file_path": str(file_path)})
        return None


def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against hash"""
    try:
        if hash_value.startswith("$2y$") or hash_value.startswith("$2a$") or hash_value.startswith("$2b$"):
            # Bcrypt format
            return bcrypt.checkpw(password.encode("utf-8"), hash_value.encode("utf-8"))
        elif hash_value.startswith("$apr1$"):
            # Apache MD5 - not implemented
            log_warning(
                "Apache MD5 format not supported",
                {"suggestion": "Please recreate .htpasswd with bcrypt (-B flag)"},
            )
            return False
        else:
            # Plain text (insecure)
            log_warning(
                "Using plain text password (insecure)",
                {"suggestion": "Please use bcrypt hashed passwords"},
            )
            return password == hash_value
    except Exception as e:
        log_error("Error verifying password", e)
        return False


def is_admin_user(username: str, password: str) -> bool:
    """Check if user has admin privileges"""
    htpasswd_users = parse_htpasswd(settings.htpasswd_path)
    if not htpasswd_users or username not in htpasswd_users:
        log_debug(
            "Admin authentication failed",
            {
                "username": username,
                "reason": ("no_htpasswd_file" if not htpasswd_users else "user_not_found"),
            },
        )
        return False

    hash_value = htpasswd_users[username]
    is_valid = verify_password(password, hash_value)

    log_debug("Admin authentication attempt", {"username": username, "success": is_valid})

    return is_valid


def is_uploader_user(username: str, password: str) -> bool:
    """Check if user has upload-only privileges"""
    htuploaders_users = parse_htpasswd(settings.htuploaders_path)
    if not htuploaders_users or username not in htuploaders_users:
        log_debug(
            "Uploader authentication failed",
            {
                "username": username,
                "reason": ("no_htuploaders_file" if not htuploaders_users else "user_not_found"),
            },
        )
        return False

    hash_value = htuploaders_users[username]
    is_valid = verify_password(password, hash_value)

    log_debug("Uploader authentication attempt", {"username": username, "success": is_valid})

    return is_valid


def is_viewer_user(username: str, password: str) -> bool:
    """Check if user has read-only (viewer) privileges"""
    viewers = parse_htpasswd(settings.htviewers_path)
    if not viewers or username not in viewers:
        return False
    is_valid = verify_password(password, viewers[username])
    log_debug("Viewer authentication attempt", {"username": username, "success": is_valid})
    return is_valid


def _cached_role(cache_key: str, now: float) -> Tuple[bool, Optional[str]]:
    """(hit, role) from the cache; expired entries are dropped."""
    with _cache_lock:
        entry = _auth_cache.get(cache_key)
        if entry is None:
            return False, None
        role, timestamp = entry
        if now - timestamp < _cache_duration:
            return True, role
        _auth_cache.pop(cache_key, None)
        return False, None


def _store_role(cache_key: str, role: Optional[str], now: float) -> None:
    # Bounded: drop expired entries, and everything if it is still too large
    with _cache_lock:
        _auth_cache[cache_key] = (role, now)
        if len(_auth_cache) > _MAX_CACHE_ENTRIES:
            for key in [k for k, (_, ts) in _auth_cache.items() if now - ts > _cache_duration]:
                del _auth_cache[key]
            if len(_auth_cache) > _MAX_CACHE_ENTRIES:
                _auth_cache.clear()


def get_user_role(username: str, password: str) -> Optional[str]:
    """Get user role with caching (the cache is shared by threadpool requests: locked)"""
    cache_key = _get_cache_key(username, password)
    current_time = time.time()
    hit, cached = _cached_role(cache_key, current_time)
    if hit:
        log_debug("Authentication cache hit", {"username": username, "role": cached})
        return cached

    # Cache miss - do actual authentication
    log_debug("Authentication cache miss", {"username": username})
    role = None
    if is_admin_user(username, password):
        role = "admin"
    elif is_uploader_user(username, password):
        role = "uploader"
    elif is_viewer_user(username, password):
        role = "viewer"

    if role is None and not any(role_password_hash(username, r) for r in ROLE_FILES):
        # Unknown user: spend a bcrypt check anyway, so the response time does not reveal it
        _burn_bcrypt(password)

    # Cache the result (even if None, to avoid repeated bcrypt calls for invalid users)
    _store_role(cache_key, role, current_time)
    return role


ROLE_FILES = {"admin": "htpasswd_path", "uploader": "htuploaders_path", "viewer": "htviewers_path"}


def role_password_hash(username: str, role: str) -> Optional[str]:
    """Password hash of a user in one role's file (None if the user is not in it)."""
    attribute = ROLE_FILES.get(role)
    if attribute is None:
        return None
    return (parse_htpasswd(getattr(settings, attribute)) or {}).get(username)


def duplicate_usernames() -> Dict[str, List[str]]:
    """Usernames found in more than one role file, with their roles (logged at startup)."""
    roles: Dict[str, List[str]] = {}
    for role, attribute in ROLE_FILES.items():
        for username in parse_htpasswd(getattr(settings, attribute)) or {}:
            roles.setdefault(username, []).append(role)
    return {username: found for username, found in roles.items() if len(found) > 1}


def parse_auth_header(auth_header: str) -> Optional[Tuple[str, str]]:
    """Parse Basic Auth header"""
    if not auth_header or not auth_header.startswith("Basic "):
        return None

    try:
        credentials = base64.b64decode(auth_header[6:]).decode("utf-8")
        if ":" not in credentials:
            return None

        username, password = credentials.split(":", 1)
        return username, password
    except Exception as e:
        log_error("Error parsing auth header", e)
        return None
