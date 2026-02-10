"""Structured logging setup and request context helpers."""

from __future__ import annotations

import json
import logging
from contextvars import ContextVar, Token
from datetime import datetime, timezone
from typing import Any

_REQUEST_CONTEXT: ContextVar[dict[str, Any] | None] = ContextVar(
    "request_context",
    default=None,
)
_LOGGING_INITIALIZED = False


def get_request_context() -> dict[str, Any]:
    """Return a copy of context bound to the current request."""

    context = _REQUEST_CONTEXT.get()
    if context is None:
        return {}
    return dict(context)


def bind_request_context(**context: Any) -> Token[dict[str, Any] | None]:
    """Bind request-scoped context for logs in current task context."""

    merged_context = get_request_context()
    for key, value in context.items():
        if value is not None:
            merged_context[key] = value
    return _REQUEST_CONTEXT.set(merged_context)


def reset_request_context(token: Token[dict[str, Any] | None]) -> None:
    """Reset request context to previous state."""

    _REQUEST_CONTEXT.reset(token)


def get_request_id() -> str | None:
    """Return current request id from bound logging context."""

    request_id = get_request_context().get("request_id")
    if request_id is None:
        return None
    return str(request_id)


class RequestContextFilter(logging.Filter):
    """Inject request context attributes into each log record."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        context = get_request_context()
        record.request_id = context.get("request_id")
        record.method = context.get("method")
        record.path = context.get("path")
        return True


class JsonFormatter(logging.Formatter):
    """Serialize log records into newline-delimited JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc)
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for field_name in (
            "event",
            "request_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "client_ip",
            "error_code",
            "environment",
        ):
            field_value = getattr(record, field_name, None)
            if field_value is not None:
                payload[field_name] = field_value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(level: str = "INFO") -> None:
    """Configure process-wide structured logging exactly once."""

    global _LOGGING_INITIALIZED
    if _LOGGING_INITIALIZED:
        return

    normalized_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestContextFilter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(normalized_level)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True
        logger.setLevel(normalized_level)

    _LOGGING_INITIALIZED = True


def get_logger(name: str) -> logging.Logger:
    """Return module-level logger."""

    return logging.getLogger(name)
