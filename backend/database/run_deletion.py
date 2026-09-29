"""
Deleting test runs across test_runs (latest), test_runs_all (history) and client_results.

test_runs and test_runs_all number their rows independently, so a test_runs id never
identifies a history row. An upload writes identical values into both tables: the history
twin of a latest row is the row with the same timestamp, run_uuid and unique key.
client_results rows reference test_runs_all ids and have no foreign key, so every history
delete also removes them.
"""

import sqlite3
from typing import Dict, List, Optional, Sequence

from database.client_migration import CLIENT_RESULTS_TABLE

# UNIQUE key of test_runs plus the fields that tell two uploads of one configuration apart
TWIN_COLUMNS = (
    "timestamp",
    "run_uuid",
    "hostname",
    "protocol",
    "drive_type",
    "drive_model",
    "block_size",
    "read_write_pattern",
    "queue_depth",
    "num_jobs",
    "direct",
    "test_size",
    "sync",
    "iodepth",
    "duration",
    "clients",
)


def _ids(cursor: sqlite3.Cursor, sql: str, params: Sequence[object]) -> List[int]:
    return [row[0] for row in cursor.execute(sql, params).fetchall()]


def history_twin_ids(cursor: sqlite3.Cursor, test_run_id: int) -> Optional[List[int]]:
    """test_runs_all ids holding the same result as test_runs row <test_run_id>; None if that row is unknown."""
    columns = ", ".join(TWIN_COLUMNS)
    latest = cursor.execute(f"SELECT {columns} FROM test_runs WHERE id = ?", (test_run_id,)).fetchone()
    if latest is None:
        return None
    # IS instead of = so NULL columns (test_size, sync, run_uuid of old rows) still match
    where = " AND ".join(f"{column} IS ?" for column in TWIN_COLUMNS)
    return _ids(cursor, f"SELECT id FROM test_runs_all WHERE {where}", tuple(latest))


def delete_history_rows(cursor: sqlite3.Cursor, history_ids: Sequence[int]) -> Dict[str, int]:
    """Delete test_runs_all rows and their client_results; returns the counts per table."""
    if not history_ids:
        return {"test_runs_all": 0, "client_results": 0}
    placeholders = ", ".join("?" for _ in history_ids)
    cursor.execute(f"DELETE FROM {CLIENT_RESULTS_TABLE} WHERE test_run_id IN ({placeholders})", tuple(history_ids))
    client_results = cursor.rowcount
    cursor.execute(f"DELETE FROM test_runs_all WHERE id IN ({placeholders})", tuple(history_ids))
    return {"test_runs_all": cursor.rowcount, "client_results": client_results}


def delete_latest_run(cursor: sqlite3.Cursor, test_run_id: int) -> Optional[Dict[str, int]]:
    """Delete one test_runs row with its history twin; None if the row is unknown."""
    twins = history_twin_ids(cursor, test_run_id)
    if twins is None:
        return None
    counts = delete_history_rows(cursor, twins)
    cursor.execute("DELETE FROM test_runs WHERE id = ?", (test_run_id,))
    return {"test_runs": cursor.rowcount, **counts}


def delete_run_uuid(cursor: sqlite3.Cursor, run_uuid: str) -> Dict[str, int]:
    """Delete every latest and history row of one script run, with its client_results."""
    history_ids = _ids(cursor, "SELECT id FROM test_runs_all WHERE run_uuid = ?", (run_uuid,))
    counts = delete_history_rows(cursor, history_ids)
    cursor.execute("DELETE FROM test_runs WHERE run_uuid = ?", (run_uuid,))
    return {"test_runs": cursor.rowcount, **counts}


def delete_orphan_client_results(cursor: sqlite3.Cursor) -> int:
    """Remove client_results whose history row is gone (after bulk history deletes)."""
    cursor.execute(f"DELETE FROM {CLIENT_RESULTS_TABLE} WHERE test_run_id NOT IN (SELECT id FROM test_runs_all)")
    return cursor.rowcount
