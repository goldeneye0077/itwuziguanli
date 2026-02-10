"""M02 router implementation: asset application."""

from __future__ import annotations

from datetime import UTC, datetime
from collections.abc import Sequence
from random import randint

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import Application, ApplicationAsset, ApplicationItem
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
from ....models.sku_stock import SkuStock
from ....models.notification import UserAddress
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m02 import (
    AiPrecheckRequest,
    ApplicationCreateRequest,
    UserAddressCreateRequest,
)
from ....services.sku_stock_service import apply_stock_delta

router = APIRouter(tags=["M02"])


def _to_iso8601(value: datetime) -> str:
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


def _serialize_address(address: UserAddress) -> dict[str, object]:
    return {
        "id": address.id,
        "user_id": address.user_id,
        "receiver_name": address.receiver_name,
        "receiver_phone": address.receiver_phone,
        "province": address.province,
        "city": address.city,
        "district": address.district,
        "detail": address.detail,
        "is_default": address.is_default,
    }


def _serialize_application(
    application: Application,
    items: list[ApplicationItem],
    assets: list[ApplicationAsset],
    express_address: dict[str, object] | None,
) -> dict[str, object]:
    return {
        "id": application.id,
        "applicant_user_id": application.applicant_user_id,
        "type": application.type.value,
        "status": application.status.value,
        "delivery_type": application.delivery_type.value,
        "pickup_code": application.pickup_code,
        "pickup_qr_string": application.pickup_qr_string,
        "created_at": _to_iso8601(application.created_at),
        "items": [
            {
                "id": item.id,
                "sku_id": item.sku_id,
                "quantity": item.quantity,
                "note": item.note,
            }
            for item in items
        ],
        "locked_assets": [
            {
                "application_asset_id": relation.id,
                "asset_id": relation.asset_id,
            }
            for relation in assets
        ],
        "express_address": express_address,
    }


def _build_category_tree(rows: Sequence[Category]) -> list[dict[str, object]]:
    node_map: dict[int, dict[str, object]] = {
        row.id: {"id": row.id, "name": row.name, "children": []} for row in rows
    }
    roots: list[dict[str, object]] = []
    for row in rows:
        current = node_map[row.id]
        if row.parent_id is None or row.parent_id not in node_map:
            roots.append(current)
            continue
        parent = node_map[row.parent_id]
        children = parent["children"]
        if isinstance(children, list):
            children.append(current)
    return roots


def _pickup_code_exists(db: Session, pickup_code: str) -> bool:
    stmt = select(Application.id).where(Application.pickup_code == pickup_code).limit(1)
    return db.scalar(stmt) is not None


def _create_pickup_code(db: Session) -> str:
    for _ in range(10):
        candidate = f"{randint(0, 999999):06d}"
        if not _pickup_code_exists(db, candidate):
            return candidate
    raise AppException(
        code="INTERNAL_SERVER_ERROR",
        message="无法分配取件码，请稍后重试。",
    )


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _sku_query(
    *,
    category_id: int | None,
    keyword: str | None,
) -> Select[tuple[Sku]]:
    stmt: Select[tuple[Sku]] = select(Sku)
    if category_id is not None:
        stmt = stmt.where(Sku.category_id == category_id)
    if keyword:
        token = f"%{keyword}%"
        stmt = stmt.where(
            or_(
                Sku.brand.ilike(token),
                Sku.model.ilike(token),
                Sku.spec.ilike(token),
            )
        )
    return stmt


