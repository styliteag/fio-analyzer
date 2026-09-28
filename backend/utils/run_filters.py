"""
Shared filters for test-run queries: description tags, date range and run_uuid.

Tags are the comma-separated `key:value` elements that fio-test.sh writes into
the description (e.g. prefill:1, fileperjob:1). A tag matches a whole element,
so prefill:1 does not match prefill:10.
"""

import re
from datetime import date, datetime, timedelta
from typing import Any, List, Optional, Tuple

from fastapi import HTTPException

TAG_PATTERN = re.compile(r"^[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+$")
DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_VALUES = 100  # keeps IN (...) lists well below SQLite's parameter limit


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _parse_tags(raw: str) -> List[str]:
    tags = [tag.strip() for tag in raw.split(",") if tag.strip()]
    if len(tags) > MAX_VALUES:
        raise _bad_request(f"Too many tags (max {MAX_VALUES})")
    invalid = [tag for tag in tags if not TAG_PATTERN.match(tag)]
    if invalid:
        raise _bad_request(f"Invalid tag {invalid[0][:40]!r}: expected key:value, e.g. prefill:1")
    return tags


def _parse_bound(raw: str, name: str, upper: bool) -> Tuple[str, str]:
    """Return (operator, value). A date-only upper bound includes the whole day."""
    value = raw.strip()
    try:
        if DATE_ONLY.match(value):
            day = date.fromisoformat(value)
            if upper:
                return "<", (day + timedelta(days=1)).isoformat()
            return ">=", day.isoformat()
        datetime.fromisoformat(value)
    except ValueError as error:
        raise _bad_request(f"Invalid {name} {value[:40]!r}: use YYYY-MM-DD or an ISO datetime") from error
    return ("<=" if upper else ">="), value


def build_run_filters(
    tags: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    run_uuids: Optional[str] = None,
    column_prefix: str = "",
) -> Tuple[List[str], List[Any]]:
    """Build SQL conditions (AND-combined) and parameters for the optional filters."""
    conditions: List[str] = []
    params: List[Any] = []

    for tag in _parse_tags(tags) if tags else []:
        conditions.append(f"(',' || {column_prefix}description || ',') LIKE ? ESCAPE '\\'")
        params.append(f"%,{_escape_like(tag)},%")

    for raw, name, upper in ((since, "since", False), (until, "until", True)):
        if raw:
            operator, value = _parse_bound(raw, name, upper)
            conditions.append(f"{column_prefix}timestamp {operator} ?")
            params.append(value)

    if run_uuids:
        values = [value.strip() for value in run_uuids.split(",") if value.strip()]
        if len(values) > MAX_VALUES:
            raise _bad_request(f"Too many run_uuid values (max {MAX_VALUES})")
        if values:
            conditions.append(f"{column_prefix}run_uuid IN ({','.join('?' for _ in values)})")
            params.extend(values)

    return conditions, params
