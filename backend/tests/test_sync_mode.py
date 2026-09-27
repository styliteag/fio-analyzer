"""Tests for fio sync mode handling (stored as text: none, sync, dsync)."""

import sqlite3

import pytest
from fastapi import HTTPException

from database.sync_migration import migrate_sync_to_text
from routers.imports import extract_test_run_data
from utils.sync_mode import normalize_sync, parse_sync_filter


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, "none"),
        ("", "none"),
        (0, "none"),
        ("0", "none"),
        ("none", "none"),
        (1, "sync"),
        ("1", "sync"),
        ("sync", "sync"),
        ("dsync", "dsync"),
        (" DSync ", "dsync"),
    ],
)
def test_normalize_sync_accepts_fio_values(raw: object, expected: str) -> None:
    assert normalize_sync(raw) == expected


def test_normalize_sync_rejects_unknown_value() -> None:
    with pytest.raises(ValueError, match="Unsupported sync value"):
        normalize_sync("osync")


def test_parse_sync_filter_accepts_names_and_legacy_numbers() -> None:
    assert parse_sync_filter("1, dsync,none") == ["sync", "dsync", "none"]


def test_parse_sync_filter_rejects_unknown_value_with_400() -> None:
    with pytest.raises(HTTPException) as error:
        parse_sync_filter("bogus")
    assert error.value.status_code == 400


def fio_json(sync: str) -> dict:
    return {
        "fio version": "fio-3.36",
        "global options": {},
        "jobs": [
            {
                "jobname": "test",
                "job options": {"rw": "randread", "bs": "4k", "iodepth": "1", "numjobs": "1", "sync": sync},
                "read": {"iops": 100.0, "bw": 400, "clat_ns": {"mean": 1000.0, "percentile": {}}},
                "write": {"iops": 0.0, "bw": 0, "clat_ns": {"mean": 0.0, "percentile": {}}},
            }
        ],
    }


def test_import_with_dsync_no_longer_fails() -> None:
    data = extract_test_run_data(fio_json("dsync"), "result.json")
    assert data["sync"] == "dsync"


def test_import_rejects_unknown_sync_with_400() -> None:
    with pytest.raises(HTTPException) as error:
        extract_test_run_data(fio_json("weird"), "result.json")
    assert error.value.status_code == 400


def make_legacy_db() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    for table in ("test_runs", "test_runs_all", "saturation_runs"):
        connection.execute(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, sync INTEGER)")
        connection.executemany(f"INSERT INTO {table} (sync) VALUES (?)", [(0,), (1,), (None,)])
    return connection


def test_migration_converts_numeric_sync_to_text_and_is_idempotent() -> None:
    connection = make_legacy_db()
    cursor = connection.cursor()

    migrate_sync_to_text(cursor)
    migrate_sync_to_text(cursor)

    for table in ("test_runs", "test_runs_all", "saturation_runs"):
        rows = cursor.execute(f"SELECT sync, typeof(sync) FROM {table} ORDER BY id").fetchall()
        assert rows == [("none", "text"), ("sync", "text"), (None, "null")]
    connection.close()


def test_migration_skips_missing_tables() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE test_runs (id INTEGER PRIMARY KEY, sync INTEGER)")
    migrate_sync_to_text(connection.cursor())
    connection.close()


def call_route(router_module, prefix: str, path: str) -> int:
    """Call a list route in-process with auth and DB stubbed out; returns the status code."""
    import asyncio

    import httpx
    from fastapi import FastAPI

    from auth.middleware import User, require_admin
    from database.connection import get_db

    app = FastAPI()
    app.include_router(router_module.router, prefix=prefix)
    app.dependency_overrides[require_admin] = lambda: User("admin", "admin")
    app.dependency_overrides[get_db] = lambda: sqlite3.connect(":memory:", check_same_thread=False)

    async def call() -> int:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return (await client.get(path)).status_code

    return asyncio.run(call())


@pytest.mark.parametrize(
    ("prefix", "path"),
    [
        ("/api/test-runs", "/api/test-runs/?syncs=bogus"),
        ("/api/time-series", "/api/time-series/all?syncs=bogus"),
        ("/api/time-series", "/api/time-series/history?sync=bogus"),
    ],
)
def test_unknown_sync_filter_is_a_400_not_a_500(prefix: str, path: str) -> None:
    from routers import test_runs, time_series

    module = test_runs if prefix == "/api/test-runs" else time_series
    assert call_route(module, prefix, path) == 400
