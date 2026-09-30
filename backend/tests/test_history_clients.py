"""History endpoint returns clients and num_jobs, so multi-client ramp steps form their own series."""

import asyncio

import httpx
from fastapi import FastAPI
from test_client_import import FIXTURE, single_client_output, upload

from auth.middleware import User, require_viewer
from database.connection import DatabaseManager, get_db
from routers import time_series


def history(db_manager: DatabaseManager) -> list:
    app = FastAPI()
    app.include_router(time_series.router, prefix="/api/time-series")
    app.dependency_overrides[get_db] = lambda: db_manager.connection
    app.dependency_overrides[require_viewer] = lambda: User("viewer", "viewer")

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get("/api/time-series/history?days=365&start_date=2000-01-01")

    response = asyncio.run(call())
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_history_rows_carry_clients_and_num_jobs(manager: DatabaseManager) -> None:
    assert upload(manager, single_client_output(), ramp_uuid="ramp-1").status_code == 200
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1").status_code == 200
    rows = history(manager)
    assert sorted(row["clients"] for row in rows) == [1, 2]
    assert all(isinstance(row["num_jobs"], int) for row in rows)
