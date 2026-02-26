"""M05 router implementation: outbound operations."""

from __future__ import annotations

import csv
import io
import json
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import (
    Application,
    ApplicationAsset,
    ApplicationItem,
    Logistics,
)
from ....models.catalog import Category, Sku
from ....models.enums import (
    ApplicationStatus,
    AssetStatus,
    DeliveryType,
    SkuStockFlowAction,
    SkuStockMode,
    StockFlowAction,
)
from ....models.inventory import Asset, StockFlow
from ....models.notification import UserAddress
from ....models.organization import SysUser
from ....models.sku_stock import SkuStockFlow
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m05 import OutboundConfirmPickupRequest, OutboundShipRequest
from ....services.sku_stock_service import apply_stock_delta

router = APIRouter(tags=["M05"])
PERMISSION_OUTBOUND_READ = "OUTBOUND:READ"


def _to_iso8601(value: datetime) -> str:
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


def _to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _next_bigint_id(db: Session, model: type[object]) -> int:
    # Cache per-session counters to avoid duplicate ids before transaction flush.
    cache_key = f"next_bigint_id:{getattr(model, '__tablename__', model.__name__)}"
    cached_value = db.info.get(cache_key)
    if cached_value is None:
        value = db.scalar(select(func.max(getattr(model, "id"))))
        cached_value = int(value or 0)
    next_value = int(cached_value) + 1
    db.info[cache_key] = next_value
    return next_value


def _normalize_required_permissions(
    required_permissions: set[str] | None,
) -> set[str]:
    return {
        str(value).strip().upper()
        for value in (required_permissions or set())
        if str(value).strip()
    }


def _require_admin(
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


def _to_iso8601_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _to_iso8601(value)


def _assert_application_status(
    application: Application,
    *,
    expected: ApplicationStatus,
    event: str,
) -> bool:
    if application.status == expected:
        return True
    if expected == ApplicationStatus.READY_OUTBOUND:
        if application.status == ApplicationStatus.ADMIN_APPROVED:
            return False
        if application.status in {
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.LOCKED,
            ApplicationStatus.LEADER_APPROVED,
        }:
            raise AppException(
                code="APPLICATION_STATUS_INVALID",
                message="申请单尚未完成审批，暂不可执行出库。",
                details={
                    "application_id": application.id,
                    "current_status": application.status.value,
                    "expected_status": expected.value,
                    "event": event,
                },
            )
    raise AppException(
        code="APPLICATION_STATUS_INVALID",
        message=f"申请单状态不支持执行 {event}。",
        details={
            "application_id": application.id,
            "current_status": application.status.value,
            "expected_status": expected.value,
            "event": event,
        },
    )


def _load_application_items(
    db: Session,
    *,
    application_ids: list[int],
) -> dict[int, list[ApplicationItem]]:
    items_by_application: dict[int, list[ApplicationItem]] = {
        key: [] for key in application_ids
    }
    if not application_ids:
        return items_by_application

    item_rows = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id.in_(application_ids))
        .order_by(ApplicationItem.id.asc())
    ).all()
    for row in item_rows:
        items_by_application.setdefault(row.application_id, []).append(row)
    return items_by_application


def _load_assigned_assets(db: Session, *, application_id: int) -> list[Asset]:
    rows = (
        db.execute(
            select(Asset)
            .join(ApplicationAsset, ApplicationAsset.asset_id == Asset.id)
            .where(ApplicationAsset.application_id == application_id)
            .order_by(Asset.id.asc())
        )
        .scalars()
        .all()
    )
    return list(rows)


