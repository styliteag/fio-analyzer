"""Bound upload request bodies before FastAPI parses multipart forms."""

from fastapi.responses import JSONResponse

from config.settings import settings


class _BodyTooLarge(Exception):
    pass


class ImportBodyLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] not in ("/api/import", "/api/import/"):
            return await self.app(scope, receive, send)

        # Allow space for metadata fields and multipart boundaries in addition to the file.
        limit = settings.max_upload_size + 2 * 1024 * 1024
        headers = dict(scope["headers"])
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                if int(content_length) > limit:
                    return await JSONResponse({"error": "File too large"}, status_code=413)(scope, receive, send)
            except ValueError:
                pass

        received = 0
        too_large = False

        async def limited_receive():
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    too_large = True
                    raise _BodyTooLarge
            return message

        # Import responses are small JSON objects. Hold them until parsing completes so
        # an exception raised by receive cannot race a framework-generated error response.
        pending = []

        async def buffer_send(message):
            pending.append(message)

        # The flag decides, not the exception: middlewares and FastAPI may wrap or convert
        # it (an ExceptionGroup from BaseHTTPMiddleware, "error parsing the body" as 400)
        try:
            await self.app(scope, limited_receive, buffer_send)
        except Exception:
            if not too_large:
                raise
        if too_large:
            await JSONResponse({"error": "File too large"}, status_code=413)(scope, receive, send)
            return
        for message in pending:
            await send(message)
