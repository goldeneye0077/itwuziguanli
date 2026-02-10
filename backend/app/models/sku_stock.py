from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import SkuStockFlowAction, enum_column
from app.models.mixins import TimestampMixin


class SkuStock(TimestampMixin, Base):
    __tablename__ = "sku_stock"

    sku_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sku.id", name="fk_sku_stock_sku", ondelete="RESTRICT"),
        primary_key=True,
    )
    on_hand_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SkuStockFlow(TimestampMixin, Base):
    __tablename__ = "sku_stock_flow"
    __table_args__ = (
        Index("idx_sku_stock_flow_sku_time", "sku_id", "occurred_at"),
        Index("idx_sku_stock_flow_app_time", "related_application_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sku.id", name="fk_sku_stock_flow_sku", ondelete="RESTRICT"),
        nullable=False,
    )
    action: Mapped[SkuStockFlowAction] = mapped_column(
        enum_column(SkuStockFlowAction, "sku_stock_flow_action"),
        nullable=False,
    )
    on_hand_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    on_hand_qty_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_qty_after: Mapped[int] = mapped_column(Integer, nullable=False)
    operator_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "sys_user.id", name="fk_sku_stock_flow_operator", ondelete="RESTRICT"
        ),
        nullable=False,
    )
    related_application_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )
    meta_json: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)

