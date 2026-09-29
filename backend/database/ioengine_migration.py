"""
Migration: ioengine column (fio I/O engine, e.g. libaio or io_uring) on all test-run tables.

- Every startup (idempotent, one UPDATE per table): rows without an engine take
  storage_info.ioengine, the engine fio-test.sh detected on the host.
- Once, when the column is added: rows that are still NULL (client mode runs have no
  storage_info on the aggregate row, old runs have none at all) are read from their stored
  fio JSON upload, if that file still exists inside the upload directory.

The column is not part of the test_runs unique key: SQLite treats NULLs in a UNIQUE key as
distinct, so every NULL-engine re-upload would add a row instead of replacing the latest one.
"""

import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

from config.settings import settings
from utils.ioengine import ioengine_from_fio_json
from utils.logging import log_error, log_info

IOENGINE_TABLES = ("test_runs", "test_runs_all", "saturation_runs")

# storage_info is compact JSON (utils.storage_info.encode_storage_info). Nested CASE is evaluated lazily,
# so json_type/json_extract never see malformed JSON (they raise on it) and only a text engine is taken.
STORAGE_ENGINE_SQL = (
    "lower(trim(CASE WHEN json_valid(storage_info) THEN " "CASE WHEN json_type(storage_info, '$.ioengine') = 'text' THEN json_extract(storage_info, '$.ioengine') END END))"
)


def _columns(cursor: sqlite3.Cursor, table: str) -> List[str]:
    return [row[1] for row in cursor.execute(f"PRAGMA table_info({table})")]


def backfill_from_storage_info(cursor: sqlite3.Cursor, table: str) -> int:
    """Set ioengine from storage_info where it is NULL and storage_info names a non-empty engine."""
    if "storage_info" not in _columns(cursor, table):
        return 0
    cursor.execute(f"UPDATE {table} SET ioengine = {STORAGE_ENGINE_SQL} " f"WHERE ioengine IS NULL AND storage_info IS NOT NULL AND COALESCE({STORAGE_ENGINE_SQL}, '') <> ''")
    return cursor.rowcount


def _read_engine(path: str, upload_dir: Path) -> Optional[str]:
    """Engine from a stored upload; None if the file is gone, outside the upload directory, too big or unreadable."""
    try:
        file_path = Path(path).resolve()
        if not file_path.is_relative_to(upload_dir) or not file_path.is_file():
            return None
        if file_path.stat().st_size > settings.max_upload_size:
            return None
        return ioengine_from_fio_json(file_path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return None


def backfill_from_uploads(cursor: sqlite3.Cursor, table: str, cache: Dict[str, Optional[str]]) -> int:
    """Set ioengine from the stored fio JSON of rows that are still NULL (one-time, when the column is added)."""
    if "uploaded_file_path" not in _columns(cursor, table):
        return 0
    upload_dir = settings.upload_dir.resolve()
    rows = cursor.execute(f"SELECT id, uploaded_file_path FROM {table} WHERE ioengine IS NULL AND uploaded_file_path IS NOT NULL").fetchall()
    updates = []
    for row_id, path in rows:
        if path not in cache:
            cache[path] = _read_engine(path, upload_dir)
        if cache[path]:
            updates.append((cache[path], row_id))
    cursor.executemany(f"UPDATE {table} SET ioengine = ? WHERE id = ?", updates)
    return len(updates)


def migrate_ioengine(cursor: sqlite3.Cursor) -> None:
    """Add ioengine TEXT to every test-run table and backfill it (see module docstring)."""
    added = []
    for table in IOENGINE_TABLES:
        columns = _columns(cursor, table)
        if columns and "ioengine" not in columns:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN ioengine TEXT")
            log_info("Added ioengine column", {"table": table})
            added.append(table)
    for table in IOENGINE_TABLES:
        if "ioengine" in _columns(cursor, table):
            count = backfill_from_storage_info(cursor, table)
            if count:
                log_info("Backfilled ioengine from storage_info", {"table": table, "rows": count})
    cache: Dict[str, Optional[str]] = {}
    for table in added:
        try:
            count = backfill_from_uploads(cursor, table, cache)
        except sqlite3.Error as error:
            log_error("Backfilling ioengine from uploads failed", error, {"table": table})
            continue
        if count:
            log_info("Backfilled ioengine from uploaded fio JSON", {"table": table, "rows": count})
