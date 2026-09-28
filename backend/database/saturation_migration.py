"""
Migration: store the latency threshold used by a saturation run (sent by fio-test.sh),
so the saturation summary can be computed without guessing it.
"""

import sqlite3

from utils.logging import log_info


def add_threshold_column(cursor: sqlite3.Cursor) -> None:
    """Add saturation_runs.latency_threshold_ms if the table exists and lacks it."""
    columns = [row[1] for row in cursor.execute("PRAGMA table_info(saturation_runs)")]
    if columns and "latency_threshold_ms" not in columns:
        cursor.execute("ALTER TABLE saturation_runs ADD COLUMN latency_threshold_ms REAL")
        log_info("Added latency_threshold_ms column to saturation_runs")
