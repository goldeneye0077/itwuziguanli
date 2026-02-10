"""Application settings for shared backend foundation."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _get_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class Settings:
    """Application settings resolved from environment variables."""

    app_name: str
    environment: str
    log_level: str
    request_id_header: str
    expose_error_details: bool
    upload_dir: str
    jwt_secret: str
    jwt_algorithm: str
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int
    refresh_cookie_name: str
    refresh_cookie_secure: bool
    refresh_cookie_samesite: str
    password_hash_iterations: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Read settings once and reuse across request lifecycle."""

    return Settings(
        app_name=os.getenv("APP_NAME", "IT Asset Lifecycle"),
        # Accept both APP_ENV (preferred) and ENVIRONMENT (legacy/doc-friendly).
        environment=(os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        request_id_header=os.getenv("REQUEST_ID_HEADER", "X-Request-ID"),
        expose_error_details=_get_bool_env("EXPOSE_ERROR_DETAILS", False),
        upload_dir=os.getenv("UPLOAD_DIR", "uploads"),
        jwt_secret=os.getenv("JWT_SECRET", "dev-only-change-me"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_ttl_seconds=int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", "7200")),
        refresh_token_ttl_seconds=int(os.getenv("REFRESH_TOKEN_TTL_SECONDS", "604800")),
        refresh_cookie_name=os.getenv("REFRESH_COOKIE_NAME", "refresh_token"),
        refresh_cookie_secure=_get_bool_env("REFRESH_COOKIE_SECURE", False),
        refresh_cookie_samesite=os.getenv("REFRESH_COOKIE_SAMESITE", "strict"),
        password_hash_iterations=int(os.getenv("PASSWORD_HASH_ITERATIONS", "600000")),
    )
