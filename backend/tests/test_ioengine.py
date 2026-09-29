"""fio I/O engine per test run: extraction at import, storage_info fallback and the startup backfill."""

import asyncio
import json
import sqlite3
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_admin, require_uploader
from config.settings import settings
from database.client_migration import UNIQUE_PATTERN
from database.connection import DatabaseManager, get_db
from database.ioengine_migration import IOENGINE_TABLES, migrate_ioengine
from routers import imports
from utils.ioengine import extract_ioengine, ioengine_from_fio_json, ioengine_from_storage_info, normalize_ioengine

CLIENT_FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "fio_client_mode_2clients.json").read_text())


def local_output(**job_options: str) -> dict:
    """Minimal local fio JSON; fio-test.sh passes the engine on the command line (job options)."""
    options = {"rw": "randread", "bs": "4k", "iodepth": "1", "numjobs": "1", "direct": "1", "size": "1G", "runtime": "10", **job_options}
    return {
        "fio version": "fio-3.36",
        "global options": {},
        "jobs": [{"jobname": "randread_4k", "job options": options, "read": {"iops": 1000.0, "bw": 4000}, "write": {"iops": 0, "bw": 0}}],
    }


@pytest.fixture
def manager(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path / "uploads")
    monkeypatch.setattr(DatabaseManager, "_populate_sample_data", lambda self, cursor: asyncio.sleep(0))
    db_manager = DatabaseManager()
    db_manager.db_path = tmp_path / "test.db"
    asyncio.run(db_manager.connect())
    monkeypatch.setattr(imports, "db_manager", db_manager)
    yield db_manager
    asyncio.run(db_manager.close())


def app_for(db_manager: DatabaseManager) -> FastAPI:
    app = FastAPI()
    app.include_router(imports.router, prefix="/api/import")
    app.dependency_overrides[get_db] = lambda: db_manager.connection
    app.dependency_overrides[require_uploader] = lambda: User("robot", "uploader")
    app.dependency_overrides[require_admin] = lambda: User("admin", "admin")
    return app


def upload(db_manager: DatabaseManager, fio_output: dict, **fields: str) -> httpx.Response:
    form = {"drive_model": "m", "drive_type": "ssd", "hostname": "h1", "protocol": "local", "description": "d", "run_uuid": "run-1", **fields}

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for(db_manager)), base_url="http://test") as client:
            files = {"file": ("step.json", json.dumps(fio_output).encode(), "application/json")}
            return await client.post("/api/import/", data=form, files=files)

    return asyncio.run(call())


def bulk_import(db_manager: DatabaseManager) -> httpx.Response:
    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for(db_manager)), base_url="http://test") as client:
            return await client.post("/api/import/bulk", json={"overwrite": False, "dryRun": False})

    return asyncio.run(call())


def engines(db: sqlite3.Connection, table: str = "test_runs_all") -> list:
    return [row[0] for row in db.execute(f"SELECT ioengine FROM {table} ORDER BY id")]


# --- extraction -------------------------------------------------------------


@pytest.mark.parametrize("raw, expected", [(" IO_URING ", "io_uring"), ("libaio", "libaio"), ("", None), ("  ", None), (None, None), (5, None), ("a b", None), ("x" * 65, None)])
def test_normalize_ioengine(raw: object, expected: str | None) -> None:
    assert normalize_ioengine(raw) == expected


def test_job_options_win_over_global_options() -> None:
    assert extract_ioengine({"ioengine": "io_uring"}, {"ioengine": "libaio"}) == "io_uring"
    assert extract_ioengine({}, {"ioengine": "LibAIO"}) == "libaio"
    assert extract_ioengine({"ioengine": ""}, {"ioengine": "psync"}) == "psync"
    assert extract_ioengine({}, {}) is None


def test_storage_info_engine() -> None:
    assert ioengine_from_storage_info('{"ioengine":"io_uring"}') == "io_uring"
    assert ioengine_from_storage_info('{"fs_type":"zfs"}') is None
    assert ioengine_from_storage_info("{broken") is None
    assert ioengine_from_storage_info(None) is None


def test_engine_from_stored_fio_json() -> None:
    assert ioengine_from_fio_json(json.dumps(local_output(ioengine="libaio"))) == "libaio"
    assert ioengine_from_fio_json(json.dumps(CLIENT_FIXTURE)) == "psync"
    assert ioengine_from_fio_json("not json") is None
    assert ioengine_from_fio_json("[]") is None


def test_extract_test_run_data_reads_engine() -> None:
    assert imports.extract_test_run_data(local_output(ioengine="io_uring"), "f.json")["ioengine"] == "io_uring"
    assert imports.extract_test_run_data(CLIENT_FIXTURE, "f.json")["ioengine"] == "psync"
    assert imports.extract_test_run_data(local_output(), "f.json")["ioengine"] is None


# --- import -----------------------------------------------------------------


def test_single_upload_stores_engine_from_job_options(manager: DatabaseManager) -> None:
    storage = json.dumps({"ioengine": "libaio"})  # the detected engine loses against the one fio actually used
    assert upload(manager, local_output(ioengine="IO_URING"), storage_info=storage).status_code == 200
    assert engines(manager.connection) == ["io_uring"]
    assert engines(manager.connection, "test_runs") == ["io_uring"]


