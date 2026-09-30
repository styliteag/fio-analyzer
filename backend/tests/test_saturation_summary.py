"""Tests for the per-run saturation summary (best step within threshold, first step above it)."""

import asyncio
import sqlite3

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_viewer
from database.connection import get_db
from database.client_migration import add_saturation_client_columns
from database.saturation_migration import add_threshold_column
from routers import saturation

COLUMNS = "id, run_uuid, hostname, read_write_pattern, block_size, sync, iodepth, num_jobs, iops, p95_latency, bandwidth, latency_threshold_ms"


def make_db(threshold: float | None = 20.0) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:", check_same_thread=False)
    db.execute(
        "CREATE TABLE saturation_runs (id INTEGER PRIMARY KEY, run_uuid TEXT, hostname TEXT, read_write_pattern TEXT, "
        "block_size TEXT, sync TEXT, iodepth INTEGER, num_jobs INTEGER, iops REAL, p95_latency REAL, bandwidth REAL)"
    )
    add_threshold_column(db.cursor())
    add_saturation_client_columns(db.cursor())
    steps = [
        # randread: best within 20 ms is step 3 (QD 16), step 4 crosses
        ("run-1", "randread", 1, 4, 1000.0, 1.0),
        ("run-1", "randread", 2, 4, 2000.0, 3.0),
        ("run-1", "randread", 4, 4, 3000.0, 19.9),
        ("run-1", "randread", 8, 4, 3100.0, 25.0),
        # write: IOPS drop in the last step within threshold -> best is the highest IOPS, not the last step
        ("run-1", "write", 1, 4, 500.0, 2.0),
        ("run-1", "write", 2, 4, 900.0, 5.0),
        ("run-1", "write", 4, 4, 800.0, 10.0),
        # randwrite: never crosses
        ("run-1", "randwrite", 1, 4, 100.0, 1.0),
        ("run-1", "randwrite", 2, 4, 150.0, 2.0),
    ]
    for index, (run, pattern, iodepth, jobs, iops, p95) in enumerate(steps, start=1):
        db.execute(
            f"INSERT INTO saturation_runs ({COLUMNS}) VALUES (?, ?, 'px1', ?, '4K', 'sync', ?, ?, ?, ?, ?, ?)",
            (index, run, pattern, iodepth, jobs, iops, p95, iops * 4 / 1024, threshold),
        )
    return db


def get(db: sqlite3.Connection, path: str) -> httpx.Response:
    app = FastAPI()
    app.include_router(saturation.router, prefix="/api/saturation")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_viewer] = lambda: User("viewer", "viewer")

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(call())


def by_pattern(body: dict) -> dict:
    return {entry["read_write_pattern"]: entry for entry in body["patterns"]}


def test_best_step_within_threshold_and_crossing_step() -> None:
    body = get(make_db(), "/api/saturation/runs/run-1/summary").json()
    assert body["threshold_ms"] == 20.0
    assert body["threshold_source"] == "stored"
    randread = by_pattern(body)["randread"]
    assert randread["status"] == "saturated"
    assert (randread["best_within"]["total_qd"], randread["best_within"]["iops"], randread["best_within"]["p95_latency"]) == (16, 3000.0, 19.9)
    assert (randread["crossed_at"]["total_qd"], randread["crossed_at"]["p95_latency"]) == (32, 25.0)
    assert randread["steps"] == 4


def test_best_is_highest_iops_not_last_step() -> None:
    write = by_pattern(get(make_db(), "/api/saturation/runs/run-1/summary").json())["write"]
    assert write["best_within"]["total_qd"] == 8
    assert write["status"] == "not_reached"
    assert write["crossed_at"] is None


def test_query_threshold_overrides_stored_value() -> None:
    body = get(make_db(), "/api/saturation/runs/run-1/summary?threshold_ms=4").json()
    assert body["threshold_source"] == "query"
    randread = by_pattern(body)["randread"]
    assert randread["best_within"]["total_qd"] == 8
    assert randread["crossed_at"]["total_qd"] == 16


