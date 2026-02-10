from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import SkuStockFlowAction
from app.models.sku_stock import SkuStock, SkuStockFlow


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def get_or_create_stock_for_update(db: Session, *, sku_id: int) -> SkuStock:
    record = db.scalar(
        select(SkuStock).where(SkuStock.sku_id == sku_id).with_for_update()
    )
    if record is not None:
        return record

    record = SkuStock(sku_id=sku_id, on_hand_qty=0, reserved_qty=0)
    db.add(record)
    db.flush()
    return record


def apply_stock_delta(
    db: Session,
    *,
    sku_id: int,
    action: SkuStockFlowAction,
    on_hand_delta: int,
    reserved_delta: int,
    operator_user_id: int,
    related_application_id: int | None,
    occurred_at: datetime | None = None,
    meta_json: dict[str, object] | None = None,
) -> SkuStock:
    """Apply stock delta with row-level lock + audit flow.

    Invariants:
    - on_hand_qty >= 0
    - reserved_qty >= 0
    - reserved_qty <= on_hand_qty
    """

    stock = get_or_create_stock_for_update(db, sku_id=sku_id)
    next_on_hand = int(stock.on_hand_qty) + int(on_hand_delta)
    next_reserved = int(stock.reserved_qty) + int(reserved_delta)

    if next_on_hand < 0:
        raise AppException(
            code="STOCK_INSUFFICIENT",
            message="现存库存不足，无法扣减。",
            details={
                "sku_id": int(sku_id),
                "on_hand_qty": int(stock.on_hand_qty),
                "on_hand_delta": int(on_hand_delta),
            },
        )
    if next_reserved < 0:
        raise AppException(
            code="VALIDATION_ERROR",
            message="预占库存不足，无法释放。",
            details={
                "sku_id": int(sku_id),
                "reserved_qty": int(stock.reserved_qty),
                "reserved_delta": int(reserved_delta),
            },
        )
    if next_reserved > next_on_hand:
        raise AppException(
            code="STOCK_INSUFFICIENT",
            message="可用库存不足，无法预占或扣减。",
            details={
                "sku_id": int(sku_id),
                "on_hand_qty": int(stock.on_hand_qty),
                "reserved_qty": int(stock.reserved_qty),
                "on_hand_delta": int(on_hand_delta),
                "reserved_delta": int(reserved_delta),
            },
        )

    stock.on_hand_qty = next_on_hand
    stock.reserved_qty = next_reserved

    now = occurred_at or datetime.now(UTC).replace(tzinfo=None)
    db.add(
        SkuStockFlow(
            id=_next_bigint_id(db, SkuStockFlow),
            sku_id=sku_id,
            action=action,
            on_hand_delta=int(on_hand_delta),
            reserved_delta=int(reserved_delta),
            on_hand_qty_after=int(next_on_hand),
            reserved_qty_after=int(next_reserved),
            operator_user_id=operator_user_id,
            related_application_id=related_application_id,
            occurred_at=now,
            meta_json=meta_json,
        )
    )
    db.flush()
    return stock

