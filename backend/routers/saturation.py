"""
Saturation API router: per-run summary of where each pattern saturates.
"""

import sqlite3
from itertools import groupby
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.middleware import User, require_viewer
from database.connection import get_db

router = APIRouter()

STEP_COLUMNS = "id, hostname, read_write_pattern, block_size, sync, iodepth, num_jobs, iops, bandwidth, p95_latency, latency_threshold_ms"
GROUP_KEYS = ("read_write_pattern", "block_size", "sync")


def stored_threshold(rows: List[Dict[str, Any]]) -> Optional[float]:
    """Threshold stored with the run: taken from the first uploaded step (lowest id) that has one."""
    with_threshold = [row for row in rows if row["latency_threshold_ms"]]
    return min(with_threshold, key=lambda row: row["id"])["latency_threshold_ms"] if with_threshold else None


def _step(row: Dict[str, Any]) -> Dict[str, Any]:
    iodepth, num_jobs = row["iodepth"] or 1, row["num_jobs"] or 1
    return {
        "id": row["id"],
        "total_qd": iodepth * num_jobs,
        "iodepth": iodepth,
        "num_jobs": num_jobs,
        "iops": row["iops"],
        "bandwidth": row["bandwidth"],
        "p95_latency": row["p95_latency"],
    }


def summarize_pattern(rows: List[Dict[str, Any]], threshold_ms: float) -> Dict[str, Any]:
    """Best step (highest IOPS) with P95 within the threshold, and the first step above it (in run order)."""
    steps = [_step(row) for row in rows]
    within = [step for step in steps if step["p95_latency"] is not None and step["p95_latency"] <= threshold_ms]
    crossed = next((step for step in steps if step["p95_latency"] is not None and step["p95_latency"] > threshold_ms), None)
    best = max(within, key=lambda step: step["iops"] or 0) if within else None
    return {
        **{key: rows[0][key] for key in GROUP_KEYS},
        "status": "saturated" if crossed else "not_reached",
        "steps": len(steps),
        "best_within": best,
        "crossed_at": crossed,
    }


@router.get(
    "/runs/{run_uuid}/summary",
    summary="Saturation Summary of a Run",
    description="For each pattern (and block size / sync mode) of one saturation run: the step with the highest IOPS whose "
    "P95 latency stays within the threshold, and the first step that crossed it. The threshold is the one stored at upload "
    "(sent by fio-test.sh) unless `threshold_ms` is given; older runs have no stored threshold and need the parameter.",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "run_uuid": "f8a6209f-1b60-418d-ba97-9418300c0ade",
                        "hostname": "px1",
                        "threshold_ms": 20.0,
                        "threshold_source": "stored",
                        "patterns": [
                            {
                                "read_write_pattern": "randread",
                                "block_size": "4K",
                                "sync": "sync",
                                "status": "saturated",
                                "steps": 12,
                                "best_within": {"total_qd": 256, "iodepth": 64, "num_jobs": 4, "iops": 412000.0, "p95_latency": 18.2},
                                "crossed_at": {"total_qd": 512, "iodepth": 128, "num_jobs": 4, "iops": 415000.0, "p95_latency": 34.3},
                            }
                        ],
                    }
                }
            }
        },
        400: {"description": "No stored threshold for this run and no threshold_ms given"},
        404: {"description": "Unknown run_uuid"},
    },
)
async def get_saturation_summary(
    run_uuid: str,
    threshold_ms: Optional[float] = Query(None, gt=0, le=100000, description="P95 latency threshold in ms (overrides the stored one)"),
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    cursor = db.execute(f"SELECT {STEP_COLUMNS} FROM saturation_runs WHERE run_uuid = ? ORDER BY id", (run_uuid,))
    names = [column[0] for column in cursor.description]
    rows = [dict(zip(names, values)) for values in cursor.fetchall()]
    if not rows:
        raise HTTPException(status_code=404, detail="Unknown saturation run_uuid")

    stored = stored_threshold(rows)
    threshold = threshold_ms if threshold_ms is not None else stored
    if threshold is None:
        raise HTTPException(status_code=400, detail="This run has no stored threshold; pass threshold_ms")

    def key(row: Dict[str, Any]) -> tuple:
        return tuple(str(row[k]) for k in GROUP_KEYS)

    groups = [list(group) for _, group in groupby(sorted(rows, key=lambda r: (key(r), r["id"])), key=key)]
    return {
        "run_uuid": run_uuid,
        "hostname": rows[0]["hostname"],
        "threshold_ms": threshold,
        "threshold_source": "query" if threshold_ms is not None else "stored",
        "patterns": [summarize_pattern(group, threshold) for group in groups],
    }