def _auto_assign_assets(
    db: Session,
    *,
    application: Application,
    operator_user_id: int,
) -> list[Asset]:
    items = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()

    if not items:
        raise AppException(
            code="VALIDATION_ERROR",
            message="申请单没有物料明细，无法自动分配资产。",
            details={"application_id": application.id},
        )

    sku_ids = [item.sku_id for item in items]
    sku_rows = db.scalars(select(Sku).where(Sku.id.in_(sku_ids))).all()
    sku_by_id = {int(row.id): row for row in sku_rows}

    required_by_sku: dict[int, int] = {}
    for item in items:
        sku = sku_by_id.get(int(item.sku_id))
        if sku and sku.stock_mode != SkuStockMode.QUANTITY:
            required_by_sku[int(item.sku_id)] = required_by_sku.get(int(item.sku_id), 0) + int(item.quantity)

    if not required_by_sku:
        return []

    # Reuse assets already locked for this application first.
    existing_locked_assets = db.scalars(
        select(Asset)
        .where(
            Asset.sku_id.in_(required_by_sku.keys()),
            Asset.status == AssetStatus.LOCKED,
            Asset.locked_application_id == application.id,
        )
        .order_by(Asset.id.asc())
    ).all()
    existing_locked_by_sku: dict[int, list[Asset]] = {}
    for asset in existing_locked_assets:
        existing_locked_by_sku.setdefault(int(asset.sku_id), []).append(asset)

    selected_assets: list[Asset] = []
    extra_locked_assets: list[Asset] = []
    shortfall_by_sku: dict[int, int] = {}

    for sku_id, required_qty in required_by_sku.items():
        locked_for_sku = existing_locked_by_sku.get(sku_id, [])
        selected_assets.extend(locked_for_sku[:required_qty])
        if len(locked_for_sku) > required_qty:
            extra_locked_assets.extend(locked_for_sku[required_qty:])
        missing_qty = required_qty - min(len(locked_for_sku), required_qty)
        if missing_qty > 0:
            shortfall_by_sku[sku_id] = missing_qty

    available_by_sku: dict[int, list[Asset]] = {}
    if shortfall_by_sku:
        available_assets = db.scalars(
            select(Asset)
            .where(
                Asset.sku_id.in_(shortfall_by_sku.keys()),
                Asset.status == AssetStatus.IN_STOCK,
                Asset.locked_application_id.is_(None),
            )
            .order_by(Asset.id.asc())
        ).all()
        for asset in available_assets:
            available_by_sku.setdefault(int(asset.sku_id), []).append(asset)

    insufficient_assets: list[dict[str, Any]] = []
    for sku_id, missing_qty in shortfall_by_sku.items():
        available = available_by_sku.get(sku_id, [])
        if len(available) < missing_qty:
            sku = sku_by_id.get(sku_id)
            insufficient_assets.append(
                {
                    "sku_id": sku_id,
                    "sku_name": f"{sku.brand} {sku.model}" if sku else "Unknown",
                    "required": required_by_sku[sku_id],
                    "available": len(existing_locked_by_sku.get(sku_id, [])) + len(available),
                }
            )

    if insufficient_assets:
        raise AppException(
            code="INSUFFICIENT_ASSETS",
            message="库存中可用资产不足，无法完成自动分配。",
            details={"insufficient_items": insufficient_assets},
        )

    assets_to_lock: list[Asset] = []
    for sku_id, missing_qty in shortfall_by_sku.items():
        assets_to_lock.extend(available_by_sku.get(sku_id, [])[:missing_qty])

    now = datetime.now(UTC).replace(tzinfo=None)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)
    next_relation_id = _next_bigint_id(db, ApplicationAsset)

    for asset in assets_to_lock:
        asset.status = AssetStatus.LOCKED
        asset.locked_application_id = application.id
        db.add(
            StockFlow(
                id=next_stock_flow_id,
                asset_id=asset.id,
                action=StockFlowAction.LOCK,
                operator_user_id=operator_user_id,
                related_application_id=application.id,
                occurred_at=now,
                meta_json={"event": "auto_assign_outbound"},
            )
        )
        next_stock_flow_id += 1
    selected_assets.extend(assets_to_lock)

    # If this application has more locked assets than required, release the extras.
    for asset in extra_locked_assets:
        asset.status = AssetStatus.IN_STOCK
        asset.locked_application_id = None
        db.add(
            StockFlow(
                id=next_stock_flow_id,
                asset_id=asset.id,
                action=StockFlowAction.UNLOCK,
                operator_user_id=operator_user_id,
                related_application_id=application.id,
                occurred_at=now,
                meta_json={"event": "auto_assign_outbound_rebalance"},
            )
        )
        next_stock_flow_id += 1

    # Rebuild relations to keep a single, exact mapping between application and selected assets.
    db.query(ApplicationAsset).filter(ApplicationAsset.application_id == application.id).delete()
    for asset_id in sorted({int(asset.id) for asset in selected_assets}):
        db.add(
            ApplicationAsset(
                id=next_relation_id,
                application_id=application.id,
                asset_id=asset_id,
            )
        )
        next_relation_id += 1

    application.status = ApplicationStatus.READY_OUTBOUND

    db.flush()

    return sorted(selected_assets, key=lambda row: int(row.id))


def _serialize_items(items: list[ApplicationItem]) -> list[dict[str, int]]:
    return [{"sku_id": item.sku_id, "quantity": item.quantity} for item in items]


def _resolve_sku_display_name(sku: Sku | None, *, fallback_sku_id: int) -> str:
    if sku is None:
        return f"物料#{fallback_sku_id}"
    explicit_name = (sku.name or "").strip()
    if explicit_name:
        return explicit_name
    fallback = f"{sku.brand} {sku.model}".strip()
    if fallback:
        return fallback
    return f"物料#{fallback_sku_id}"


def _build_applicant_name_map(
    db: Session, *, applications: list[Application]
) -> dict[int, str]:
    user_ids = sorted(
        {
            int(application.applicant_user_id)
            for application in applications
            if application.applicant_user_id is not None
        }
    )
    if not user_ids:
        return {}
    rows = db.execute(
        select(SysUser.id, SysUser.name).where(SysUser.id.in_(user_ids))
    ).all()
    return {int(user_id): str(name) for user_id, name in rows if name is not None}


def _build_sku_name_map(
    db: Session, *, items_by_application: dict[int, list[ApplicationItem]]
) -> dict[int, str]:
    sku_ids = sorted(
        {
            int(item.sku_id)
            for items in items_by_application.values()
            for item in items
            if item.sku_id is not None
        }
    )
    if not sku_ids:
        return {}
    skus = db.scalars(select(Sku).where(Sku.id.in_(sku_ids))).all()
    sku_by_id = {int(sku.id): sku for sku in skus}
    return {
        sku_id: _resolve_sku_display_name(sku_by_id.get(sku_id), fallback_sku_id=sku_id)
        for sku_id in sku_ids
    }


def _serialize_queue_items(
    items: list[ApplicationItem], *, sku_name_by_id: dict[int, str]
) -> list[dict[str, object]]:
    return [
        {
            "sku_id": int(item.sku_id),
            "quantity": int(item.quantity),
            "sku_name": sku_name_by_id.get(int(item.sku_id)),
        }
        for item in items
    ]


def _sanitize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


EXPRESS_SNAPSHOT_KEY_ALIASES: dict[str, tuple[str, ...]] = {
    "receiver_name": ("receiver_name", "receiverName"),
    "receiver_phone": ("receiver_phone", "receiverPhone"),
    "province": ("province",),
    "city": ("city",),
    "district": ("district",),
    "detail": ("detail",),
}


def _read_express_snapshot_field(
    application: Application, *, key: str
) -> str | None:
    snapshot = application.express_address_snapshot
    if not isinstance(snapshot, dict):
        return None
    for alias in EXPRESS_SNAPSHOT_KEY_ALIASES.get(key, (key,)):
        value = snapshot.get(alias)
        if not isinstance(value, str):
            continue
        normalized = value.strip()
        if normalized:
            return normalized
    return None


