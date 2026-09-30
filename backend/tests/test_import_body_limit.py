"""Multipart requests are bounded before the framework parses the upload."""

import asyncio

import httpx

from config.settings import settings
from main import app


def test_import_rejects_oversize_content_length(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size", 8)

    async def call():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.post("/api/import/", content=b"x" * (2 * 1024 * 1024 + 9))

    response = asyncio.run(call())
    assert response.status_code == 413
    assert response.json() == {"error": "File too large"}


def test_import_rejects_chunked_oversize_body(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size", 8)

    async def chunks():
        yield b'--x\r\nContent-Disposition: form-data; name="file"; filename="x.json"\r\n\r\n'
        yield b"x" * (2 * 1024 * 1024)
        yield b"\r\n--x--\r\n"

    async def call():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.post("/api/import", content=chunks(), headers={"content-type": "multipart/form-data; boundary=x"})

    response = asyncio.run(call())
    assert response.status_code == 413
    assert response.json() == {"error": "File too large"}


def test_small_import_still_checks_authentication(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size", 8)

    async def call():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.post("/api/import", files={"file": ("x.json", b"{}", "application/json")})

    response = asyncio.run(call())
    assert response.status_code == 401


def test_unrelated_errors_still_propagate_below_the_limit():
    from utils.import_body_limit import ImportBodyLimitMiddleware

    async def failing_app(scope, receive, send):
        await receive()
        raise RuntimeError("boom")

    async def receive():
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def send(message):
        raise AssertionError("nothing must be sent")

    scope = {"type": "http", "method": "POST", "path": "/api/import/", "headers": []}
    try:
        asyncio.run(ImportBodyLimitMiddleware(failing_app)(scope, receive, send))
    except RuntimeError as error:
        assert str(error) == "boom"
    else:
        raise AssertionError("RuntimeError was swallowed")
