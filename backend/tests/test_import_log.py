"""Tests for the import log: every upload attempt is recorded, and counts per run_uuid are queryable."""

import asyncio
import json
import sqlite3
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_uploader, require_viewer
from config.settings import settings
from database.connection import get_db
from database.import_log import ensure_import_log_table, record_import
from routers import import_log, imports

FIO_JSON = {
    "fio version": "fio-3.36",
    "global options": {},
    "jobs": [
        {
            "jobname": "t",
            "job options": {"rw": "randread", "bs": "4k", "iodepth": "1", "numjobs": "1", "sync": "1"},
            "read": {"iops": 100.0, "bw": 400, "clat_ns": {"mean": 1000.0, "percentile": {}}},
            "write": {"iops": 0.0, "bw": 0, "clat_ns": {"mean": 0.0, "percentile": {}}},
        }
    ],
}


def make_db() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", check_same_thread=False)
    connection.row_factory = sqlite3.Row
    ensure_import_log_table(connection.cursor())
    for table in ("test_runs_all", "saturation_runs"):
        connection.execute(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, run_uuid TEXT)")
    return connection


def test_table_creation_is_idempotent() -> None:
    connection = make_db()
    ensure_import_log_table(connection.cursor())
    assert connection.execute("SELECT count(*) FROM import_log").fetchone()[0] == 0


def test_record_import_never_raises_on_broken_db() -> None:
    connection = sqlite3.connect(":memory:")  # no import_log table
    record_import(connection, status="imported", username="u", run_uuid="r")  # must not raise


@pytest.fixture
def upload_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path / "uploads")
    settings.upload_dir.mkdir()
    db = make_db()
    calls = {}

    def fake_insert(db_, data, path):
        calls["inserted"] = data["run_uuid"]
        return 42

    async def no_flags(data):
        return None

    monkeypatch.setattr(imports, "insert_test_run", fake_insert)
    monkeypatch.setattr(imports, "insert_saturation_run", lambda db_, data, path: 7)
    monkeypatch.setattr(imports.db_manager, "update_latest_flags", no_flags)
    return db


def upload(db: sqlite3.Connection, content: bytes, filename: str = "r.json", run_uuid: str = "run-1", description: str = "x") -> httpx.Response:
    app = FastAPI()
    app.include_router(imports.router, prefix="/api/import")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_uploader] = lambda: User("robot", "uploader")
    form = {"drive_model": "m", "drive_type": "ssd", "hostname": "h1", "protocol": "local", "description": description, "run_uuid": run_uuid}

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.post("/api/import/", data=form, files={"file": (filename, content, "application/json")})

    return asyncio.run(call())


def log_rows(db: sqlite3.Connection) -> list[dict]:
    return [dict(row) for row in db.execute("SELECT * FROM import_log ORDER BY id")]


def test_successful_upload_is_logged(upload_env: sqlite3.Connection) -> None:
    assert upload(upload_env, json.dumps(FIO_JSON).encode()).status_code == 200
    [row] = log_rows(upload_env)
    assert (row["status"], row["http_status"], row["run_uuid"], row["username"], row["hostname"]) == ("imported", 200, "run-1", "robot", "h1")
    assert (row["target_table"], row["test_run_id"]) == ("test_runs", 42)


def test_saturation_upload_is_logged_with_its_table(upload_env: sqlite3.Connection) -> None:
    upload(upload_env, json.dumps(FIO_JSON).encode(), description="saturation-test,hostname:h1")
    [row] = log_rows(upload_env)
    assert (row["target_table"], row["test_run_id"]) == ("saturation_runs", 7)


def test_rejected_upload_is_logged(upload_env: sqlite3.Connection) -> None:
    response = upload(upload_env, b"{not json")
    assert response.status_code == 400
    [row] = log_rows(upload_env)
    assert (row["status"], row["http_status"], row["run_uuid"]) == ("rejected", 400, "run-1")
    assert "Invalid JSON" in row["detail"]
    assert row["filename"] == "r.json"


def test_unexpected_error_is_logged(upload_env: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(imports, "insert_test_run", boom)
    assert upload(upload_env, json.dumps(FIO_JSON).encode()).status_code == 500
    [row] = log_rows(upload_env)
    assert (row["status"], row["http_status"]) == ("error", 500)


def get(db: sqlite3.Connection, path: str) -> httpx.Response:
    app = FastAPI()
    app.include_router(import_log.router, prefix="/api/import-log")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_viewer] = lambda: User("viewer", "viewer")

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(call())


def test_run_summary_counts_log_and_stored_rows() -> None:
    db = make_db()
    for status, code in (("imported", 200), ("imported", 200), ("rejected", 400), ("error", 500)):
        record_import(db, status=status, http_status=code, username="robot", run_uuid="run-9", hostname="h1", filename=f"{status}.json")
    record_import(db, status="imported", http_status=200, username="robot", run_uuid="other")
    db.executemany("INSERT INTO test_runs_all (run_uuid) VALUES (?)", [("run-9",), ("run-9",)])
    db.execute("INSERT INTO saturation_runs (run_uuid) VALUES ('run-9')")

    body = get(db, "/api/import-log/runs/run-9").json()
    assert body["counts"] == {"imported": 2, "rejected": 1, "error": 1, "total": 4}
    assert body["stored"] == {"history": 2, "saturation": 1}
    assert [entry["status"] for entry in body["failures"]] == ["rejected", "error"]
    assert body["hostnames"] == ["h1"]


def test_run_without_log_but_with_data_still_reports_stored_rows() -> None:
    db = make_db()
    db.execute("INSERT INTO test_runs_all (run_uuid) VALUES ('old-run')")
    body = get(db, "/api/import-log/runs/old-run").json()
    assert body["counts"]["total"] == 0
    assert body["stored"] == {"history": 1, "saturation": 0}


def test_unknown_run_is_404() -> None:
    assert get(make_db(), "/api/import-log/runs/nope").status_code == 404


def test_list_filters_by_status_and_run() -> None:
    db = make_db()
    record_import(db, status="rejected", http_status=400, username="robot", run_uuid="a")
    record_import(db, status="imported", http_status=200, username="robot", run_uuid="a")
    record_import(db, status="rejected", http_status=400, username="robot", run_uuid="b")
    body = get(db, "/api/import-log/?status=rejected&run_uuid=a").json()
    assert [(entry["run_uuid"], entry["status"]) for entry in body["entries"]] == [("a", "rejected")]


def test_invalid_status_filter_is_422() -> None:
    assert get(make_db(), "/api/import-log/?status=weird").status_code == 422


def test_failed_import_does_not_persist_partial_rows(upload_env: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    """Logging the failure must not commit a half-finished import."""

    def half_insert(db_, data, path):
        db_.execute("INSERT INTO test_runs_all (run_uuid) VALUES ('partial')")
        raise sqlite3.IntegrityError("unique constraint")

    monkeypatch.setattr(imports, "insert_test_run", half_insert)
    assert upload(upload_env, json.dumps(FIO_JSON).encode()).status_code == 500
    assert upload_env.execute("SELECT count(*) FROM test_runs_all").fetchone()[0] == 0
    assert [row["status"] for row in log_rows(upload_env)] == ["error"]


def test_overlong_run_uuid_is_rejected(upload_env: sqlite3.Connection) -> None:
    assert upload(upload_env, json.dumps(FIO_JSON).encode(), run_uuid="x" * 65).status_code == 422