def _resolve_express_queue_receiver_snapshot(
    db: Session, *, application: Application
) -> dict[str, str]:
    keys = (
        "receiver_name",
        "receiver_phone",
        "province",
        "city",
        "district",
        "detail",
    )
    snapshot_values = {
        key: _read_express_snapshot_field(application, key=key) for key in keys
    }
    if all(snapshot_values.values()):
        return {
            key: str(snapshot_values[key]) for key in keys
        }

    fallback_values = _resolve_receiver_snapshot(
        db, applicant_user_id=application.applicant_user_id
    )
    return {
        key: str(snapshot_values[key] or fallback_values[key]) for key in keys
    }


def _resolve_ship_receiver_snapshot(
    *,
    default_snapshot: dict[str, str],
    payload: OutboundShipRequest,
) -> dict[str, str]:
    receiver_name = _sanitize_optional_text(payload.receiver_name)
    receiver_phone = _sanitize_optional_text(payload.receiver_phone)
    province = _sanitize_optional_text(payload.province)
    city = _sanitize_optional_text(payload.city)
    district = _sanitize_optional_text(payload.district)
    detail = _sanitize_optional_text(payload.detail)

    return {
        "receiver_name": receiver_name or default_snapshot["receiver_name"],
        "receiver_phone": receiver_phone or default_snapshot["receiver_phone"],
        "province": province or default_snapshot["province"],
        "city": city or default_snapshot["city"],
        "district": district or default_snapshot["district"],
        "detail": detail or default_snapshot["detail"],
    }


def _serialize_assets(assets: list[Asset]) -> list[dict[str, object]]:
    return [
        {
            "asset_id": asset.id,
            "asset_tag": asset.asset_tag,
            "sn": asset.sn,
        }
        for asset in assets
    ]


def _resolve_pickup_application(
    db: Session,
    *,
    verify_type: str,
    value: str,
) -> Application:
    candidate = value.strip()
    if not candidate:
        raise AppException(
            code="VALIDATION_ERROR",
            message="核验值不能为空。",
        )

    if verify_type == "APPLICATION_ID":
        try:
            application_id = int(candidate)
        except ValueError as error:
            raise AppException(
                code="VALIDATION_ERROR",
                message="申请单编号核验值必须为数字。",
                details={"value": candidate},
            ) from error
        if application_id <= 0:
            raise AppException(
                code="VALIDATION_ERROR",
                message="申请单编号核验值必须为正整数。",
                details={"value": candidate},
            )
        application = db.get(Application, application_id)
        if application is None:
            raise AppException(
                code="APPLICATION_NOT_FOUND",
                message="申请单不存在。",
            )
        return application

    if verify_type == "QR":
        stmt = (
            select(Application)
            .where(Application.pickup_qr_string == candidate)
            .limit(1)
        )
    else:
        stmt = select(Application).where(Application.pickup_code == candidate).limit(1)
    application = db.scalar(stmt)
    if application is None:
        raise AppException(
            code="PICKUP_CODE_INVALID",
            message="取件核验值不正确。",
        )
    return application


def _apply_outbound_asset_transition(
    db: Session,
    *,
    application: Application,
    assets: list[Asset],
    operator_user_id: int,
    action: StockFlowAction,
    event: str,
    meta: dict[str, object] | None = None,
) -> None:
    if not assets:
        raise AppException(
            code="ASSET_NOT_FOUND",
            message="申请单未分配任何资产。",
        )

    now = datetime.now(UTC).replace(tzinfo=None)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)
    for asset in assets:
        if (
            asset.status != AssetStatus.LOCKED
            or asset.locked_application_id != application.id
        ):
            raise AppException(
                code="ASSET_LOCKED",
                message="资产未被当前申请单锁定。",
                details={
                    "asset_id": asset.id,
                    "asset_status": asset.status.value,
                    "locked_application_id": asset.locked_application_id,
                },
            )

        asset.status = AssetStatus.IN_USE
        asset.holder_user_id = application.applicant_user_id
        asset.locked_application_id = None

        meta_json: dict[str, object] = {"event": event}
        if meta:
            meta_json.update(meta)

        db.add(
            StockFlow(
                id=next_stock_flow_id,
                asset_id=asset.id,
                action=action,
                operator_user_id=operator_user_id,
                related_application_id=application.id,
                occurred_at=now,
                meta_json=meta_json,
            )
        )
        next_stock_flow_id += 1


def _release_remaining_locked_assets(
    db: Session,
    *,
    application: Application,
    operator_user_id: int,
    event: str,
) -> list[Asset]:
    # Session uses autoflush=False; flush first so we don't unlock just-delivered assets.
    db.flush()
    locked_assets = db.scalars(
        select(Asset)
        .where(
            Asset.locked_application_id == application.id,
            Asset.status == AssetStatus.LOCKED,
        )
        .order_by(Asset.id.asc())
    ).all()
    if not locked_assets:
        return []

    now = datetime.now(UTC).replace(tzinfo=None)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)
    for asset in locked_assets:
        asset.status = AssetStatus.IN_STOCK
        asset.locked_application_id = None
        db.add(
            StockFlow(
                id=next_stock_flow_id,
                asset_id=asset.id,
                action=StockFlowAction.UNLOCK,
                operator_user_id=operator_user_id,
                related_application_id=application.id,
                occurred_at=now,
                meta_json={"event": event},
            )
        )
        next_stock_flow_id += 1
    return list(locked_assets)


