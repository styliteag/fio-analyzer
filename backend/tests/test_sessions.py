"""Browser sessions: the password is checked once at login, then an HttpOnly cookie authenticates."""

import asyncio
import sqlite3
from pathlib import Path
from typing import Dict, Optional

import httpx
import pytest
from fastapi import FastAPI
from test_viewer_role import auth_files, write_htpasswd  # noqa: F401 (auth_files is a fixture)

from auth import sessions
from config.settings import settings
from database.connection import get_optional_db
from routers import auth as auth_router
from routers import users

CSRF = {sessions.CSRF_HEADER: sessions.CSRF_VALUE}
LIFETIME_S = 48 * 3600


@pytest.fixture
def db() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", check_same_thread=False)
    sessions.ensure_sessions_table(connection.cursor())
    sessions.clear_failed_logins()
    return connection


def build_app(db: sqlite3.Connection) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router.router, prefix="/api/auth")
    app.include_router(users.router)
    app.dependency_overrides[get_optional_db] = lambda: db
    return app


def call(app: FastAPI, method: str, path: str, cookie: Optional[str] = None, headers: Optional[Dict[str, str]] = None, **kwargs) -> httpx.Response:
    cookies = {sessions.COOKIE_NAME: cookie} if cookie else None

    async def run() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", cookies=cookies) as client:
            return await client.request(method, path, headers=headers, **kwargs)

    return asyncio.run(run())


def login(app: FastAPI, username: str = "px1", password: str = "pw-view", headers: Optional[Dict[str, str]] = None) -> httpx.Response:
    return call(app, "POST", "/api/auth/login", json={"username": username, "password": password}, headers={**CSRF, **(headers or {})})


def session_cookie(response: httpx.Response) -> str:
    return response.cookies[sessions.COOKIE_NAME]


def test_login_sets_httponly_strict_cookie_for_48_hours(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    response = login(build_app(db))
    assert response.status_code == 200, response.text
    assert response.json()["username"] == "px1"
    assert response.json()["role"] == "viewer"
    header = response.headers["set-cookie"].lower()
    assert "httponly" in header
    assert "samesite=strict" in header
    assert f"max-age={LIFETIME_S}" in header
    assert "path=/" in header
    assert "secure" not in header  # plain http (dev); see the https test


def test_cookie_is_secure_behind_https_proxy(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    response = login(build_app(db), headers={"X-Forwarded-Proto": "https"})
    assert "secure" in response.headers["set-cookie"].lower()


def test_wrong_password_sets_no_cookie(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    response = login(build_app(db), password="wrong")
    assert response.status_code == 401
    assert sessions.COOKIE_NAME not in response.cookies
    assert db.execute("SELECT count(*) FROM sessions").fetchone()[0] == 0


def test_cookie_authenticates_and_only_a_hash_is_stored(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    cookie = session_cookie(login(app))
    me = call(app, "GET", "/api/users/me", cookie=cookie)
    assert me.status_code == 200
    assert me.json() == {"username": "px1", "role": "viewer"}
    stored = [row[0] for row in db.execute("SELECT token_hash FROM sessions")]
    assert len(stored) == 1 and cookie not in stored[0]


def test_unknown_or_expired_cookie_is_401(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    assert call(app, "GET", "/api/users/me", cookie="made-up").status_code == 401
    cookie = session_cookie(login(app))
    db.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00'")
    assert call(app, "GET", "/api/users/me", cookie=cookie).status_code == 401


def test_password_change_ends_the_session(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    cookie = session_cookie(login(app))
    write_htpasswd(auth_files / ".htviewers", "px1", "new-password")
    assert call(app, "GET", "/api/users/me", cookie=cookie).status_code == 401


def test_role_change_or_removal_ends_the_session(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    cookie = session_cookie(login(app))
    (auth_files / ".htviewers").write_text("")
    assert call(app, "GET", "/api/users/me", cookie=cookie).status_code == 401


def test_logout_deletes_the_session_and_clears_the_cookie(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    cookie = session_cookie(login(app))
    response = call(app, "POST", "/api/auth/logout", cookie=cookie, headers=CSRF)
    assert response.status_code == 200
    assert "max-age=0" in response.headers["set-cookie"].lower()
    assert db.execute("SELECT count(*) FROM sessions").fetchone()[0] == 0
    assert call(app, "GET", "/api/users/me", cookie=cookie).status_code == 401


def test_cookie_writes_need_the_csrf_header(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    cookie = session_cookie(login(app))
    assert call(app, "POST", "/api/auth/logout", cookie=cookie).status_code == 403
    assert login(app, headers={sessions.CSRF_HEADER: "other"}).status_code == 403


def test_basic_auth_still_works_without_a_session(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    async def run() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=build_app(db)), base_url="http://test", auth=("robot", "pw-upload")) as client:
            return await client.get("/api/users/me")

    assert asyncio.run(run()).json() == {"username": "robot", "role": "uploader"}


def test_lifetime_comes_from_settings(auth_files: Path, db: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setattr(settings, "session_lifetime_hours", 1)
    assert "max-age=3600" in login(build_app(db)).headers["set-cookie"].lower()


def test_duplicate_username_gets_the_role_its_password_proves(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    # "px1" also exists as admin with another password; the viewer password must not open an admin session
    write_htpasswd(auth_files / ".htpasswd", "px1", "pw-admin-px1")
    app = build_app(db)
    response = login(app)
    assert response.json()["role"] == "viewer"
    assert call(app, "GET", "/api/users/me", cookie=session_cookie(response)).json()["role"] == "viewer"


def test_login_again_ends_the_previous_session(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    old = session_cookie(login(app))
    fresh = call(app, "POST", "/api/auth/login", cookie=old, json={"username": "px1", "password": "pw-view"}, headers=CSRF)
    assert fresh.status_code == 200
    assert call(app, "GET", "/api/users/me", cookie=old).status_code == 401
    assert call(app, "GET", "/api/users/me", cookie=session_cookie(fresh)).status_code == 200


def test_repeated_failed_logins_are_throttled(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)
    codes = [login(app, password=f"wrong-{i}").status_code for i in range(sessions.MAX_FAILED_LOGINS + 1)]
    assert codes[:-1] == [401] * sessions.MAX_FAILED_LOGINS
    assert codes[-1] == 429
    assert login(app).status_code == 429  # the right password waits too, until the window passes


def test_basic_auth_guesses_share_the_login_throttle(auth_files: Path, db: sqlite3.Connection) -> None:  # noqa: F811
    app = build_app(db)

    async def basic(password: str) -> int:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=("px1", password)) as client:
            return (await client.get("/api/users/me")).status_code

    codes = [asyncio.run(basic(f"wrong-{i}")) for i in range(sessions.MAX_FAILED_LOGINS + 1)]
    assert codes[-1] == 429
    assert login(app).status_code == 429  # the browser login of the same user waits as well


def test_throttle_evicts_oldest_keys_instead_of_forgetting_all(monkeypatch: pytest.MonkeyPatch) -> None:
    sessions.clear_failed_logins()
    monkeypatch.setattr(sessions, "_MAX_TRACKED_LOGINS", 3)
    sessions.record_failed_login("old-a")
    sessions.record_failed_login("old-b")
    for _ in range(sessions.MAX_FAILED_LOGINS):
        sessions.record_failed_login("target")
    sessions.record_failed_login("flood")  # full: must evict "old-a", not every key
    assert sessions.login_throttled("target") is True
