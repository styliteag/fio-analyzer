"""Shared fixtures of the backend tests."""

import asyncio
from pathlib import Path

import pytest

from config.settings import settings
from database.connection import DatabaseManager
from routers import imports


@pytest.fixture
def manager(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path / "uploads")
    monkeypatch.setattr(DatabaseManager, "_populate_sample_data", lambda self, cursor: asyncio.sleep(0))
    db_manager = DatabaseManager()
    db_manager.db_path = tmp_path / "test.db"
    asyncio.run(db_manager.connect())
    monkeypatch.setattr(imports, "db_manager", db_manager)
    yield db_manager
    asyncio.run(db_manager.close())
