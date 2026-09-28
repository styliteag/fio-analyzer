"""Uploaded files must always land inside the uploads directory."""

from pathlib import Path

import pytest

from config.settings import settings
from routers.imports import save_uploaded_file


@pytest.fixture
def upload_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    target = tmp_path / "uploads"
    target.mkdir()
    monkeypatch.setattr(settings, "upload_dir", target)
    return target


@pytest.mark.parametrize(
    ("hostname", "protocol", "filename"),
    [
        ("../../../etc", "local", "x.json"),
        ("server-01", "../../..", "x.json"),
        ("/absolute/path", "nfs", "x.json"),
        ("server-01", "local", "../../escape.json"),
        ("..", "..", ".."),
        ("", "", ""),
    ],
)
def test_upload_path_stays_inside_upload_dir(upload_dir: Path, hostname: str, protocol: str, filename: str) -> None:
    saved = Path(save_uploaded_file(b"{}", filename, {"hostname": hostname, "protocol": protocol}))
    assert saved.resolve().is_relative_to(upload_dir.resolve())
    assert saved.read_bytes() == b"{}"


def test_normal_names_are_kept_readable(upload_dir: Path) -> None:
    saved = Path(save_uploaded_file(b"{}", "fio_results.json", {"hostname": "px1-vm", "protocol": "iSCSI"}))
    relative = saved.relative_to(upload_dir)
    assert relative.parts[:2] == ("px1-vm", "iSCSI")
    assert relative.name.endswith("_fio_results.json")
