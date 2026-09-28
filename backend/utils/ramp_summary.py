"""
Multi-client ramp summary: how aggregate IOPS and P95 latency scale with the number of clients.

A ramp (ramp_uuid) is one test configuration run with a growing client count
(RAMP_CLIENTS in fio-test.sh). Incomplete steps (a client failed) are listed but never ranked.
"""

from typing import Any, Dict, List, Optional

INCOMPLETE_TAG = "incomplete:1"


def newest_per_client_count(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One row per client count (the newest upload, highest id), sorted by client count."""
    newest: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        clients = row["clients"] or 1
        if clients not in newest or row["id"] > newest[clients]["id"]:
            newest[clients] = row
    return [newest[clients] for clients in sorted(newest)]


def _is_complete(row: Dict[str, Any]) -> bool:
    tags = [tag.strip() for tag in (row.get("description") or "").split(",")]
    client_rows = row.get("client_rows") or []
    if INCOMPLETE_TAG in tags or any(client["error"] for client in client_rows):
        return False
    return not client_rows or len(client_rows) == (row["clients"] or 1)


def _fairness(client_rows: List[Dict[str, Any]]) -> Optional[float]:
    values = [client["iops"] or 0 for client in client_rows]
    if len(values) < 2 or max(values) <= 0:
        return None
    return min(values) / max(values)


def _step(row: Dict[str, Any]) -> Dict[str, Any]:
    clients = row["clients"] or 1
    return {
        "id": row["id"],
        "clients": clients,
        "timestamp": row["timestamp"],
        "iops": row["iops"],
        "per_client_iops": (row["iops"] or 0) / clients,
        "bandwidth": row["bandwidth"],
        "avg_latency": row["avg_latency"],
        "p95_latency": row["p95_latency"],
        "p99_latency": row["p99_latency"],
        "fairness": _fairness(row.get("client_rows") or []),
        "complete": _is_complete(row),
    }


def _drop_pct(steps: List[Dict[str, Any]]) -> Optional[float]:
    if len(steps) < 2 or steps[0]["per_client_iops"] <= 0:
        return None
    return (1 - steps[-1]["per_client_iops"] / steps[0]["per_client_iops"]) * 100


def summarize_ramp(rows: List[Dict[str, Any]], threshold_ms: float) -> Dict[str, Any]:
    """Steps plus: highest client count within the P95 threshold, first count above it, max aggregate IOPS, per-client drop."""
    steps = [_step(row) for row in newest_per_client_count(rows)]
    ranked = [s for s in steps if s["complete"] and s["p95_latency"] is not None]
    within = [s for s in ranked if s["p95_latency"] <= threshold_ms]
    crossed = next((s for s in ranked if s["p95_latency"] > threshold_ms), None)
    return {
        "threshold_ms": threshold_ms,
        "status": "saturated" if crossed else "not_reached",
        "best_within": max(within, key=lambda s: s["clients"]) if within else None,
        "crossed_at": crossed,
        "max_iops": max(ranked, key=lambda s: s["iops"] or 0) if ranked else None,
        "per_client_iops_drop_pct": _drop_pct([s for s in steps if s["complete"]]),
        "incomplete_steps": sum(1 for s in steps if not s["complete"]),
        "steps": steps,
    }
