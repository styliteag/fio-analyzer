"""
fio sync mode handling.

fio's `sync` option accepts none/0, sync/1 and dsync. The analyzer stores the
mode as text so O_DSYNC runs stay distinguishable from O_SYNC runs.
"""

from typing import Any, List

from fastapi import HTTPException

SYNC_MODES = ("none", "sync", "dsync")

_ALIASES = {"": "none", "0": "none", "none": "none", "1": "sync", "sync": "sync", "dsync": "dsync"}


def normalize_sync(value: Any) -> str:
    """Map any fio sync value (int, legacy 0/1 or name) to none, sync or dsync."""
    key = "" if value is None else str(value).strip().lower()
    if key not in _ALIASES:
        raise ValueError(f"Unsupported sync value: {repr(value)[:40]} (expected one of {', '.join(SYNC_MODES)})")
    return _ALIASES[key]


def parse_sync_filter(raw: str) -> List[str]:
    """Parse a comma-separated sync filter (names or legacy 0/1) for SQL IN clauses."""
    try:
        return [normalize_sync(part) for part in raw.split(",")]
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
