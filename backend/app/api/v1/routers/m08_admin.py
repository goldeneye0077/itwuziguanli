"""M08 router implementation: backend admin operations."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from random import randint
from typing import cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ....core.auth import hash_password
from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import Application
from ....models.catalog import Category, Sku
from ....models.enums import (
    AnnouncementStatus,
    ApplicationStatus,
    ApplicationType,
    AssetStatus,
    DeliveryType,
    SkuStockMode,
)
from ....models.inventory import Asset
from ....models.organization import Department, SysUser
from ....models.portal import Announcement
from ....models.rbac import (
    RbacPermission,
    RbacRole,
    RbacRolePermission,
    RbacUiGuard,
    RbacUserRole,
)
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m08 import (
    AdminCrudResource,
    AdminUserRolesUpdateRequest,
    RbacRoleBindingsRequest,
    RbacRoleCreateRequest,
    RbacUiGuardsReplaceRequest,
)

router = APIRouter(tags=["M08"])
PERMISSION_RBAC_UPDATE = "RBAC_ADMIN:UPDATE"
PERMISSION_INVENTORY_READ = "INVENTORY:READ"
PERMISSION_INVENTORY_WRITE = "INVENTORY:WRITE"
PERMISSION_REPORTS_READ = "REPORTS:READ"
PERMISSION_OUTBOUND_READ = "OUTBOUND:READ"

UI_GUARD_TYPE_ROUTE = "ROUTE"
UI_GUARD_TYPE_ACTION = "ACTION"


def _to_iso8601(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _normalize_required_permissions(
    required_permissions: set[str] | None,
) -> set[str]:
    return {
        str(value).strip().upper()
        for value in (required_permissions or set())
        if str(value).strip()
    }


DEFAULT_ROUTE_UI_GUARDS: tuple[dict[str, object], ...] = (
    {"key": "/outbound", "required_permissions": [PERMISSION_OUTBOUND_READ]},
    {"key": "/inbound", "required_permissions": [PERMISSION_INVENTORY_READ]},
    {"key": "/inventory", "required_permissions": [PERMISSION_INVENTORY_READ]},
    {"key": "/materials", "required_permissions": [PERMISSION_INVENTORY_READ]},
    {"key": "/analytics", "required_permissions": [PERMISSION_REPORTS_READ]},
    {"key": "/copilot", "required_permissions": [PERMISSION_REPORTS_READ]},
    {"key": "/admin/rbac", "required_permissions": [PERMISSION_RBAC_UPDATE]},
    {"key": "/admin/crud", "required_permissions": [PERMISSION_RBAC_UPDATE]},
)

DEFAULT_ACTION_UI_GUARDS: tuple[dict[str, object], ...] = (
    {"key": "rbac.save-role-permissions", "required_permissions": [PERMISSION_RBAC_UPDATE]},
    {"key": "crud.save-record", "required_permissions": [PERMISSION_RBAC_UPDATE]},
    {"key": "outbound.fetch-records", "required_permissions": [PERMISSION_OUTBOUND_READ]},
    {"key": "outbound.export-records", "required_permissions": [PERMISSION_OUTBOUND_READ]},
    {"key": "inbound.confirm-inbound", "required_permissions": [PERMISSION_INVENTORY_WRITE]},
    {"key": "inbound.print-tag", "required_permissions": [PERMISSION_INVENTORY_READ]},
    {"key": "inventory.fetch-skus", "required_permissions": [PERMISSION_INVENTORY_READ]},
    {"key": "inventory.fetch-assets", "required_permissions": [PERMISSION_INVENTORY_READ]},
    {
        "key": "materials.manage-categories",
        "required_permissions": [PERMISSION_INVENTORY_WRITE],
    },
    {"key": "materials.manage-skus", "required_permissions": [PERMISSION_INVENTORY_WRITE]},
    {"key": "analytics.apply-filter", "required_permissions": [PERMISSION_REPORTS_READ]},
    {"key": "analytics.export-report", "required_permissions": [PERMISSION_REPORTS_READ]},
    {"key": "analytics.run-copilot", "required_permissions": [PERMISSION_REPORTS_READ]},
)


def _serialize_permissions_for_storage(values: Iterable[str]) -> str:
    normalized = sorted(_normalize_required_permissions(set(values)))
    return ",".join(normalized)


def _deserialize_permissions_from_storage(serialized: str) -> list[str]:
    if not serialized.strip():
        return []
    normalized = _normalize_required_permissions(set(serialized.split(",")))
    return sorted(normalized)


def _normalize_ui_guard_items(
    items: Iterable[dict[str, object]],
) -> list[dict[str, object]]:
    result: dict[str, list[str]] = {}
    for item in items:
        raw_key = str(item.get("key", "")).strip()
        if not raw_key:
            raise AppException(
                code="VALIDATION_ERROR",
                message="UI 权限映射项缺少 key。",
            )
        required_permissions = item.get("required_permissions")
        if isinstance(required_permissions, list):
            normalized_permissions = sorted(
                _normalize_required_permissions(set(required_permissions))
            )
        else:
            normalized_permissions = []
        result[raw_key] = normalized_permissions

    return [
        {"key": key, "required_permissions": permissions}
        for key, permissions in sorted(result.items(), key=lambda pair: pair[0])
    ]


def _default_ui_guard_payload() -> dict[str, list[dict[str, object]]]:
    routes = _normalize_ui_guard_items(DEFAULT_ROUTE_UI_GUARDS)
    actions = _normalize_ui_guard_items(DEFAULT_ACTION_UI_GUARDS)
    return {"routes": routes, "actions": actions}


def _load_ui_guard_payload(db: Session) -> dict[str, list[dict[str, object]]]:
    rows = db.scalars(
        select(RbacUiGuard).order_by(RbacUiGuard.guard_type.asc(), RbacUiGuard.guard_key.asc())
    ).all()
    if not rows:
        return _default_ui_guard_payload()

    route_items: list[dict[str, object]] = []
    action_items: list[dict[str, object]] = []
    for row in rows:
        item = {
            "key": row.guard_key,
            "required_permissions": _deserialize_permissions_from_storage(
                row.required_permissions
            ),
        }
        if row.guard_type == UI_GUARD_TYPE_ROUTE:
            route_items.append(item)
        elif row.guard_type == UI_GUARD_TYPE_ACTION:
            action_items.append(item)

    if not route_items and not action_items:
        return _default_ui_guard_payload()

    return {
        "routes": _normalize_ui_guard_items(route_items),
        "actions": _normalize_ui_guard_items(action_items),
    }


def _require_super_admin(
    context: AuthContext,
    *,
    required_permissions: set[str] | None = None,
) -> None:
    if "SUPER_ADMIN" not in context.roles:
        raise AppException(
            code="ROLE_INSUFFICIENT",
            message="当前角色无权执行该操作。",
        )

    normalized = _normalize_required_permissions(required_permissions)
    if not normalized or normalized.intersection(context.permissions):
        return
    raise AppException(
        code="PERMISSION_DENIED",
        message="当前账号缺少执行该操作所需权限。",
        details={"required_permissions": sorted(normalized)},
    )


def _require_admin_or_super_admin(
    context: AuthContext,
    *,
    required_permissions: set[str] | None = None,
) -> None:
    if not context.roles.intersection({"ADMIN", "SUPER_ADMIN"}):
        raise AppException(
            code="ROLE_INSUFFICIENT",
            message="当前角色无权执行该操作。",
        )

    if "SUPER_ADMIN" in context.roles:
        return

    normalized = _normalize_required_permissions(required_permissions)
    if not normalized or normalized.intersection(context.permissions):
        return
    raise AppException(
        code="PERMISSION_DENIED",
        message="当前账号缺少执行该操作所需权限。",
        details={"required_permissions": sorted(normalized)},
    )


def _normalize_key(value: str, *, field_name: str, max_length: int = 64) -> str:
    normalized = value.strip().upper()
    if not normalized:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段不能为空。",
            details={"field": field_name},
        )
    if len(normalized) > max_length:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段长度超出限制。",
            details={"field": field_name, "max_length": max_length},
        )
    return normalized


def _normalize_name(value: str, *, field_name: str, max_length: int) -> str:
    normalized = value.strip()
    if not normalized:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段不能为空。",
            details={"field": field_name},
        )
    if len(normalized) > max_length:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段长度超出限制。",
            details={"field": field_name, "max_length": max_length},
        )
    return normalized


def _permission_name(resource: str, action: str) -> str:
    return f"{resource}:{action}"


def _serialize_permission(permission: RbacPermission) -> dict[str, object]:
    return {
        "id": permission.id,
        "resource": permission.resource,
        "action": permission.action,
        "name": permission.name,
        "description": permission.description,
    }


def _serialize_role(
    role: RbacRole,
    permissions: list[RbacPermission],
) -> dict[str, object]:
    return {
        "id": role.id,
        "key": role.role_key,
        "name": role.role_name,
        "description": role.description,
        "is_system": role.is_system,
        "permissions": [_serialize_permission(item) for item in permissions],
    }


def _group_permission_pairs(
    permission_pairs: list[tuple[str, str]],
) -> list[dict[str, object]]:
    grouped: dict[str, list[str]] = {}
    for resource, action in permission_pairs:
        grouped.setdefault(resource, []).append(action)

    return [
        {"resource": resource, "actions": sorted(actions)}
        for resource, actions in sorted(grouped.items())
    ]


def _normalize_permission_pairs(
    payload: RbacRoleBindingsRequest,
) -> list[tuple[str, str]]:
    pairs: set[tuple[str, str]] = set()
    for permission_group in payload.permissions:
        resource = _normalize_key(
            permission_group.resource,
            field_name="permissions.resource",
            max_length=64,
        )
        for raw_action in permission_group.actions:
            action = _normalize_key(
                raw_action,
                field_name="permissions.actions",
                max_length=64,
            )
            pairs.add((resource, action))

    return sorted(pairs)


def _resolve_permissions(
    db: Session,
    *,
    permission_pairs: list[tuple[str, str]],
) -> list[RbacPermission]:
    if not permission_pairs:
        return []

    conditions = [
        (RbacPermission.resource == resource) & (RbacPermission.action == action)
        for resource, action in permission_pairs
    ]
    existing_permissions = db.scalars(
        select(RbacPermission).where(or_(*conditions))
    ).all()
    permission_by_pair = {
        (item.resource, item.action): item for item in existing_permissions
    }

    next_permission_id = _next_bigint_id(db, RbacPermission)
    for resource, action in permission_pairs:
        if (resource, action) in permission_by_pair:
            continue
        permission = RbacPermission(
            id=next_permission_id,
            resource=resource,
            action=action,
            name=_permission_name(resource, action),
            description=None,
        )
        db.add(permission)
        db.flush()
        permission_by_pair[(resource, action)] = permission
        next_permission_id += 1

    return [permission_by_pair[pair] for pair in permission_pairs]


def _paginate_scalars(
    db: Session,
    *,
    stmt,
    page: int,
    page_size: int,
) -> tuple[list[object], int]:
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def _keyword_pattern(keyword: str | None) -> str | None:
    if keyword is None:
        return None
    normalized = keyword.strip().lower()
    if not normalized:
        return None
    return f"%{normalized}%"


def _optional_text(
    payload: dict[str, object],
    key: str,
    *,
    max_length: int | None = None,
) -> str | None:
    raw = payload.get(key)
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    if max_length is not None and len(value) > max_length:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段长度超出限制。",
            details={"field": key, "max_length": max_length},
        )
    return value


def _required_text(
    payload: dict[str, object],
    key: str,
    *,
    max_length: int | None = None,
) -> str:
    value = _optional_text(payload, key, max_length=max_length)
    if value is None:
        raise AppException(
            code="VALIDATION_ERROR",
            message="缺少必填字段。",
            details={"field": key},
        )
    return value


def _optional_int(payload: dict[str, object], key: str) -> int | None:
    raw = payload.get(key)
    if raw is None:
        return None
    if isinstance(raw, bool):
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段格式错误。",
            details={"field": key},
        )
    try:
        return int(raw)
    except (TypeError, ValueError) as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段格式错误。",
            details={"field": key},
        ) from error


def _required_int(payload: dict[str, object], key: str) -> int:
    value = _optional_int(payload, key)
    if value is None:
        raise AppException(
            code="VALIDATION_ERROR",
            message="缺少必填字段。",
            details={"field": key},
        )
    return value


def _optional_decimal(payload: dict[str, object], key: str) -> Decimal | None:
    raw = payload.get(key)
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="字段格式错误。",
            details={"field": key},
        ) from error


def _required_decimal(payload: dict[str, object], key: str) -> Decimal:
    value = _optional_decimal(payload, key)
    if value is None:
        raise AppException(
            code="VALIDATION_ERROR",
            message="缺少必填字段。",
            details={"field": key},
        )
    return value


def _optional_datetime(payload: dict[str, object], key: str) -> datetime | None:
    raw = payload.get(key)
    if raw is None:
        return None
    if isinstance(raw, datetime):
        if raw.tzinfo is None:
            return raw
        return raw.astimezone(UTC).replace(tzinfo=None)

    text = str(raw).strip()
    if not text:
        return None
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="时间字段格式错误，请使用 ISO8601。",
            details={"field": key},
        ) from error
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(UTC).replace(tzinfo=None)


def _require_existing_user(db: Session, user_id: int) -> SysUser:
    user = db.get(SysUser, user_id)
    if user is None:
        raise AppException(
            code="USER_NOT_FOUND",
            message="用户不存在。",
            details={"user_id": user_id},
        )
    return user


def _require_existing_department(db: Session, department_id: int) -> Department:
    department = db.get(Department, department_id)
    if department is None:
        raise AppException(
            code="RESOURCE_NOT_FOUND",
            message="部门不存在。",
            details={"department_id": department_id},
        )
    return department


def _require_existing_category(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise AppException(
            code="CATEGORY_NOT_FOUND",
            message="分类不存在。",
            details={"category_id": category_id},
        )
    return category


def _require_existing_sku(db: Session, sku_id: int) -> Sku:
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise AppException(
            code="SKU_NOT_FOUND",
            message="物料不存在。",
            details={"sku_id": sku_id},
        )
    return sku


def _resolve_asset_status(value: str, *, field_name: str) -> AssetStatus:
    normalized = value.strip().upper()
    try:
        return AssetStatus(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="资产状态不合法。",
            details={"field": field_name, "value": normalized},
        ) from error


def _resolve_application_type(value: str, *, field_name: str) -> ApplicationType:
    normalized = value.strip().upper()
    try:
        return ApplicationType(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="申请类型不合法。",
            details={"field": field_name, "value": normalized},
        ) from error


def _resolve_application_status(value: str, *, field_name: str) -> ApplicationStatus:
    normalized = value.strip().upper()
    try:
        return ApplicationStatus(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="申请状态不合法。",
            details={"field": field_name, "value": normalized},
        ) from error


def _resolve_delivery_type(value: str, *, field_name: str) -> DeliveryType:
    normalized = value.strip().upper()
    try:
        return DeliveryType(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="交付方式不合法。",
            details={"field": field_name, "value": normalized},
        ) from error


def _resolve_announcement_status(
    value: str, *, field_name: str
) -> AnnouncementStatus:
    normalized = value.strip().upper()
    try:
        return AnnouncementStatus(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="公告状态不合法。",
            details={"field": field_name, "value": normalized},
        ) from error


def _resolve_sku_stock_mode(value: str, *, field_name: str) -> SkuStockMode:
    normalized = value.strip().upper()
    try:
        return SkuStockMode(normalized)
    except ValueError as error:
        raise AppException(
            code="VALIDATION_ERROR",
            message="库存模式不合法。",
            details={"field": field_name, "value": normalized},
        ) from error


def _generate_pickup_code(db: Session) -> str:
    for _ in range(20):
        candidate = f"{randint(0, 999999):06d}"
        exists = db.scalar(
            select(Application.id).where(Application.pickup_code == candidate).limit(1)
        )
        if exists is None:
            return candidate
    raise AppException(
        code="INTERNAL_SERVER_ERROR",
        message="无法生成取件码，请稍后重试。",
    )


def _commit_or_raise_validation_error(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise AppException(
            code="VALIDATION_ERROR",
            message="数据约束冲突，请检查输入内容。",
        ) from error


def _serialize_user(user: SysUser) -> dict[str, object]:
    return {
        "id": user.id,
        "employee_no": user.employee_no,
        "name": user.name,
        "department_id": user.department_id,
        "department_name": user.department_name,
        "section_name": user.section_name,
        "mobile_phone": user.mobile_phone,
        "job_title": user.job_title,
        "email": user.email,
        "created_at": _to_iso8601(user.created_at),
        "updated_at": _to_iso8601(user.updated_at),
    }


def _serialize_category(category: Category) -> dict[str, object]:
    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "created_at": _to_iso8601(category.created_at),
        "updated_at": _to_iso8601(category.updated_at),
    }


def _serialize_sku(sku: Sku) -> dict[str, object]:
    return {
        "id": sku.id,
        "category_id": sku.category_id,
        "brand": sku.brand,
        "model": sku.model,
        "spec": sku.spec,
        "reference_price": str(sku.reference_price),
        "cover_url": sku.cover_url,
        "safety_stock_threshold": sku.safety_stock_threshold,
        "created_at": _to_iso8601(sku.created_at),
        "updated_at": _to_iso8601(sku.updated_at),
    }


def _serialize_asset(asset: Asset) -> dict[str, object]:
    return {
        "id": asset.id,
        "asset_tag": asset.asset_tag,
        "sku_id": asset.sku_id,
        "sn": asset.sn,
        "status": asset.status.value,
        "holder_user_id": asset.holder_user_id,
        "locked_application_id": asset.locked_application_id,
        "inbound_at": _to_iso8601(asset.inbound_at),
        "created_at": _to_iso8601(asset.created_at),
        "updated_at": _to_iso8601(asset.updated_at),
    }


def _serialize_application(application: Application) -> dict[str, object]:
    return {
        "id": application.id,
        "title": application.title,
        "applicant_user_id": application.applicant_user_id,
        "applicant_name_snapshot": application.applicant_name_snapshot,
        "applicant_department_snapshot": application.applicant_department_snapshot,
        "applicant_phone_snapshot": application.applicant_phone_snapshot,
        "applicant_job_title_snapshot": application.applicant_job_title_snapshot,
        "express_address_snapshot": application.express_address_snapshot,
        "type": application.type.value,
        "status": application.status.value,
        "delivery_type": application.delivery_type.value,
        "pickup_code": application.pickup_code,
        "leader_approver_user_id": application.leader_approver_user_id,
        "admin_reviewer_user_id": application.admin_reviewer_user_id,
        "created_at": _to_iso8601(application.created_at),
        "updated_at": _to_iso8601(application.updated_at),
    }


def _serialize_announcement(announcement: Announcement) -> dict[str, object]:
    return {
        "id": announcement.id,
        "title": announcement.title,
        "content": announcement.content,
        "author_user_id": announcement.author_user_id,
        "status": announcement.status.value,
        "published_at": _to_iso8601(announcement.published_at),
        "created_at": _to_iso8601(announcement.created_at),
        "updated_at": _to_iso8601(announcement.updated_at),
    }


def _list_users(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, object]], int]:
    stmt = select(SysUser)
    pattern = _keyword_pattern(keyword)
    numeric_keyword = (
        int(keyword.strip()) if keyword and keyword.strip().isdigit() else None
    )
    if pattern is not None:
        if numeric_keyword is None:
            stmt = stmt.where(
                or_(
                    func.lower(SysUser.employee_no).like(pattern),
                    func.lower(SysUser.name).like(pattern),
                    func.lower(func.coalesce(SysUser.email, "")).like(pattern),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    func.lower(SysUser.employee_no).like(pattern),
                    func.lower(SysUser.name).like(pattern),
                    func.lower(func.coalesce(SysUser.email, "")).like(pattern),
                    SysUser.id == numeric_keyword,
                )
            )
    rows, total = _paginate_scalars(
        db,
        stmt=stmt.order_by(SysUser.id.asc()),
        page=page,
        page_size=page_size,
    )
    typed_rows = cast(list[SysUser], rows)
    return [_serialize_user(item) for item in typed_rows], total


def _list_categories(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, object]], int]:
    stmt = select(Category)
    pattern = _keyword_pattern(keyword)
    numeric_keyword = (
        int(keyword.strip()) if keyword and keyword.strip().isdigit() else None
    )
    if pattern is not None:
        if numeric_keyword is None:
            stmt = stmt.where(func.lower(Category.name).like(pattern))
        else:
            stmt = stmt.where(
                or_(
                    func.lower(Category.name).like(pattern),
                    Category.id == numeric_keyword,
                )
            )
    rows, total = _paginate_scalars(
        db,
        stmt=stmt.order_by(Category.id.asc()),
        page=page,
        page_size=page_size,
    )
    typed_rows = cast(list[Category], rows)
    return [_serialize_category(item) for item in typed_rows], total


def _list_skus(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, object]], int]:
    stmt = select(Sku)
    pattern = _keyword_pattern(keyword)
    numeric_keyword = (
        int(keyword.strip()) if keyword and keyword.strip().isdigit() else None
    )
    if pattern is not None:
        if numeric_keyword is None:
            stmt = stmt.where(
                or_(
                    func.lower(Sku.brand).like(pattern),
                    func.lower(Sku.model).like(pattern),
                    func.lower(Sku.spec).like(pattern),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    func.lower(Sku.brand).like(pattern),
                    func.lower(Sku.model).like(pattern),
                    func.lower(Sku.spec).like(pattern),
                    Sku.id == numeric_keyword,
                )
            )
    rows, total = _paginate_scalars(
        db,
        stmt=stmt.order_by(Sku.id.asc()),
        page=page,
        page_size=page_size,
    )
    typed_rows = cast(list[Sku], rows)
    return [_serialize_sku(item) for item in typed_rows], total


def _list_assets(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, object]], int]:
    stmt = select(Asset)
    pattern = _keyword_pattern(keyword)
    numeric_keyword = (
        int(keyword.strip()) if keyword and keyword.strip().isdigit() else None
    )
    if pattern is not None:
        if numeric_keyword is None:
            stmt = stmt.where(
                or_(
                    func.lower(Asset.asset_tag).like(pattern),
                    func.lower(Asset.sn).like(pattern),
                    func.lower(Asset.status).like(pattern),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    func.lower(Asset.asset_tag).like(pattern),
                    func.lower(Asset.sn).like(pattern),
                    func.lower(Asset.status).like(pattern),
                    Asset.id == numeric_keyword,
                )
            )
    rows, total = _paginate_scalars(
        db,
        stmt=stmt.order_by(Asset.id.asc()),
        page=page,
        page_size=page_size,
    )
    typed_rows = cast(list[Asset], rows)
    return [_serialize_asset(item) for item in typed_rows], total


def _list_applications(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, object]], int]:
    stmt = select(Application)
    pattern = _keyword_pattern(keyword)
    numeric_keyword = (
        int(keyword.strip()) if keyword and keyword.strip().isdigit() else None
    )
    if pattern is not None:
        if numeric_keyword is None:
            stmt = stmt.where(
                or_(
                    func.lower(Application.pickup_code).like(pattern),
                    func.lower(Application.status).like(pattern),
                    func.lower(Application.type).like(pattern),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    func.lower(Application.pickup_code).like(pattern),
                    func.lower(Application.status).like(pattern),
                    func.lower(Application.type).like(pattern),
                    Application.id == numeric_keyword,
                )
            )
    rows, total = _paginate_scalars(
        db,
        stmt=stmt.order_by(Application.id.asc()),
        page=page,
        page_size=page_size,
    )
    typed_rows = cast(list[Application], rows)
    return [_serialize_application(item) for item in typed_rows], total


def _list_announcements(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, object]], int]:
    stmt = select(Announcement)
    pattern = _keyword_pattern(keyword)
    numeric_keyword = (
        int(keyword.strip()) if keyword and keyword.strip().isdigit() else None
    )
    if pattern is not None:
        if numeric_keyword is None:
            stmt = stmt.where(
                or_(
                    func.lower(Announcement.title).like(pattern),
                    func.lower(Announcement.content).like(pattern),
                    func.lower(Announcement.status).like(pattern),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    func.lower(Announcement.title).like(pattern),
                    func.lower(Announcement.content).like(pattern),
                    func.lower(Announcement.status).like(pattern),
                    Announcement.id == numeric_keyword,
                )
            )
    rows, total = _paginate_scalars(
        db,
        stmt=stmt.order_by(Announcement.id.asc()),
        page=page,
        page_size=page_size,
    )
    typed_rows = cast(list[Announcement], rows)
    return [_serialize_announcement(item) for item in typed_rows], total


def _create_user(db: Session, payload: dict[str, object]) -> dict[str, object]:
    employee_no = _required_text(payload, "employee_no", max_length=32)
    name = _required_text(payload, "name", max_length=64)
    department_id = _required_int(payload, "department_id")
    _require_existing_department(db, department_id)
    password = _optional_text(payload, "password", max_length=128) or "User12345"
    user = SysUser(
        id=_next_bigint_id(db, SysUser),
        employee_no=employee_no,
        name=name,
        department_id=department_id,
        email=_optional_text(payload, "email", max_length=128),
        department_name=_optional_text(payload, "department_name", max_length=64),
        section_name=_optional_text(payload, "section_name", max_length=64),
        mobile_phone=_optional_text(payload, "mobile_phone", max_length=32),
        job_title=_optional_text(payload, "job_title", max_length=128),
        password_hash=hash_password(password),
    )
    db.add(user)
    _commit_or_raise_validation_error(db)
    db.refresh(user)
    return _serialize_user(user)


def _update_user(
    db: Session, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    user = db.get(SysUser, record_id)
    if user is None:
        raise AppException(code="USER_NOT_FOUND", message="用户不存在。")

    if "employee_no" in payload:
        user.employee_no = _required_text(payload, "employee_no", max_length=32)
    if "name" in payload:
        user.name = _required_text(payload, "name", max_length=64)
    if "department_id" in payload:
        department_id = _required_int(payload, "department_id")
        _require_existing_department(db, department_id)
        user.department_id = department_id
    if "email" in payload:
        user.email = _optional_text(payload, "email", max_length=128)
    if "department_name" in payload:
        user.department_name = _optional_text(payload, "department_name", max_length=64)
    if "section_name" in payload:
        user.section_name = _optional_text(payload, "section_name", max_length=64)
    if "mobile_phone" in payload:
        user.mobile_phone = _optional_text(payload, "mobile_phone", max_length=32)
    if "job_title" in payload:
        user.job_title = _optional_text(payload, "job_title", max_length=128)
    if "password" in payload:
        password = _optional_text(payload, "password", max_length=128)
        if not password:
            raise AppException(
                code="VALIDATION_ERROR",
                message="密码不能为空。",
                details={"field": "password"},
            )
        user.password_hash = hash_password(password)

    _commit_or_raise_validation_error(db)
    db.refresh(user)
    return _serialize_user(user)


def _create_category(db: Session, payload: dict[str, object]) -> dict[str, object]:
    parent_id = _optional_int(payload, "parent_id")
    if parent_id is not None and db.get(Category, parent_id) is None:
        raise AppException(
            code="CATEGORY_NOT_FOUND",
            message="父级分类不存在。",
            details={"parent_id": parent_id},
        )
    category = Category(
        id=_next_bigint_id(db, Category),
        name=_required_text(payload, "name", max_length=64),
        parent_id=parent_id,
    )
    db.add(category)
    _commit_or_raise_validation_error(db)
    db.refresh(category)
    return _serialize_category(category)


def _update_category(
    db: Session, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    category = db.get(Category, record_id)
    if category is None:
        raise AppException(code="CATEGORY_NOT_FOUND", message="分类不存在。")

    if "name" in payload:
        category.name = _required_text(payload, "name", max_length=64)
    if "parent_id" in payload:
        parent_id = _optional_int(payload, "parent_id")
        if parent_id == category.id:
            raise AppException(
                code="VALIDATION_ERROR",
                message="分类父级不能指向自身。",
            )
        if parent_id is not None and db.get(Category, parent_id) is None:
            raise AppException(
                code="CATEGORY_NOT_FOUND",
                message="父级分类不存在。",
                details={"parent_id": parent_id},
            )
        category.parent_id = parent_id

    _commit_or_raise_validation_error(db)
    db.refresh(category)
    return _serialize_category(category)


def _create_sku(db: Session, payload: dict[str, object]) -> dict[str, object]:
    category_id = _required_int(payload, "category_id")
    _require_existing_category(db, category_id)

    stock_mode = SkuStockMode.SERIALIZED
    if "stock_mode" in payload and payload.get("stock_mode") is not None:
        stock_mode = _resolve_sku_stock_mode(
            _required_text(payload, "stock_mode"), field_name="stock_mode"
        )

    sku = Sku(
        id=_next_bigint_id(db, Sku),
        category_id=category_id,
        brand=_required_text(payload, "brand", max_length=64),
        model=_required_text(payload, "model", max_length=128),
        spec=_required_text(payload, "spec", max_length=255),
        reference_price=_required_decimal(payload, "reference_price"),
        cover_url=_optional_text(payload, "cover_url", max_length=512),
        stock_mode=stock_mode,
        safety_stock_threshold=_optional_int(payload, "safety_stock_threshold") or 0,
    )
    db.add(sku)
    _commit_or_raise_validation_error(db)
    db.refresh(sku)
    return _serialize_sku(sku)


def _update_sku(
    db: Session, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    sku = db.get(Sku, record_id)
    if sku is None:
        raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")

    if "category_id" in payload:
        category_id = _required_int(payload, "category_id")
        _require_existing_category(db, category_id)
        sku.category_id = category_id
    if "brand" in payload:
        sku.brand = _required_text(payload, "brand", max_length=64)
    if "model" in payload:
        sku.model = _required_text(payload, "model", max_length=128)
    if "spec" in payload:
        sku.spec = _required_text(payload, "spec", max_length=255)
    if "reference_price" in payload:
        sku.reference_price = _required_decimal(payload, "reference_price")
    if "cover_url" in payload:
        sku.cover_url = _optional_text(payload, "cover_url", max_length=512)
    if "stock_mode" in payload:
        sku.stock_mode = _resolve_sku_stock_mode(
            _required_text(payload, "stock_mode"), field_name="stock_mode"
        )
    if "safety_stock_threshold" in payload:
        sku.safety_stock_threshold = _optional_int(payload, "safety_stock_threshold") or 0

    _commit_or_raise_validation_error(db)
    db.refresh(sku)
    return _serialize_sku(sku)


def _create_asset(db: Session, payload: dict[str, object]) -> dict[str, object]:
    sku_id = _required_int(payload, "sku_id")
    _require_existing_sku(db, sku_id)
    holder_user_id = _optional_int(payload, "holder_user_id")
    if holder_user_id is not None:
        _require_existing_user(db, holder_user_id)
    locked_application_id = _optional_int(payload, "locked_application_id")
    if locked_application_id is not None and db.get(Application, locked_application_id) is None:
        raise AppException(
            code="APPLICATION_NOT_FOUND",
            message="关联申请不存在。",
            details={"locked_application_id": locked_application_id},
        )

    status = AssetStatus.IN_STOCK
    if "status" in payload and payload.get("status") is not None:
        status = _resolve_asset_status(
            _required_text(payload, "status"), field_name="status"
        )

    asset = Asset(
        id=_next_bigint_id(db, Asset),
        asset_tag=_required_text(payload, "asset_tag", max_length=64),
        sku_id=sku_id,
        sn=_required_text(payload, "sn", max_length=128),
        status=status,
        holder_user_id=holder_user_id,
        locked_application_id=locked_application_id,
        inbound_at=_optional_datetime(payload, "inbound_at")
        or datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(asset)
    _commit_or_raise_validation_error(db)
    db.refresh(asset)
    return _serialize_asset(asset)


def _update_asset(
    db: Session, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    asset = db.get(Asset, record_id)
    if asset is None:
        raise AppException(code="ASSET_NOT_FOUND", message="资产不存在。")

    if "asset_tag" in payload:
        asset.asset_tag = _required_text(payload, "asset_tag", max_length=64)
    if "sku_id" in payload:
        sku_id = _required_int(payload, "sku_id")
        _require_existing_sku(db, sku_id)
        asset.sku_id = sku_id
    if "sn" in payload:
        asset.sn = _required_text(payload, "sn", max_length=128)
    if "status" in payload:
        asset.status = _resolve_asset_status(
            _required_text(payload, "status"), field_name="status"
        )
    if "holder_user_id" in payload:
        holder_user_id = _optional_int(payload, "holder_user_id")
        if holder_user_id is not None:
            _require_existing_user(db, holder_user_id)
        asset.holder_user_id = holder_user_id
    if "locked_application_id" in payload:
        locked_application_id = _optional_int(payload, "locked_application_id")
        if locked_application_id is not None and db.get(Application, locked_application_id) is None:
            raise AppException(
                code="APPLICATION_NOT_FOUND",
                message="关联申请不存在。",
                details={"locked_application_id": locked_application_id},
            )
        asset.locked_application_id = locked_application_id
    if "inbound_at" in payload:
        inbound_at = _optional_datetime(payload, "inbound_at")
        if inbound_at is None:
            raise AppException(
                code="VALIDATION_ERROR",
                message="入库时间不能为空。",
                details={"field": "inbound_at"},
            )
        asset.inbound_at = inbound_at

    _commit_or_raise_validation_error(db)
    db.refresh(asset)
    return _serialize_asset(asset)


def _create_application(db: Session, payload: dict[str, object]) -> dict[str, object]:
    applicant_user_id = _required_int(payload, "applicant_user_id")
    _require_existing_user(db, applicant_user_id)
    application_type = _resolve_application_type(
        _required_text(payload, "type"), field_name="type"
    )
    delivery_type = _resolve_delivery_type(
        _required_text(payload, "delivery_type"), field_name="delivery_type"
    )
    status = (
        _resolve_application_status(
            _required_text(payload, "status"), field_name="status"
        )
        if "status" in payload and payload.get("status") is not None
        else ApplicationStatus.SUBMITTED
    )

    express_address_snapshot = payload.get("express_address_snapshot")
    if express_address_snapshot is not None and not isinstance(express_address_snapshot, dict):
        raise AppException(
            code="VALIDATION_ERROR",
            message="express_address_snapshot 必须是对象。",
            details={"field": "express_address_snapshot"},
        )

    application = Application(
        id=_next_bigint_id(db, Application),
        title=_optional_text(payload, "title", max_length=255),
        applicant_user_id=applicant_user_id,
        type=application_type,
        status=status,
        delivery_type=delivery_type,
        pickup_code=_optional_text(payload, "pickup_code", max_length=6)
        or _generate_pickup_code(db),
        pickup_qr_string=_optional_text(payload, "pickup_qr_string", max_length=512),
        applicant_name_snapshot=_optional_text(payload, "applicant_name_snapshot", max_length=64),
        applicant_department_snapshot=_optional_text(
            payload, "applicant_department_snapshot", max_length=64
        ),
        applicant_phone_snapshot=_optional_text(payload, "applicant_phone_snapshot", max_length=32),
        applicant_job_title_snapshot=_optional_text(
            payload, "applicant_job_title_snapshot", max_length=128
        ),
        express_address_snapshot=cast(dict[str, object] | None, express_address_snapshot),
        leader_approver_user_id=_optional_int(payload, "leader_approver_user_id"),
        admin_reviewer_user_id=_optional_int(payload, "admin_reviewer_user_id"),
    )
    db.add(application)
    _commit_or_raise_validation_error(db)
    db.refresh(application)
    return _serialize_application(application)


def _update_application(
    db: Session, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    application = db.get(Application, record_id)
    if application is None:
        raise AppException(code="APPLICATION_NOT_FOUND", message="申请单不存在。")

    if "title" in payload:
        application.title = _optional_text(payload, "title", max_length=255)
    if "applicant_user_id" in payload:
        applicant_user_id = _required_int(payload, "applicant_user_id")
        _require_existing_user(db, applicant_user_id)
        application.applicant_user_id = applicant_user_id
    if "type" in payload:
        application.type = _resolve_application_type(
            _required_text(payload, "type"), field_name="type"
        )
    if "status" in payload:
        application.status = _resolve_application_status(
            _required_text(payload, "status"), field_name="status"
        )
    if "delivery_type" in payload:
        application.delivery_type = _resolve_delivery_type(
            _required_text(payload, "delivery_type"), field_name="delivery_type"
        )
    if "pickup_code" in payload:
        pickup_code = _required_text(payload, "pickup_code", max_length=6)
        if len(pickup_code) != 6:
            raise AppException(
                code="VALIDATION_ERROR",
                message="pickup_code 必须为 6 位。",
                details={"field": "pickup_code"},
            )
        application.pickup_code = pickup_code
    if "pickup_qr_string" in payload:
        application.pickup_qr_string = _optional_text(
            payload, "pickup_qr_string", max_length=512
        )
    if "applicant_name_snapshot" in payload:
        application.applicant_name_snapshot = _optional_text(
            payload, "applicant_name_snapshot", max_length=64
        )
    if "applicant_department_snapshot" in payload:
        application.applicant_department_snapshot = _optional_text(
            payload, "applicant_department_snapshot", max_length=64
        )
    if "applicant_phone_snapshot" in payload:
        application.applicant_phone_snapshot = _optional_text(
            payload, "applicant_phone_snapshot", max_length=32
        )
    if "applicant_job_title_snapshot" in payload:
        application.applicant_job_title_snapshot = _optional_text(
            payload, "applicant_job_title_snapshot", max_length=128
        )
    if "express_address_snapshot" in payload:
        snapshot = payload.get("express_address_snapshot")
        if snapshot is not None and not isinstance(snapshot, dict):
            raise AppException(
                code="VALIDATION_ERROR",
                message="express_address_snapshot 必须是对象。",
                details={"field": "express_address_snapshot"},
            )
        application.express_address_snapshot = cast(dict[str, object] | None, snapshot)
    if "leader_approver_user_id" in payload:
        leader_approver_user_id = _optional_int(payload, "leader_approver_user_id")
        if leader_approver_user_id is not None:
            _require_existing_user(db, leader_approver_user_id)
        application.leader_approver_user_id = leader_approver_user_id
    if "admin_reviewer_user_id" in payload:
        admin_reviewer_user_id = _optional_int(payload, "admin_reviewer_user_id")
        if admin_reviewer_user_id is not None:
            _require_existing_user(db, admin_reviewer_user_id)
        application.admin_reviewer_user_id = admin_reviewer_user_id

    _commit_or_raise_validation_error(db)
    db.refresh(application)
    return _serialize_application(application)


def _create_announcement(
    db: Session, payload: dict[str, object]
) -> dict[str, object]:
    author_user_id = _required_int(payload, "author_user_id")
    _require_existing_user(db, author_user_id)
    status = (
        _resolve_announcement_status(
            _required_text(payload, "status"), field_name="status"
        )
        if "status" in payload and payload.get("status") is not None
        else AnnouncementStatus.DRAFT
    )
    announcement = Announcement(
        id=_next_bigint_id(db, Announcement),
        title=_required_text(payload, "title", max_length=128),
        content=_required_text(payload, "content"),
        author_user_id=author_user_id,
        status=status,
        published_at=_optional_datetime(payload, "published_at"),
    )
    db.add(announcement)
    _commit_or_raise_validation_error(db)
    db.refresh(announcement)
    return _serialize_announcement(announcement)


def _update_announcement(
    db: Session, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    announcement = db.get(Announcement, record_id)
    if announcement is None:
        raise AppException(code="RESOURCE_NOT_FOUND", message="公告不存在。")

    if "title" in payload:
        announcement.title = _required_text(payload, "title", max_length=128)
    if "content" in payload:
        announcement.content = _required_text(payload, "content")
    if "author_user_id" in payload:
        author_user_id = _required_int(payload, "author_user_id")
        _require_existing_user(db, author_user_id)
        announcement.author_user_id = author_user_id
    if "status" in payload:
        announcement.status = _resolve_announcement_status(
            _required_text(payload, "status"), field_name="status"
        )
    if "published_at" in payload:
        announcement.published_at = _optional_datetime(payload, "published_at")

    _commit_or_raise_validation_error(db)
    db.refresh(announcement)
    return _serialize_announcement(announcement)


def _create_crud_resource_item(
    db: Session, resource: AdminCrudResource, payload: dict[str, object]
) -> dict[str, object]:
    if resource == "users":
        return _create_user(db, payload)
    if resource == "categories":
        return _create_category(db, payload)
    if resource == "skus":
        return _create_sku(db, payload)
    if resource == "assets":
        return _create_asset(db, payload)
    if resource == "applications":
        return _create_application(db, payload)
    if resource == "announcements":
        return _create_announcement(db, payload)
    raise AppException(
        code="VALIDATION_ERROR",
        message="不支持的资源类型。",
        details={"resource": resource},
    )


def _update_crud_resource_item(
    db: Session, resource: AdminCrudResource, record_id: int, payload: dict[str, object]
) -> dict[str, object]:
    if resource == "users":
        return _update_user(db, record_id, payload)
    if resource == "categories":
        return _update_category(db, record_id, payload)
    if resource == "skus":
        return _update_sku(db, record_id, payload)
    if resource == "assets":
        return _update_asset(db, record_id, payload)
    if resource == "applications":
        return _update_application(db, record_id, payload)
    if resource == "announcements":
        return _update_announcement(db, record_id, payload)
    raise AppException(
        code="VALIDATION_ERROR",
        message="不支持的资源类型。",
        details={"resource": resource},
    )


def _delete_crud_resource_item(
    db: Session, resource: AdminCrudResource, record_id: int
) -> dict[str, object]:
    if resource == "users":
        user = db.get(SysUser, record_id)
        if user is None:
            raise AppException(code="USER_NOT_FOUND", message="用户不存在。")
        db.delete(user)
        _commit_or_raise_validation_error(db)
        return {"id": record_id, "deleted": True}

    if resource == "categories":
        category = db.get(Category, record_id)
        if category is None:
            raise AppException(code="CATEGORY_NOT_FOUND", message="分类不存在。")
        db.delete(category)
        _commit_or_raise_validation_error(db)
        return {"id": record_id, "deleted": True}

    if resource == "skus":
        sku = db.get(Sku, record_id)
        if sku is None:
            raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")
        db.delete(sku)
        _commit_or_raise_validation_error(db)
        return {"id": record_id, "deleted": True}

    if resource == "assets":
        asset = db.get(Asset, record_id)
        if asset is None:
            raise AppException(code="ASSET_NOT_FOUND", message="资产不存在。")
        db.delete(asset)
        _commit_or_raise_validation_error(db)
        return {"id": record_id, "deleted": True}

    if resource == "applications":
        application = db.get(Application, record_id)
        if application is None:
            raise AppException(code="APPLICATION_NOT_FOUND", message="申请单不存在。")
        application.status = ApplicationStatus.CANCELLED
        _commit_or_raise_validation_error(db)
        return {"id": record_id, "deleted": True, "status": application.status.value}

    if resource == "announcements":
        announcement = db.get(Announcement, record_id)
        if announcement is None:
            raise AppException(code="RESOURCE_NOT_FOUND", message="公告不存在。")
        db.delete(announcement)
        _commit_or_raise_validation_error(db)
        return {"id": record_id, "deleted": True}

    raise AppException(
        code="VALIDATION_ERROR",
        message="不支持的资源类型。",
        details={"resource": resource},
    )


@router.get("/admin/rbac/roles", response_model=ApiResponse)
def list_roles(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    roles = db.scalars(select(RbacRole).order_by(RbacRole.id.asc())).all()
    role_permissions_map: dict[int, list[RbacPermission]] = {
        role.id: [] for role in roles
    }

    if roles:
        role_ids = [role.id for role in roles]
        rows = db.execute(
            select(RbacRolePermission.role_id, RbacPermission)
            .join(RbacPermission, RbacPermission.id == RbacRolePermission.permission_id)
            .where(RbacRolePermission.role_id.in_(role_ids))
            .order_by(
                RbacRolePermission.role_id.asc(),
                RbacPermission.resource.asc(),
                RbacPermission.action.asc(),
                RbacPermission.id.asc(),
            )
        ).all()
        for role_id, permission in rows:
            role_permissions_map[int(role_id)].append(permission)

    data = [
        _serialize_role(role, role_permissions_map.get(role.id, [])) for role in roles
    ]
    return build_success_response(data)


@router.post("/admin/rbac/roles", response_model=ApiResponse)
def create_role(
    payload: RbacRoleCreateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    role_key = _normalize_key(payload.key, field_name="key", max_length=64)
    role_name = _normalize_name(payload.name, field_name="name", max_length=128)
    description = (
        payload.description.strip()
        if payload.description and payload.description.strip()
        else None
    )

    existing_role = db.scalar(
        select(RbacRole.id).where(RbacRole.role_key == role_key).limit(1)
    )
    if existing_role is not None:
        raise AppException(
            code="VALIDATION_ERROR",
            message="角色标识已存在。",
            details={"key": role_key},
        )

    role = RbacRole(
        id=_next_bigint_id(db, RbacRole),
        role_key=role_key,
        role_name=role_name,
        description=description,
        is_system=False,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return build_success_response(_serialize_role(role, []))


@router.get("/admin/rbac/permissions", response_model=ApiResponse)
def list_permissions(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    permissions = db.scalars(
        select(RbacPermission).order_by(
            RbacPermission.resource.asc(),
            RbacPermission.action.asc(),
            RbacPermission.id.asc(),
        )
    ).all()
    return build_success_response([_serialize_permission(item) for item in permissions])


@router.get("/rbac/ui-guards", response_model=ApiResponse)
def list_ui_guards(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _ = context
    return build_success_response(_load_ui_guard_payload(db))


@router.put("/admin/rbac/ui-guards", response_model=ApiResponse)
def replace_ui_guards(
    payload: RbacUiGuardsReplaceRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    normalized_routes = _normalize_ui_guard_items(
        [
            {"key": item.key, "required_permissions": item.required_permissions}
            for item in payload.routes
        ]
    )
    normalized_actions = _normalize_ui_guard_items(
        [
            {"key": item.key, "required_permissions": item.required_permissions}
            for item in payload.actions
        ]
    )

    db.execute(delete(RbacUiGuard))

    next_guard_id = _next_bigint_id(db, RbacUiGuard)
    for route_item in normalized_routes:
        db.add(
            RbacUiGuard(
                id=next_guard_id,
                guard_type=UI_GUARD_TYPE_ROUTE,
                guard_key=str(route_item["key"]),
                required_permissions=_serialize_permissions_for_storage(
                    cast(list[str], route_item["required_permissions"])
                ),
            )
        )
        next_guard_id += 1

    for action_item in normalized_actions:
        db.add(
            RbacUiGuard(
                id=next_guard_id,
                guard_type=UI_GUARD_TYPE_ACTION,
                guard_key=str(action_item["key"]),
                required_permissions=_serialize_permissions_for_storage(
                    cast(list[str], action_item["required_permissions"])
                ),
            )
        )
        next_guard_id += 1

    db.commit()
    return build_success_response(
        {
            "routes": normalized_routes,
            "actions": normalized_actions,
        }
    )


@router.post("/admin/rbac/role-bindings", response_model=ApiResponse)
def bind_role_permissions(
    payload: RbacRoleBindingsRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    role_key = _normalize_key(payload.role_key, field_name="role_key", max_length=64)
    role = db.scalar(select(RbacRole).where(RbacRole.role_key == role_key).limit(1))
    if role is None:
        raise AppException(
            code="RESOURCE_NOT_FOUND",
            message="角色不存在。",
            details={"role_key": role_key},
        )

    permission_pairs = _normalize_permission_pairs(payload)
    resolved_permissions = _resolve_permissions(db, permission_pairs=permission_pairs)

    db.execute(delete(RbacRolePermission).where(RbacRolePermission.role_id == role.id))

    next_binding_id = _next_bigint_id(db, RbacRolePermission)
    for permission in resolved_permissions:
        db.add(
            RbacRolePermission(
                id=next_binding_id,
                role_id=role.id,
                permission_id=permission.id,
            )
        )
        next_binding_id += 1

    db.commit()
    return build_success_response(
        {
            "role_key": role.role_key,
            "permission_count": len(resolved_permissions),
            "permissions": [
                _serialize_permission(item) for item in resolved_permissions
            ],
            "grouped_permissions": _group_permission_pairs(permission_pairs),
        }
    )


@router.put("/admin/users/{id}/roles", response_model=ApiResponse)
def replace_user_roles(
    id: int,
    payload: AdminUserRolesUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    user = db.get(SysUser, id)
    if user is None:
        raise AppException(code="USER_NOT_FOUND", message="用户不存在。")

    normalized_role_keys: list[str] = []
    seen_roles: set[str] = set()
    for raw_role_key in payload.roles:
        role_key = _normalize_key(raw_role_key, field_name="roles", max_length=64)
        if role_key in seen_roles:
            continue
        seen_roles.add(role_key)
        normalized_role_keys.append(role_key)
    normalized_role_keys.sort()

    role_key_to_id: dict[str, int] = {}
    if normalized_role_keys:
        existing_roles = db.scalars(
            select(RbacRole)
            .where(RbacRole.role_key.in_(normalized_role_keys))
            .order_by(RbacRole.role_key.asc())
        ).all()
        role_key_to_id = {role.role_key: role.id for role in existing_roles}
        missing_role_keys = [
            role_key
            for role_key in normalized_role_keys
            if role_key not in role_key_to_id
        ]
        if missing_role_keys:
            raise AppException(
                code="VALIDATION_ERROR",
                message="存在不存在的角色标识。",
                details={"missing_roles": missing_role_keys},
            )

    db.execute(delete(RbacUserRole).where(RbacUserRole.user_id == user.id))
    next_user_role_id = _next_bigint_id(db, RbacUserRole)
    for role_key in normalized_role_keys:
        db.add(
            RbacUserRole(
                id=next_user_role_id,
                user_id=user.id,
                role_id=role_key_to_id[role_key],
            )
        )
        next_user_role_id += 1

    db.commit()
    return build_success_response(
        {
            "user_id": user.id,
            "roles": normalized_role_keys,
        }
    )


@router.get("/admin/crud/{resource}", response_model=ApiResponse)
def list_crud_resource(
    resource: AdminCrudResource,
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})

    keyword = q.strip() if q and q.strip() else None
    if resource == "users":
        items, total = _list_users(
            db,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
    elif resource == "categories":
        items, total = _list_categories(
            db,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
    elif resource == "skus":
        items, total = _list_skus(
            db,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
    elif resource == "assets":
        items, total = _list_assets(
            db,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
    elif resource == "applications":
        items, total = _list_applications(
            db,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
    elif resource == "announcements":
        items, total = _list_announcements(
            db,
            keyword=keyword,
            page=page,
            page_size=page_size,
        )
    else:
        raise AppException(
            code="VALIDATION_ERROR",
            message="不支持的资源类型。",
            details={"resource": resource},
        )

    return build_success_response(
        {
            "resource": resource,
            "items": items,
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": total,
            },
        }
    )


@router.post("/admin/crud/{resource}", response_model=ApiResponse)
def create_crud_resource(
    resource: AdminCrudResource,
    payload: dict[str, object],
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})
    data = _create_crud_resource_item(db, resource, payload)
    return build_success_response(
        {
            "resource": resource,
            "item": data,
        }
    )


@router.put("/admin/crud/{resource}/{id}", response_model=ApiResponse)
def update_crud_resource(
    resource: AdminCrudResource,
    id: int,
    payload: dict[str, object],
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})
    data = _update_crud_resource_item(db, resource, id, payload)
    return build_success_response(
        {
            "resource": resource,
            "item": data,
        }
    )


@router.delete("/admin/crud/{resource}/{id}", response_model=ApiResponse)
def delete_crud_resource(
    resource: AdminCrudResource,
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context, required_permissions={PERMISSION_RBAC_UPDATE})
    result = _delete_crud_resource_item(db, resource, id)
    return build_success_response(
        {
            "resource": resource,
            **result,
        }
    )
