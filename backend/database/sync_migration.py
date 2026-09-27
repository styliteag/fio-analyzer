"""
Migration: store fio sync mode as text (none, sync, dsync) instead of 0/1.

Existing databases keep the declared INTEGER column type (SQLite cannot alter a
column type in place). Values are rewritten to text, and non-numeric text keeps
its text storage class under INTEGER affinity. New databases declare TEXT.
"""

import sqlite3

from utils.logging import log_info

SYNC_TABLES = ("test_runs", "test_runs_all", "saturation_runs")

CONVERT_SQL = """
UPDATE {table}
SET sync = CASE CAST(sync AS INTEGER) WHEN 0 THEN 'none' ELSE 'sync' END
WHERE typeof(sync) IN ('integer', 'real')
"""


def _table_exists(cursor: sqlite3.Cursor, table: str) -> bool:
    row = cursor.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone()
    return row is not None


def migrate_sync_to_text(cursor: sqlite3.Cursor) -> None:
    """Rewrite numeric sync values to their fio names. Safe to run repeatedly."""
    for table in SYNC_TABLES:
        if not _table_exists(cursor, table):
            continue
        cursor.execute(CONVERT_SQL.format(table=table))
        if cursor.rowcount:
            log_info("Converted sync values to text", {"table": table, "rows": cursor.rowcount})
