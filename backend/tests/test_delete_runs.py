"""Deleting test runs removes exactly their own history rows and per-client results."""

import asyncio

import httpx
from fastapi import FastAPI
from test_client_import import FIXTURE, manager, single_client_output, upload  # noqa: F401 (manager is a fixture)

from auth.middleware import User, require_admin
from database.connection import DatabaseManager, get_db
from routers import test_runs, time_series


def delete(db_manager: DatabaseManager, path: str, json: dict = None, method: str = "DELETE") -> httpx.Response:
    app = FastAPI()
    app.include_router(test_runs.router, prefix="/api/test-runs")
    app.include_router(time_series.router, prefix="/api/time-series")
    app.dependency_overrides[get_db] = lambda: db_manager.connection
    app.dependency_overrides[require_admin] = lambda: User("admin", "admin")

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.request(method, path, json=json)

    return asyncio.run(call())


def count(db_manager: DatabaseManager, sql: str, *params: object) -> int:
    return db_manager.connection.execute(sql, params).fetchone()[0]


def misalign_ids(db_manager: DatabaseManager) -> None:
    """Production state: test_runs and test_runs_all number their rows independently, so the
    test_runs id of one result is the test_runs_all id of an unrelated older result."""
    db = db_manager.connection
    db.execute("UPDATE test_runs SET id = id + 1000")
    db.execute("UPDATE test_runs SET id = (SELECT MIN(id) FROM test_runs_all) WHERE hostname = 'new'")
    db.commit()


def test_delete_latest_run_removes_its_own_history_row_only(manager: DatabaseManager) -> None:  # noqa: F811
    assert upload(manager, single_client_output(), hostname="old", run_uuid="run-old").status_code == 200
    assert upload(manager, FIXTURE, hostname="new", run_uuid="run-new", ramp_uuid="ramp-1").status_code == 200
    misalign_ids(manager)
    new_id = count(manager, "SELECT id FROM test_runs WHERE hostname = 'new'")

    response = delete(manager, f"/api/test-runs/{new_id}")

    assert response.status_code == 200, response.text
    assert count(manager, "SELECT count(*) FROM test_runs WHERE hostname = 'new'") == 0
    assert count(manager, "SELECT count(*) FROM test_runs_all WHERE hostname = 'new'") == 0
    assert count(manager, "SELECT count(*) FROM test_runs_all WHERE hostname = 'old'") == 1
    assert count(manager, "SELECT count(*) FROM client_results") == 1  # the old run's single client


def test_delete_unknown_latest_id_is_404_and_keeps_history(manager: DatabaseManager) -> None:  # noqa: F811
    assert upload(manager, single_client_output(), hostname="old", run_uuid="run-old").status_code == 200
    history_id = count(manager, "SELECT id FROM test_runs_all")
    manager.connection.execute("UPDATE test_runs SET id = id + 1000")
    manager.connection.commit()

    assert delete(manager, f"/api/test-runs/{history_id}").status_code == 404
    assert count(manager, "SELECT count(*) FROM test_runs_all") == 1


def test_delete_by_run_uuid_removes_history_only_run(manager: DatabaseManager) -> None:  # noqa: F811
    # Same configuration twice: the second upload replaces the first in test_runs
    assert upload(manager, FIXTURE, run_uuid="run-broken", ramp_uuid="ramp-a").status_code == 200
    assert upload(manager, FIXTURE, run_uuid="run-good", ramp_uuid="ramp-b").status_code == 200
    assert count(manager, "SELECT count(*) FROM test_runs WHERE run_uuid = 'run-broken'") == 0

    response = delete(manager, "/api/test-runs/by-run-uuid?run_uuid=run-broken")

    assert response.status_code == 200, response.text
    assert response.json()["deleted"] == {"test_runs": 0, "test_runs_all": 1, "client_results": 2}
    assert count(manager, "SELECT count(*) FROM test_runs_all WHERE run_uuid = 'run-broken'") == 0
    assert count(manager, "SELECT count(*) FROM client_results WHERE run_uuid = 'run-broken'") == 0
    assert count(manager, "SELECT count(*) FROM test_runs_all WHERE run_uuid = 'run-good'") == 1
    assert count(manager, "SELECT count(*) FROM client_results WHERE run_uuid = 'run-good'") == 2


def test_delete_by_unknown_run_uuid_is_404(manager: DatabaseManager) -> None:  # noqa: F811
    assert delete(manager, "/api/test-runs/by-run-uuid?run_uuid=nope").status_code == 404


def test_history_delete_removes_client_results(manager: DatabaseManager) -> None:  # noqa: F811
    assert upload(manager, FIXTURE, run_uuid="run-1", ramp_uuid="ramp-a").status_code == 200
    history_id = count(manager, "SELECT id FROM test_runs_all")

    response = delete(manager, "/api/time-series/delete", json={"testRunIds": [history_id]})

    assert response.status_code == 200, response.text
    assert count(manager, "SELECT count(*) FROM client_results") == 0


def test_history_cleanup_removes_client_results(manager: DatabaseManager) -> None:  # noqa: F811
    assert upload(manager, FIXTURE, run_uuid="run-1", ramp_uuid="ramp-a").status_code == 200

    body = {"cutoff_date": "9999-12-31T00:00:00", "mode": "delete-old"}
    response = delete(manager, "/api/time-series/history/cleanup", json=body, method="POST")

    assert response.status_code == 200, response.text
    assert count(manager, "SELECT count(*) FROM client_results") == 0
