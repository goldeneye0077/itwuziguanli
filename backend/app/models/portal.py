from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import AnnouncementStatus, enum_column
from app.models.mixins import TimestampMixin


class Announcement(TimestampMixin, Base):
    __tablename__ = "announcement"
    __table_args__ = (Index("idx_announcement_status_time", "status", "published_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    author_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_announcement_author", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[AnnouncementStatus] = mapped_column(
        enum_column(AnnouncementStatus, "announcement_status"),
        nullable=False,
        default=AnnouncementStatus.DRAFT,
        server_default=text("'DRAFT'"),
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )


class HeroBanner(TimestampMixin, Base):
    __tablename__ = "hero_banner"
    __table_args__ = (Index("idx_hero_active_order", "is_active", "display_order"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    link_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
