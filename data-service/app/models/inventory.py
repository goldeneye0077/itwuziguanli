from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import AssetStatus, StockFlowAction, enum_column
from app.models.mixins import TimestampMixin


class Asset(TimestampMixin, Base):
    __tablename__ = "asset"
    __table_args__ = (
        UniqueConstraint("asset_tag", name="uk_asset_asset_tag"),
        UniqueConstraint("sn", name="uk_asset_sn"),
        Index("idx_asset_sku_status", "sku_id", "status"),
        Index("idx_asset_holder", "holder_user_id"),
        Index("idx_asset_locked_app", "locked_application_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    asset_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    sku_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sku.id", name="fk_asset_sku", ondelete="RESTRICT"),
        nullable=False,
    )
    sn: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[AssetStatus] = mapped_column(
        enum_column(AssetStatus, "asset_status"),
        nullable=False,
    )
    holder_user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_asset_holder", ondelete="SET NULL"),
        nullable=True,
    )
    locked_application_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inbound_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )


class StockFlow(TimestampMixin, Base):
    __tablename__ = "stock_flow"
    __table_args__ = (
        Index("idx_stock_flow_asset_time", "asset_id", "occurred_at"),
        Index("idx_stock_flow_app_time", "related_application_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("asset.id", name="fk_stock_flow_asset", ondelete="RESTRICT"),
        nullable=False,
    )
    action: Mapped[StockFlowAction] = mapped_column(
        enum_column(StockFlowAction, "stock_flow_action"),
        nullable=False,
    )
    operator_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_stock_flow_operator", ondelete="RESTRICT"),
        nullable=False,
    )
    related_application_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )
    meta_json: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
