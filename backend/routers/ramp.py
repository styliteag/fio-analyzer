"""
Ramp API router: multi-client ramps (fio client mode with a growing client count).

A ramp_uuid groups the steps of one test configuration; every step is one row in
test_runs_all (aggregate over all clients) plus one row per client in client_results.
"""

import json
import sqlite3
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.middleware import User, require_viewer
from database.client_migration import CLIENT_RESULTS_TABLE
from database.client_results import MAX_RAMP_CLIENT_ROWS, MAX_RAMP_STEPS
from database.connection import get_db
from utils.ramp_summary import client_fairness, summarize_ramp
from utils.storage_info import decode_storage_info

router = APIRouter()

DEFAULT_THRESHOLD_MS = 100.0
CONFIG_COLUMNS = (
    "hostname",
    "protocol",
    "drive_type",
    "drive_model",
    "block_size",
    "read_write_pattern",
    "iodepth",
    "num_jobs",
    "direct",
    "sync",
    "test_size",
    "duration",
)
STEP_COLUMNS = (
    "id, run_uuid, timestamp, clients, client_hosts, description, iops, bandwidth, avg_latency, p95_latency, p99_latency, "
    + ", ".join(CONFIG_COLUMNS)
)
CLIENT_COLUMNS = "test_run_id, client_index, client_host, client_port, iops, read_iops, write_iops, bandwidth, avg_latency, p95_latency, p99_latency, error, storage_info"


def _dicts(cursor: sqlite3.Cursor) -> List[Dict[str, Any]]:
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, values)) for values in cursor.fetchall()]


def _client_hosts(stored: Optional[str]) -> Optional[List[str]]:
    try:
        hosts = json.loads(stored) if stored else None
    except ValueError:
        return None
    return hosts if isinstance(hosts, list) else None


def _client_row(row: Dict[str, Any]) -> Dict[str, Any]:
    storage = decode_storage_info(row["storage_info"])
    return {
        **{key: value for key, value in row.items() if key not in ("test_run_id", "storage_info")},
        "client_name": storage.get("client_name") if storage else None,
        "storage_info": storage,
    }


def load_ramp_steps(db: sqlite3.Connection, ramp_uuid: str) -> List[Dict[str, Any]]:
    """All uploaded steps of one ramp with their per-client rows; 404 if the ramp is unknown."""
    steps = _dicts(
        db.execute(f"SELECT {STEP_COLUMNS} FROM test_runs_all WHERE ramp_uuid = ? ORDER BY clients, id LIMIT ?", (ramp_uuid, MAX_RAMP_STEPS + 1))
    )
    if not steps:
        raise HTTPException(status_code=404, detail="Unknown ramp_uuid")
    clients = _dicts(
        db.execute(
            f"SELECT {CLIENT_COLUMNS} FROM {CLIENT_RESULTS_TABLE} WHERE ramp_uuid = ? ORDER BY test_run_id, client_index LIMIT ?",
            (ramp_uuid, MAX_RAMP_CLIENT_ROWS + 1),
        )
    )
    if len(steps) > MAX_RAMP_STEPS or len(clients) > MAX_RAMP_CLIENT_ROWS:
        raise HTTPException(status_code=413, detail="Ramp is too large to load in one response")
    by_step: Dict[int, List[Dict[str, Any]]] = {}
    for client in clients:
        by_step.setdefault(client["test_run_id"], []).append(client)
    return [
        {**step, "client_hosts": _client_hosts(step["client_hosts"]), "client_rows": [_client_row(c) for c in by_step.get(step["id"], [])]}
        for step in steps
    ]


