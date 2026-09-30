"""CORS: with cookie sessions, only configured origins may read API responses."""

import asyncio

import httpx
import pytest

from main import app


def health_from(origin: str) -> httpx.Response:
    async def call() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get("/health", headers={"Origin": origin})

    return asyncio.run(call())


def test_foreign_origin_gets_no_cors_headers() -> None:
    response = health_from("https://evil.example")
    # Without Allow-Origin the browser refuses the response to the foreign page
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_vite_dev_origin_is_allowed_with_credentials(origin: str) -> None:
    response = health_from(origin)
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
