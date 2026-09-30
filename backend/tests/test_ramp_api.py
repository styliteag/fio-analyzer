"""Ramp API and ramp ZIP download against the real schema, fed through the import endpoint."""

import asyncio
import io
import json
import zipfile

import httpx
from fastapi import FastAPI
from test_client_import import FIXTURE, STORAGE, single_client_output, upload

from auth.middleware import User, require_viewer
from database.connection import DatabaseManager, get_db
from routers import ramp, raw_data


def get(db_manager: DatabaseManager, path: str, viewer: bool = True) -> httpx.Response:
    app = FastAPI()
    app.include_router(ramp.router, prefix="/api/ramp")
    app.include_router(raw_data.router, prefix="/api/raw")
    app.dependency_overrides[get_db] = lambda: db_manager.connection
    if viewer:
        app.dependency_overrides[require_viewer] = lambda: User("viewer", "viewer")

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(call())


def upload_ramp(db_manager: DatabaseManager) -> None:
    common = {"ramp_uuid": "ramp-1", "client_hosts": "vm1,vm2", "client_storage_info": json.dumps(STORAGE)}
    assert upload(db_manager, single_client_output(), description="clients:1,ramp:1", **common).status_code == 200
    assert upload(db_manager, FIXTURE, description="clients:2,ramp:1", **common).status_code == 200


def test_list_ramps(manager: DatabaseManager) -> None:
    upload_ramp(manager)
    ramps = get(manager, "/api/ramp/runs").json()
    assert len(ramps) == 1
    assert ramps[0]["ramp_uuid"] == "ramp-1"
    assert ramps[0]["client_counts"] == [1, 2]
    assert ramps[0]["steps"] == 2
    assert (ramps[0]["hostname"], ramps[0]["read_write_pattern"]) == ("ctrl", "randread")
    assert get(manager, "/api/ramp/runs?hostname=other").json() == []


def test_ramp_details_include_clients_and_storage(manager: DatabaseManager) -> None:
    upload_ramp(manager)
    detail = get(manager, "/api/ramp/runs/ramp-1").json()
    assert [step["clients"] for step in detail["steps"]] == [1, 2]
    two = detail["steps"][1]
    assert two["client_hosts"] == ["vm1", "vm2"]
    assert [c["client_name"] for c in two["clients_detail"]] == ["vm1", "vm2"]
    assert two["clients_detail"][1]["storage_info"]["fs_type"] == "xfs"


def test_ramp_details_carry_fairness_per_step(manager: DatabaseManager) -> None:
    upload_ramp(manager)
    detail = get(manager, "/api/ramp/runs/ramp-1").json()
    summary = get(manager, "/api/ramp/runs/ramp-1/summary").json()
    assert detail["steps"][0]["fairness"] is None  # one client: nothing to compare
    assert detail["steps"][1]["fairness"] == summary["steps"][1]["fairness"]
    assert 0 < detail["steps"][1]["fairness"] <= 1


def test_ramp_summary(manager: DatabaseManager) -> None:
    upload_ramp(manager)
    summary = get(manager, "/api/ramp/runs/ramp-1/summary?threshold_ms=1").json()
    assert summary["threshold_ms"] == 1
    assert summary["best_within"]["clients"] == 2  # P95 about 0.08 ms in the fixture
    assert summary["max_iops"]["clients"] == 2
    assert summary["incomplete_steps"] == 0
    assert summary["steps"][1]["fairness"] > 0.99


def test_unknown_ramp_is_404_and_bad_threshold_is_422(manager: DatabaseManager) -> None:
    assert get(manager, "/api/ramp/runs/nope").status_code == 404
    assert get(manager, "/api/ramp/runs/nope/summary").status_code == 404
    upload_ramp(manager)
    assert get(manager, "/api/ramp/runs/ramp-1/summary?threshold_ms=0").status_code == 422


def test_requires_authentication(manager: DatabaseManager) -> None:
    assert get(manager, "/api/ramp/runs", viewer=False).status_code in (401, 403)


def test_ramp_zip_contains_every_step(manager: DatabaseManager) -> None:
    upload_ramp(manager)
    response = get(manager, "/api/raw/ramps/ramp-1")
    assert response.status_code == 200
    assert 'filename="ramp_ramp-1.zip"' in response.headers["content-disposition"]
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    index = json.loads(archive.read("index.json"))
    assert index["ramp_uuid"] == "ramp-1"
    assert [entry["clients"] for entry in index["files"]] == [1, 2]
    assert len(archive.namelist()) == 3
    assert get(manager, "/api/raw/ramps/nope").status_code == 404
