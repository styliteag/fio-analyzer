"""manage_users.py never puts one username into two role files (a session would get the wrong role)."""

import sys
from pathlib import Path

import pytest
from test_viewer_role import auth_files  # noqa: F401 (fixture)

from config.settings import settings

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import manage_users  # noqa: E402


def test_add_refuses_a_username_of_another_role(auth_files: Path) -> None:  # noqa: F811
    with pytest.raises(SystemExit):
        manage_users.add_user("px1", "pw", settings.htpasswd_path)  # px1 is a viewer
    assert "px1" not in settings.htpasswd_path.read_text()


def test_add_to_the_same_file_changes_the_password(auth_files: Path) -> None:  # noqa: F811
    before = settings.htviewers_path.read_text()
    manage_users.add_user("px1", "new-pw", settings.htviewers_path)
    after = settings.htviewers_path.read_text()
    assert after.count("px1:") == 1 and after != before


def test_duplicate_usernames_are_reported(auth_files: Path) -> None:  # noqa: F811
    from auth.authentication import duplicate_usernames

    assert duplicate_usernames() == {}
    (settings.htpasswd_path).write_text(settings.htpasswd_path.read_text() + settings.htviewers_path.read_text())
    assert duplicate_usernames() == {"px1": ["admin", "viewer"]}