def _resolve_receiver_snapshot(
    db: Session,
    *,
    applicant_user_id: int,
) -> dict[str, str]:
    address = db.scalar(
        select(UserAddress)
        .where(UserAddress.user_id == applicant_user_id)
        .order_by(UserAddress.is_default.desc(), UserAddress.id.asc())
        .limit(1)
    )
    if address is not None:
        return {
            "receiver_name": address.receiver_name,
            "receiver_phone": address.receiver_phone,
            "province": address.province,
            "city": address.city,
            "district": address.district,
            "detail": address.detail,
        }

    applicant = db.get(SysUser, applicant_user_id)
    receiver_name = (
        applicant.name if applicant is not None else f"\u7528\u6237-{applicant_user_id}"
    )
    return {
        "receiver_name": receiver_name,
        "receiver_phone": "\u672a\u77e5",
        "province": "\u672a\u77e5",
        "city": "\u672a\u77e5",
        "district": "\u672a\u77e5",
        "detail": "\u672a\u77e5",
    }


@router.get("/outbound/pickup-queue", response_model=ApiResponse)
def list_pickup_queue(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    base_stmt = (
        select(Application)
        .where(
            Application.status.in_(
                [ApplicationStatus.READY_OUTBOUND, ApplicationStatus.ADMIN_APPROVED]
            ),
            Application.delivery_type == DeliveryType.PICKUP,
        )
        .order_by(Application.created_at.asc(), Application.id.asc())
    )
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    offset = (page - 1) * page_size

    applications = db.scalars(base_stmt.offset(offset).limit(page_size)).all()
    application_ids = [application.id for application in applications]
    items_by_application = _load_application_items(db, application_ids=application_ids)
    applicant_name_by_user_id = _build_applicant_name_map(db, applications=applications)
    sku_name_by_id = _build_sku_name_map(
        db, items_by_application=items_by_application
    )

    return build_success_response(
        {
            "items": [
                {
                    "application_id": application.id,
                    "applicant_user_id": application.applicant_user_id,
                    "applicant_name": (
                        application.applicant_name_snapshot
                        or applicant_name_by_user_id.get(int(application.applicant_user_id))
                    ),
                    "status": application.status.value,
                    "created_at": _to_iso8601(application.created_at),
                    "items": _serialize_queue_items(
                        items_by_application.get(application.id, []),
                        sku_name_by_id=sku_name_by_id,
                    ),
                }
                for application in applications
            ],
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": int(total),
            },
        }
    )


@router.post("/outbound/confirm-pickup", response_model=ApiResponse)
def confirm_pickup_outbound(
    payload: OutboundConfirmPickupRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    application = _resolve_pickup_application(
        db,
        verify_type=payload.verify_type,
        value=payload.value,
    )
    if application.delivery_type != DeliveryType.PICKUP:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="申请单交付方式不是自提。",
            details={"application_id": application.id},
        )

    needs_auto_assign = not _assert_application_status(
        application,
        expected=ApplicationStatus.READY_OUTBOUND,
        event="confirm_pickup",
    )

    items = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    sku_rows = db.scalars(select(Sku).where(Sku.id.in_([item.sku_id for item in items]))).all()
    mode_by_sku_id = {int(row.id): row.stock_mode for row in sku_rows}

    delivered_assets: list[Asset] = []
    if needs_auto_assign:
        assigned_assets = _auto_assign_assets(
            db,
            application=application,
            operator_user_id=context.user.id,
        )
        if assigned_assets:
            _apply_outbound_asset_transition(
                db,
                application=application,
                assets=assigned_assets,
                operator_user_id=context.user.id,
                action=StockFlowAction.OUTBOUND,
                event="confirm_pickup",
            )
            delivered_assets = assigned_assets
    elif any(mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY for item in items):
        assigned_assets = _load_assigned_assets(db, application_id=application.id)
        _apply_outbound_asset_transition(
            db,
            application=application,
            assets=assigned_assets,
            operator_user_id=context.user.id,
            action=StockFlowAction.OUTBOUND,
            event="confirm_pickup",
        )
        delivered_assets = assigned_assets

    now = datetime.now(UTC).replace(tzinfo=None)
    for item in items:
        if mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY:
            continue
        apply_stock_delta(
            db,
            sku_id=item.sku_id,
            action=SkuStockFlowAction.OUTBOUND,
            on_hand_delta=-int(item.quantity),
            reserved_delta=-int(item.quantity),
            operator_user_id=context.user.id,
            related_application_id=application.id,
            occurred_at=now,
            meta_json={"event": "confirm_pickup"},
        )

    _release_remaining_locked_assets(
        db,
        application=application,
        operator_user_id=context.user.id,
        event="confirm_pickup_cleanup",
    )
    application.status = ApplicationStatus.OUTBOUNDED

    db.commit()

    return build_success_response(
        {
            "application_id": application.id,
            "status": application.status.value,
            "delivered_assets": _serialize_assets(delivered_assets),
            "delivered_items": _serialize_items(items),
        }
    )


