"""
Dashboard API router: aggregated statistics computed in SQL, so the
dashboard no longer downloads full test-run rows just to count them.
"""

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from auth.middleware import User, require_admin
from database.connection import get_db
from utils.logging import log_error

router = APIRouter()

STATS_QUERY = """
SELECT
    (SELECT COUNT(*) FROM test_runs) AS total_runs,
    (SELECT COUNT(DISTINCT hostname) FROM test_runs WHERE hostname IS NOT NULL) AS total_hosts,
    (SELECT COUNT(DISTINCT hostname) FROM test_runs_all WHERE hostname IS NOT NULL) AS hosts_with_history,
    (SELECT COUNT(*) FROM (
        SELECT DISTINCT hostname, protocol, drive_type, drive_model FROM test_runs_all WHERE hostname IS NOT NULL
    )) AS active_servers,
    (SELECT AVG(iops) FROM test_runs WHERE iops > 0) AS avg_iops,
    (SELECT AVG(avg_latency) FROM test_runs WHERE avg_latency > 0) AS avg_latency,
    (SELECT MAX(timestamp) FROM test_runs) AS last_upload
"""


def compute_dashboard_stats(db: sqlite3.Connection) -> dict[str, Any]:
    """Aggregate dashboard numbers in a single query."""
    row = db.execute(STATS_QUERY).fetchone()
    total_runs, total_hosts, hosts_with_history, active_servers, avg_iops, avg_latency, last_upload = row
    return {
        "totalTestRuns": total_runs,
        "totalHostnames": total_hosts,
        "hostnamesWithHistory": hosts_with_history,
        "activeServers": active_servers,
        "avgIOPS": round(avg_iops) if avg_iops is not None else 0,
        "avgLatency": round(avg_latency, 2) if avg_latency is not None else 0.0,
        "lastUploadAt": last_upload,
    }


@router.get(
    "/stats",
    summary="Get Dashboard Statistics",
    description="Counts, averages and last upload time for the dashboard, aggregated in SQL",
    response_description="Dashboard statistics",
    responses={
        200: {
            "description": "Statistics retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "totalTestRuns": 5373,
                        "totalHostnames": 21,
                        "hostnamesWithHistory": 24,
                        "activeServers": 54,
                        "avgIOPS": 34309,
                        "avgLatency": 2.38,
                        "lastUploadAt": "2026-09-26T14:09:45.760325+00:00",
                    }
                }
            },
        },
        401: {"description": "Authentication required, or the user is not an admin"},
    },
)
async def get_dashboard_stats(
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    try:
        return compute_dashboard_stats(db)
    except sqlite3.Error as error:
        log_error("Error computing dashboard stats", error, {"user": user.username})
        raise HTTPException(status_code=500, detail="Failed to compute dashboard statistics")
