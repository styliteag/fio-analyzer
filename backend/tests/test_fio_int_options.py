"""Whole-number fio options (direct, iodepth, numjobs, runtime) in uploaded fio JSON."""

import pytest
from fastapi import HTTPException

from routers.imports import extract_test_run_data


def fio_json(**job_options: str) -> dict:
    options = {"rw": "randread", "bs": "4k", "iodepth": "8", "numjobs": "2", "direct": "1", "runtime": "30"}
    options.update(job_options)
    return {
        "fio version": "fio-3.36",
        "global options": {},
        "jobs": [
            {
                "jobname": "test",
                "job options": options,
                "read": {"iops": 100.0, "bw": 400, "clat_ns": {"mean": 1000.0, "percentile": {}}},
                "write": {"iops": 0.0, "bw": 0, "clat_ns": {"mean": 0.0, "percentile": {}}},
            }
        ],
    }


def test_whole_number_options_are_parsed() -> None:
    data = extract_test_run_data(fio_json(), "x.json")
    assert (data["direct"], data["iodepth"], data["queue_depth"], data["num_jobs"], data["duration"]) == (
        1,
        8,
        8,
        2,
        30,
    )


def test_missing_options_use_defaults() -> None:
    fio = fio_json()
    for name in ("direct", "iodepth", "numjobs", "runtime"):
        del fio["jobs"][0]["job options"][name]
    data = extract_test_run_data(fio, "x.json")
    assert (data["direct"], data["iodepth"], data["num_jobs"]) == (0, 1, 1)


@pytest.mark.parametrize("name", ["direct", "iodepth", "numjobs", "runtime"])
def test_option_list_is_rejected_with_400(name: str) -> None:
    # e.g. DIRECT=1,0 in a fio-test.sh saturation run (issue #6): a client error, not a server error
    with pytest.raises(HTTPException) as error:
        extract_test_run_data(fio_json(**{name: "1,0"}), "x.json")
    assert error.value.status_code == 400
    assert f"{name}='1,0'" in error.value.detail
