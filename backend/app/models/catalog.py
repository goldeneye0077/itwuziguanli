from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import SkuStockMode, enum_column
from app.models.mixins import TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "category"
    __table_args__ = (Index("idx_category_parent", "parent_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("category.id", name="fk_category_parent", ondelete="SET NULL"),
        nullable=True,
    )


class Sku(TimestampMixin, Base):
    __tablename__ = "sku"
    __table_args__ = (
        Index("idx_sku_category", "category_id"),
        Index("idx_sku_brand_model", "brand", "model"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("category.id", name="fk_sku_category", ondelete="RESTRICT"),
        nullable=False,
    )
    brand: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    spec: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cover_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    stock_mode: Mapped[SkuStockMode] = mapped_column(
        enum_column(SkuStockMode, "sku_stock_mode"),
        nullable=False,
        default=SkuStockMode.SERIALIZED,
    )
    safety_stock_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