@router.get(
    "/runs",
    summary="List Client Ramps",
    description="Multi-client ramps (one per ramp_uuid), newest first, with their test configuration, "
    "the client counts that were run and the number of uploaded steps.",
)
async def list_ramps(
    hostname: Optional[str] = Query(None, description="Only ramps uploaded with this hostname (the controller)"),
    run_uuid: Optional[str] = Query(None, description="Only ramps of this script run"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of ramps"),
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    filters = ["ramp_uuid IS NOT NULL"]
    params: List[Any] = []
    for column, value in (("hostname", hostname), ("run_uuid", run_uuid)):
        if value is not None:
            filters.append(f"{column} = ?")
            params.append(value)
    config = ", ".join(f"MAX({column}) AS {column}" for column in CONFIG_COLUMNS)
    cursor = db.execute(
        f"""
        SELECT ramp_uuid, MAX(run_uuid) AS run_uuid, {config},
               COUNT(*) AS steps, MIN(clients) AS min_clients, MAX(clients) AS max_clients,
               GROUP_CONCAT(DISTINCT clients) AS client_counts,
               MIN(timestamp) AS first_timestamp, MAX(timestamp) AS last_timestamp
        FROM test_runs_all WHERE {' AND '.join(filters)}
        GROUP BY ramp_uuid ORDER BY last_timestamp DESC LIMIT ?
        """,
        (*params, limit),
    )
    return [
        {**row, "client_counts": sorted(int(value) for value in (row["client_counts"] or "").split(",") if value)} for row in _dicts(cursor)
    ]


@router.get(
    "/runs/{ramp_uuid}",
    summary="Client Ramp Details",
    description="All steps of one multi-client ramp in client-count order: aggregate metrics over all clients "
    "(from fio's \"All clients\" result) and the per-client results with each client's storage_info.",
    responses={404: {"description": "Unknown ramp_uuid"}},
)
async def get_ramp(
    ramp_uuid: str,
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    steps = load_ramp_steps(db, ramp_uuid)
    first = steps[0]
    return {
        "ramp_uuid": ramp_uuid,
        "run_uuid": first["run_uuid"],
        **{column: first[column] for column in CONFIG_COLUMNS},
        "steps": [
            {
                **{k: v for k, v in step.items() if k not in CONFIG_COLUMNS and k != "client_rows"},
                "fairness": client_fairness(step["client_rows"]),
                "clients_detail": step["client_rows"],
            }
            for step in steps
        ],
    }


@router.get(
    "/runs/{ramp_uuid}/summary",
    summary="Client Ramp Summary",
    description="How the storage scales with the number of clients: the highest client count whose P95 latency stays "
    "within `threshold_ms`, the first client count above it, the step with the highest aggregate IOPS, the drop of "
    "per-client IOPS from the smallest to the largest complete step, and per step the fairness (slowest / fastest "
    "client IOPS). Incomplete steps (a client failed) are listed but not ranked. For repeated client counts the newest "
    "upload counts.",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "ramp_uuid": "0b7c3f6e-2d1a-4c55-9a0e-6f1d2c3b4a59",
                        "hostname": "ctrl01",
                        "threshold_ms": 10.0,
                        "status": "saturated",
                        "best_within": {"clients": 4, "iops": 30000.0, "per_client_iops": 7500.0, "p95_latency": 9.0},
                        "crossed_at": {"clients": 6, "iops": 31000.0, "per_client_iops": 5166.7, "p95_latency": 25.0},
                        "max_iops": {"clients": 6, "iops": 31000.0},
                        "per_client_iops_drop_pct": 48.3,
                        "incomplete_steps": 0,
                        "steps": [],
                    }
                }
            }
        },
        404: {"description": "Unknown ramp_uuid"},
    },
)
async def get_ramp_summary(
    ramp_uuid: str,
    threshold_ms: float = Query(DEFAULT_THRESHOLD_MS, gt=0, le=100000, description="P95 latency threshold in ms"),
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    steps = load_ramp_steps(db, ramp_uuid)
    return {
        "ramp_uuid": ramp_uuid,
        **{column: steps[0][column] for column in CONFIG_COLUMNS},
        **summarize_ramp(steps, threshold_ms),
    }