def test_single_upload_falls_back_to_storage_info(manager: DatabaseManager) -> None:
    assert upload(manager, local_output(), storage_info=json.dumps({"ioengine": " LibAIO "})).status_code == 200
    assert engines(manager.connection) == ["libaio"]


def test_upload_without_any_engine_stores_null(manager: DatabaseManager) -> None:
    assert upload(manager, local_output()).status_code == 200
    assert engines(manager.connection) == [None]


def test_client_mode_upload_stores_engine_from_global_options(manager: DatabaseManager) -> None:
    assert upload(manager, CLIENT_FIXTURE, client_hosts="vm1,vm2", description="clients:2").status_code == 200
    assert engines(manager.connection) == ["psync"]
    assert engines(manager.connection, "test_runs") == ["psync"]


def test_saturation_upload_stores_engine(manager: DatabaseManager) -> None:
    assert upload(manager, local_output(ioengine="libaio"), description="saturation-test,step:1,target_latency:100").status_code == 200
    assert engines(manager.connection, "saturation_runs") == ["libaio"]


def test_bulk_import_stores_engine(manager: DatabaseManager) -> None:
    assert upload(manager, local_output(ioengine="io_uring")).status_code == 200
    assert upload(manager, CLIENT_FIXTURE, hostname="h2", client_hosts="vm1,vm2").status_code == 200
    db = manager.connection
    db.execute("DELETE FROM test_runs_all")
    db.execute("DELETE FROM test_runs")
    db.commit()
    response = bulk_import(manager)
    assert response.status_code == 200, response.text
    assert response.json()["statistics"]["totalTestRuns"] == 2
    assert sorted(engines(db)) == ["io_uring", "psync"]


# --- startup backfill -------------------------------------------------------


def old_schema_db() -> sqlite3.Connection:
    """Test-run tables as they were before the ioengine column existed."""
    db = sqlite3.connect(":memory:")
    for table in IOENGINE_TABLES:
        db.execute(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, storage_info TEXT, uploaded_file_path TEXT)")
    return db


def test_backfill_from_storage_info_and_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(settings, "upload_dir", uploads)
    client_file = uploads / "client.json"
    client_file.write_text(json.dumps(CLIENT_FIXTURE))
    outside = tmp_path / "outside.json"
    outside.write_text(json.dumps(local_output(ioengine="libaio")))
    db = old_schema_db()
    rows = [
        ('{"ioengine":"IO_URING"}', None),  # engine detected by fio-test.sh
        ('{"ioengine":""}', None),  # empty -> stays NULL
        ('{"ioengine":5}', None),  # not a string -> stays NULL
        ("{broken", None),  # malformed storage_info must not break the startup
        (None, str(client_file)),  # client run: engine from the stored fio JSON (global options)
        (None, str(outside)),  # outside the upload directory: never read
        (None, str(uploads / "missing.json")),
        ('{"ioengine":"libaio"}', str(client_file)),  # storage_info wins, the file is not needed
    ]
    for table in IOENGINE_TABLES:
        db.executemany(f"INSERT INTO {table} (storage_info, uploaded_file_path) VALUES (?, ?)", rows)
    migrate_ioengine(db.cursor())
    expected = ["io_uring", None, None, None, "psync", None, None, "libaio"]
    for table in IOENGINE_TABLES:
        assert engines(db, table) == expected


def test_backfill_is_idempotent_and_reads_uploads_only_once(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(settings, "upload_dir", uploads)
    db = old_schema_db()
    migrate_ioengine(db.cursor())
    client_file = uploads / "client.json"
    client_file.write_text(json.dumps(CLIENT_FIXTURE))
    db.execute("INSERT INTO test_runs (storage_info, uploaded_file_path) VALUES (?, ?)", ('{"ioengine":"libaio"}', None))
    db.execute("INSERT INTO test_runs (storage_info, uploaded_file_path) VALUES (?, ?)", (None, str(client_file)))
    migrate_ioengine(db.cursor())  # second startup: storage_info backfill again, no file scan
    assert engines(db, "test_runs") == ["libaio", None]
    for table in IOENGINE_TABLES:
        columns = [row[1] for row in db.execute(f"PRAGMA table_info({table})")]
        assert columns.count("ioengine") == 1


def test_migration_skips_missing_tables() -> None:
    migrate_ioengine(sqlite3.connect(":memory:").cursor())


def test_real_schema_has_ioengine_everywhere(manager: DatabaseManager) -> None:
    for table in IOENGINE_TABLES:
        assert "ioengine" in [row[1] for row in manager.connection.execute(f"PRAGMA table_info({table})")]
    create_sql = manager.connection.execute("SELECT sql FROM sqlite_master WHERE name = 'test_runs'").fetchone()[0]
    unique = [part.strip() for part in UNIQUE_PATTERN.search(create_sql).group(1).split(",")]
    assert "clients" in unique and "ioengine" not in unique  # NULL engines would never conflict in a UNIQUE key