@router.get("/outbound/express-queue", response_model=ApiResponse)
def list_express_queue(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    base_stmt = (
        select(Application)
        .where(
            Application.status.in_(
                [ApplicationStatus.READY_OUTBOUND, ApplicationStatus.ADMIN_APPROVED]
            ),
            Application.delivery_type == DeliveryType.EXPRESS,
        )
        .order_by(Application.created_at.asc(), Application.id.asc())
    )
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    offset = (page - 1) * page_size

    applications = db.scalars(base_stmt.offset(offset).limit(page_size)).all()
    application_ids = [application.id for application in applications]
    items_by_application = _load_application_items(db, application_ids=application_ids)
    applicant_name_by_user_id = _build_applicant_name_map(db, applications=applications)
    sku_name_by_id = _build_sku_name_map(
        db, items_by_application=items_by_application
    )

    queue_items: list[dict[str, object]] = []
    for application in applications:
        receiver_snapshot = _resolve_express_queue_receiver_snapshot(
            db, application=application
        )
        queue_items.append(
            {
                "application_id": application.id,
                "applicant_user_id": application.applicant_user_id,
                "applicant_name": (
                    application.applicant_name_snapshot
                    or applicant_name_by_user_id.get(int(application.applicant_user_id))
                ),
                "status": application.status.value,
                "created_at": _to_iso8601(application.created_at),
                "items": _serialize_queue_items(
                    items_by_application.get(application.id, []),
                    sku_name_by_id=sku_name_by_id,
                ),
                "receiver_name": receiver_snapshot["receiver_name"],
                "receiver_phone": receiver_snapshot["receiver_phone"],
                "province": receiver_snapshot["province"],
                "city": receiver_snapshot["city"],
                "district": receiver_snapshot["district"],
                "detail": receiver_snapshot["detail"],
            }
        )

    return build_success_response(
        {
            "items": queue_items,
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": int(total),
            },
        }
    )


@router.post("/outbound/ship", response_model=ApiResponse)
def ship_express_outbound(
    payload: OutboundShipRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    application = db.get(Application, payload.application_id)
    if application is None:
        raise AppException(
            code="APPLICATION_NOT_FOUND",
            message="申请单不存在。",
        )
    if application.delivery_type != DeliveryType.EXPRESS:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="申请单交付方式不是快递。",
            details={"application_id": application.id},
        )

    needs_auto_assign = not _assert_application_status(
        application,
        expected=ApplicationStatus.READY_OUTBOUND,
        event="ship_express",
    )

    items = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    sku_rows = db.scalars(select(Sku).where(Sku.id.in_([item.sku_id for item in items]))).all()
    mode_by_sku_id = {int(row.id): row.stock_mode for row in sku_rows}

    delivered_assets: list[Asset] = []
    if needs_auto_assign:
        assigned_assets = _auto_assign_assets(
            db,
            application=application,
            operator_user_id=context.user.id,
        )
        if assigned_assets:
            _apply_outbound_asset_transition(
                db,
                application=application,
                assets=assigned_assets,
                operator_user_id=context.user.id,
                action=StockFlowAction.SHIP,
                event="ship_express",
                meta={"carrier": payload.carrier, "tracking_no": payload.tracking_no},
            )
            delivered_assets = assigned_assets
    elif any(mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY for item in items):
        assigned_assets = _load_assigned_assets(db, application_id=application.id)
        _apply_outbound_asset_transition(
            db,
            application=application,
            assets=assigned_assets,
            operator_user_id=context.user.id,
            action=StockFlowAction.SHIP,
            event="ship_express",
            meta={"carrier": payload.carrier, "tracking_no": payload.tracking_no},
        )
        delivered_assets = assigned_assets

    now = (
        _to_naive_utc(payload.shipped_at)
        if payload.shipped_at is not None
        else datetime.now(UTC).replace(tzinfo=None)
    )
    for item in items:
        if mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY:
            continue
        apply_stock_delta(
            db,
            sku_id=item.sku_id,
            action=SkuStockFlowAction.SHIP,
            on_hand_delta=-int(item.quantity),
            reserved_delta=-int(item.quantity),
            operator_user_id=context.user.id,
            related_application_id=application.id,
            occurred_at=now,
            meta_json={"event": "ship_express", "carrier": payload.carrier, "tracking_no": payload.tracking_no},
        )

    _release_remaining_locked_assets(
        db,
        application=application,
        operator_user_id=context.user.id,
        event="ship_express_cleanup",
    )

    logistics = db.scalar(
        select(Logistics).where(Logistics.application_id == application.id).limit(1)
    )
    default_receiver_snapshot = _resolve_receiver_snapshot(
        db,
        applicant_user_id=application.applicant_user_id,
    )
    receiver_snapshot = _resolve_ship_receiver_snapshot(
        default_snapshot=default_receiver_snapshot,
        payload=payload,
    )
    shipped_at = now

    if logistics is None:
        logistics = Logistics(
            id=_next_bigint_id(db, Logistics),
            application_id=application.id,
            receiver_name=receiver_snapshot["receiver_name"],
            receiver_phone=receiver_snapshot["receiver_phone"],
            province=receiver_snapshot["province"],
            city=receiver_snapshot["city"],
            district=receiver_snapshot["district"],
            detail=receiver_snapshot["detail"],
            carrier=payload.carrier,
            tracking_no=payload.tracking_no,
            shipped_at=shipped_at,
        )
        db.add(logistics)
    else:
        logistics.receiver_name = receiver_snapshot["receiver_name"]
        logistics.receiver_phone = receiver_snapshot["receiver_phone"]
        logistics.province = receiver_snapshot["province"]
        logistics.city = receiver_snapshot["city"]
        logistics.district = receiver_snapshot["district"]
        logistics.detail = receiver_snapshot["detail"]
        logistics.carrier = payload.carrier
        logistics.tracking_no = payload.tracking_no
        logistics.shipped_at = shipped_at

    application.status = ApplicationStatus.SHIPPED
    db.commit()

    return build_success_response(
        {
            "application_id": application.id,
            "status": application.status.value,
            "delivered_assets": _serialize_assets(delivered_assets),
            "delivered_items": _serialize_items(items),
        }
    )


