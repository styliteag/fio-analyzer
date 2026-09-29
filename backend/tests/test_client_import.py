"""Upload of fio client mode results: aggregate row with clients/ramp_uuid plus per-client rows."""

import asyncio
import copy
import json
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_uploader
from config.settings import settings
from database.connection import DatabaseManager, get_db
from routers import imports

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "fio_client_mode_2clients.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text())
STORAGE = {
    "127.0.0.1:18766": {"fs_type": "ext4", "client_name": "vm1"},
    "127.0.0.1:18765": {"fs_type": "xfs", "client_name": "vm2"},
}


def single_client_output() -> dict:
    data = copy.deepcopy(FIXTURE)
    data["client_stats"] = [data["client_stats"][0]]
    data["global options"] = [data["global options"][0]]
    return data


def upload(db_manager: DatabaseManager, fio_output: dict, **fields: str) -> httpx.Response:
    app = FastAPI()
    app.include_router(imports.router, prefix="/api/import")
    app.dependency_overrides[get_db] = lambda: db_manager.connection
    app.dependency_overrides[require_uploader] = lambda: User("robot", "uploader")
    form = {"drive_model": "m", "drive_type": "ssd", "hostname": "ctrl", "protocol": "local", "description": "d", "run_uuid": "run-1", **fields}

    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            files = {"file": ("step.json", json.dumps(fio_output).encode(), "application/json")}
            return await client.post("/api/import/", data=form, files=files)

    return asyncio.run(call())


def test_client_mode_upload_stores_aggregate_and_clients(manager: DatabaseManager) -> None:
    response = upload(manager, FIXTURE, ramp_uuid="ramp-1", client_hosts="vm1,vm2", client_storage_info=json.dumps(STORAGE), description="clients:2,ramp:1")
    assert response.status_code == 200, response.text
    db = manager.connection
    row = db.execute("SELECT clients, ramp_uuid, client_hosts, iops FROM test_runs").fetchone()
    assert (row[0], row[1], json.loads(row[2])) == (2, "ramp-1", ["vm1", "vm2"])
    assert row[3] == pytest.approx(217638.18, rel=1e-6)
    all_id = db.execute("SELECT id FROM test_runs_all").fetchone()[0]
    clients = db.execute("SELECT test_run_id, client_index, client_port, ramp_uuid, storage_info FROM client_results ORDER BY client_index").fetchall()
    assert [(c[0], c[1], c[2], c[3]) for c in clients] == [(all_id, 0, 18766, "ramp-1"), (all_id, 1, 18765, "ramp-1")]
    assert json.loads(clients[0][4])["client_name"] == "vm1"
    assert json.loads(clients[1][4])["fs_type"] == "xfs"


def test_different_client_counts_keep_their_own_latest_row(manager: DatabaseManager) -> None:
    assert upload(manager, single_client_output(), ramp_uuid="ramp-1").status_code == 200
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1").status_code == 200
    db = manager.connection
    assert sorted(r[0] for r in db.execute("SELECT clients FROM test_runs WHERE is_latest = 1")) == [1, 2]
    assert db.execute("SELECT count(*) FROM client_results").fetchone()[0] == 3


def test_reupload_of_same_client_count_replaces_latest_only(manager: DatabaseManager) -> None:
    upload(manager, FIXTURE, ramp_uuid="ramp-1")
    upload(manager, FIXTURE, ramp_uuid="ramp-2")
    db = manager.connection
    assert db.execute("SELECT count(*) FROM test_runs").fetchone()[0] == 1
    assert db.execute("SELECT count(*) FROM test_runs_all").fetchone()[0] == 2
    assert db.execute("SELECT count(*) FROM client_results").fetchone()[0] == 4


def test_normal_upload_is_unchanged(manager: DatabaseManager) -> None:
    normal = {"fio version": "fio-3.36", "jobs": [{"jobname": "t", "job options": {"rw": "read"}, "read": {"iops": 5.0}}]}
    assert upload(manager, normal).status_code == 200
    db = manager.connection
    assert tuple(db.execute("SELECT clients, ramp_uuid, client_hosts FROM test_runs").fetchone()) == (1, None, None)
    assert db.execute("SELECT count(*) FROM client_results").fetchone()[0] == 0


def test_info_file_keeps_client_fields_for_bulk_reimport(manager: DatabaseManager) -> None:
    upload(manager, FIXTURE, ramp_uuid="ramp-1", client_hosts="vm1,vm2", client_storage_info=json.dumps(STORAGE))
    info = json.loads(next(settings.upload_dir.rglob("*.info")).read_text())
    assert info["ramp_uuid"] == "ramp-1"
    assert info["client_hosts"] == "vm1,vm2"
    assert json.loads(info["client_storage_info"]) == STORAGE


def test_overlong_ramp_uuid_is_rejected(manager: DatabaseManager) -> None:
    assert upload(manager, FIXTURE, ramp_uuid="x" * 65).status_code == 422


def test_ramp_uuid_must_be_a_plain_identifier(manager: DatabaseManager) -> None:
    assert upload(manager, FIXTURE, ramp_uuid="../x y").status_code == 400


def test_ramp_uuid_of_another_configuration_is_rejected(manager: DatabaseManager) -> None:
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1").status_code == 200
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1", hostname="other").status_code == 409
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1", drive_model="m2").status_code == 409


def test_ramp_size_is_capped(manager: DatabaseManager, monkeypatch: pytest.MonkeyPatch) -> None:
    from database import client_results

    monkeypatch.setattr(client_results, "MAX_RAMP_CLIENT_ROWS", 3)
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1").status_code == 200
    assert upload(manager, FIXTURE, ramp_uuid="ramp-1").status_code == 413
    assert upload(manager, FIXTURE, ramp_uuid="ramp-2").status_code == 200


def test_info_metadata_only_sets_known_string_fields() -> None:
    fields = imports.info_fields({"hostname": "h", "clients": "7", "iops": "x", "description": 5, "run_uuid": "r"})
    assert fields == {"hostname": "h", "run_uuid": "r"}


@pytest.mark.parametrize("name, clients", [("fio_client_1client.json", 1), ("fio_client_2clients.json", 2)])
def test_fio_test_sh_fixtures_import(manager: DatabaseManager, name: str, clients: int) -> None:
    """Contract with scripts/fio-test.sh: its real fio client-mode fixtures and upload fields import cleanly."""
    output = json.loads((Path(__file__).parents[2] / "scripts" / "tests" / "fixtures" / name).read_text())
    storage = {"127.0.0.1:18801": {"fs_type": "apfs", "client_name": "127.0.0.1:18801"}}
    response = upload(
        manager,
        output,
        ramp_uuid="b4785b3c-94a5-4188-9084-a4fb58fb0382",
        client_hosts=",".join(["vm"] * clients),
        client_storage_info=json.dumps(storage),
        ramp_step_complete="1",
        clients=str(clients),
        description=f"clients:{clients},ramp:1",
    )
    assert response.status_code == 200, response.text
    db = manager.connection
    assert db.execute("SELECT clients FROM test_runs").fetchone()[0] == clients
    stored = db.execute("SELECT client_port, storage_info FROM client_results ORDER BY client_port").fetchall()
    assert len(stored) == clients
    assert json.loads(dict((row[0], row[1]) for row in stored)[18801])["fs_type"] == "apfs"
