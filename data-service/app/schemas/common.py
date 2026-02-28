"""Shared API response schemas used by all backend modules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def utc_timestamp() -> str:
    """Return UTC timestamp string with stable ISO8601 format."""

    return (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


class ApiError(BaseModel):
    """Standardized API error envelope."""

    code: str
    message: str
    details: dict[str, Any] | list[Any] | None = None
    request_id: str | None = None
    timestamp: str = Field(default_factory=utc_timestamp)


class ApiResponse(BaseModel):
    """Standardized API response envelope."""

    success: bool
    data: Any | None = None
    error: ApiError | None = None


def build_success_response(data: Any | None = None) -> ApiResponse:
    """Create success payload in the unified response shape."""

    return ApiResponse(success=True, data=data)


def build_error_response(
    *,
    code: str,
    message: str,
    details: dict[str, Any] | list[Any] | None = None,
    request_id: str | None = None,
) -> ApiResponse:
    """Create error payload in the unified response shape."""

    return ApiResponse(
        success=False,
        error=ApiError(
            code=code,
            message=message,
            details=details,
            request_id=request_id,
        ),
    )