OUTBOUND_RECORD_COLUMNS: tuple[str, ...] = (
    "record_key",
    "record_type",
    "action",
    "occurred_at",
    "meta_json",
    "application_id",
    "application_title",
    "application_type",
    "application_status",
    "delivery_type",
    "pickup_code",
    "pickup_qr_string",
    "application_created_at",
    "applicant_user_id",
    "applicant_name_snapshot",
    "applicant_department_snapshot",
    "applicant_phone_snapshot",
    "applicant_job_title_snapshot",
    "carrier",
    "tracking_no",
    "shipped_at",
    "logistics_receiver_name",
    "logistics_receiver_phone",
    "logistics_province",
    "logistics_city",
    "logistics_district",
    "logistics_detail",
    "sku_id",
    "category_id",
    "category_name",
    "brand",
    "model",
    "spec",
    "stock_mode",
    "reference_price",
    "cover_url",
    "safety_stock_threshold",
    "asset_id",
    "asset_tag",
    "sn",
    "asset_status",
    "holder_user_id",
    "inbound_at",
    "quantity",
    "on_hand_delta",
    "reserved_delta",
    "on_hand_qty_after",
    "reserved_qty_after",
    "operator_user_id",
    "operator_name",
)


def _string_or_none(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text


def _json_dict(value: object | None) -> dict[str, object] | None:
    if isinstance(value, dict):
        return value
    return None


def _record_value(
    *,
    meta_json: dict[str, object] | None,
    key: str,
) -> str | None:
    if meta_json is None:
        return None
    return _string_or_none(meta_json.get(key))


def _delivery_type_value(value: DeliveryType | None) -> str | None:
    if value is None:
        return None
    return value.value


def _application_type_value(application: Application | None) -> str | None:
    if application is None:
        return None
    return application.type.value


def _application_status_value(application: Application | None) -> str | None:
    if application is None:
        return None
    return application.status.value


def _format_reference_price(sku: Sku | None) -> str | None:
    if sku is None:
        return None
    return str(sku.reference_price)


def _build_asset_outbound_records(
    db: Session,
    *,
    action: Literal["OUTBOUND", "SHIP"] | None,
    delivery_type: DeliveryType | None,
    application_id: int | None,
    operator_user_id: int | None,
    sku_id: int | None,
    asset_id: int | None,
    from_at: datetime | None,
    to_at: datetime | None,
    q: str | None,
) -> list[dict[str, Any]]:
    operator_alias = SysUser
    stmt = (
        select(
            StockFlow,
            Asset,
            Sku,
            Category,
            Application,
            Logistics,
            operator_alias,
        )
        .join(Asset, Asset.id == StockFlow.asset_id)
        .join(Sku, Sku.id == Asset.sku_id)
        .outerjoin(Category, Category.id == Sku.category_id)
        .outerjoin(Application, Application.id == StockFlow.related_application_id)
        .outerjoin(Logistics, Logistics.application_id == Application.id)
        .join(operator_alias, operator_alias.id == StockFlow.operator_user_id)
        .where(StockFlow.action.in_([StockFlowAction.OUTBOUND, StockFlowAction.SHIP]))
    )
    if action is not None:
        stmt = stmt.where(StockFlow.action == StockFlowAction(action))
    if delivery_type is not None:
        stmt = stmt.where(Application.delivery_type == delivery_type)
    if application_id is not None:
        stmt = stmt.where(StockFlow.related_application_id == application_id)
    if operator_user_id is not None:
        stmt = stmt.where(StockFlow.operator_user_id == operator_user_id)
    if sku_id is not None:
        stmt = stmt.where(Asset.sku_id == sku_id)
    if asset_id is not None:
        stmt = stmt.where(StockFlow.asset_id == asset_id)
    if from_at is not None:
        stmt = stmt.where(StockFlow.occurred_at >= _to_naive_utc(from_at))
    if to_at is not None:
        stmt = stmt.where(StockFlow.occurred_at <= _to_naive_utc(to_at))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                cast(StockFlow.related_application_id, String).like(pattern),
                Application.title.ilike(pattern),
                Asset.asset_tag.ilike(pattern),
                Asset.sn.ilike(pattern),
                Logistics.tracking_no.ilike(pattern),
                operator_alias.name.ilike(pattern),
            )
        )

    rows = db.execute(stmt).all()
    records: list[dict[str, Any]] = []
    for flow, asset, sku, category, application, logistics, operator in rows:
        meta_json = _json_dict(flow.meta_json)
        record = {
            "_occurred_at_dt": flow.occurred_at,
            "record_key": f"ASSET_FLOW-{int(flow.id)}",
            "record_type": "ASSET",
            "action": flow.action.value,
            "occurred_at": _to_iso8601(flow.occurred_at),
            "meta_json": meta_json,
            "application_id": (
                int(flow.related_application_id)
                if flow.related_application_id is not None
                else None
            ),
            "application_title": application.title if application is not None else None,
            "application_type": _application_type_value(application),
            "application_status": _application_status_value(application),
            "delivery_type": _delivery_type_value(
                application.delivery_type if application is not None else None
            ),
            "pickup_code": application.pickup_code if application is not None else None,
            "pickup_qr_string": (
                application.pickup_qr_string if application is not None else None
            ),
            "application_created_at": _to_iso8601_or_none(
                application.created_at if application is not None else None
            ),
            "applicant_user_id": (
                int(application.applicant_user_id) if application is not None else None
            ),
            "applicant_name_snapshot": (
                application.applicant_name_snapshot if application is not None else None
            ),
            "applicant_department_snapshot": (
                application.applicant_department_snapshot
                if application is not None
                else None
            ),
            "applicant_phone_snapshot": (
                application.applicant_phone_snapshot if application is not None else None
            ),
            "applicant_job_title_snapshot": (
                application.applicant_job_title_snapshot
                if application is not None
                else None
            ),
            "carrier": (
                logistics.carrier
                if logistics is not None
                else _record_value(meta_json=meta_json, key="carrier")
            ),
            "tracking_no": (
                logistics.tracking_no
                if logistics is not None
                else _record_value(meta_json=meta_json, key="tracking_no")
            ),
            "shipped_at": _to_iso8601_or_none(
                logistics.shipped_at if logistics is not None else None
            ),
            "logistics_receiver_name": (
                logistics.receiver_name if logistics is not None else None
            ),
            "logistics_receiver_phone": (
                logistics.receiver_phone if logistics is not None else None
            ),
            "logistics_province": logistics.province if logistics is not None else None,
            "logistics_city": logistics.city if logistics is not None else None,
            "logistics_district": logistics.district if logistics is not None else None,
            "logistics_detail": logistics.detail if logistics is not None else None,
            "sku_id": int(sku.id),
            "category_id": int(category.id) if category is not None else None,
            "category_name": category.name if category is not None else None,
            "brand": sku.brand,
            "model": sku.model,
            "spec": sku.spec,
            "stock_mode": sku.stock_mode.value,
            "reference_price": _format_reference_price(sku),
            "cover_url": sku.cover_url,
            "safety_stock_threshold": int(sku.safety_stock_threshold),
            "asset_id": int(asset.id),
            "asset_tag": asset.asset_tag,
            "sn": asset.sn,
            "asset_status": asset.status.value,
            "holder_user_id": (
                int(asset.holder_user_id) if asset.holder_user_id is not None else None
            ),
            "inbound_at": _to_iso8601(asset.inbound_at),
            "quantity": None,
            "on_hand_delta": None,
            "reserved_delta": None,
            "on_hand_qty_after": None,
            "reserved_qty_after": None,
            "operator_user_id": int(flow.operator_user_id),
            "operator_name": operator.name,
        }
        records.append(record)

    return records


