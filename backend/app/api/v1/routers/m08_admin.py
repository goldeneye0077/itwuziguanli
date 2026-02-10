"""M08 router implementation: backend admin operations."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import Application
from ....models.catalog import Category, Sku
from ....models.inventory import Asset
from ....models.organization import SysUser
from ....models.portal import Announcement
from ....models.rbac import RbacPermission, RbacRole, RbacRolePermission, RbacUserRole
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m08 import (
    AdminCrudResource,
    AdminUserRolesUpdateRequest,
    RbacRoleBindingsRequest,
    RbacRoleCreateRequest,
)

router = APIRouter(tags=["M08"])


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


def _require_super_admin(context: AuthContext) -> None:
    if "SUPER_ADMIN" in context.roles:
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色无权执行该操作。",
    )


def _require_admin_or_super_admin(context: AuthContext) -> None:
    if context.roles.intersection({"ADMIN", "SUPER_ADMIN"}):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色无权执行该操作。",
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


def _serialize_user(user: SysUser) -> dict[str, object]:
    return {
        "id": user.id,
        "employee_no": user.employee_no,
        "name": user.name,
        "department_id": user.department_id,
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
        "applicant_user_id": application.applicant_user_id,
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


@router.get("/admin/rbac/roles", response_model=ApiResponse)
def list_roles(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context)

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
    _require_super_admin(context)

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
    _require_super_admin(context)

    permissions = db.scalars(
        select(RbacPermission).order_by(
            RbacPermission.resource.asc(),
            RbacPermission.action.asc(),
            RbacPermission.id.asc(),
        )
    ).all()
    return build_success_response([_serialize_permission(item) for item in permissions])


@router.post("/admin/rbac/role-bindings", response_model=ApiResponse)
def bind_role_permissions(
    payload: RbacRoleBindingsRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_super_admin(context)

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
    _require_super_admin(context)

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
    _require_admin_or_super_admin(context)

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
