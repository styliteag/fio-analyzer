"""Tests for the side-by-side comparison endpoint (GET /api/compare)."""

import asyncio
import sqlite3
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from auth.middleware import User, require_viewer
from database.connection import get_db
from routers import compare

SCHEMA = """
CREATE TABLE {table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    hostname TEXT,
    protocol TEXT,
    drive_type TEXT,
    drive_model TEXT,
    read_write_pattern TEXT,
    block_size TEXT,
    sync TEXT,
    direct INTEGER,
    num_jobs INTEGER,
    iodepth INTEGER,
    test_size TEXT,
    duration INTEGER,
    iops REAL,
    bandwidth REAL,
    avg_latency REAL,
    p95_latency REAL,
    p99_latency REAL,
    description TEXT,
    run_uuid TEXT,
    clients INTEGER DEFAULT 1
);
"""

COLUMNS = (
    "timestamp",
    "hostname",
    "protocol",
    "drive_type",
    "drive_model",
    "read_write_pattern",
    "block_size",
    "sync",
    "direct",
    "num_jobs",
    "iodepth",
    "test_size",
    "duration",
    "iops",
    "bandwidth",
    "avg_latency",
    "p95_latency",
    "p99_latency",
    "description",
    "run_uuid",
    "clients",
)

DEFAULTS: dict[str, Any] = {
    "timestamp": "2026-09-01T10:00:00+00:00",
    "protocol": "local",
    "drive_type": "ssd",
    "drive_model": "m1",
    "read_write_pattern": "randread",
    "block_size": "4K",
    "sync": "none",
    "direct": 1,
    "num_jobs": 1,
    "iodepth": 1,
    "test_size": "10G",
    "duration": 60,
    "iops": 1000.0,
    "bandwidth": 100.0,
    "avg_latency": 1.0,
    "p95_latency": 2.0,
    "p99_latency": 3.0,
    "description": "",
    "run_uuid": "run-1",
    "clients": 1,
}


def row(hostname: str, **overrides: Any) -> dict[str, Any]:
    return {**DEFAULTS, "hostname": hostname, **overrides}


def make_db(latest: list[dict[str, Any]], history: list[dict[str, Any]] | None = None) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", check_same_thread=False)
    placeholders = ",".join("?" for _ in COLUMNS)
    for table, rows in (("test_runs", latest), ("test_runs_all", history if history is not None else latest)):
        connection.execute(SCHEMA.format(table=table))
        connection.executemany(
            f"INSERT INTO {table} ({','.join(COLUMNS)}) VALUES ({placeholders})",
            [tuple(r[c] for c in COLUMNS) for r in rows],
        )
    connection.commit()
    return connection


def call(connection: sqlite3.Connection, params: list[tuple[str, str]], user: User | None = User("admin", "admin"), path: str = "/api/compare") -> httpx.Response:
    app = FastAPI()
    app.include_router(compare.router, prefix="/api/compare")
    app.dependency_overrides[get_db] = lambda: connection
    if user is not None:
        app.dependency_overrides[require_viewer] = lambda: user

    async def run() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path, params=params)

    return asyncio.run(run())


def targets(*labels: str, **extra: str) -> list[tuple[str, str]]:
    return [("target", label) for label in labels] + list(extra.items())


@pytest.fixture
def basic_db() -> Iterator[sqlite3.Connection]:
    connection = make_db(
        [
            row("zfs", iops=1000.0, bandwidth=100.0, avg_latency=2.0, p95_latency=4.0, p99_latency=8.0),
            row("ceph", protocol="rbd", iops=1500.0, bandwidth=80.0, avg_latency=1.0, p95_latency=5.0, p99_latency=8.0),
        ]
    )
    yield connection
    connection.close()


# --- validation -----------------------------------------------------------