def _build_quantity_outbound_records(
    db: Session,
    *,
    action: Literal["OUTBOUND", "SHIP"] | None,
    delivery_type: DeliveryType | None,
    application_id: int | None,
    operator_user_id: int | None,
    sku_id: int | None,
    from_at: datetime | None,
    to_at: datetime | None,
    q: str | None,
) -> list[dict[str, Any]]:
    operator_alias = SysUser
    stmt = (
        select(
            SkuStockFlow,
            Sku,
            Category,
            Application,
            Logistics,
            operator_alias,
        )
        .join(Sku, Sku.id == SkuStockFlow.sku_id)
        .outerjoin(Category, Category.id == Sku.category_id)
        .outerjoin(Application, Application.id == SkuStockFlow.related_application_id)
        .outerjoin(Logistics, Logistics.application_id == Application.id)
        .join(operator_alias, operator_alias.id == SkuStockFlow.operator_user_id)
        .where(
            SkuStockFlow.action.in_(
                [SkuStockFlowAction.OUTBOUND, SkuStockFlowAction.SHIP]
            )
        )
    )
    if action is not None:
        stmt = stmt.where(SkuStockFlow.action == SkuStockFlowAction(action))
    if delivery_type is not None:
        stmt = stmt.where(Application.delivery_type == delivery_type)
    if application_id is not None:
        stmt = stmt.where(SkuStockFlow.related_application_id == application_id)
    if operator_user_id is not None:
        stmt = stmt.where(SkuStockFlow.operator_user_id == operator_user_id)
    if sku_id is not None:
        stmt = stmt.where(SkuStockFlow.sku_id == sku_id)
    if from_at is not None:
        stmt = stmt.where(SkuStockFlow.occurred_at >= _to_naive_utc(from_at))
    if to_at is not None:
        stmt = stmt.where(SkuStockFlow.occurred_at <= _to_naive_utc(to_at))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                cast(SkuStockFlow.related_application_id, String).like(pattern),
                Application.title.ilike(pattern),
                Logistics.tracking_no.ilike(pattern),
                operator_alias.name.ilike(pattern),
            )
        )

    rows = db.execute(stmt).all()
    records: list[dict[str, Any]] = []
    for flow, sku, category, application, logistics, operator in rows:
        meta_json = _json_dict(flow.meta_json)
        quantity = abs(int(flow.on_hand_delta))
        if quantity == 0:
            quantity = abs(int(flow.reserved_delta))
        record = {
            "_occurred_at_dt": flow.occurred_at,
            "record_key": f"SKU_FLOW-{int(flow.id)}",
            "record_type": "SKU_QUANTITY",
            "action": flow.action.value,
            "occurred_at": _to_iso8601(flow.occurred_at),
            "meta_json": meta_json,
            "application_id": (
                int(flow.related_application_id)
                if flow.related_application_id is not None
                else None
            ),
            "application_title": application.title if application is not None else None,
            "application_type": _application_type_value(application),
            "application_status": _application_status_value(application),
            "delivery_type": _delivery_type_value(
                application.delivery_type if application is not None else None
            ),
            "pickup_code": application.pickup_code if application is not None else None,
            "pickup_qr_string": (
                application.pickup_qr_string if application is not None else None
            ),
            "application_created_at": _to_iso8601_or_none(
                application.created_at if application is not None else None
            ),
            "applicant_user_id": (
                int(application.applicant_user_id) if application is not None else None
            ),
            "applicant_name_snapshot": (
                application.applicant_name_snapshot if application is not None else None
            ),
            "applicant_department_snapshot": (
                application.applicant_department_snapshot
                if application is not None
                else None
            ),
            "applicant_phone_snapshot": (
                application.applicant_phone_snapshot if application is not None else None
            ),
            "applicant_job_title_snapshot": (
                application.applicant_job_title_snapshot
                if application is not None
                else None
            ),
            "carrier": (
                logistics.carrier
                if logistics is not None
                else _record_value(meta_json=meta_json, key="carrier")
            ),
            "tracking_no": (
                logistics.tracking_no
                if logistics is not None
                else _record_value(meta_json=meta_json, key="tracking_no")
            ),
            "shipped_at": _to_iso8601_or_none(
                logistics.shipped_at if logistics is not None else None
            ),
            "logistics_receiver_name": (
                logistics.receiver_name if logistics is not None else None
            ),
            "logistics_receiver_phone": (
                logistics.receiver_phone if logistics is not None else None
            ),
            "logistics_province": logistics.province if logistics is not None else None,
            "logistics_city": logistics.city if logistics is not None else None,
            "logistics_district": logistics.district if logistics is not None else None,
            "logistics_detail": logistics.detail if logistics is not None else None,
            "sku_id": int(sku.id),
            "category_id": int(category.id) if category is not None else None,
            "category_name": category.name if category is not None else None,
            "brand": sku.brand,
            "model": sku.model,
            "spec": sku.spec,
            "stock_mode": sku.stock_mode.value,
            "reference_price": _format_reference_price(sku),
            "cover_url": sku.cover_url,
            "safety_stock_threshold": int(sku.safety_stock_threshold),
            "asset_id": None,
            "asset_tag": None,
            "sn": None,
            "asset_status": None,
            "holder_user_id": None,
            "inbound_at": None,
            "quantity": quantity,
            "on_hand_delta": int(flow.on_hand_delta),
            "reserved_delta": int(flow.reserved_delta),
            "on_hand_qty_after": int(flow.on_hand_qty_after),
            "reserved_qty_after": int(flow.reserved_qty_after),
            "operator_user_id": int(flow.operator_user_id),
            "operator_name": operator.name,
        }
        records.append(record)

    return records


