"""Tests for storage_info: storage configuration detected by fio-test.sh and stored per test run."""

import json
import sqlite3

import pytest

from database.storage_info_migration import STORAGE_INFO_TABLES, add_storage_info_column
from routers.imports import storage_info_from_form
from utils.storage_info import decode_storage_info

SAMPLE = {
    "fs_type": "zfs",
    "kernel": "6.8.12-4-pve",
    "os": "Linux",
    "ioengine": "io_uring",
    "fio_version": "fio-3.36",
    "zfs": {"dataset": "tank/fio", "type": "filesystem", "sync": "disabled", "recordsize": "16K", "compression": "lz4"},
}


def test_valid_object_is_stored_compact() -> None:
    stored = storage_info_from_form(json.dumps(SAMPLE, indent=2))
    assert stored is not None and "\n" not in stored
    assert json.loads(stored) == SAMPLE


@pytest.mark.parametrize("raw", [None, "", "not json", "[1, 2]", '"string"', "42", "{" + '"a": "' + "x" * 9000 + '"}'])
def test_invalid_or_oversized_values_are_ignored(raw: str | None) -> None:
    """An odd storage_info must never make an upload fail."""
    assert storage_info_from_form(raw) is None


def test_decode_returns_objects_and_tolerates_garbage() -> None:
    assert decode_storage_info(json.dumps(SAMPLE)) == SAMPLE
    assert decode_storage_info(None) is None
    assert decode_storage_info("{broken") is None


def test_migration_adds_column_to_all_tables_idempotently() -> None:
    db = sqlite3.connect(":memory:")
    for table in STORAGE_INFO_TABLES:
        db.execute(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)")
    add_storage_info_column(db.cursor())
    add_storage_info_column(db.cursor())
    for table in STORAGE_INFO_TABLES:
        columns = [row[1] for row in db.execute(f"PRAGMA table_info({table})")]
        assert columns.count("storage_info") == 1


def test_migration_skips_missing_tables() -> None:
    add_storage_info_column(sqlite3.connect(":memory:").cursor())


def test_real_schema_stores_storage_info_on_insert(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Full schema + migrations: both insert paths persist storage_info."""
    import asyncio

    from database.connection import DatabaseManager
    from routers.imports import insert_saturation_run, insert_test_run

    manager = DatabaseManager()
    manager.db_path = tmp_path / "test.db"
    monkeypatch.setattr(DatabaseManager, "_populate_sample_data", lambda self, cursor: asyncio.sleep(0))
    asyncio.run(manager.connect())
    db = manager.connection
    data = {
        "timestamp": "2026-09-28T10:00:00+00:00",
        "test_date": "2026-09-28T10:00:00+00:00",
        "test_name": "t",
        "fio_version": "fio-3.36",
        "hostname": "h1",
        "protocol": "local",
        "drive_type": "ssd",
        "drive_model": "m",
        "block_size": "4K",
        "read_write_pattern": "randread",
        "queue_depth": 1,
        "iodepth": 1,
        "num_jobs": 1,
        "direct": 1,
        "sync": "none",
        "test_size": "1G",
        "duration": 60,
        "iops": 1.0,
        "run_uuid": "r",
        "config_uuid": "c",
        "storage_info": storage_info_from_form(json.dumps(SAMPLE)),
    }
    insert_test_run(db, data, "/tmp/x.json")
    insert_saturation_run(db, data, "/tmp/y.json")
    for table in STORAGE_INFO_TABLES:
        stored = db.execute(f"SELECT storage_info FROM {table}").fetchone()[0]
        assert decode_storage_info(stored) == SAMPLE, table
    asyncio.run(manager.close())


@pytest.mark.parametrize("raw", ['{"a": NaN}', '{"a": Infinity}', '{"a": -Infinity}', '{"a": 1e400}', "[" * 5000 + "]" * 5000])
def test_values_that_cannot_be_served_as_json_are_rejected(raw: str) -> None:
    """NaN/Infinity would make every response containing the row fail with 500."""
    assert storage_info_from_form(raw) is None


def test_decode_tolerates_already_stored_nan() -> None:
    assert decode_storage_info('{"a": NaN}') is None


def test_size_limit_counts_bytes_not_characters() -> None:
    assert storage_info_from_form(json.dumps({"a": "€" * 3000})) is None