def test_requires_at_least_two_targets(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs"))
    assert response.status_code == 400


def test_rejects_more_than_ten_targets(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets(*[f"h{i}" for i in range(11)]))
    assert response.status_code == 400


@pytest.mark.parametrize("bad", ["zfs||ssd", "|local", "a|b|c|d|e", "zfs| ", ""])
def test_rejects_malformed_target(basic_db: sqlite3.Connection, bad: str) -> None:
    response = call(basic_db, targets("ceph", bad))
    assert response.status_code == 400


def test_rejects_duplicate_targets(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs", "zfs"))
    assert response.status_code == 400


def test_rejects_unknown_source(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs", "ceph", source="archive"))
    assert response.status_code in (400, 422)


def test_unknown_target_returns_404_naming_it(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs", "nope|nfs"))
    assert response.status_code == 404
    assert "nope|nfs" in response.json()["detail"]


def test_requires_authentication(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs", "ceph"), user=None)
    assert response.status_code == 401


def test_row_cap_returns_413(basic_db: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(compare, "ROW_LIMITS", {"test_runs": 0, "test_runs_all": 0})
    response = call(basic_db, targets("zfs", "ceph"))
    assert response.status_code == 413


# --- comparison -----------------------------------------------------------


def test_basic_two_target_diff_and_better_flags(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs", "ceph"))
    assert response.status_code == 200
    body = response.json()

    assert body["baseline"] == "zfs"
    assert body["targets"] == ["zfs", "ceph"]
    assert len(body["rows"]) == 1
    entry = body["rows"][0]
    assert {k: entry[k] for k in ("read_write_pattern", "block_size", "sync", "direct", "num_jobs", "iodepth")} == {
        "read_write_pattern": "randread",
        "block_size": "4K",
        "sync": "none",
        "direct": 1,
        "num_jobs": 1,
        "iodepth": 1,
    }
    assert entry["results"]["zfs"]["iops"] == 1000.0
    assert entry["results"]["ceph"]["rows_merged"] == 1
    assert entry["diff_pct"]["ceph"] == {"iops": 50.0, "bandwidth": -20.0, "avg_latency": -50.0, "p95_latency": 25.0, "p99_latency": 0.0}
    assert entry["better"]["ceph"] == {"iops": True, "bandwidth": False, "avg_latency": True, "p95_latency": False, "p99_latency": False}
    assert "zfs" not in entry["diff_pct"]

    summary = body["summary"]["ceph"]
    assert summary["configs_compared"] == 1
    assert summary["median_diff_pct"]["iops"] == 50.0
    assert summary["median_diff_pct"]["avg_latency"] == -50.0


def test_trailing_slash_variant(basic_db: sqlite3.Connection) -> None:
    response = call(basic_db, targets("zfs", "ceph"), path="/api/compare/")
    assert response.status_code == 200


def test_diff_rounded_to_one_decimal() -> None:
    connection = make_db([row("a", iops=3.0), row("b", iops=4.0)])
    body = call(connection, targets("a", "b")).json()
    assert body["rows"][0]["diff_pct"]["b"]["iops"] == 33.3


def test_wildcard_and_partial_targets() -> None:
    connection = make_db(
        [
            row("ceph-node1", protocol="rbd", drive_type="hdd", drive_model="rbd-pool", iops=2000.0),
            row("ceph-node1", protocol="rbd", drive_type="hdd", drive_model="other-pool", iops=9999.0),
            row("zfs-host", protocol="local", drive_type="raidz1", drive_model="tank", iops=1000.0),
        ]
    )
    response = call(connection, targets("zfs-host|local", "ceph-node1|*|*|rbd-pool"))
    assert response.status_code == 200
    body = response.json()
    assert body["targets"] == ["zfs-host|local", "ceph-node1|*|*|rbd-pool"]
    assert body["rows"][0]["results"]["ceph-node1|*|*|rbd-pool"]["iops"] == 2000.0
    assert body["rows"][0]["diff_pct"]["ceph-node1|*|*|rbd-pool"]["iops"] == 100.0


def test_three_targets_compared_against_baseline() -> None:
    connection = make_db([row("a", iops=100.0), row("b", iops=150.0), row("c", iops=50.0)])
    body = call(connection, targets("a", "b", "c")).json()
    diff = body["rows"][0]["diff_pct"]
    assert diff["b"]["iops"] == 50.0
    assert diff["c"]["iops"] == -50.0
    assert body["rows"][0]["better"]["c"]["iops"] is False
    assert set(body["summary"]) == {"b", "c"}


def test_zero_baseline_gives_null_diff() -> None:
    connection = make_db([row("a", iops=0.0, avg_latency=None), row("b", iops=10.0, avg_latency=1.0)])
    entry = call(connection, targets("a", "b")).json()["rows"][0]
    assert entry["diff_pct"]["b"]["iops"] is None
    assert entry["diff_pct"]["b"]["avg_latency"] is None
    assert entry["better"]["b"]["iops"] is None
    assert entry["better"]["b"]["avg_latency"] is None


def test_newest_row_wins_and_rows_merged() -> None:
    connection = make_db(
        [
            row("a", iops=100.0),
            row("b", drive_model="d1", iops=110.0, timestamp="2026-09-01T10:00:00+00:00"),
            row("b", drive_model="d2", iops=200.0, timestamp="2026-09-05T10:00:00+00:00"),
            row("b", drive_model="d3", iops=300.0, timestamp="2026-09-03T10:00:00+00:00"),
        ]
    )
    cell = call(connection, targets("a", "b")).json()["rows"][0]["results"]["b"]
    assert cell["iops"] == 200.0
    assert cell["rows_merged"] == 3
    assert cell["timestamp"] == "2026-09-05T10:00:00+00:00"


def test_incomplete_keys_excluded_by_default_and_included_on_request() -> None:
    connection = make_db(
        [
            row("a", block_size="4K"),
            row("a", block_size="1M"),  # baseline only
            row("b", block_size="4K"),
            row("b", block_size="64K"),  # other only
        ]
    )
    default = call(connection, targets("a", "b")).json()
    assert [r["block_size"] for r in default["rows"]] == ["4K"]

    full = call(connection, targets("a", "b", include_incomplete="true")).json()
    assert [r["block_size"] for r in full["rows"]] == ["4K", "64K", "1M"]
    by_bs = {r["block_size"]: r for r in full["rows"]}
    assert by_bs["1M"]["results"]["b"] is None
    assert by_bs["1M"]["diff_pct"]["b"]["iops"] is None
    assert by_bs["64K"]["results"]["a"] is None
    assert full["summary"]["b"]["configs_compared"] == 1


def test_rows_sorted_by_pattern_block_size_sync_jobs_iodepth() -> None:
    rows = []
    for host in ("a", "b"):
        rows += [
            row(host, read_write_pattern="write", block_size="4K"),
            row(host, read_write_pattern="randread", block_size="1M"),
            row(host, read_write_pattern="randread", block_size="4k", sync="dsync"),
            row(host, read_write_pattern="randread", block_size="4k", sync="sync"),
            row(host, read_write_pattern="randread", block_size="4k", iodepth=32),
            row(host, read_write_pattern="randread", block_size="4k", num_jobs=4),
            row(host, read_write_pattern="randread", block_size="64K"),
        ]
    connection = make_db(rows)
    body = call(connection, targets("a", "b")).json()
    keys = [(r["read_write_pattern"], r["block_size"], r["sync"], r["num_jobs"], r["iodepth"]) for r in body["rows"]]
    assert keys == [
        ("randread", "4k", "none", 1, 32),
        ("randread", "4k", "none", 4, 1),
        ("randread", "4k", "sync", 1, 1),
        ("randread", "4k", "dsync", 1, 1),
        ("randread", "64K", "none", 1, 1),
        ("randread", "1M", "none", 1, 1),
        ("write", "4K", "none", 1, 1),
    ]


def test_summary_median_over_configs() -> None:
    rows = [row("a", block_size=bs, iops=100.0) for bs in ("4K", "64K", "1M")]
    rows += [row("b", block_size="4K", iops=110.0), row("b", block_size="64K", iops=130.0), row("b", block_size="1M", iops=200.0)]
    summary = call(make_db(rows), targets("a", "b")).json()["summary"]["b"]
    assert summary["configs_compared"] == 3
    assert summary["median_diff_pct"]["iops"] == 30.0


# --- filters --------------------------------------------------------------


@pytest.fixture
def filter_db() -> Iterator[sqlite3.Connection]:
    rows = []
    for host, iops in (("a", 100.0), ("b", 200.0)):
        rows += [
            row(host, read_write_pattern="randread", sync="none", description="prefill:1", iops=iops),
            row(host, read_write_pattern="randwrite", sync="sync", description="prefill:0", iops=iops),
            row(host, read_write_pattern="randwrite", block_size="1M", sync="dsync", description="prefill:1", iops=iops),
        ]
    connection = make_db(rows)
    yield connection
    connection.close()


def test_tags_filter(filter_db: sqlite3.Connection) -> None:
    body = call(filter_db, targets("a", "b", tags="prefill:1")).json()
    assert {r["sync"] for r in body["rows"]} == {"none", "dsync"}


def test_patterns_filter(filter_db: sqlite3.Connection) -> None:
    body = call(filter_db, targets("a", "b", patterns="randwrite")).json()
    assert {r["read_write_pattern"] for r in body["rows"]} == {"randwrite"}
    assert len(body["rows"]) == 2


def test_syncs_filter_accepts_legacy_values(filter_db: sqlite3.Connection) -> None:
    body = call(filter_db, targets("a", "b", syncs="1,dsync")).json()
    assert {r["sync"] for r in body["rows"]} == {"sync", "dsync"}


def test_block_sizes_filter(filter_db: sqlite3.Connection) -> None:
    body = call(filter_db, targets("a", "b", block_sizes="1M")).json()
    assert [r["block_size"] for r in body["rows"]] == ["1M"]


def test_invalid_sync_filter_is_400(filter_db: sqlite3.Connection) -> None:
    assert call(filter_db, targets("a", "b", syncs="bogus")).status_code == 400


def test_filter_leaving_target_empty_is_404(filter_db: sqlite3.Connection) -> None:
    response = call(filter_db, targets("a", "b", tags="prefill:9"))
    assert response.status_code == 404


def test_history_source_picks_newest() -> None:
    latest = [row("a", iops=100.0), row("b", iops=100.0)]
    history = latest + [
        row("b", iops=300.0, timestamp="2026-09-10T10:00:00+00:00"),
        row("b", iops=50.0, timestamp="2026-08-01T10:00:00+00:00"),
    ]
    connection = make_db(latest, history)

    latest_body = call(connection, targets("a", "b", source="latest")).json()
    assert latest_body["rows"][0]["results"]["b"]["iops"] == 100.0

    history_body = call(connection, targets("a", "b", source="history")).json()
    cell = history_body["rows"][0]["results"]["b"]
    assert cell["iops"] == 300.0
    assert cell["rows_merged"] == 3
    assert history_body["rows"][0]["diff_pct"]["b"]["iops"] == 200.0


def test_run_uuid_filter() -> None:
    connection = make_db(
        [row("a", iops=100.0), row("b", iops=100.0, run_uuid="old"), row("b", iops=500.0, run_uuid="new", timestamp="2026-09-02T00:00:00+00:00")],
    )
    body = call(connection, targets("a", "b", source="history", run_uuid="run-1,old")).json()
    assert body["rows"][0]["results"]["b"]["iops"] == 100.0


# --- strict matching: only comparable runs (test size, duration, layout tags) ---------------------------


def test_layout_signature_uses_only_layout_tags() -> None:
    assert compare.layout_signature("tester,hostname:h,prefill:1,fileperjob:1,satcap:100G,date:x") == "fileperjob:1,prefill:1,satcap:100G"
    assert compare.layout_signature("hostname:h,run_uuid:abc") == ""
    assert compare.layout_signature(None) == ""


def mixed_db() -> sqlite3.Connection:
    """Host a has a real 10G/60 s run and a newer 256M/5 s smoke test; host b only the real run."""
    return make_db(
        [
            row("a", iops=1000.0),
            row("a", test_size="256M", duration=5, iops=3490.0, timestamp="2026-09-02T10:00:00+00:00"),
            row("b", iops=1100.0),
        ]
    )


def test_strict_is_default_and_never_mixes_test_sizes() -> None:
    body = call(mixed_db(), targets("a", "b")).json()
    assert len(body["rows"]) == 1
    [compared] = body["rows"]
    assert (compared["test_size"], compared["duration"], compared["layout"]) == ("10G", 60, "")
    assert compared["results"]["a"]["iops"] == 1000.0
    assert compared["diff_pct"]["b"]["iops"] == 10.0


def test_strict_keeps_prefill_runs_apart() -> None:
    db = make_db([row("a", description="hostname:a,prefill:1"), row("b", description="hostname:b")])
    assert call(db, targets("a", "b")).json()["rows"] == []
    rows = call(db, targets("a", "b", include_incomplete="true")).json()["rows"]
    assert sorted(r["layout"] for r in rows) == ["", "prefill:1"]


def test_strict_keeps_client_counts_apart() -> None:
    """The aggregate of 4 fio clients is not comparable with a single host."""
    db = make_db([row("a", clients=4, iops=400.0), row("b", clients=1, iops=100.0), row("b", clients=4, iops=380.0)])
    [compared] = call(db, targets("a", "b")).json()["rows"]
    assert compared["clients"] == 4
    assert compared["diff_pct"]["b"]["iops"] == -5.0
    loose = call(db, targets("a", "b", strict="false")).json()["rows"]
    assert any("clients" in r["mismatch"] for r in loose)


def test_strict_compares_runs_with_identical_layout() -> None:
    db = make_db([row("a", description="x,prefill:1", iops=100.0), row("b", description="y,prefill:1", iops=150.0)])
    [compared] = call(db, targets("a", "b")).json()["rows"]
    assert compared["layout"] == "prefill:1"
    assert compared["diff_pct"]["b"]["iops"] == 50.0


def test_loose_mode_marks_mismatched_rows() -> None:
    body = call(mixed_db(), targets("a", "b", strict="false")).json()
    [compared] = body["rows"]
    assert "test_size" not in compared
    assert compared["mismatch"] == ["test_size", "duration"]
    assert compared["results"]["a"]["test_size"] == "256M"
    assert body["summary"]["b"]["configs_mismatched"] == 1


def test_loose_mode_without_differences_has_empty_mismatch() -> None:
    db = make_db([row("a"), row("b")])
    [compared] = call(db, targets("a", "b", strict="false")).json()["rows"]
    assert compared["mismatch"] == []


def test_test_size_spelling_is_normalized() -> None:
    db = make_db([row("a", test_size="10g"), row("b", test_size="10G")])
    assert len(call(db, targets("a", "b")).json()["rows"]) == 1


def test_targets_lists_hierarchy_combinations_with_counts() -> None:
    db = make_db([row("a"), row("a", block_size="64K"), row("b", drive_model="m2")])
    body = call(db, [], path="/api/compare/targets").json()
    assert body["targets"] == [
        {"hostname": "a", "protocol": "local", "drive_type": "ssd", "drive_model": "m1", "target": "a|local|ssd|m1", "test_runs": 2, "last_run": "2026-09-01T10:00:00+00:00"},
        {"hostname": "b", "protocol": "local", "drive_type": "ssd", "drive_model": "m2", "target": "b|local|ssd|m2", "test_runs": 1, "last_run": "2026-09-01T10:00:00+00:00"},
    ]


def test_targets_requires_authentication() -> None:
    assert call(make_db([row("a")]), [], user=None, path="/api/compare/targets").status_code == 401


# --- default source: newest comparable run per target; hints when strict finds less ---------------------


def replaced_by_prefill_db() -> sqlite3.Connection:
    """The latest table only keeps a's newer prefill run; history still has a's plain run."""
    latest = [row("a", description="x,prefill:1", iops=900.0, timestamp="2026-09-03T10:00:00+00:00"), row("b", iops=1000.0)]
    history = [
        row("a", iops=800.0, timestamp="2026-09-01T10:00:00+00:00"),
        row("a", description="x,prefill:1", iops=900.0, timestamp="2026-09-03T10:00:00+00:00"),
        row("b", iops=1000.0),
    ]
    return make_db(latest, history)


def test_default_source_uses_newest_comparable_run_from_history() -> None:
    body = call(replaced_by_prefill_db(), targets("a", "b")).json()
    assert body["source"] == "newest"
    [compared] = body["rows"]
    assert compared["results"]["a"]["iops"] == 800.0
    assert compared["diff_pct"]["b"]["iops"] == 25.0


def test_latest_source_keeps_old_behaviour_and_explains_empty_result() -> None:
    body = call(replaced_by_prefill_db(), targets("a", "b", source="latest")).json()
    assert body["rows"] == []
    assert body["match_counts"] == {"strict": 0, "loose": 1}
    assert "source=newest" in body["hint"] and "strict=false" in body["hint"]


def test_no_hint_when_strict_finds_everything() -> None:
    body = call(make_db([row("a"), row("b")]), targets("a", "b")).json()
    assert body["match_counts"] == {"strict": 1, "loose": 1}
    assert body["hint"] is None


def test_history_is_an_alias_of_newest() -> None:
    assert call(replaced_by_prefill_db(), targets("a", "b", source="history")).json()["rows"][0]["results"]["a"]["iops"] == 800.0


def test_total_row_cap_across_targets(monkeypatch: pytest.MonkeyPatch) -> None:
    """Many wide targets must not pull an unbounded number of history rows into memory."""
    monkeypatch.setattr(compare, "MAX_TOTAL_ROWS", 3)
    db = make_db([row("a"), row("a", block_size="64K"), row("b"), row("b", block_size="64K")])
    response = call(db, targets("a", "b"))
    assert response.status_code == 413
    assert "all targets" in response.json()["detail"]


def test_compare_handler_runs_in_threadpool() -> None:
    """sqlite work must not block the event loop."""
    import inspect

    assert not inspect.iscoroutinefunction(compare.compare_targets)