def _build_outbound_records(
    db: Session,
    *,
    action: Literal["OUTBOUND", "SHIP"] | None,
    record_type: Literal["ASSET", "SKU_QUANTITY"] | None,
    delivery_type: DeliveryType | None,
    application_id: int | None,
    operator_user_id: int | None,
    sku_id: int | None,
    asset_id: int | None,
    from_at: datetime | None,
    to_at: datetime | None,
    q: str | None,
) -> list[dict[str, Any]]:
    normalized_q = _string_or_none(q)
    include_asset = record_type in (None, "ASSET")
    include_quantity = record_type in (None, "SKU_QUANTITY")
    records: list[dict[str, Any]] = []

    if include_asset:
        records.extend(
            _build_asset_outbound_records(
                db,
                action=action,
                delivery_type=delivery_type,
                application_id=application_id,
                operator_user_id=operator_user_id,
                sku_id=sku_id,
                asset_id=asset_id,
                from_at=from_at,
                to_at=to_at,
                q=normalized_q,
            )
        )

    if include_quantity and asset_id is None:
        records.extend(
            _build_quantity_outbound_records(
                db,
                action=action,
                delivery_type=delivery_type,
                application_id=application_id,
                operator_user_id=operator_user_id,
                sku_id=sku_id,
                from_at=from_at,
                to_at=to_at,
                q=normalized_q,
            )
        )

    records.sort(
        key=lambda item: (
            item["_occurred_at_dt"],
            str(item["record_key"]),
        ),
        reverse=True,
    )
    for item in records:
        item.pop("_occurred_at_dt", None)
    return records


def _csv_cell(value: object | None) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


@router.get("/outbound/records", response_model=ApiResponse)
def list_outbound_records(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    from_at: datetime | None = Query(default=None, alias="from"),
    to_at: datetime | None = Query(default=None, alias="to"),
    action: Literal["OUTBOUND", "SHIP"] | None = Query(default=None),
    record_type: Literal["ASSET", "SKU_QUANTITY"] | None = Query(default=None),
    delivery_type: DeliveryType | None = Query(default=None),
    application_id: int | None = Query(default=None, ge=1),
    operator_user_id: int | None = Query(default=None, ge=1),
    sku_id: int | None = Query(default=None, ge=1),
    asset_id: int | None = Query(default=None, ge=1),
    q: str | None = Query(default=None),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_OUTBOUND_READ})
    records = _build_outbound_records(
        db,
        action=action,
        record_type=record_type,
        delivery_type=delivery_type,
        application_id=application_id,
        operator_user_id=operator_user_id,
        sku_id=sku_id,
        asset_id=asset_id,
        from_at=from_at,
        to_at=to_at,
        q=q,
    )
    total = len(records)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = records[start:end]
    return build_success_response(
        {
            "items": page_items,
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": total,
            },
        }
    )


@router.get("/outbound/records/export")
def export_outbound_records_csv(
    from_at: datetime | None = Query(default=None, alias="from"),
    to_at: datetime | None = Query(default=None, alias="to"),
    action: Literal["OUTBOUND", "SHIP"] | None = Query(default=None),
    record_type: Literal["ASSET", "SKU_QUANTITY"] | None = Query(default=None),
    delivery_type: DeliveryType | None = Query(default=None),
    application_id: int | None = Query(default=None, ge=1),
    operator_user_id: int | None = Query(default=None, ge=1),
    sku_id: int | None = Query(default=None, ge=1),
    asset_id: int | None = Query(default=None, ge=1),
    q: str | None = Query(default=None),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    _require_admin(context, required_permissions={PERMISSION_OUTBOUND_READ})
    rows = _build_outbound_records(
        db,
        action=action,
        record_type=record_type,
        delivery_type=delivery_type,
        application_id=application_id,
        operator_user_id=operator_user_id,
        sku_id=sku_id,
        asset_id=asset_id,
        from_at=from_at,
        to_at=to_at,
        q=q,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(list(OUTBOUND_RECORD_COLUMNS))
    for row in rows:
        writer.writerow([_csv_cell(row.get(column)) for column in OUTBOUND_RECORD_COLUMNS])

    content = "\ufeff" + buffer.getvalue()
    response = StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
    )
    response.headers["Content-Disposition"] = 'attachment; filename="outbound_records.csv"'
    return response
