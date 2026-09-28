"""
Import log: one row per upload attempt (imported, rejected or failed).

Lets users check whether a script run arrived completely, including uploads the
server refused. Logging is best effort and never breaks an import.
"""

import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from utils.logging import log_error

IMPORT_STATUSES = ("imported", "rejected", "error")

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS import_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER,
    detail TEXT,
    username TEXT,
    run_uuid TEXT,
    config_uuid TEXT,
    hostname TEXT,
    filename TEXT,
    target_table TEXT,
    test_run_id INTEGER
)
"""


def ensure_import_log_table(cursor: sqlite3.Cursor) -> None:
    """Create the import_log table and its indexes if missing (safe to run repeatedly)."""
    cursor.execute(CREATE_SQL)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_import_log_run_uuid ON import_log(run_uuid)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_import_log_timestamp ON import_log(timestamp)")


def record_import(
    db: sqlite3.Connection,
    *,
    status: str,
    username: Optional[str],
    run_uuid: Optional[str] = None,
    http_status: Optional[int] = None,
    detail: Optional[str] = None,
    config_uuid: Optional[str] = None,
    hostname: Optional[str] = None,
    filename: Optional[str] = None,
    target_table: Optional[str] = None,
    test_run_id: Optional[int] = None,
) -> None:
    """Append one upload attempt to the log; errors are logged, never raised."""
    values: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "http_status": http_status,
        "detail": (detail or "")[:500] or None,
        "username": username,
        "run_uuid": run_uuid,
        "config_uuid": config_uuid,
        "hostname": hostname,
        "filename": (filename or "")[:255] or None,
        "target_table": target_table,
        "test_run_id": test_run_id,
    }
    try:
        db.execute(
            f"INSERT INTO import_log ({', '.join(values)}) VALUES ({', '.join('?' for _ in values)})",
            list(values.values()),
        )
        db.commit()
    except sqlite3.Error as error:
        log_error("Failed to write import log entry", error, {"status": status, "run_uuid": run_uuid})
