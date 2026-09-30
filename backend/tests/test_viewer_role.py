"""Tests for the read-only viewer role."""

import asyncio
import sqlite3
from pathlib import Path

import bcrypt
import httpx
import pytest
from fastapi import FastAPI

import auth.authentication as authentication
from auth.middleware import User
from config.settings import settings
from database.connection import get_db
from routers import dashboard, test_runs, time_series, users, utils_router


def write_htpasswd(path: Path, username: str, password: str) -> None:
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode()
    path.write_text(f"{username}:{hashed}\n")


@pytest.fixture
def auth_files(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(settings, "htpasswd_path", tmp_path / ".htpasswd")
    monkeypatch.setattr(settings, "htuploaders_path", tmp_path / ".htuploaders")
    monkeypatch.setattr(settings, "htviewers_path", tmp_path / ".htviewers")
    write_htpasswd(tmp_path / ".htpasswd", "boss", "pw-admin")
    write_htpasswd(tmp_path / ".htuploaders", "robot", "pw-upload")
    write_htpasswd(tmp_path / ".htviewers", "viewer", "pw-view")
    authentication._auth_cache.clear()
    return tmp_path


def test_viewer_role_is_resolved_from_htviewers(auth_files: Path) -> None:
    assert authentication.get_user_role("viewer", "pw-view") == "viewer"
    assert authentication.get_user_role("viewer", "wrong") is None
    assert authentication.get_user_role("boss", "pw-admin") == "admin"
    assert authentication.get_user_role("robot", "pw-upload") == "uploader"


def make_db() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", check_same_thread=False)
    connection.row_factory = sqlite3.Row
    for table in ("test_runs", "test_runs_all"):
        connection.execute(
            f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, timestamp TEXT, hostname TEXT, protocol TEXT, "
            "drive_type TEXT, drive_model TEXT, iops REAL, avg_latency REAL, description TEXT)"
        )
    return connection


def build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(dashboard.router, prefix="/api/dashboard")
    app.include_router(test_runs.router, prefix="/api/test-runs")
    app.include_router(time_series.router, prefix="/api/time-series")
    app.include_router(utils_router.router, prefix="/api")
    app.include_router(users.router)
    connection = make_db()
    app.dependency_overrides[get_db] = lambda: connection
    return app


def request(method: str, path: str, auth: tuple[str, str] | None) -> httpx.Response:
    app = build_app()

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=auth) as client:
            return await client.request(method, path, json={} if method != "GET" else None)

    return asyncio.run(call())


VIEWER = ("viewer", "pw-view")
UPLOADER = ("robot", "pw-upload")
ADMIN = ("boss", "pw-admin")


@pytest.mark.parametrize("path", ["/api/dashboard/stats", "/api/test-runs/", "/api/time-series/servers", "/api/filters"])
def test_viewer_can_read(auth_files: Path, path: str) -> None:
    response = request("GET", path, VIEWER)
    assert response.status_code not in (401, 403), response.text


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("DELETE", "/api/test-runs/1"),
        ("PUT", "/api/test-runs/1"),
        ("PUT", "/api/test-runs/bulk"),
        ("DELETE", "/api/time-series/delete"),
        ("POST", "/api/time-series/history/cleanup"),
        ("GET", "/api/time-series/history/cleanup-preview"),
        ("GET", "/api/users/"),
    ],
)
def test_viewer_cannot_change_data_and_gets_403_not_401(auth_files: Path, method: str, path: str) -> None:
    """403 keeps the viewer logged in (the frontend logs out on 401)."""
    assert request(method, path, VIEWER).status_code == 403


def test_uploader_still_cannot_read(auth_files: Path) -> None:
    assert request("GET", "/api/test-runs/", UPLOADER).status_code == 403


def test_admin_can_still_read(auth_files: Path) -> None:
    assert request("GET", "/api/dashboard/stats", ADMIN).status_code == 200


def test_anonymous_gets_401(auth_files: Path) -> None:
    assert request("GET", "/api/test-runs/", None).status_code == 401


def test_me_reports_viewer_role(auth_files: Path) -> None:
    response = request("GET", "/api/users/me", VIEWER)
    assert response.json() == {"username": "viewer", "role": "viewer"}


def test_admin_can_create_viewer_via_api(auth_files: Path) -> None:
    response = request("POST", "/api/users/", ADMIN)  # empty body -> validation error proves route is reachable
    assert response.status_code == 422
    app = build_app()

    async def create() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=ADMIN) as client:
            return await client.post("/api/users/", json={"username": "newviewer", "password": "secret1", "role": "viewer"})

    assert asyncio.run(create()).status_code in (200, 201)
    assert "newviewer" in (auth_files / ".htviewers").read_text()


def test_role_change_takes_effect_immediately(auth_files: Path) -> None:
    """The 5-minute auth cache must not keep a demoted admin's rights."""
    assert request("GET", "/api/users/", ADMIN).status_code == 200
    app = build_app()

    async def demote_and_check() -> tuple[int, int]:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=ADMIN) as admin:
            await admin.post("/api/users/", json={"username": "boss2", "password": "pw-admin2", "role": "admin"})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=("boss2", "pw-admin2")) as boss2:
            before = (await boss2.get("/api/users/")).status_code
            await boss2.put("/api/users/boss", json={"role": "viewer"})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=ADMIN) as demoted:
            after = (await demoted.get("/api/users/")).status_code
        return before, after

    assert asyncio.run(demote_and_check()) == (200, 403)


def test_last_admin_cannot_be_demoted(auth_files: Path) -> None:
    app = build_app()

    async def demote_self_via_other_route() -> int:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=ADMIN) as client:
            # only one admin exists ("boss"); demoting must be refused even though it is not a delete
            await client.post("/api/users/", json={"username": "helper", "password": "pw-helper", "role": "viewer"})
            return (await client.put("/api/users/boss", json={"role": "viewer"})).status_code

    assert asyncio.run(demote_self_via_other_route()) == 400
