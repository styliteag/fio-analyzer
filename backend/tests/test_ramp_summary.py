"""Tests for the multi-client ramp summary (pure logic, no database)."""

import pytest

from utils.ramp_summary import newest_per_client_count, summarize_ramp


def step(step_id: int, clients: int, iops: float, p95: float, *, client_iops=None, errors=0, description: str = "clients:1,ramp:1") -> dict:
    per_client = client_iops if client_iops is not None else [iops / clients] * clients
    return {
        "id": step_id,
        "clients": clients,
        "iops": iops,
        "bandwidth": iops / 256,
        "avg_latency": p95 / 2,
        "p95_latency": p95,
        "p99_latency": p95 * 1.5,
        "description": description,
        "timestamp": f"2026-09-28T10:00:{step_id:02d}+00:00",
        "client_rows": [{"iops": value, "error": errors} for value in per_client],
    }


RAMP = [
    step(1, 1, 10000, 2.0),
    step(2, 2, 19000, 4.0),
    step(3, 4, 30000, 9.0, client_iops=[9000, 8000, 7000, 6000]),
    step(4, 6, 31000, 25.0),
]


def test_best_within_threshold_is_highest_client_count_that_passes() -> None:
    summary = summarize_ramp(RAMP, threshold_ms=10)
    assert summary["best_within"]["clients"] == 4
    assert summary["crossed_at"]["clients"] == 6
    assert summary["status"] == "saturated"


def test_max_iops_and_per_client_drop() -> None:
    summary = summarize_ramp(RAMP, threshold_ms=100)
    assert summary["max_iops"]["clients"] == 6
    assert summary["status"] == "not_reached"
    # per client: 10000 at 1 client, 31000/6 at 6 clients
    assert summary["per_client_iops_drop_pct"] == pytest.approx((1 - (31000 / 6) / 10000) * 100)


def test_fairness_is_min_over_max_client_iops() -> None:
    steps = summarize_ramp(RAMP, threshold_ms=10)["steps"]
    four = next(s for s in steps if s["clients"] == 4)
    assert four["fairness"] == pytest.approx(6000 / 9000)
    assert four["per_client_iops"] == pytest.approx(7500)
    assert next(s for s in steps if s["clients"] == 1)["fairness"] is None


def test_incomplete_steps_are_listed_but_not_ranked() -> None:
    ramp = [step(1, 1, 10000, 2.0), step(2, 2, 50000, 3.0, description="clients:2,ramp:1,incomplete:1"), step(3, 4, 30000, 4.0, errors=5)]
    summary = summarize_ramp(ramp, threshold_ms=10)
    assert [s["complete"] for s in summary["steps"]] == [True, False, False]
    assert summary["best_within"]["clients"] == 1
    assert summary["max_iops"]["clients"] == 1
    assert summary["incomplete_steps"] == 2


def test_step_with_missing_client_rows_is_incomplete() -> None:
    broken = step(2, 4, 30000, 4.0, client_iops=[7500, 7500])
    assert summarize_ramp([broken], threshold_ms=10)["steps"][0]["complete"] is False


def test_step_without_any_client_rows_is_complete() -> None:
    """Single-host style rows (no per-client results) are judged by description and errors only."""
    plain = {**step(1, 1, 1000, 1.0), "client_rows": []}
    assert summarize_ramp([plain], threshold_ms=10)["steps"][0]["complete"] is True


def test_newest_row_wins_per_client_count() -> None:
    rows = [step(1, 2, 100, 1.0), step(5, 2, 200, 1.0), step(3, 1, 50, 1.0)]
    assert [(r["clients"], r["id"]) for r in newest_per_client_count(rows)] == [(1, 3), (2, 5)]


def test_single_step_has_no_drop() -> None:
    summary = summarize_ramp([step(1, 1, 1000, 1.0)], threshold_ms=10)
    assert summary["per_client_iops_drop_pct"] is None
