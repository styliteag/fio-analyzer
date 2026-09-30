"""Tests for the aggregated dashboard statistics endpoint."""

import asyncio
import sqlite3
from collections.abc import Iterator

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_viewer
from database.connection import get_db
from routers import dashboard
from routers.dashboard import compute_dashboard_stats

SCHEMA = """
CREATE TABLE {table} (
    id INTEGER PRIMARY KEY,
    timestamp TEXT,
    hostname TEXT,
    protocol TEXT,
    drive_type TEXT,
    drive_model TEXT,
    iops REAL,
    avg_latency REAL
);
"""

LATEST_ROWS = [
    ("2026-09-01T10:00:00+00:00", "host-a", "NVMe", "Model X", 1000.0, 1.0),
    ("2026-09-03T10:00:00+00:00", "host-a", "NVMe", "Model X", 3000.0, 3.0),
    ("2026-09-02T10:00:00+00:00", "host-b", "iSCSI", "Model Y", 0.0, None),
]

HISTORY_ROWS = LATEST_ROWS + [
    ("2026-08-01T10:00:00+00:00", "host-c", "NFS", "Model Z", 500.0, 5.0),
    ("2026-08-02T10:00:00+00:00", "host-c", "NFS", "Model Z", 600.0, 6.0),
]


def make_db(latest: list[tuple], history: list[tuple]) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", check_same_thread=False)
    for table, rows in (("test_runs", latest), ("test_runs_all", history)):
        connection.execute(SCHEMA.format(table=table))
        connection.executemany(
            f"INSERT INTO {table} (timestamp, hostname, protocol, drive_model, iops, avg_latency) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
    connection.commit()
    return connection


@pytest.fixture
def populated_db() -> Iterator[sqlite3.Connection]:
    connection = make_db(LATEST_ROWS, HISTORY_ROWS)
    yield connection
    connection.close()


def test_counts_runs_hosts_and_history(populated_db: sqlite3.Connection) -> None:
    stats = compute_dashboard_stats(populated_db)

    assert stats["totalTestRuns"] == 3
    assert stats["totalHostnames"] == 2
    assert stats["hostnamesWithHistory"] == 3
    assert stats["activeServers"] == 3


def test_averages_ignore_zero_and_missing_values(populated_db: sqlite3.Connection) -> None:
    stats = compute_dashboard_stats(populated_db)

    assert stats["avgIOPS"] == 2000
    assert stats["avgLatency"] == 2.0


def test_last_upload_is_newest_latest_run(populated_db: sqlite3.Connection) -> None:
    stats = compute_dashboard_stats(populated_db)

    assert stats["lastUploadAt"] == "2026-09-03T10:00:00+00:00"


def test_empty_database_returns_zeros() -> None:
    connection = make_db([], [])
    stats = compute_dashboard_stats(connection)
    connection.close()

    assert stats == {
        "totalTestRuns": 0,
        "totalHostnames": 0,
        "hostnamesWithHistory": 0,
        "activeServers": 0,
        "avgIOPS": 0,
        "avgLatency": 0.0,
        "lastUploadAt": None,
    }


def get_stats(connection: sqlite3.Connection, user: User | None, override_auth: bool = True) -> httpx.Response:
    """Call the route in-process (starlette's TestClient is incompatible with httpx>=0.28)."""
    app = FastAPI()
    app.include_router(dashboard.router, prefix="/api/dashboard")
    app.dependency_overrides[get_db] = lambda: connection
    if user is not None and override_auth:
        app.dependency_overrides[require_viewer] = lambda: user

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get("/api/dashboard/stats")

    return asyncio.run(call())


def test_stats_route_returns_stats_for_admin(populated_db: sqlite3.Connection) -> None:
    response = get_stats(populated_db, User("admin", "admin"))

    assert response.status_code == 200
    assert response.json()["totalTestRuns"] == 3


def test_stats_route_requires_authentication(populated_db: sqlite3.Connection) -> None:
    response = get_stats(populated_db, None)

    assert response.status_code == 401


def test_stats_route_rejects_uploader_role(populated_db: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    """Runs the real require_viewer check with an authenticated uploader (no read access)."""
    monkeypatch.setattr("auth.middleware.get_current_user", lambda request, db=None: User("uploader", "uploader"))

    response = get_stats(populated_db, User("uploader", "uploader"), override_auth=False)

    assert response.status_code == 403
    assert response.json()["detail"] == "Read access required"


def test_active_servers_count_full_hierarchy() -> None:
    """Host-Protocol-Type-Model: same host/protocol/model with different drive types are distinct."""
    connection = sqlite3.connect(":memory:")
    for table in ("test_runs", "test_runs_all"):
        connection.execute(SCHEMA.format(table=table))
    connection.executemany(
        "INSERT INTO test_runs_all (timestamp, hostname, protocol, drive_type, drive_model, iops, avg_latency) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [("2026-09-01", "h", "NVMe", "SSD", "M", 1.0, 1.0), ("2026-09-01", "h", "NVMe", "HDD", "M", 1.0, 1.0)],
    )

    assert compute_dashboard_stats(connection)["activeServers"] == 2
    connection.close()
