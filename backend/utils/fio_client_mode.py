"""
fio client mode (fio --client=a --client=b job.fio) JSON output.

Unlike a local run there is no "jobs" list: "client_stats" holds one entry per client
(with hostname/port) plus an "All clients" entry with merged metrics, and "global options"
is a list with one dict per client. The "All clients" entry has no "job options" and sums
job_runtime over the clients, so those come from the first client entry. Older fio versions
(e.g. 3.36) also leave the latency percentiles out of "All clients"; the worst client's
percentiles stand in for them.
"""

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from utils.fio_metrics import extract_bandwidth, extract_iops, extract_latency, extract_percentile_latency, number, section
from utils.storage_info import parse_servable_object, encode_storage_info

AGGREGATE_JOBNAME = "All clients"
MAX_CLIENTS = 1024
MAX_CLIENT_STORAGE_BYTES = 256 * 1024
MAX_CLIENT_HOSTS_BYTES = 16 * 1024
CLIENT_ADDRESS_KEYS = ("hostname", "port")


@dataclass(frozen=True)
class ClientResult:
    """Metrics of one client in a multi-client step."""

    index: int
    host: Optional[str]
    port: Optional[int]
    iops: float
    read_iops: float
    write_iops: float
    bandwidth: float
    avg_latency: float
    p95_latency: float
    p99_latency: float
    error: int


@dataclass(frozen=True)
class ClientModeRun:
    """Aggregate job (shaped like a local fio job entry), shared options and per-client results."""

    job: Dict[str, Any]
    global_options: Dict[str, Any]
    clients: Tuple[ClientResult, ...]


def _port(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _client_result(index: int, entry: Dict[str, Any]) -> ClientResult:
    return ClientResult(
        index=index,
        host=str(entry["hostname"]) if entry.get("hostname") is not None else None,
        port=_port(entry.get("port")),
        iops=extract_iops(entry),
        read_iops=number(section(entry, "read"), "iops"),
        write_iops=number(section(entry, "write"), "iops"),
        bandwidth=extract_bandwidth(entry),
        avg_latency=extract_latency(entry),
        p95_latency=extract_percentile_latency(entry, 95),
        p99_latency=extract_percentile_latency(entry, 99),
        error=int(entry.get("error") or 0),
    )


def _with_client_percentiles(merged: Dict[str, Any], clients: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Older fio (e.g. 3.36) writes no clat percentiles into "All clients" (P95 would read as 0):
    use the worst client's value per percentile, an upper bound of the combined percentile."""
    result = dict(merged)
    for direction in ("read", "write"):
        stats = section(merged, direction)
        clat = section(stats, "clat_ns")
        if not stats or clat.get("percentile"):
            continue
        worst: Dict[str, float] = {}
        for client in clients:
            for key, value in section(client, direction, "clat_ns", "percentile").items():
                worst[key] = max(worst.get(key, 0), number({key: value}, key))
        if worst:
            result[direction] = {**stats, "clat_ns": {**clat, "percentile": worst}}
    return result


def _global_options(fio_data: Dict[str, Any]) -> Dict[str, Any]:
    raw = fio_data.get("global options") or {}
    first = raw[0] if isinstance(raw, list) and raw else raw
    if not isinstance(first, dict):
        return {}
    return {key: value for key, value in first.items() if key not in CLIENT_ADDRESS_KEYS}


def parse_client_mode(fio_data: Dict[str, Any]) -> Optional[ClientModeRun]:
    """Client mode view of fio output, or None for a normal local run."""
    stats = fio_data.get("client_stats")
    if not isinstance(stats, list) or fio_data.get("jobs"):
        return None
    entries = [entry for entry in stats if isinstance(entry, dict)]
    clients = [entry for entry in entries if entry.get("jobname") != AGGREGATE_JOBNAME]
    if not clients:
        raise HTTPException(status_code=400, detail="No client results found in fio client mode data")
    if len(clients) > MAX_CLIENTS:
        raise HTTPException(status_code=400, detail=f"Too many clients (max {MAX_CLIENTS})")
    merged = next((entry for entry in entries if entry.get("jobname") == AGGREGATE_JOBNAME), clients[0])
    merged = _with_client_percentiles(merged, clients)
    first = clients[0]
    job = {
        **merged,
        "jobname": first.get("jobname", "unknown"),
        "job options": first.get("job options", {}),
        "job_runtime": first.get("job_runtime", 0),
    }
    return ClientModeRun(
        job=job,
        global_options=_global_options(fio_data),
        clients=tuple(_client_result(index, entry) for index, entry in enumerate(clients)),
    )


def client_storage_map(raw: Optional[str]) -> Dict[str, str]:
    """Form field client_storage_info: {"host:port" or "host": storage_info} with each value encoded once
    (compact JSON, same 8 KiB limit as storage_info); garbage and oversized values are ignored."""
    if not raw or len(raw.encode("utf-8", errors="replace")) > MAX_CLIENT_STORAGE_BYTES:
        return {}
    value = parse_servable_object(raw)
    if value is None:
        return {}
    encoded = {str(key): encode_storage_info(json.dumps(info, ensure_ascii=False)) for key, info in value.items() if isinstance(info, dict)}
    return {key: info for key, info in encoded.items() if info is not None}


def storage_for_client(mapping: Dict[str, str], host: Optional[str], port: Optional[int]) -> Optional[str]:
    """Encoded storage_info of one client, matched by "host:port" first, then by host."""
    return mapping.get(f"{host}:{port}") or mapping.get(str(host))


def client_hosts_from_form(raw: Optional[str]) -> Optional[str]:
    """Comma list of client names as a JSON list; None when empty or oversized."""
    if not raw or len(raw.encode("utf-8", errors="replace")) > MAX_CLIENT_HOSTS_BYTES:
        return None
    hosts = [host.strip() for host in raw.split(",") if host.strip()]
    if not hosts or len(hosts) > MAX_CLIENTS:
        return None
    return json.dumps(hosts)
