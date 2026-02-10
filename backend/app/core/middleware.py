"""Middleware components for common request handling concerns."""

from __future__ import annotations

import time
from typing import Awaitable, Callable
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .logging import (
    bind_request_context,
    get_logger,
    get_request_id,
    reset_request_context,
)

DEFAULT_REQUEST_ID_HEADER = "X-Request-ID"
logger = get_logger(__name__)


def generate_request_id() -> str:
    """Generate request id compatible with proposal tracing format."""

    return f"req_{uuid4().hex[:16]}"


def resolve_request_id(request: Request, header_name: str) -> str:
    """Prefer inbound request id header and fallback to generated id."""

    incoming = request.headers.get(header_name)
    if incoming is not None:
        candidate = incoming.strip()
        if candidate:
            return candidate[:64]
    return generate_request_id()


def extract_request_id(request: Request) -> str | None:
    """Read request id from request state or fallback logging context."""

    request_id = getattr(request.state, "request_id", None)
    if request_id is not None:
        return str(request_id)
    return get_request_id()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Inject request id header and bind per-request log context."""

    def __init__(self, app, header_name: str = DEFAULT_REQUEST_ID_HEADER) -> None:
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = resolve_request_id(request, self.header_name)
        token = bind_request_context(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None,
        )
        request.state.request_id = request_id

        started_at = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            logger.exception(
                "request_unhandled_exception",
                extra={
                    "event": "request.unhandled_exception",
                    "duration_ms": duration_ms,
                },
            )
            raise
        else:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            response.headers[self.header_name] = request_id
            logger.info(
                "request_completed",
                extra={
                    "event": "request.completed",
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                },
            )
            return response
        finally:
            reset_request_context(token)
