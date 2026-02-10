from sqlalchemy import BigInteger, ForeignKey, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import OcrDocType, OcrJobStatus, enum_column
from app.models.mixins import TimestampMixin


class OcrInboundJob(TimestampMixin, Base):
    __tablename__ = "ocr_inbound_job"
    __table_args__ = (
        Index("idx_ocr_job_operator_time", "operator_user_id", "created_at"),
        Index("idx_ocr_job_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    operator_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_ocr_job_operator", ondelete="RESTRICT"),
        nullable=False,
    )
    source_file_url: Mapped[str] = mapped_column(String(512), nullable=False)
    doc_type: Mapped[OcrDocType | None] = mapped_column(
        enum_column(OcrDocType, "ocr_doc_type"),
        nullable=True,
    )
    status: Mapped[OcrJobStatus] = mapped_column(
        enum_column(OcrJobStatus, "ocr_job_status"),
        nullable=False,
    )
    extracted_json: Mapped[dict[str, object] | None] = mapped_column(
        JSON, nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    confirmed_sku_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("sku.id", name="fk_ocr_job_sku", ondelete="SET NULL"),
        nullable=True,
    )
