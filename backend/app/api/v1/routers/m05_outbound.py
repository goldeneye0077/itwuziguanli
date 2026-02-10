"""M05 router implementation: outbound operations."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
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
from ....models.catalog import Sku
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
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m05 import OutboundConfirmPickupRequest, OutboundShipRequest
from ....services.sku_stock_service import apply_stock_delta

router = APIRouter(tags=["M05"])


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
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _require_admin(context: AuthContext) -> None:
    if context.roles.intersection({"ADMIN", "SUPER_ADMIN"}):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色无权执行该操作。",
    )


def _assert_application_status(
    application: Application,
    *,
    expected: ApplicationStatus,
    event: str,
) -> None:
    if application.status == expected:
        return
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


def _serialize_items(items: list[ApplicationItem]) -> list[dict[str, int]]:
    return [{"sku_id": item.sku_id, "quantity": item.quantity} for item in items]


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
            Application.status == ApplicationStatus.READY_OUTBOUND,
            Application.delivery_type == DeliveryType.PICKUP,
        )
        .order_by(Application.created_at.asc(), Application.id.asc())
    )
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    offset = (page - 1) * page_size

    applications = db.scalars(base_stmt.offset(offset).limit(page_size)).all()
    application_ids = [application.id for application in applications]
    items_by_application = _load_application_items(db, application_ids=application_ids)

    return build_success_response(
        {
            "items": [
                {
                    "application_id": application.id,
                    "applicant_user_id": application.applicant_user_id,
                    "pickup_code": application.pickup_code,
                    "created_at": _to_iso8601(application.created_at),
                    "items": _serialize_items(
                        items_by_application.get(application.id, [])
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
    _assert_application_status(
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
    if any(mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY for item in items):
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
            Application.status == ApplicationStatus.READY_OUTBOUND,
            Application.delivery_type == DeliveryType.EXPRESS,
        )
        .order_by(Application.created_at.asc(), Application.id.asc())
    )
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    offset = (page - 1) * page_size

    applications = db.scalars(base_stmt.offset(offset).limit(page_size)).all()
    application_ids = [application.id for application in applications]
    items_by_application = _load_application_items(db, application_ids=application_ids)

    return build_success_response(
        {
            "items": [
                {
                    "application_id": application.id,
                    "applicant_user_id": application.applicant_user_id,
                    "created_at": _to_iso8601(application.created_at),
                    "items": _serialize_items(
                        items_by_application.get(application.id, [])
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
    _assert_application_status(
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
    if any(mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY for item in items):
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

    logistics = db.scalar(
        select(Logistics).where(Logistics.application_id == application.id).limit(1)
    )
    receiver_snapshot = _resolve_receiver_snapshot(
        db,
        applicant_user_id=application.applicant_user_id,
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
