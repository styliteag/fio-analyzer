"""
Compare API router: two or more storage combinations side by side per test
configuration, with the difference to the first (baseline) target in percent.

A target follows the Host-Protocol-Type-Model hierarchy as
`hostname|protocol|drive_type|drive_model`; trailing parts may be omitted and
any part may be `*` to match everything on that level.
"""

import re
import sqlite3
import statistics
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.middleware import User, require_viewer
from database.connection import get_db
from utils.logging import log_error
from utils.run_filters import MAX_VALUES, build_run_filters
from utils.sync_mode import SYNC_MODES, parse_sync_filter

router = APIRouter()

MIN_TARGETS = 2
MAX_TARGETS = 10
MAX_ROWS_PER_TARGET = 5000

SOURCE_TABLES = {"latest": "test_runs", "history": "test_runs_all"}
HIERARCHY_COLUMNS = ("hostname", "protocol", "drive_type", "drive_model")
KEY_COLUMNS = ("read_write_pattern", "block_size", "sync", "direct", "num_jobs", "iodepth")
METRICS = ("iops", "bandwidth", "avg_latency", "p95_latency", "p99_latency")
HIGHER_IS_BETTER = frozenset({"iops", "bandwidth"})
SELECT_COLUMNS = KEY_COLUMNS + METRICS + ("timestamp",)
WILDCARD = "*"

BLOCK_SIZE_PATTERN = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*([kmgt]?)(?:i?b)?\s*$", re.IGNORECASE)
UNIT_FACTORS = {"": 1, "k": 1024, "m": 1024**2, "g": 1024**3, "t": 1024**4}

ConfigKey = Tuple[Any, ...]


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


def parse_target(raw: str) -> Tuple[Optional[str], ...]:
    """Split `host|protocol|type|model` into hierarchy values; None means wildcard."""
    parts = [part.strip() for part in raw.split("|")]
    if not 1 <= len(parts) <= len(HIERARCHY_COLUMNS) or any(not part for part in parts):
        raise _bad_request(f"Invalid target {raw[:80]!r}: expected hostname|protocol|drive_type|drive_model with 1-4 non-empty parts")
    return tuple(None if part == WILDCARD else part for part in parts)


def _validate_targets(target: Optional[List[str]]) -> List[str]:
    labels = [label.strip() for label in (target or [])]
    if not MIN_TARGETS <= len(labels) <= MAX_TARGETS:
        raise _bad_request(f"Provide between {MIN_TARGETS} and {MAX_TARGETS} target parameters")
    if len(set(labels)) != len(labels):
        raise _bad_request("Targets must be unique")
    return labels


def _split_list(raw: Optional[str], name: str) -> List[str]:
    values = [value.strip() for value in (raw or "").split(",") if value.strip()]
    if len(values) > MAX_VALUES:
        raise _bad_request(f"Too many {name} values (max {MAX_VALUES})")
    return values


def _in_condition(column: str, values: List[str]) -> Tuple[List[str], List[Any]]:
    if not values:
        return [], []
    return [f"{column} IN ({','.join('?' for _ in values)})"], list(values)


def build_shared_filters(
    tags: Optional[str],
    since: Optional[str],
    until: Optional[str],
    run_uuid: Optional[str],
    patterns: Optional[str],
    block_sizes: Optional[str],
    syncs: Optional[str],
) -> Tuple[List[str], List[Any]]:
    """Conditions applied to every target: run filters plus pattern/block size/sync lists."""
    conditions, params = build_run_filters(tags=tags, since=since, until=until, run_uuids=run_uuid)
    sync_values = parse_sync_filter(syncs) if syncs else []
    for column, values in (
        ("read_write_pattern", _split_list(patterns, "patterns")),
        ("block_size", _split_list(block_sizes, "block_sizes")),
        ("sync", sync_values),
    ):
        extra_conditions, extra_params = _in_condition(column, values)
        conditions = [*conditions, *extra_conditions]
        params = [*params, *extra_params]
    return conditions, params


def fetch_target_rows(db: sqlite3.Connection, table: str, label: str, shared: Tuple[List[str], List[Any]]) -> List[Dict[str, Any]]:
    """Rows of one target; table and column names come from fixed constants only."""
    hierarchy = parse_target(label)
    conditions = [f"{column} = ?" for column, value in zip(HIERARCHY_COLUMNS, hierarchy) if value is not None]
    params: List[Any] = [value for value in hierarchy if value is not None]
    conditions = [*conditions, *shared[0]]
    params = [*params, *shared[1]]
    where = " AND ".join(conditions) if conditions else "1 = 1"
    sql = f"SELECT {', '.join(SELECT_COLUMNS)} FROM {table} WHERE {where} LIMIT ?"
    cursor = db.execute(sql, [*params, MAX_ROWS_PER_TARGET + 1])
    names = [description[0] for description in cursor.description]
    rows = [dict(zip(names, values)) for values in cursor.fetchall()]
    if len(rows) > MAX_ROWS_PER_TARGET:
        raise HTTPException(status_code=413, detail=f"Target {label!r} matches more than {MAX_ROWS_PER_TARGET} rows; narrow it or add filters")
    if not rows:
        raise HTTPException(status_code=404, detail=f"No test runs found for target {label!r}")
    return rows


