"""Tests for fio client mode JSON (fio --client=a --client=b job.fio): aggregate plus per-client results."""

import copy
import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from routers.imports import extract_test_run_data
from utils.fio_client_mode import (
    client_hosts_from_form,
    client_storage_map,
    parse_client_mode,
    storage_for_client,
)

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "fio_client_mode_2clients.json").read_text())


def test_normal_fio_output_is_not_client_mode() -> None:
    assert parse_client_mode({"jobs": [{"jobname": "j"}]}) is None


def test_aggregate_comes_from_all_clients_entry() -> None:
    run = parse_client_mode(FIXTURE)
    assert run is not None
    assert run.job["read"]["iops"] == pytest.approx(217638.18, rel=1e-6)
    assert run.job["jobname"] == "j"
    assert run.job["job options"] == {"numjobs": "2"}
    # "All clients" sums job_runtime over clients; the aggregate uses one client's runtime
    assert run.job["job_runtime"] == 4000


def test_global_options_drop_client_address() -> None:
    run = parse_client_mode(FIXTURE)
    assert run.global_options["rw"] == "randread"
    assert "hostname" not in run.global_options and "port" not in run.global_options


def test_per_client_results_in_fio_order() -> None:
    run = parse_client_mode(FIXTURE)
    assert [(c.index, c.host, c.port) for c in run.clients] == [(0, "127.0.0.1", 18766), (1, "127.0.0.1", 18765)]
    first = run.clients[0]
    assert first.iops == pytest.approx(108822.59, rel=1e-6)
    assert first.read_iops == pytest.approx(108822.59, rel=1e-6)
    assert first.write_iops == 0
    assert first.p95_latency == pytest.approx(0.083456)
    assert first.error == 0


def test_single_client_without_all_clients_entry() -> None:
    data = copy.deepcopy(FIXTURE)
    data["client_stats"] = [data["client_stats"][0]]
    data["global options"] = [data["global options"][0]]
    run = parse_client_mode(data)
    assert len(run.clients) == 1
    assert run.job["read"]["iops"] == pytest.approx(108822.59, rel=1e-6)


def test_client_mode_without_clients_is_rejected() -> None:
    with pytest.raises(HTTPException) as error:
        parse_client_mode({"client_stats": [{"jobname": "All clients"}]})
    assert error.value.status_code == 400


def test_extract_test_run_data_handles_client_mode() -> None:
    data = extract_test_run_data(FIXTURE, "x.json")
    assert data["clients"] == 2
    assert data["iops"] == pytest.approx(217638.18, rel=1e-6)
    assert data["read_write_pattern"] == "randread"
    assert data["block_size"] == "4K"
    assert data["num_jobs"] == 2
    assert data["test_size"] == "4M"
    assert data["duration"] == 2
    assert len(data["client_results"]) == 2


def test_extract_test_run_data_normal_run_has_one_client() -> None:
    normal = {"jobs": [{"jobname": "j", "job options": {"rw": "read"}, "read": {"iops": 5}}]}
    data = extract_test_run_data(normal, "x.json")
    assert data["clients"] == 1
    assert data["client_results"] == ()


def test_storage_map_matches_host_port_then_host() -> None:
    mapping = client_storage_map(json.dumps({"127.0.0.1:18766": {"fs_type": "zfs", "client_name": "vm1"}, "10.0.0.2": {"fs_type": "ext4"}}))
    assert json.loads(storage_for_client(mapping, "127.0.0.1", 18766))["client_name"] == "vm1"
    assert json.loads(storage_for_client(mapping, "10.0.0.2", 8765))["fs_type"] == "ext4"
    assert storage_for_client(mapping, "10.0.0.9", 8765) is None


@pytest.mark.parametrize("raw", [None, "", "nope", "[1]", '{"a": "string"}', '{"a": {"x": NaN}}', "{" + '"a": {"b": "' + "x" * 300_000 + '"}}'])
def test_storage_map_ignores_garbage(raw) -> None:
    assert client_storage_map(raw) == {}


def test_client_hosts_from_form() -> None:
    assert client_hosts_from_form(" vm1, vm2 ,,vm3") == '["vm1", "vm2", "vm3"]'
    assert client_hosts_from_form(None) is None
    assert client_hosts_from_form(",".join(f"h{i}" for i in range(2000))) is None


@pytest.mark.parametrize("bad", ["1", True, None, [1], {"x": 1}])
def test_non_numeric_metrics_are_rejected(bad) -> None:
    """A string or list stored in a REAL column would break every summary of that ramp."""
    data = copy.deepcopy(FIXTURE)
    data["client_stats"][0]["read"]["iops"] = bad
    with pytest.raises(HTTPException) as error:
        extract_test_run_data(data, "x.json")
    assert error.value.status_code == 400


def test_non_dict_sections_are_rejected_not_500() -> None:
    data = copy.deepcopy(FIXTURE)
    data["client_stats"][2]["read"] = "broken"
    with pytest.raises(HTTPException) as error:
        extract_test_run_data(data, "x.json")
    assert error.value.status_code == 400


@pytest.mark.parametrize("raw", ['{"a": NaN}', '{"a": Infinity}', '{"a": -Infinity}', '{"a": 1e999}'])
def test_fio_json_loader_rejects_non_finite_numbers(raw: str) -> None:
    from utils.fio_metrics import load_fio_json

    with pytest.raises(ValueError):
        load_fio_json(raw)


def test_storage_map_values_are_encoded_once_and_limited() -> None:
    mapping = client_storage_map(json.dumps({"a:1": {"x": "y"}, "b": {"x": "z" * 9000}}))
    assert mapping == {"a:1": '{"x":"y"}'}
    assert storage_for_client(mapping, "a", 1) == '{"x":"y"}'
