"""Authentication, token, and RBAC utilities for M00 endpoints."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from time import time
from typing import Any, Literal, cast

from fastapi import Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.session import get_db_session
from ..models.enums import TokenBlacklistReason
from ..models.organization import SysUser
from ..models.rbac import RbacPermission, RbacRole, RbacRolePermission, RbacUserRole
from ..models.security import TokenBlacklist
from .config import Settings, get_settings
from .exceptions import AppException

PASSWORD_POLICY = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


def _cookie_samesite(value: str) -> Literal["lax", "strict", "none"]:
    candidate = value.lower()
    if candidate not in {"lax", "strict", "none"}:
        return "strict"
    return cast(Literal["lax", "strict", "none"], candidate)


@dataclass(slots=True)
class AuthContext:
    user: SysUser
    roles: set[str]
    token_claims: dict[str, Any]


def validate_password_policy(password: str) -> None:
    if not PASSWORD_POLICY.match(password):
        raise AppException(
            code="INVALID_FIELD_FORMAT",
            message="密码至少 8 位且包含字母和数字。",
        )


def hash_password(password: str, settings: Settings | None = None) -> str:
    resolved_settings = settings or get_settings()
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        resolved_settings.password_hash_iterations,
    )
    salt_encoded = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_encoded = base64.urlsafe_b64encode(digest).decode("ascii")
    return (
        "pbkdf2_sha256"
        f"${resolved_settings.password_hash_iterations}"
        f"${salt_encoded}"
        f"${digest_encoded}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_encoded, digest_encoded = password_hash.split(
            "$", 3
        )
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(iterations)
        salt = base64.urlsafe_b64decode(salt_encoded.encode("ascii"))
        expected_digest = base64.urlsafe_b64decode(digest_encoded.encode("ascii"))
    except (ValueError, TypeError):
        return False

    candidate_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, rounds
    )
    return hmac.compare_digest(candidate_digest, expected_digest)


def _base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _base64url_decode(text: str) -> bytes:
    padded = text + "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _encode_jwt(payload: dict[str, Any], settings: Settings) -> str:
    header = {"alg": settings.jwt_algorithm, "typ": "JWT"}
    header_raw = json.dumps(header, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    payload_raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )

    header_part = _base64url_encode(header_raw)
    payload_part = _base64url_encode(payload_raw)
    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    signature = hmac.new(
        settings.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    signature_part = _base64url_encode(signature)
    return f"{header_part}.{payload_part}.{signature_part}"


def _decode_jwt(token: str, settings: Settings) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise AppException(code="TOKEN_INVALID", message="令牌格式不正确。")

    header_part, payload_part, signature_part = parts
    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    expected_signature = hmac.new(
        settings.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    try:
        token_signature = _base64url_decode(signature_part)
    except (ValueError, TypeError) as error:
        raise AppException(code="TOKEN_INVALID", message="令牌签名不正确。") from error

    if not hmac.compare_digest(expected_signature, token_signature):
        raise AppException(code="TOKEN_INVALID", message="令牌签名校验失败。")

    try:
        header = json.loads(_base64url_decode(header_part))
        payload = json.loads(_base64url_decode(payload_part))
    except (ValueError, TypeError) as error:
        raise AppException(code="TOKEN_INVALID", message="令牌内容不正确。") from error

    if header.get("alg") != settings.jwt_algorithm:
        raise AppException(code="TOKEN_INVALID", message="令牌算法不被允许。")

    expires_at = payload.get("exp")
    if not isinstance(expires_at, int):
        raise AppException(code="TOKEN_INVALID", message="令牌缺少过期时间。")
    if int(time()) >= expires_at:
        raise AppException(code="TOKEN_EXPIRED", message="令牌已过期。")

    return payload


def _issue_token(
    token_type: str, user_id: int, ttl_seconds: int, settings: Settings
) -> str:
    now = int(time())
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": secrets.token_hex(16),
        "type": token_type,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return _encode_jwt(payload, settings)


def create_access_token(user_id: int, settings: Settings | None = None) -> str:
    resolved_settings = settings or get_settings()
    return _issue_token(
        "access", user_id, resolved_settings.access_token_ttl_seconds, resolved_settings
    )


def create_refresh_token(user_id: int, settings: Settings | None = None) -> str:
    resolved_settings = settings or get_settings()
    return _issue_token(
        "refresh",
        user_id,
        resolved_settings.refresh_token_ttl_seconds,
        resolved_settings,
    )


def set_refresh_cookie(
    response: Response, refresh_token: str, settings: Settings | None = None
) -> None:
    resolved_settings = settings or get_settings()
    response.set_cookie(
        key=resolved_settings.refresh_cookie_name,
        value=refresh_token,
        max_age=resolved_settings.refresh_token_ttl_seconds,
        httponly=True,
        secure=resolved_settings.refresh_cookie_secure,
        samesite=_cookie_samesite(resolved_settings.refresh_cookie_samesite),
        path="/",
    )


def clear_refresh_cookie(response: Response, settings: Settings | None = None) -> None:
    resolved_settings = settings or get_settings()
    response.delete_cookie(
        key=resolved_settings.refresh_cookie_name,
        path="/",
        secure=resolved_settings.refresh_cookie_secure,
        httponly=True,
        samesite=_cookie_samesite(resolved_settings.refresh_cookie_samesite),
    )


def decode_refresh_token_from_request(
    request: Request,
    db: Session,
    settings: Settings | None = None,
) -> dict[str, Any]:
    resolved_settings = settings or get_settings()
    refresh_token = request.cookies.get(resolved_settings.refresh_cookie_name)
    if not refresh_token:
        raise AppException(code="UNAUTHORIZED", message="缺少刷新令牌。")

    claims = _decode_jwt(refresh_token, resolved_settings)
    if claims.get("type") != "refresh":
        raise AppException(code="TOKEN_INVALID", message="刷新令牌类型不正确。")

    _ensure_token_not_blacklisted(db, claims)
    return claims


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    resolved_settings = settings or get_settings()
    claims = _decode_jwt(token, resolved_settings)
    if claims.get("type") != "access":
        raise AppException(code="TOKEN_INVALID", message="访问令牌类型不正确。")
    return claims


def blacklist_token(
    session: Session, claims: dict[str, Any], reason: TokenBlacklistReason
) -> None:
    jti = claims.get("jti")
    subject = claims.get("sub")
    expires_at = claims.get("exp")
    if (
        not isinstance(jti, str)
        or not isinstance(subject, str)
        or not isinstance(expires_at, int)
    ):
        raise AppException(code="TOKEN_INVALID", message="令牌声明不正确。")

    if session.get(TokenBlacklist, jti) is not None:
        return

    expires_dt = datetime.fromtimestamp(expires_at, tz=UTC).replace(tzinfo=None)
    session.add(
        TokenBlacklist(
            jti=jti,
            user_id=int(subject),
            revoked_at=datetime.now(UTC).replace(tzinfo=None),
            expires_at=expires_dt,
            reason=reason,
        )
    )


def get_user_roles(session: Session, user_id: int) -> set[str]:
    stmt = (
        select(RbacRole.role_key)
        .join(RbacUserRole, RbacUserRole.role_id == RbacRole.id)
        .where(RbacUserRole.user_id == user_id)
    )
    return set(session.scalars(stmt).all())


def get_user_permissions(session: Session, user_id: int) -> set[str]:
    stmt = (
        select(RbacPermission.resource, RbacPermission.action)
        .select_from(RbacPermission)
        .join(RbacRolePermission, RbacRolePermission.permission_id == RbacPermission.id)
        .join(RbacRole, RbacRole.id == RbacRolePermission.role_id)
        .join(RbacUserRole, RbacUserRole.role_id == RbacRole.id)
        .where(RbacUserRole.user_id == user_id)
    )
    rows = session.execute(stmt).all()
    return {f"{resource}:{action}" for resource, action in rows}


def _ensure_token_not_blacklisted(session: Session, claims: dict[str, Any]) -> None:
    jti = claims.get("jti")
    if not isinstance(jti, str):
        raise AppException(code="TOKEN_INVALID", message="令牌标识不正确。")

    blacklisted = session.get(TokenBlacklist, jti)
    if blacklisted is not None:
        raise AppException(code="TOKEN_BLACKLISTED", message="令牌已被吊销。")


def _resolve_user_id(claims: dict[str, Any]) -> int:
    subject = claims.get("sub")
    if not isinstance(subject, str):
        raise AppException(code="TOKEN_INVALID", message="令牌主体不正确。")
    try:
        return int(subject)
    except ValueError as error:
        raise AppException(code="TOKEN_INVALID", message="令牌主体不正确。") from error


def _resolve_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise AppException(code="UNAUTHORIZED", message="缺少访问令牌。")

    token_type, _, token = authorization.partition(" ")
    if token_type.lower() != "bearer" or not token:
        raise AppException(code="TOKEN_INVALID", message="访问令牌格式不正确。")
    return token.strip()


def get_auth_context(
    request: Request,
    db: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    token = _resolve_bearer_token(request)
    claims = decode_access_token(token, settings)
    _ensure_token_not_blacklisted(db, claims)

    user_id = _resolve_user_id(claims)
    user = db.get(SysUser, user_id)
    if user is None:
        raise AppException(code="UNAUTHORIZED", message="用户不存在。")

    roles = get_user_roles(db, user.id)
    return AuthContext(user=user, roles=roles, token_claims=claims)


def require_roles(*role_keys: str):
    expected_roles = {value.upper() for value in role_keys}

    def _dependency(context: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if expected_roles.intersection(context.roles):
            return context
        raise AppException(
            code="ROLE_INSUFFICIENT",
            message="当前角色无权执行该操作。",
        )

    return _dependency