def test_old_runs_without_stored_threshold_need_the_parameter() -> None:
    db = make_db(threshold=None)
    assert get(db, "/api/saturation/runs/run-1/summary").status_code == 400
    assert get(db, "/api/saturation/runs/run-1/summary?threshold_ms=20").status_code == 200


def test_no_step_within_threshold() -> None:
    randread = by_pattern(get(make_db(), "/api/saturation/runs/run-1/summary?threshold_ms=0.5").json())["randread"]
    assert randread["best_within"] is None
    assert randread["crossed_at"]["total_qd"] == 4


def test_unknown_run_is_404() -> None:
    assert get(make_db(), "/api/saturation/runs/nope/summary").status_code == 404


def test_invalid_threshold_is_422() -> None:
    assert get(make_db(), "/api/saturation/runs/run-1/summary?threshold_ms=-1").status_code == 422


def test_threshold_column_migration_is_idempotent() -> None:
    db = make_db()
    add_threshold_column(db.cursor())
    columns = [row[1] for row in db.execute("PRAGMA table_info(saturation_runs)")]
    assert columns.count("latency_threshold_ms") == 1


def test_migration_skips_missing_table() -> None:
    add_threshold_column(sqlite3.connect(":memory:").cursor())


@pytest.mark.parametrize("value", ["20", "20.5"])
def test_import_stores_threshold_for_saturation_uploads(value: str) -> None:
    from routers.imports import threshold_from_form

    assert threshold_from_form(value) == float(value)


@pytest.mark.parametrize("value", [None, "", "abc", "-1", "0", "1e9"])
def test_import_ignores_invalid_threshold(value: str | None) -> None:
    from routers.imports import threshold_from_form

    assert threshold_from_form(value) is None


def saturation_data(threshold: float | None, query: str = "") -> dict:
    """Existing chart endpoint: must default to the stored threshold, not a fixed 100 ms."""
    from routers import test_runs

    db = sqlite3.connect(":memory:", check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute(
        "CREATE TABLE saturation_runs (id INTEGER PRIMARY KEY, timestamp TEXT, hostname TEXT, protocol TEXT, drive_type TEXT, "
        "drive_model TEXT, block_size TEXT, read_write_pattern TEXT, iodepth INTEGER, num_jobs INTEGER, iops REAL, "
        "avg_latency REAL, bandwidth REAL, p95_latency REAL, p99_latency REAL, config_uuid TEXT, run_uuid TEXT, "
        "description TEXT, latency_threshold_ms REAL, storage_info TEXT)"
    )
    add_saturation_client_columns(db.cursor())
    for qd, p95 in ((1, 5.0), (2, 25.0)):
        db.execute(
            "INSERT INTO saturation_runs (timestamp, hostname, read_write_pattern, block_size, iodepth, num_jobs, iops, p95_latency, "
            "run_uuid, latency_threshold_ms) VALUES ('t', 'px1', 'randread', '4K', ?, 1, 100, ?, 'run-1', ?)",
            (qd, p95, threshold),
        )
    app = FastAPI()
    app.include_router(test_runs.router, prefix="/api/test-runs")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_viewer] = lambda: User("viewer", "viewer")

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(f"/api/test-runs/saturation-data?run_uuid=run-1{query}")

    return asyncio.run(call()).json()


def test_chart_data_uses_stored_threshold() -> None:
    body = saturation_data(20.0)
    assert body["threshold_ms"] == 20.0
    assert body["patterns"]["randread"]["saturation_point"]["p95_latency_ms"] == 25.0


def test_chart_data_query_overrides_stored_threshold() -> None:
    assert saturation_data(20.0, "&threshold_ms=50")["threshold_ms"] == 50.0


def test_chart_data_falls_back_to_100_ms_for_old_runs() -> None:
    assert saturation_data(None)["threshold_ms"] == 100.0


def test_stored_threshold_is_taken_from_the_first_uploaded_step() -> None:
    from routers.saturation import stored_threshold

    rows = [{"id": 5, "latency_threshold_ms": 50.0}, {"id": 2, "latency_threshold_ms": None}, {"id": 3, "latency_threshold_ms": 20.0}]
    assert stored_threshold(rows) == 20.0
    assert stored_threshold([{"id": 1, "latency_threshold_ms": None}]) is None


