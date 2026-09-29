"""main.app imports cleanly and mounts every router under its documented prefix."""

import pytest

from main import app

# One documented endpoint per router (AGENTS.md "Major API Endpoints")
EXPECTED_ROUTES = (
    "/health",
    "/api/info",
    "/api/filters",
    "/api/test-runs/",
    "/api/import/",
    "/api/time-series/history",
    "/api/dashboard/stats",
    "/api/saturation/runs/{run_uuid}/summary",
    "/api/ramp/runs",
    "/api/compare",
    "/api/import-log/",
    "/api/raw/runs/{run_uuid}",
    "/api/users/me",
)


@pytest.mark.parametrize("path", EXPECTED_ROUTES)
def test_app_mounts_router(path: str) -> None:
    assert path in {route.path for route in app.routes}
