"""Migration for multi-client (fio client mode) runs: new columns and `clients` in the latest-table unique key."""

import sqlite3

from database.client_migration import CLIENT_RESULTS_TABLE, migrate_clients

OLD_TEST_RUNS = """
CREATE TABLE test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    hostname TEXT, protocol TEXT, drive_type TEXT, drive_model TEXT,
    block_size TEXT, read_write_pattern TEXT, queue_depth INTEGER, num_jobs INTEGER,
    direct INTEGER, test_size TEXT, sync TEXT, iodepth INTEGER, duration INTEGER,
    iops REAL,
    UNIQUE(hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth, num_jobs, direct, test_size, sync, iodepth, duration)
)
"""
CONFIG = ("h", "local", "ssd", "m", "4K", "randread", 1, 1, 1, "1G", "none", 1, 60)
INSERT = (
    "INSERT OR REPLACE INTO test_runs (timestamp, hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, "
    "queue_depth, num_jobs, direct, test_size, sync, iodepth, duration, iops{extra}) VALUES ('t', ?,?,?,?,?,?,?,?,?,?,?,?,?, ?{marks})"
)


def old_db() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.execute(OLD_TEST_RUNS)
    db.execute("CREATE TABLE test_runs_all (id INTEGER PRIMARY KEY, hostname TEXT, iops REAL)")
    db.execute("CREATE INDEX idx_test_runs_config_lookup ON test_runs (hostname, protocol, drive_type, drive_model)")
    db.execute("CREATE VIEW latest_test_per_server AS SELECT id, hostname FROM test_runs")
    db.execute(INSERT.format(extra="", marks=""), (*CONFIG, 100.0))
    db.execute("INSERT INTO test_runs_all (hostname, iops) VALUES ('h', 100.0)")
    return db


def recreate_view(cursor: sqlite3.Cursor) -> None:
    cursor.execute("CREATE VIEW IF NOT EXISTS latest_test_per_server AS SELECT id, hostname FROM test_runs")


def test_existing_rows_get_clients_1_and_keep_their_data() -> None:
    db = old_db()
    migrate_clients(db.cursor(), recreate_view)
    assert db.execute("SELECT clients, iops FROM test_runs").fetchall() == [(1, 100.0)]
    assert db.execute("SELECT clients FROM test_runs_all").fetchall() == [(1,)]


def test_unique_key_includes_clients() -> None:
    """A 4-client result must not replace the 1-client result of the same configuration."""
    db = old_db()
    migrate_clients(db.cursor(), recreate_view)
    db.execute(INSERT.format(extra=", clients", marks=", ?"), (*CONFIG, 400.0, 4))
    db.execute(INSERT.format(extra=", clients", marks=", ?"), (*CONFIG, 110.0, 1))
    assert db.execute("SELECT clients, iops FROM test_runs ORDER BY clients").fetchall() == [(1, 110.0), (4, 400.0)]


def test_indexes_and_view_survive_the_rebuild() -> None:
    db = old_db()
    migrate_clients(db.cursor(), recreate_view)
    names = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type IN ('index', 'view')")}
    assert {"idx_test_runs_config_lookup", "latest_test_per_server"} <= names
    assert db.execute("SELECT count(*) FROM latest_test_per_server").fetchone()[0] == 1


def test_migration_is_idempotent() -> None:
    db = old_db()
    migrate_clients(db.cursor(), recreate_view)
    migrate_clients(db.cursor(), recreate_view)
    columns = [row[1] for row in db.execute("PRAGMA table_info(test_runs)")]
    assert columns.count("clients") == 1 and "ramp_uuid" in columns and "client_hosts" in columns
    assert db.execute("SELECT count(*) FROM test_runs").fetchone()[0] == 1


def test_client_results_table_is_created() -> None:
    db = old_db()
    migrate_clients(db.cursor(), recreate_view)
    columns = [row[1] for row in db.execute(f"PRAGMA table_info({CLIENT_RESULTS_TABLE})")]
    assert {"test_run_id", "ramp_uuid", "client_host", "iops", "p95_latency", "storage_info", "error"} <= set(columns)


def old_db_file(path) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.execute(OLD_TEST_RUNS)
    db.execute("CREATE TABLE test_runs_all (id INTEGER PRIMARY KEY, hostname TEXT, iops REAL)")
    db.execute("CREATE VIEW latest_test_per_server AS SELECT id, hostname FROM test_runs")
    db.execute(INSERT.format(extra="", marks=""), (*CONFIG, 100.0))
    db.commit()
    return db


def test_failed_rebuild_leaves_the_old_table_on_disk(tmp_path) -> None:
    """A crash half-way (seen from a new connection) must leave the old table and no leftover rebuild table."""
    path = tmp_path / "old.db"
    db = old_db_file(path)

    def broken_views(cursor: sqlite3.Cursor) -> None:
        raise sqlite3.OperationalError("simulated crash")

    try:
        migrate_clients(db.cursor(), broken_views)
    except sqlite3.OperationalError:
        pass
    db.close()  # uncommitted work is discarded, as when the backend dies on startup

    reopened = sqlite3.connect(path)
    tables = {row[0] for row in reopened.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")}
    assert "test_runs__rebuild" not in tables
    assert "latest_test_per_server" in tables
    assert reopened.execute("SELECT count(*) FROM test_runs").fetchone()[0] == 1
    assert "clients" not in reopened.execute("SELECT sql FROM sqlite_master WHERE name = 'test_runs'").fetchone()[0].split("UNIQUE")[1]
    migrate_clients(reopened.cursor(), recreate_view)  # the next start retries
    reopened.commit()
    assert "clients" in reopened.execute("SELECT sql FROM sqlite_master WHERE name = 'test_runs'").fetchone()[0].split("UNIQUE")[1]


def test_rebuild_keeps_the_autoincrement_sequence() -> None:
    """Ids of deleted rows must not be handed out again (raw download links and URLs reference ids)."""
    db = old_db()
    db.execute("UPDATE sqlite_sequence SET seq = 500 WHERE name = 'test_runs'")
    migrate_clients(db.cursor(), recreate_view)
    assert db.execute("SELECT seq FROM sqlite_sequence WHERE name = 'test_runs'").fetchone()[0] == 500