def add_client_steps(db: sqlite3.Connection, run: str = "run-1", clients: int = 4) -> None:
    """Steps of a multi-client saturation run (fio-test.sh with CLIENTS) under the same run_uuid."""
    for index, (iodepth, iops, p95) in enumerate(((1, 4000.0, 2.0), (2, 7000.0, 8.0), (4, 7200.0, 30.0)), start=100):
        db.execute(
            f"INSERT INTO saturation_runs ({COLUMNS}, clients, client_hosts) "
            "VALUES (?, ?, 'px1', 'randread', '4K', 'sync', ?, 4, ?, ?, ?, 20.0, ?, ?)",
            (index, run, iodepth, iops, p95, iops * 4 / 1024, clients, '["vm1", "vm2", "vm3", "vm4"]'),
        )


def test_single_host_steps_default_to_one_client() -> None:
    body = get(make_db(), "/api/saturation/runs/run-1/summary").json()
    assert {entry["clients"] for entry in body["patterns"]} == {1}


def test_multi_client_steps_are_a_separate_group() -> None:
    db = make_db()
    add_client_steps(db)
    patterns = get(db, "/api/saturation/runs/run-1/summary").json()["patterns"]
    randread = {entry["clients"]: entry for entry in patterns if entry["read_write_pattern"] == "randread"}
    assert set(randread) == {1, 4}
    # single-host group unchanged by the client steps
    assert randread[1]["steps"] == 4
    assert randread[1]["best_within"]["iops"] == 3000.0
    # 4-client group: best within 20 ms is QD 8 per client, crossed at QD 16
    assert randread[4]["steps"] == 3
    assert (randread[4]["best_within"]["total_qd"], randread[4]["best_within"]["iops"]) == (8, 7000.0)
    assert randread[4]["crossed_at"]["total_qd"] == 16
    assert randread[4]["status"] == "saturated"


def test_saturation_client_columns_migration_is_idempotent() -> None:
    db = make_db()
    add_saturation_client_columns(db.cursor())
    columns = [row[1] for row in db.execute("PRAGMA table_info(saturation_runs)")]
    assert (columns.count("clients"), columns.count("client_hosts"), columns.count("ramp_uuid")) == (1, 1, 0)
    add_saturation_client_columns(sqlite3.connect(":memory:").cursor())  # no table: no-op


def test_chart_data_reports_client_count() -> None:
    body = saturation_data(20.0)
    assert body["clients"] == 1
    assert all(step["clients"] == 1 for step in body["patterns"]["randread"]["steps"])


def test_real_schema_stores_client_count_of_saturation_steps(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Full schema + migrations: a client-mode saturation upload keeps clients and client_hosts."""
    from database.connection import DatabaseManager
    from routers.imports import insert_saturation_run

    manager = DatabaseManager()
    manager.db_path = tmp_path / "test.db"
    monkeypatch.setattr(DatabaseManager, "_populate_sample_data", lambda self, cursor: asyncio.sleep(0))
    asyncio.run(manager.connect())
    db = manager.connection
    data = {
        "timestamp": "2025-06-31T20:00:00+00:00",
        "test_name": "t",
        "hostname": "px1-vms",
        "drive_type": "ssd",
        "drive_model": "m",
        "block_size": "4K",
        "read_write_pattern": "randread",
        "queue_depth": 16,
        "duration": 30,
        "iodepth": 16,
        "num_jobs": 4,
        "run_uuid": "r",
        "clients": 3,
        "client_hosts": '["vm1", "vm2", "vm3"]',
    }
    insert_saturation_run(db, data, "/tmp/sat.json")
    insert_saturation_run(db, {**data, "clients": None, "client_hosts": None}, "/tmp/sat2.json")
    rows = db.execute("SELECT clients, client_hosts FROM saturation_runs ORDER BY id").fetchall()
    assert [tuple(row) for row in rows] == [(3, '["vm1", "vm2", "vm3"]'), (1, None)]
    asyncio.run(manager.close())
