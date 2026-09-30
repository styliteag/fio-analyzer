"""Tests for downloading the stored raw fio JSON files."""

import asyncio
import io
import json
import sqlite3
import zipfile
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_viewer
from config.settings import settings
from database.connection import get_db
from routers import raw_data

TABLES = ("test_runs", "test_runs_all", "saturation_runs")


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    uploads = tmp_path / "uploads"
    (uploads / "h1" / "local").mkdir(parents=True)
    monkeypatch.setattr(settings, "upload_dir", uploads)

    def store(name: str, content: dict) -> str:
        path = uploads / "h1" / "local" / name
        path.write_text(json.dumps(content))
        # Stored paths come from the container (/app/uploads/...), not from this machine
        return f"/app/uploads/h1/local/{name}"

    db = sqlite3.connect(":memory:", check_same_thread=False)
    for table in TABLES:
        db.execute(
            f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, run_uuid TEXT, hostname TEXT, "
            "read_write_pattern TEXT, block_size TEXT, queue_depth INTEGER, uploaded_file_path TEXT)"
        )
    a = store("aaa_randread.json", {"jobs": ["a"]})
    b = store("bbb_write.json", {"jobs": ["b"]})
    s = store("sss_sat.json", {"jobs": ["s"]})
    db.execute("INSERT INTO test_runs VALUES (7, 'run-1', 'h1', 'randread', '4K', 1, ?)", (a,))
    db.execute("INSERT INTO test_runs_all VALUES (70, 'run-1', 'h1', 'randread', '4K', 1, ?)", (a,))
    db.execute("INSERT INTO test_runs_all VALUES (71, 'run-1', 'h1', 'write', '4K', 1, ?)", (b,))
    db.execute("INSERT INTO test_runs_all VALUES (72, 'run-1', 'h1', 'read', '4K', 1, '/app/uploads/h1/local/gone.json')")
    db.execute("INSERT INTO test_runs_all VALUES (73, 'run-evil', 'h1', 'read', '4K', 1, '/etc/passwd')")
    db.execute("INSERT INTO saturation_runs VALUES (5, 'run-sat', 'h1', 'randread', '4K', 8, ?)", (s,))
    return db


def get(db: sqlite3.Connection, path: str, user: User | None = User("viewer", "viewer")) -> httpx.Response:
    app = FastAPI()
    app.include_router(raw_data.router, prefix="/api/raw")
    app.dependency_overrides[get_db] = lambda: db
    if user:
        app.dependency_overrides[require_viewer] = lambda: user

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(call())


def test_download_single_latest_test_run(env: sqlite3.Connection) -> None:
    response = get(env, "/api/raw/test-runs/7")
    assert response.status_code == 200
    assert response.json() == {"jobs": ["a"]}
    assert "aaa_randread.json" in response.headers["content-disposition"]


def test_download_from_history_and_saturation_tables(env: sqlite3.Connection) -> None:
    assert get(env, "/api/raw/test-runs/71?source=history").json() == {"jobs": ["b"]}
    assert get(env, "/api/raw/test-runs/5?source=saturation").json() == {"jobs": ["s"]}


def test_unknown_id_or_missing_file_is_404(env: sqlite3.Connection) -> None:
    assert get(env, "/api/raw/test-runs/999").status_code == 404
    assert get(env, "/api/raw/test-runs/72?source=history").status_code == 404


def test_paths_outside_uploads_are_never_served(env: sqlite3.Connection) -> None:
    response = get(env, "/api/raw/test-runs/73?source=history")
    assert response.status_code == 404
    assert "root:" not in response.text


def test_invalid_source_is_rejected(env: sqlite3.Connection) -> None:
    assert get(env, "/api/raw/test-runs/7?source=users").status_code == 422


def test_zip_for_run_uuid_contains_all_files_and_an_index(env: sqlite3.Connection) -> None:
    response = get(env, "/api/raw/runs/run-1")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    names = sorted(archive.namelist())
    assert names == ["aaa_randread.json", "bbb_write.json", "index.json"]
    index = json.loads(archive.read("index.json"))
    assert index["run_uuid"] == "run-1"
    assert [entry["file"] for entry in index["files"]] == ["aaa_randread.json", "bbb_write.json"]
    assert index["missing"] == [{"source": "history", "id": 72}]


def test_zip_includes_saturation_runs(env: sqlite3.Connection) -> None:
    archive = zipfile.ZipFile(io.BytesIO(get(env, "/api/raw/runs/run-sat").content))
    assert "sss_sat.json" in archive.namelist()


def test_unknown_run_uuid_is_404(env: sqlite3.Connection) -> None:
    assert get(env, "/api/raw/runs/nope").status_code == 404


def test_requires_authentication(env: sqlite3.Connection) -> None:
    assert get(env, "/api/raw/test-runs/7", user=None).status_code == 401


def test_content_disposition_is_sanitized_for_hostile_run_uuid(env: sqlite3.Connection) -> None:
    evil = 'x"\r\nSet-Cookie: a=b'
    env.execute("INSERT INTO test_runs_all VALUES (80, ?, 'h1', 'read', '4K', 1, '/app/uploads/h1/local/aaa_randread.json')", (evil,))
    response = get(env, "/api/raw/runs/" + evil.replace("\r\n", "%0D%0A").replace('"', "%22").replace(" ", "%20"))
    assert response.status_code == 200
    assert "set-cookie" not in response.headers
    assert response.headers["content-disposition"] == 'attachment; filename="run_xSet-Cookieab.zip"'


def test_stored_file_named_index_json_does_not_clash(env: sqlite3.Connection, tmp_path: Path) -> None:
    (settings.upload_dir / "h1" / "local" / ("f" * 32 + "_index.json")).write_text("{}")
    env.execute(
        "INSERT INTO test_runs_all VALUES (81, 'run-idx', 'h1', 'read', '4K', 1, ?)",
        ("/app/uploads/h1/local/" + "f" * 32 + "_index.json",),
    )
    names = zipfile.ZipFile(io.BytesIO(get(env, "/api/raw/runs/run-idx").content)).namelist()
    assert names.count("index.json") == 1
    assert "f" * 32 + "_index.json" in names


def test_zip_is_refused_above_the_file_limit(env: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(raw_data, "MAX_ZIP_FILES", 1)
    assert get(env, "/api/raw/runs/run-1").status_code == 413