@router.get("/categories/tree", response_model=ApiResponse)
def get_category_tree(
    _: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    categories = db.scalars(select(Category).order_by(Category.id.asc())).all()
    return build_success_response(_build_category_tree(categories))


@router.get("/skus", response_model=ApiResponse)
def list_skus(
    category_id: int | None = Query(default=None),
    keyword: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    _: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    offset = (page - 1) * page_size
    sku_stmt = _sku_query(category_id=category_id, keyword=keyword)

    total_stmt = select(func.count()).select_from(sku_stmt.subquery())
    total = db.scalar(total_stmt) or 0

    available_stock_subquery = (
        select(
            Asset.sku_id.label("sku_id"), func.count(Asset.id).label("available_stock")
        )
        .where(
            Asset.status == AssetStatus.IN_STOCK,
            Asset.locked_application_id.is_(None),
        )
        .group_by(Asset.sku_id)
        .subquery()
    )
    quantity_stock_subquery = (
        select(
            SkuStock.sku_id.label("sku_id"),
            (SkuStock.on_hand_qty - SkuStock.reserved_qty).label("available_qty"),
        ).subquery()
    )

    sku_id_subquery = sku_stmt.with_only_columns(Sku.id).subquery()
    rows = db.execute(
        select(
            Sku,
            func.coalesce(available_stock_subquery.c.available_stock, 0).label(
                "serialized_available_stock"
            ),
            func.coalesce(quantity_stock_subquery.c.available_qty, 0).label(
                "quantity_available_qty"
            ),
        )
        .select_from(Sku)
        .join(sku_id_subquery, Sku.id == sku_id_subquery.c.id)
        .outerjoin(
            available_stock_subquery, available_stock_subquery.c.sku_id == Sku.id
        )
        .outerjoin(quantity_stock_subquery, quantity_stock_subquery.c.sku_id == Sku.id)
        .order_by(Sku.id.asc())
        .offset(offset)
        .limit(page_size)
    ).all()

    return build_success_response(
        {
            "items": [
                {
                    "id": sku.id,
                    "category_id": sku.category_id,
                    "brand": sku.brand,
                    "model": sku.model,
                    "spec": sku.spec,
                    "reference_price": str(sku.reference_price),
                    "cover_url": sku.cover_url,
                    "stock_mode": sku.stock_mode.value,
                    "safety_stock_threshold": sku.safety_stock_threshold,
                    "available_stock": int(
                        quantity_available_qty
                        if sku.stock_mode == SkuStockMode.QUANTITY
                        else serialized_available_stock
                    ),
                }
                for sku, serialized_available_stock, quantity_available_qty in rows
            ],
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": int(total),
            },
        }
    )


@router.get("/me/addresses", response_model=ApiResponse)
def list_my_addresses(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    addresses = db.scalars(
        select(UserAddress)
        .where(UserAddress.user_id == context.user.id)
        .order_by(UserAddress.is_default.desc(), UserAddress.id.desc())
    ).all()
    return build_success_response([_serialize_address(item) for item in addresses])


@router.post("/me/addresses", response_model=ApiResponse)
def create_my_address(
    payload: UserAddressCreateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    if payload.is_default:
        db.query(UserAddress).filter(UserAddress.user_id == context.user.id).update(
            {UserAddress.is_default: False}
        )

    record = UserAddress(
        id=_next_bigint_id(db, UserAddress),
        user_id=context.user.id,
        receiver_name=payload.receiver_name,
        receiver_phone=payload.receiver_phone,
        province=payload.province,
        city=payload.city,
        district=payload.district,
        detail=payload.detail,
        is_default=payload.is_default,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return build_success_response(_serialize_address(record))


@router.post("/applications", response_model=ApiResponse)
def create_application(
    payload: ApplicationCreateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    resolved_address: dict[str, object] | None = None
    if payload.delivery_type == DeliveryType.EXPRESS:
        if payload.express_address_id is not None:
            address = db.scalar(
                select(UserAddress).where(
                    UserAddress.id == payload.express_address_id,
                    UserAddress.user_id == context.user.id,
                )
            )
            if address is None:
                raise AppException(
                    code="RESOURCE_NOT_FOUND",
                    message="快递地址不存在。",
                )
            resolved_address = _serialize_address(address)
        elif payload.express_address is not None:
            resolved_address = payload.express_address.model_dump()

    now = datetime.now(UTC).replace(tzinfo=None)
    application = Application(
        id=_next_bigint_id(db, Application),
        applicant_user_id=context.user.id,
        type=payload.type,
        status=ApplicationStatus.SUBMITTED,
        delivery_type=payload.delivery_type,
        pickup_code=_create_pickup_code(db),
        pickup_qr_string=None,
    )
    db.add(application)
    db.flush()

    item_rows: list[ApplicationItem] = []
    relation_rows: list[ApplicationAsset] = []
    next_application_asset_id = _next_bigint_id(db, ApplicationAsset)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)

    for item in payload.items:
        sku = db.get(Sku, item.sku_id)
        if sku is None:
            raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")

        item_record = ApplicationItem(
            id=_next_bigint_id(db, ApplicationItem),
            application_id=application.id,
            sku_id=item.sku_id,
            quantity=item.quantity,
            note=item.note,
        )
        db.add(item_record)
        db.flush()
        item_rows.append(item_record)

        if sku.stock_mode == SkuStockMode.QUANTITY:
            apply_stock_delta(
                db,
                sku_id=sku.id,
                action=SkuStockFlowAction.LOCK,
                on_hand_delta=0,
                reserved_delta=int(item.quantity),
                operator_user_id=context.user.id,
                related_application_id=application.id,
                occurred_at=now,
                meta_json={"event": "lock_inventory", "sku_id": item.sku_id},
            )
            continue

        available_assets = db.scalars(
            select(Asset)
            .where(
                Asset.sku_id == item.sku_id,
                Asset.status == AssetStatus.IN_STOCK,
                Asset.locked_application_id.is_(None),
            )
            .order_by(Asset.id.asc())
            .limit(item.quantity)
        ).all()

        if len(available_assets) < item.quantity:
            raise AppException(
                code="STOCK_INSUFFICIENT",
                message="可用库存不足。",
                details={
                    "sku_id": item.sku_id,
                    "requested": item.quantity,
                    "available": len(available_assets),
                },
            )

        for asset in available_assets:
            asset.status = AssetStatus.LOCKED
            asset.locked_application_id = application.id
            mapping = ApplicationAsset(application_id=application.id, asset_id=asset.id)
            mapping.id = next_application_asset_id
            next_application_asset_id += 1
            db.add(mapping)
            relation_rows.append(mapping)
            db.add(
                StockFlow(
                    id=next_stock_flow_id,
                    asset_id=asset.id,
                    action=StockFlowAction.LOCK,
                    operator_user_id=context.user.id,
                    related_application_id=application.id,
                    occurred_at=now,
                    meta_json={"event": "lock_inventory", "sku_id": item.sku_id},
                )
            )
            next_stock_flow_id += 1

    application.status = ApplicationStatus.LOCKED
    db.commit()
    db.refresh(application)
    for row in item_rows:
        db.refresh(row)
    for row in relation_rows:
        db.refresh(row)

    return build_success_response(
        _serialize_application(application, item_rows, relation_rows, resolved_address)
    )


@router.post("/ai/precheck", response_model=ApiResponse)
def ai_precheck(
    payload: AiPrecheckRequest,
    _: AuthContext = Depends(get_auth_context),
) -> ApiResponse:
    total_quantity = sum(item.quantity for item in payload.items)
    recommendation = "PASS"
    reason = "申请数量符合岗位/角色上下文，建议通过。"

    if total_quantity > 5:
        recommendation = "REJECT"
        reason = "申请数量较大，请补充更充分的业务理由。"
    elif len(payload.reason.strip()) < 10:
        recommendation = "REJECT"
        reason = "申请原因过短，无法进行有效预检。"

    return build_success_response(
        {
            "recommendation": recommendation,
            "reason": reason,
        }
    )