def newest_per_config(rows: List[Dict[str, Any]]) -> Dict[ConfigKey, Dict[str, Any]]:
    """Keep the newest row per config key and count how many rows were merged."""
    grouped: Dict[ConfigKey, List[Dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(tuple(row[column] for column in KEY_COLUMNS), []).append(row)
    cells: Dict[ConfigKey, Dict[str, Any]] = {}
    for key, group in grouped.items():
        newest = max(group, key=lambda item: item["timestamp"] or "")
        cells[key] = {**{metric: newest[metric] for metric in METRICS}, "timestamp": newest["timestamp"], "rows_merged": len(group)}
    return cells


def diff_pct(value: Optional[float], baseline: Optional[float]) -> Optional[float]:
    if value is None or baseline is None or baseline == 0:
        return None
    return round((value - baseline) / baseline * 100, 1)


def is_better(metric: str, diff: Optional[float]) -> Optional[bool]:
    if diff is None:
        return None
    return diff > 0 if metric in HIGHER_IS_BETTER else diff < 0


def block_size_bytes(value: Any) -> float:
    match = BLOCK_SIZE_PATTERN.match(str(value or ""))
    if not match:
        return float("inf")
    return float(match.group(1)) * UNIT_FACTORS[match.group(2).lower()]


def _nullable(value: Any) -> Tuple[bool, Any]:
    return (value is None, value if value is not None else 0)


def sort_key(key: ConfigKey) -> Tuple[Any, ...]:
    pattern, block_size, sync, direct, num_jobs, iodepth = key
    sync_rank = SYNC_MODES.index(sync) if sync in SYNC_MODES else len(SYNC_MODES)
    return (
        str(pattern or ""),
        block_size_bytes(block_size),
        str(block_size or ""),
        sync_rank,
        str(sync or ""),
        _nullable(num_jobs),
        _nullable(iodepth),
        _nullable(direct),
    )


def _compare_cells(base: Optional[Dict[str, Any]], cell: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    diffs = {metric: diff_pct(cell and cell[metric], base and base[metric]) for metric in METRICS}
    return diffs, {metric: is_better(metric, diffs[metric]) for metric in METRICS}


def build_row(key: ConfigKey, labels: List[str], cells: Dict[str, Dict[ConfigKey, Dict[str, Any]]]) -> Dict[str, Any]:
    results = {label: cells[label].get(key) for label in labels}
    base = results[labels[0]]
    compared = {label: _compare_cells(base, results[label]) for label in labels[1:]}
    return {
        **dict(zip(KEY_COLUMNS, key)),
        "results": results,
        "diff_pct": {label: pair[0] for label, pair in compared.items()},
        "better": {label: pair[1] for label, pair in compared.items()},
    }


def build_summary(rows: List[Dict[str, Any]], labels: List[str]) -> Dict[str, Any]:
    summary: Dict[str, Any] = {}
    for label in labels[1:]:
        compared = [row for row in rows if row["results"][labels[0]] and row["results"][label]]
        medians = {}
        for metric in METRICS:
            values = [row["diff_pct"][label][metric] for row in compared if row["diff_pct"][label][metric] is not None]
            medians[metric] = round(statistics.median(values), 1) if values else None
        summary[label] = {"configs_compared": len(compared), "median_diff_pct": medians}
    return summary


def build_comparison(labels: List[str], cells: Dict[str, Dict[ConfigKey, Dict[str, Any]]], include_incomplete: bool) -> Dict[str, Any]:
    baseline_keys = set(cells[labels[0]])
    other_keys = set().union(*(cells[label] for label in labels[1:]))
    keys = baseline_keys | other_keys if include_incomplete else baseline_keys & other_keys
    rows = [build_row(key, labels, cells) for key in sorted(keys, key=sort_key)]
    return {"baseline": labels[0], "targets": labels, "rows": rows, "summary": build_summary(rows, labels)}


COMPARE_EXAMPLE = {
    "baseline": "zfs-host|local",
    "targets": ["zfs-host|local", "ceph-node1|*|*|rbd-pool"],
    "rows": [
        {
            "read_write_pattern": "randread",
            "block_size": "4K",
            "sync": "none",
            "direct": 1,
            "num_jobs": 1,
            "iodepth": 32,
            "results": {
                "zfs-host|local": {
                    "iops": 85000.0,
                    "bandwidth": 332.0,
                    "avg_latency": 0.37,
                    "p95_latency": 0.52,
                    "p99_latency": 0.81,
                    "timestamp": "2025-06-31T20:00:00",
                    "rows_merged": 1,
                },
                "ceph-node1|*|*|rbd-pool": {
                    "iops": 42000.0,
                    "bandwidth": 164.0,
                    "avg_latency": 0.76,
                    "p95_latency": 1.2,
                    "p99_latency": 2.1,
                    "timestamp": "2025-06-31T20:00:00",
                    "rows_merged": 2,
                },
            },
            "diff_pct": {"ceph-node1|*|*|rbd-pool": {"iops": -50.6, "bandwidth": -50.6, "avg_latency": 105.4, "p95_latency": 130.8, "p99_latency": 159.3}},
            "better": {"ceph-node1|*|*|rbd-pool": {"iops": False, "bandwidth": False, "avg_latency": False, "p95_latency": False, "p99_latency": False}},
        }
    ],
    "summary": {
        "ceph-node1|*|*|rbd-pool": {
            "configs_compared": 1,
            "median_diff_pct": {"iops": -50.6, "bandwidth": -50.6, "avg_latency": 105.4, "p95_latency": 130.8, "p99_latency": 159.3},
        }
    },
}


@router.get(
    "",
    summary="Compare Storage Combinations",
    description=(
        "Compare 2-10 storage combinations side by side per test configuration "
        "(read_write_pattern, block_size, sync, direct, num_jobs, iodepth). The first target is the baseline; "
        "every other target gets `diff_pct` = (value - baseline) / baseline * 100 (1 decimal, null if the baseline "
        "is missing or 0) and a `better` flag per metric (higher is better for iops/bandwidth, lower for latencies).\n\n"
        "A target is `hostname|protocol|drive_type|drive_model`; trailing parts may be omitted and any part may be `*`, "
        "e.g. `target=zfs-host|local&target=ceph-node1|*|*|rbd-pool`. If a target has several rows for one "
        "configuration, the newest wins and `rows_merged` reports how many were merged. By default only configurations "
        "present for the baseline and at least one other target are returned."
    ),
    response_description="Per-configuration comparison with differences to the baseline",
    responses={
        200: {"description": "Comparison computed", "content": {"application/json": {"example": COMPARE_EXAMPLE}}},
        400: {"description": "Invalid target, source or filter"},
        401: {"description": "Authentication required"},
        403: {"description": "Read access required"},
        404: {"description": "A target matches no test runs"},
        413: {"description": f"A target matches more than {MAX_ROWS_PER_TARGET} rows"},
    },
)
@router.get("/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def compare_targets(
    target: Optional[List[str]] = Query(None, description="Repeatable, 2-10: hostname|protocol|drive_type|drive_model (trailing parts optional, `*` = any)"),
    source: str = Query("latest", description="`latest` (test_runs) or `history` (test_runs_all, newest row per configuration)"),
    tags: Optional[str] = Query(None, description="Comma-separated description tags, e.g. prefill:1"),
    since: Optional[str] = Query(None, description="Only runs at or after this date/datetime"),
    until: Optional[str] = Query(None, description="Only runs up to this date (inclusive) or datetime"),
    run_uuid: Optional[str] = Query(None, description="Comma-separated run UUIDs"),
    patterns: Optional[str] = Query(None, description="Comma-separated read_write_pattern values"),
    block_sizes: Optional[str] = Query(None, description="Comma-separated block sizes, e.g. 4K,1M"),
    syncs: Optional[str] = Query(None, description="Comma-separated sync modes: none, sync, dsync"),
    include_incomplete: bool = Query(False, description="Return every configuration, with null for missing targets"),
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    labels = _validate_targets(target)
    for label in labels:
        parse_target(label)
    if source not in SOURCE_TABLES:
        raise _bad_request(f"Invalid source {source[:40]!r}: expected one of {', '.join(SOURCE_TABLES)}")
    shared = build_shared_filters(tags, since, until, run_uuid, patterns, block_sizes, syncs)
    try:
        cells = {label: newest_per_config(fetch_target_rows(db, SOURCE_TABLES[source], label, shared)) for label in labels}
    except sqlite3.Error as error:
        log_error("Error computing comparison", error, {"user": user.username})
        raise HTTPException(status_code=500, detail="Failed to compute comparison")
    return build_comparison(labels, cells, include_incomplete)
