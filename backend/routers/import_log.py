"""
Import log API router: upload attempts per run_uuid, including rejected and failed imports.
"""

import sqlite3
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.middleware import User, require_viewer
from database.connection import get_db
from utils.run_filters import build_run_filters

router = APIRouter()

ENTRY_COLUMNS = "id, timestamp, status, http_status, detail, username, run_uuid, config_uuid, hostname, filename, target_table, test_run_id"


def _entries(db: sqlite3.Connection, where: str, params: List[Any], limit: int) -> List[Dict[str, Any]]:
    cursor = db.execute(f"SELECT {ENTRY_COLUMNS} FROM import_log WHERE {where} ORDER BY id DESC LIMIT ?", [*params, limit])
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def _count(db: sqlite3.Connection, table: str, run_uuid: str) -> int:
    return db.execute(f"SELECT COUNT(*) FROM {table} WHERE run_uuid = ?", (run_uuid,)).fetchone()[0]


@router.get(
    "/runs/{run_uuid}",
    summary="Upload Completeness of a Run",
    description="Counts upload attempts of one script run by outcome (imported, rejected, error) from the import log, "
    "plus the rows actually stored for that run_uuid. Runs uploaded before the import log existed only have `stored` counts.",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "run_uuid": "f8a6209f-1b60-418d-ba97-9418300c0ade",
                        "counts": {"imported": 54, "rejected": 1, "error": 0, "total": 55},
                        "stored": {"history": 0, "saturation": 54},
                        "hostnames": ["px1"],
                        "first_attempt": "2026-09-25T20:55:28+00:00",
                        "last_attempt": "2026-09-25T21:54:52+00:00",
                        "failures": [{"status": "rejected", "http_status": 400, "detail": "Unsupported sync value: 'x'"}],
                    }
                }
            }
        },
        404: {"description": "No upload attempts and no stored rows for this run_uuid"},
    },
)
async def get_run_import_summary(
    run_uuid: str,
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    by_status = dict(db.execute("SELECT status, COUNT(*) FROM import_log WHERE run_uuid = ? GROUP BY status", (run_uuid,)).fetchall())
    counts = {status: by_status.get(status, 0) for status in ("imported", "rejected", "error")}
    counts["total"] = sum(counts.values())
    stored = {"history": _count(db, "test_runs_all", run_uuid), "saturation": _count(db, "saturation_runs", run_uuid)}
    if counts["total"] == 0 and not any(stored.values()):
        raise HTTPException(status_code=404, detail="No uploads found for this run_uuid")

    first, last = db.execute("SELECT MIN(timestamp), MAX(timestamp) FROM import_log WHERE run_uuid = ?", (run_uuid,)).fetchone()
    hostnames = [row[0] for row in db.execute("SELECT DISTINCT hostname FROM import_log WHERE run_uuid = ? AND hostname IS NOT NULL ORDER BY 1", (run_uuid,))]
    failures = list(reversed(_entries(db, "run_uuid = ? AND status != 'imported'", [run_uuid], 1000)))
    return {
        "run_uuid": run_uuid,
        "counts": counts,
        "stored": stored,
        "hostnames": hostnames,
        "first_attempt": first,
        "last_attempt": last,
        "failures": failures,
    }


@router.get(
    "/",
    summary="List Upload Attempts",
    description="Newest upload attempts first, optionally filtered by run_uuid, status, hostname and time range.",
)
async def list_import_log(
    run_uuid: Optional[str] = Query(None, description="Comma-separated run_uuid values"),
    status: Optional[Literal["imported", "rejected", "error"]] = Query(None, description="Only attempts with this outcome"),
    hostname: Optional[str] = Query(None, description="Only attempts for this hostname"),
    since: Optional[str] = Query(None, description="Only attempts at or after this date/time"),
    until: Optional[str] = Query(None, description="Only attempts up to this date (whole day) or datetime"),
    limit: int = Query(200, ge=1, le=5000),
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    conditions, params = build_run_filters(since=since, until=until, run_uuids=run_uuid)
    if status:
        conditions.append("status = ?")
        params.append(status)
    if hostname:
        conditions.append("hostname = ?")
        params.append(hostname)
    return {"entries": _entries(db, " AND ".join(conditions) or "1=1", params, limit)}
