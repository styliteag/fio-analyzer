"""
Browser sessions: the password is checked once at login; afterwards a random token in an
HttpOnly cookie authenticates. Only a SHA-256 hash of the token is stored. A session ends at
its absolute expiry, at logout, or as soon as the user's role or password hash changes
(checked on every request against the role files).
"""

import hashlib
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from auth.authentication import role_password_hash
from config.settings import settings

COOKIE_NAME = "fio_session"
# Cookie-authenticated writes must carry this header: a cross-site form cannot set it
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "fio-analyzer"

# Failed logins per client IP and username before further attempts get 429 for the window
MAX_FAILED_LOGINS = 10
FAILED_LOGIN_WINDOW_S = 300
_MAX_TRACKED_LOGINS = 10000

# One connection is shared by all threadpool requests: serialize session reads and writes
_lock = threading.Lock()
_failed_logins: Dict[str, List[float]] = {}


def ensure_sessions_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            role TEXT NOT NULL,
            password_fingerprint TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
        """)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def lifetime_seconds() -> int:
    return settings.session_lifetime_hours * 3600


def create_session(db: sqlite3.Connection, username: str, role: str) -> Tuple[str, datetime]:
    """New session for a user whose password was just verified for <role>: (token, expires_at)."""
    password_hash = role_password_hash(username, role)
    if password_hash is None:
        raise ValueError("user not in the role file")
    token = secrets.token_urlsafe(32)
    now = _now()
    expires_at = now + timedelta(seconds=lifetime_seconds())
    with _lock:
        db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now.isoformat(),))
        db.execute(
            "INSERT INTO sessions (token_hash, username, role, password_fingerprint, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            (_sha256(token), username, role, _sha256(password_hash), now.isoformat(), expires_at.isoformat()),
        )
        db.commit()
    return token, expires_at


def session_user(db: sqlite3.Connection, token: str) -> Optional[Tuple[str, str]]:
    """(username, role) of a valid session; an expired or outdated session is deleted."""
    with _lock:
        row = db.execute("SELECT username, role, password_fingerprint, expires_at FROM sessions WHERE token_hash = ?", (_sha256(token),)).fetchone()
    if row is None:
        return None
    username, role, fingerprint, expires_at = row
    # Same role file, same password hash: a password change, role change or removal ends the session
    current_hash = role_password_hash(username, role)
    expired = datetime.fromisoformat(expires_at) <= _now()
    if expired or current_hash is None or _sha256(current_hash) != fingerprint:
        delete_session(db, token)
        return None
    return username, role


def delete_session(db: sqlite3.Connection, token: str) -> None:
    with _lock:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (_sha256(token),))
        db.commit()


def _recent_failures(key: str, now: float) -> List[float]:
    return [t for t in _failed_logins.get(key, []) if now - t < FAILED_LOGIN_WINDOW_S]


def login_throttled(key: str) -> bool:
    """True while <key> (client IP and username) has MAX_FAILED_LOGINS failures in the window."""
    with _lock:
        return len(_recent_failures(key, time.monotonic())) >= MAX_FAILED_LOGINS


def _record(key: str, now: float) -> None:
    # Most recently used last; when full, evict stale keys, then the oldest ones
    failures = [*_recent_failures(key, now), now]
    _failed_logins.pop(key, None)
    if len(_failed_logins) >= _MAX_TRACKED_LOGINS:
        for stale in [k for k in _failed_logins if not _recent_failures(k, now)]:
            del _failed_logins[stale]
    while len(_failed_logins) >= _MAX_TRACKED_LOGINS:
        del _failed_logins[next(iter(_failed_logins))]
    _failed_logins[key] = failures


def record_failed_login(key: str) -> None:
    with _lock:
        _record(key, time.monotonic())


def try_login_attempt(key: str) -> bool:
    """Reserve one attempt for <key>, counted as failed until clear_failed_logins(key);
    False (no attempt) while throttled. Check and reservation are one step, so parallel
    requests cannot all pass the check before any failure is counted."""
    now = time.monotonic()
    with _lock:
        if len(_recent_failures(key, now)) >= MAX_FAILED_LOGINS:
            return False
        _record(key, now)
        return True


def clear_failed_logins(key: Optional[str] = None) -> None:
    """Forget failures of one key after a successful login, or of all keys (tests)."""
    with _lock:
        if key is None:
            _failed_logins.clear()
        else:
            _failed_logins.pop(key, None)
