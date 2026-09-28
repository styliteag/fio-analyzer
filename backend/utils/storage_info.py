"""
storage_info: storage configuration detected by fio-test.sh (filesystem, ZFS/Ceph
properties, kernel, ioengine), stored as compact JSON per test run.
"""

import json
from typing import Any, Dict, Optional

MAX_STORAGE_INFO_BYTES = 8192


def _strict_object(raw: str) -> Optional[Dict[str, Any]]:
    """Parse a JSON object that can be served again; rejects NaN/Infinity and absurd nesting."""
    try:
        value = json.loads(raw)
        if not isinstance(value, dict):
            return None
        # Starlette renders responses with allow_nan=False: such values would turn every response with this row into a 500
        json.dumps(value, allow_nan=False)
    except (ValueError, RecursionError):
        return None
    return value


def encode_storage_info(raw: Optional[str]) -> Optional[str]:
    """Validate client JSON: must be a small, servable object; returns compact JSON or None."""
    if not raw or len(raw.encode("utf-8", errors="replace")) > MAX_STORAGE_INFO_BYTES:
        return None
    value = _strict_object(raw)
    if value is None:
        return None
    compact = json.dumps(value, separators=(",", ":"), sort_keys=True, allow_nan=False)
    return compact if len(compact.encode("utf-8")) <= MAX_STORAGE_INFO_BYTES else None


def decode_storage_info(stored: Optional[str]) -> Optional[Dict[str, Any]]:
    """Stored JSON back to an object for API responses; None if missing, unreadable or not servable."""
    return _strict_object(stored) if stored else None
