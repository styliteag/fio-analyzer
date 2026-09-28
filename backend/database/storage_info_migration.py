"""
Migration: storage_info column (JSON) on all test-run tables.
"""

import sqlite3

from utils.logging import log_info

STORAGE_INFO_TABLES = ("test_runs", "test_runs_all", "saturation_runs")


def add_storage_info_column(cursor: sqlite3.Cursor) -> None:
    """Add storage_info TEXT to every existing test-run table that lacks it."""
    for table in STORAGE_INFO_TABLES:
        columns = [row[1] for row in cursor.execute(f"PRAGMA table_info({table})")]
        if columns and "storage_info" not in columns:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN storage_info TEXT")
            log_info("Added storage_info column", {"table": table})
