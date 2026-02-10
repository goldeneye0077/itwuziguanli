from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import (
    ApprovalAction,
    ApprovalNode,
    ApplicationStatus,
    ApplicationType,
    DeliveryType,
    enum_column,
)
from app.models.mixins import TimestampMixin


class Application(TimestampMixin, Base):
    __tablename__ = "application"
    __table_args__ = (
        Index("idx_application_applicant_time", "applicant_user_id", "created_at"),
        Index("idx_application_status", "status"),
        Index("idx_application_delivery_type", "delivery_type"),
        UniqueConstraint("pickup_code", name="uk_application_pickup_code"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    applicant_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_application_applicant", ondelete="RESTRICT"),
        nullable=False,
    )
    type: Mapped[ApplicationType] = mapped_column(
        enum_column(ApplicationType, "application_type"),
        nullable=False,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        enum_column(ApplicationStatus, "application_status"),
        nullable=False,
    )
    delivery_type: Mapped[DeliveryType] = mapped_column(
        enum_column(DeliveryType, "delivery_type"),
        nullable=False,
    )
    pickup_code: Mapped[str] = mapped_column(String(6), nullable=False)
    pickup_qr_string: Mapped[str | None] = mapped_column(String(512), nullable=True)
    leader_approver_user_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    admin_reviewer_user_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )


class ApplicationItem(TimestampMixin, Base):
    __tablename__ = "application_item"
    __table_args__ = (
        Index("idx_app_item_app", "application_id"),
        Index("idx_app_item_sku", "sku_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("application.id", name="fk_app_item_app", ondelete="CASCADE"),
        nullable=False,
    )
    sku_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sku.id", name="fk_app_item_sku", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ApplicationAsset(TimestampMixin, Base):
    __tablename__ = "application_asset"
    __table_args__ = (
        UniqueConstraint("application_id", "asset_id", name="uk_app_asset"),
        Index("idx_app_asset_asset", "asset_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("application.id", name="fk_app_asset_app", ondelete="CASCADE"),
        nullable=False,
    )
    asset_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("asset.id", name="fk_app_asset_asset", ondelete="RESTRICT"),
        nullable=False,
    )


class ApprovalHistory(TimestampMixin, Base):
    __tablename__ = "approval_history"
    __table_args__ = (Index("idx_approval_app_time", "application_id", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("application.id", name="fk_approval_app", ondelete="CASCADE"),
        nullable=False,
    )
    node: Mapped[ApprovalNode] = mapped_column(
        enum_column(ApprovalNode, "approval_node"),
        nullable=False,
    )
    action: Mapped[ApprovalAction] = mapped_column(
        enum_column(ApprovalAction, "approval_action"),
        nullable=False,
    )
    actor_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_approval_actor", ondelete="RESTRICT"),
        nullable=False,
    )
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ai_recommendation_json: Mapped[dict[str, object] | None] = mapped_column(
        JSON, nullable=True
    )


class Logistics(TimestampMixin, Base):
    __tablename__ = "logistics"
    __table_args__ = (
        UniqueConstraint("application_id", name="uk_logistics_app"),
        Index("idx_logistics_tracking", "tracking_no"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("application.id", name="fk_logistics_app", ondelete="CASCADE"),
        nullable=False,
    )
    receiver_name: Mapped[str] = mapped_column(String(64), nullable=False)
    receiver_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    province: Mapped[str] = mapped_column(String(64), nullable=False)
    city: Mapped[str] = mapped_column(String(64), nullable=False)
    district: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str] = mapped_column(String(255), nullable=False)
    carrier: Mapped[str] = mapped_column(String(64), nullable=False)
    tracking_no: Mapped[str] = mapped_column(String(64), nullable=False)
    shipped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
