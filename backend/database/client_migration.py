"""
Migration for multi-client runs (fio client mode, client ramps).

- test_runs, test_runs_all: new columns clients (default 1), ramp_uuid, client_hosts (JSON list)
- test_runs: `clients` joins the UNIQUE key, otherwise a 4-client result would replace the
  1-client result of the same configuration (INSERT OR REPLACE). SQLite cannot change a
  constraint in place, so the table is rebuilt; its indexes and the latest_test_per_server
  view are recreated afterwards.
- client_results: per-client results of a multi-client step
"""

import re
import sqlite3
from typing import Callable, List

from utils.logging import log_info

CLIENT_COLUMNS = (("clients", "INTEGER DEFAULT 1"), ("ramp_uuid", "TEXT"), ("client_hosts", "TEXT"))
CLIENT_RESULTS_TABLE = "client_results"
UNIQUE_PATTERN = re.compile(r"UNIQUE\s*\(([^)]*)\)", re.IGNORECASE)

CLIENT_RESULTS_SQL = f"""
CREATE TABLE IF NOT EXISTS {CLIENT_RESULTS_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    ramp_uuid TEXT,
    run_uuid TEXT,
    timestamp TEXT,
    client_index INTEGER,
    client_host TEXT,
    client_port INTEGER,
    iops REAL,
    read_iops REAL,
    write_iops REAL,
    bandwidth REAL,
    avg_latency REAL,
    p95_latency REAL,
    p99_latency REAL,
    error INTEGER,
    storage_info TEXT
)
"""


def _columns(cursor: sqlite3.Cursor, table: str) -> List[str]:
    return [row[1] for row in cursor.execute(f"PRAGMA table_info({table})")]


def _add_columns(cursor: sqlite3.Cursor, table: str) -> None:
    existing = _columns(cursor, table)
    if not existing:
        return
    for name, definition in CLIENT_COLUMNS:
        if name not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
            log_info("Added multi-client column", {"table": table, "column": name})


def _unique_has_clients(create_sql: str) -> bool:
    match = UNIQUE_PATTERN.search(create_sql)
    return match is None or "clients" in [part.strip() for part in match.group(1).split(",")]


def _rebuild_test_runs(cursor: sqlite3.Cursor, recreate_views: Callable[[sqlite3.Cursor], None]) -> None:
    create_sql = cursor.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'test_runs'").fetchone()[0]
    if _unique_has_clients(create_sql):
        return
    log_info("Rebuilding test_runs to add clients to the unique key")
    # sqlite3 runs DDL outside its implicit transactions: the savepoint makes the rebuild all-or-nothing
    cursor.execute("SAVEPOINT rebuild_test_runs")
    try:
        _rebuild(cursor, create_sql, recreate_views)
    except BaseException:
        cursor.execute("ROLLBACK TO rebuild_test_runs")
        cursor.execute("RELEASE rebuild_test_runs")
        raise
    cursor.execute("RELEASE rebuild_test_runs")


def _rebuild(cursor: sqlite3.Cursor, create_sql: str, recreate_views: Callable[[sqlite3.Cursor], None]) -> None:
    indexes = [row[0] for row in cursor.execute("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'test_runs' AND sql IS NOT NULL")]
    views = [(row[0], row[1]) for row in cursor.execute("SELECT name, sql FROM sqlite_master WHERE type = 'view'")]
    new_sql = UNIQUE_PATTERN.sub(lambda match: f"UNIQUE({match.group(1).rstrip()}, clients)", create_sql, count=1)
    new_sql = re.sub(r"CREATE TABLE\s+\"?test_runs\"?", "CREATE TABLE test_runs__rebuild", new_sql, count=1, flags=re.IGNORECASE)
    for name, _ in views:
        cursor.execute(f'DROP VIEW IF EXISTS "{name}"')
    cursor.execute("DROP TABLE IF EXISTS test_runs__rebuild")
    cursor.execute(new_sql)
    columns = ", ".join(_columns(cursor, "test_runs"))
    cursor.execute(f"INSERT INTO test_runs__rebuild ({columns}) SELECT {columns} FROM test_runs")
    # Keep the AUTOINCREMENT counter: ids of deleted rows must not be handed out again
    sequence = cursor.execute("SELECT seq FROM sqlite_sequence WHERE name = 'test_runs'").fetchone()
    cursor.execute("DROP TABLE test_runs")
    cursor.execute("ALTER TABLE test_runs__rebuild RENAME TO test_runs")
    if sequence is not None:
        cursor.execute("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'test_runs'", (sequence[0],))
        if cursor.rowcount == 0:
            cursor.execute("INSERT INTO sqlite_sequence (name, seq) VALUES ('test_runs', ?)", (sequence[0],))
    for index_sql in indexes:
        cursor.execute(index_sql)
    for _, view_sql in views:
        cursor.execute(view_sql)
    recreate_views(cursor)  # views of the current schema version (CREATE VIEW IF NOT EXISTS)


def migrate_clients(cursor: sqlite3.Cursor, recreate_views: Callable[[sqlite3.Cursor], None]) -> None:
    """Add multi-client columns, `clients` in the test_runs unique key and the client_results table (idempotent)."""
    for table in ("test_runs_all", "test_runs"):
        _add_columns(cursor, table)
    if _columns(cursor, "test_runs"):
        _rebuild_test_runs(cursor, recreate_views)
    cursor.execute(CLIENT_RESULTS_SQL)
    cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{CLIENT_RESULTS_TABLE}_test_run ON {CLIENT_RESULTS_TABLE}(test_run_id)")
    cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{CLIENT_RESULTS_TABLE}_ramp ON {CLIENT_RESULTS_TABLE}(ramp_uuid)")
    for table in ("test_runs_all", "test_runs"):
        if "ramp_uuid" in _columns(cursor, table):
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_ramp_uuid ON {table}(ramp_uuid)")
