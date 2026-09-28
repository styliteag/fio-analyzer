"""Tests for tag, date-range and run_uuid filters on test-run queries."""

import sqlite3

import pytest
from fastapi import HTTPException

from utils.run_filters import build_run_filters

ROWS = [
    # id, timestamp, run_uuid, description
    (1, "2026-09-01T10:00:00+00:00", "run-a", "hostname:h1,prefill:1,fileperjob:1"),
    (2, "2026-09-10T10:00:00+00:00", "run-a", "hostname:h1,prefill:1"),
    (3, "2026-09-20T10:00:00+00:00", "run-b", "hostname:h1"),
    (4, "2026-09-27T23:59:00+00:00", "run-c", "saturation-test,prefill:10,hostname:h2"),
]


@pytest.fixture
def db() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE t (id INTEGER, timestamp TEXT, run_uuid TEXT, description TEXT)")
    connection.executemany("INSERT INTO t VALUES (?, ?, ?, ?)", ROWS)
    yield connection
    connection.close()


def ids(db: sqlite3.Connection, **filters: object) -> list[int]:
    conditions, params = build_run_filters(**filters)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return [row[0] for row in db.execute(f"SELECT id FROM t {where} ORDER BY id", params)]


def test_no_filters_returns_everything(db: sqlite3.Connection) -> None:
    assert ids(db) == [1, 2, 3, 4]


def test_single_tag(db: sqlite3.Connection) -> None:
    assert ids(db, tags="prefill:1") == [1, 2]


def test_tags_are_combined_with_and(db: sqlite3.Connection) -> None:
    assert ids(db, tags="prefill:1,fileperjob:1") == [1]


def test_tag_matches_whole_value_not_prefix(db: sqlite3.Connection) -> None:
    """prefill:1 must not match prefill:10."""
    assert 4 not in ids(db, tags="prefill:1")


def test_underscore_is_not_a_like_wildcard(db: sqlite3.Connection) -> None:
    assert ids(db, tags="prefill:_") == []


def test_date_range_is_inclusive_by_day(db: sqlite3.Connection) -> None:
    assert ids(db, since="2026-09-10", until="2026-09-27") == [2, 3, 4]


def test_date_range_accepts_datetimes(db: sqlite3.Connection) -> None:
    assert ids(db, since="2026-09-10T12:00:00") == [3, 4]


def test_run_uuid_filter_accepts_several(db: sqlite3.Connection) -> None:
    assert ids(db, run_uuids="run-a,run-c") == [1, 2, 4]


def test_filters_combine(db: sqlite3.Connection) -> None:
    assert ids(db, tags="prefill:1", run_uuids="run-a", since="2026-09-05") == [2]


@pytest.mark.parametrize("bad", [{"since": "yesterday"}, {"until": "2026-13-40"}, {"tags": "no-colon"}, {"tags": "a:b%c;d"}])
def test_invalid_values_are_400(bad: dict) -> None:
    with pytest.raises(HTTPException) as error:
        build_run_filters(**bad)
    assert error.value.status_code == 400


def test_table_alias_prefix() -> None:
    conditions, _ = build_run_filters(run_uuids="x", column_prefix="tr.")
    assert conditions == ["tr.run_uuid IN (?)"]


def test_too_many_values_are_rejected() -> None:
    with pytest.raises(HTTPException) as error:
        build_run_filters(run_uuids=",".join(f"r{i}" for i in range(101)))
    assert error.value.status_code == 400
