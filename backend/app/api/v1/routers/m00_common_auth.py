"""M00 router for common and authentication endpoints."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ....core.auth import (
    AuthContext,
    blacklist_token,
    clear_refresh_cookie,
    create_access_token,
    create_refresh_token,
    decode_refresh_token_from_request,
    get_auth_context,
    get_user_permissions,
    get_user_roles,
    hash_password,
    require_roles,
    set_refresh_cookie,
    validate_password_policy,
    verify_password,
)
from ....core.config import get_settings
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.enums import TokenBlacklistReason
from ....models.organization import SysUser
from ....schemas.auth import ChangePasswordRequest, LoginRequest, ResetPasswordRequest
from ....schemas.common import ApiResponse, build_success_response

router = APIRouter(tags=["M00"])

MAX_SKU_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_SKU_IMAGE_MIME: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def _sanitize_filename(filename: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "-", filename).strip("-")
    return normalized or "upload.bin"


@router.get("/system/ping", response_model=ApiResponse)
def system_ping() -> ApiResponse:
    """Foundation ping endpoint using unified API response schema."""

    return build_success_response(
        {
            "service": "backend",
            "status": "ok",
        }
    )


@router.post("/auth/login", response_model=ApiResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    stmt = select(SysUser).where(SysUser.employee_no == payload.employee_no)
    user = db.scalar(stmt)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppException(code="UNAUTHORIZED", message="工号或密码错误。")

    settings = get_settings()
    access_token = create_access_token(user.id, settings)
    refresh_token = create_refresh_token(user.id, settings)
    set_refresh_cookie(response, refresh_token, settings)

    roles = sorted(get_user_roles(db, user.id))
    permissions = sorted(get_user_permissions(db, user.id))
    return build_success_response(
        {
            "access_token": access_token,
            "expires_in": settings.access_token_ttl_seconds,
            "user": {
                "id": user.id,
                "employee_no": user.employee_no,
                "name": user.name,
                "department_name": user.department_name,
                "section_name": user.section_name,
                "mobile_phone": user.mobile_phone,
                "job_title": user.job_title,
                "roles": roles,
                "permissions": permissions,
            },
        }
    )


@router.post("/auth/refresh", response_model=ApiResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    settings = get_settings()
    claims = decode_refresh_token_from_request(request, db, settings)
    user_id = int(claims["sub"])

    user = db.get(SysUser, user_id)
    if user is None:
        raise AppException(code="UNAUTHORIZED", message="用户不存在。")

    access_token = create_access_token(user.id, settings)
    refresh_token = create_refresh_token(user.id, settings)
    set_refresh_cookie(response, refresh_token, settings)
    return build_success_response(
        {
            "access_token": access_token,
            "expires_in": settings.access_token_ttl_seconds,
        }
    )


@router.post("/auth/logout", response_model=ApiResponse)
def logout(
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    blacklist_token(db, context.token_claims, TokenBlacklistReason.LOGOUT)
    db.commit()
    clear_refresh_cookie(response)
    return build_success_response({"logged_out": True})


@router.put("/users/me/password", response_model=ApiResponse)
def change_my_password(
    payload: ChangePasswordRequest,
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    if not verify_password(payload.old_password, context.user.password_hash):
        raise AppException(
            code="INVALID_FIELD_FORMAT",
            message="原密码不正确。",
        )

    validate_password_policy(payload.new_password)
    context.user.password_hash = hash_password(payload.new_password)
    blacklist_token(db, context.token_claims, TokenBlacklistReason.PASSWORD_CHANGED)
    db.commit()
    clear_refresh_cookie(response)
    return build_success_response({"password_updated": True})


@router.post("/admin/users/{id}/reset-password", response_model=ApiResponse)
def reset_user_password(
    id: int,
    payload: ResetPasswordRequest,
    _: AuthContext = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    validate_password_policy(payload.new_password)
    user = db.get(SysUser, id)
    if user is None:
        raise AppException(code="USER_NOT_FOUND", message="用户不存在。")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return build_success_response({"user_id": user.id, "password_reset": True})


@router.post("/upload/sku-image", response_model=ApiResponse)
def upload_sku_image(
    file: UploadFile = File(...),
    context: AuthContext = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> ApiResponse:
    settings = get_settings()
    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

    content_type = (file.content_type or "").lower()
    ext = ALLOWED_SKU_IMAGE_MIME.get(content_type)
    if ext is None:
        raise AppException(
            code="UNSUPPORTED_MEDIA_TYPE",
            message="SKU 图片仅支持 jpg/png/webp。",
        )

    original_name = _sanitize_filename(file.filename or "upload.bin")
    raw = file.file.read()
    file_size = len(raw)
    if file_size <= 0:
        raise AppException(code="VALIDATION_ERROR", message="上传文件为空。")
    if file_size > MAX_SKU_IMAGE_SIZE_BYTES:
        raise AppException(
            code="VALIDATION_ERROR",
            message=f"SKU 图片大小不能超过 {MAX_SKU_IMAGE_SIZE_BYTES // 1024 // 1024} MB。",
        )

    uploaded_at = datetime.now(UTC)
    year = uploaded_at.year
    month = uploaded_at.month
    file_id = uuid4().hex
    filename = f"{file_id}.{ext}"

    target_dir = upload_root / "sku-covers" / f"{year}" / f"{month:02d}"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    target_path.write_bytes(raw)

    return build_success_response(
        {
            "file_id": file_id,
            "url": f"/api/v1/uploads/sku-covers/{year}/{month:02d}/{filename}",
            "file_name": original_name,
            "file_size": file_size,
            "mime_type": content_type,
            "uploaded_at": uploaded_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "meta": {
                "uploader_user_id": context.user.id,
            },
        }
    )
