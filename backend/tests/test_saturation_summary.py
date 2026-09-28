"""Tests for the per-run saturation summary (best step within threshold, first step above it)."""

import asyncio
import sqlite3

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_viewer
from database.connection import get_db
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
    app.dependency_overrides[require_viewer] = lambda: User("px1", "viewer")

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
        "description TEXT, latency_threshold_ms REAL)"
    )
    for qd, p95 in ((1, 5.0), (2, 25.0)):
        db.execute(
            "INSERT INTO saturation_runs (timestamp, hostname, read_write_pattern, block_size, iodepth, num_jobs, iops, p95_latency, "
            "run_uuid, latency_threshold_ms) VALUES ('t', 'px1', 'randread', '4K', ?, 1, 100, ?, 'run-1', ?)",
            (qd, p95, threshold),
        )
    app = FastAPI()
    app.include_router(test_runs.router, prefix="/api/test-runs")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_viewer] = lambda: User("px1", "viewer")

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
