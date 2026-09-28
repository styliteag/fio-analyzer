"""Per-client results of multi-client steps (fio client mode), linked to test_runs_all.id."""

import re
import sqlite3
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from database.client_migration import CLIENT_RESULTS_TABLE
from utils.fio_client_mode import client_hosts_from_form, client_storage_map, storage_for_client

RAMP_UUID_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
# Upper bounds for one ramp, so a ramp can always be loaded and summarized in one response
MAX_RAMP_STEPS = 500
MAX_RAMP_CLIENT_ROWS = 20000
# Every step of a ramp must share these (the client count is what varies)
RAMP_CONFIG_COLUMNS = (
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
)

CLIENT_RESULT_COLUMNS = (
    "test_run_id",
    "ramp_uuid",
    "run_uuid",
    "timestamp",
    "client_index",
    "client_host",
    "client_port",
    "iops",
    "read_iops",
    "write_iops",
    "bandwidth",
    "avg_latency",
    "p95_latency",
    "p99_latency",
    "error",
    "storage_info",
)


def ramp_uuid_from_form(value: Optional[str]) -> Optional[str]:
    """ramp_uuid groups the client-count steps of one test configuration: letters, digits and _ . : - only."""
    value = (value or "").strip()
    if not value:
        return None
    if not RAMP_UUID_PATTERN.match(value):
        raise HTTPException(status_code=400, detail="Invalid ramp_uuid: use up to 64 letters, digits, '_', '.', ':' or '-'")
    return value


def check_ramp(cursor: sqlite3.Cursor, test_run_data: Dict[str, Any]) -> None:
    """Reject a step whose ramp_uuid belongs to another configuration, or that would make the ramp too large."""
    ramp_uuid = test_run_data.get("ramp_uuid")
    if not ramp_uuid:
        return
    columns = ", ".join(RAMP_CONFIG_COLUMNS)
    existing = cursor.execute(f"SELECT {columns} FROM test_runs_all WHERE ramp_uuid = ? LIMIT 1", (ramp_uuid,)).fetchone()
    if existing is not None:
        differing = [c for c, value in zip(RAMP_CONFIG_COLUMNS, existing) if str(value) != str(test_run_data.get(c))]
        if differing:
            raise HTTPException(status_code=409, detail=f"ramp_uuid belongs to another test configuration ({', '.join(differing)} differ)")
    steps, client_rows = cursor.execute(
        "SELECT COUNT(*), COALESCE(SUM(clients), 0) FROM test_runs_all WHERE ramp_uuid = ?", (ramp_uuid,)
    ).fetchone()
    if steps + 1 > MAX_RAMP_STEPS or client_rows + (test_run_data.get("clients") or 1) > MAX_RAMP_CLIENT_ROWS:
        raise HTTPException(status_code=413, detail=f"Ramp is full (max {MAX_RAMP_STEPS} steps, {MAX_RAMP_CLIENT_ROWS} client results)")


def with_client_fields(
    test_run_data: Dict[str, Any],
    ramp_uuid: Optional[str],
    client_hosts: Optional[str],
    client_storage_info: Optional[str],
) -> Dict[str, Any]:
    """New test run dict with the multi-client upload fields (form or .info metadata) applied."""
    return {
        **test_run_data,
        "ramp_uuid": ramp_uuid_from_form(ramp_uuid),
        "client_hosts": client_hosts_from_form(client_hosts),
        "client_storage": client_storage_map(client_storage_info),
    }


def insert_client_results(cursor: sqlite3.Cursor, test_run_all_id: int, test_run_data: Dict[str, Any]) -> int:
    """Store one row per client of a multi-client step; returns the number of rows."""
    storage = test_run_data.get("client_storage") or {}
    rows: List[tuple] = [
        (
            test_run_all_id,
            test_run_data.get("ramp_uuid"),
            test_run_data.get("run_uuid"),
            test_run_data.get("timestamp"),
            client.index,
            client.host,
            client.port,
            client.iops,
            client.read_iops,
            client.write_iops,
            client.bandwidth,
            client.avg_latency,
            client.p95_latency,
            client.p99_latency,
            client.error,
            storage_for_client(storage, client.host, client.port),
        )
        for client in test_run_data.get("client_results") or ()
    ]
    if not rows:
        return 0
    placeholders = ", ".join("?" for _ in CLIENT_RESULT_COLUMNS)
    cursor.executemany(
        f"INSERT INTO {CLIENT_RESULTS_TABLE} ({', '.join(CLIENT_RESULT_COLUMNS)}) VALUES ({placeholders})",
        rows,
    )
    return len(rows)
