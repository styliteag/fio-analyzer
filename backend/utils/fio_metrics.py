"""Metric extraction from one fio job (or client) entry of fio's JSON output."""

import json
import math
from typing import Any, Dict

from fastapi import HTTPException


def _reject_constant(name: str) -> None:
    raise ValueError(f"Non-finite number {name} is not allowed")


def _finite_float(text: str) -> float:
    value = float(text)
    if not math.isfinite(value):
        raise ValueError(f"Number {text[:20]} is out of range")
    return value


def load_fio_json(text: str) -> Any:
    """json.loads that rejects NaN/Infinity and overflowing numbers: stored they would break every response with the row."""
    return json.loads(text, parse_constant=_reject_constant, parse_float=_finite_float)


def section(job: Dict[str, Any], *path: str) -> Dict[str, Any]:
    """Nested object of a fio job entry (e.g. read -> clat_ns); missing is empty, any other type is a client error."""
    current: Any = job
    for key in path:
        current = current.get(key, {})
        if not isinstance(current, dict):
            raise HTTPException(status_code=400, detail=f"Invalid fio JSON: {'.'.join(path)} is not an object")
    return current


def number(values: Dict[str, Any], key: str) -> float:
    """Numeric fio value (missing = 0); strings, booleans, null or non-finite values are a client error."""
    value = values.get(key, 0)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise HTTPException(status_code=400, detail=f"Invalid fio JSON: {key} is not a number")
    return value


def extract_iops(job: Dict[str, Any]) -> float:
    """
    Extract total IOPS (Input/Output Operations Per Second) from FIO job data.

    Combines read and write IOPS for total throughput measurement.

    Args:
        job: FIO job data containing read/write statistics

    Returns:
        Combined read + write IOPS value
    """
    read_iops = number(section(job, "read"), "iops")
    write_iops = number(section(job, "write"), "iops")
    return read_iops + write_iops


def extract_latency(job: Dict[str, Any]) -> float:
    """
    Extract weighted average latency from FIO job data.

    Calculates the I/O weighted average completion latency across read and write
    operations, converting from nanoseconds to milliseconds.
    Uses clat_ns (completion latency) for consistency with percentile metrics.

    Why weighting by I/O count?
    ---------------------------
    Read and write operations often have different latencies AND different I/O counts.
    A simple average (read_lat + write_lat) / 2 would be misleading because it treats
    both operations equally, regardless of how many I/Os each performed.

    Example:
        - 1000 reads @ 1ms, 1 write @ 10ms
        - Simple avg: (1 + 10) / 2 = 5.5 ms ❌ (misleading - most I/Os were fast!)
        - Weighted:   (1×1000 + 10×1) / 1001 = 1.009 ms ✅ (accurate)

    The weighted average gives the TRUE average latency experienced across all
    I/O operations, accounting for the actual distribution of read vs write I/Os.

    Formula: weighted_avg = (read_lat × read_ios + write_lat × write_ios) / total_ios

    Args:
        job: FIO job data containing latency statistics

    Returns:
        Weighted average completion latency in milliseconds
    """
    read_lat = number(section(job, "read", "clat_ns"), "mean")
    write_lat = number(section(job, "write", "clat_ns"), "mean")

    total_ios = number(section(job, "read"), "total_ios") + number(section(job, "write"), "total_ios")
    if total_ios == 0:
        return 0.0

    read_ios = number(section(job, "read"), "total_ios")
    write_ios = number(section(job, "write"), "total_ios")

    # Weight by I/O count: multiply each latency by its I/O count, sum, then divide by total
    weighted_lat = (read_lat * read_ios + write_lat * write_ios) / total_ios
    return weighted_lat / 1000000  # Convert ns to ms


def extract_bandwidth(job: Dict[str, Any]) -> float:
    """
    Extract total bandwidth from FIO job data.

    Combines read and write bandwidth measurements and converts
    from bytes per second to megabytes per second.

    Args:
        job: FIO job data containing bandwidth statistics

    Returns:
        Combined bandwidth in MB/s
    """
    read_bw = number(section(job, "read"), "bw_bytes")
    write_bw = number(section(job, "write"), "bw_bytes")
    return (read_bw + write_bw) / (1024 * 1024)  # Convert to MB/s


def extract_percentile_latency(job: Dict[str, Any], percentile: float) -> float:
    """
    Extract percentile latency statistics from FIO job data.

    Retrieves the specified percentile latency value (P1, P5, P95, P99, etc.)
    and converts from nanoseconds to milliseconds. Uses the higher
    value between read and write operations.

    Args:
        job: FIO job data containing latency percentile statistics
        percentile: Percentile value to extract (e.g., 95 for P95, 99.5 for P99.5)

    Returns:
        Percentile latency in milliseconds
    """
    # Format percentile key to match FIO format (e.g., "1.000000", "99.500000")
    percentile_key = f"{percentile:.6f}"

    read_lat = number(section(job, "read", "clat_ns", "percentile"), percentile_key)
    write_lat = number(section(job, "write", "clat_ns", "percentile"), percentile_key)

    # Use the higher of read/write latency
    max_lat = max(read_lat, write_lat)
    return max_lat / 1000000  # Convert ns to ms
