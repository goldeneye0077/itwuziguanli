from sqlalchemy import BigInteger, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class Department(TimestampMixin, Base):
    __tablename__ = "department"
    __table_args__ = (
        UniqueConstraint("name", name="uk_department_name"),
        Index("idx_department_parent", "parent_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("department.id", name="fk_department_parent", ondelete="SET NULL"),
        nullable=True,
    )
    manager_user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_department_manager", ondelete="SET NULL"),
        nullable=True,
    )


class SysUser(TimestampMixin, Base):
    __tablename__ = "sys_user"
    __table_args__ = (
        UniqueConstraint("employee_no", name="uk_sys_user_employee_no"),
        Index("idx_sys_user_department", "department_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_no: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    department_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("department.id", name="fk_sys_user_department", ondelete="RESTRICT"),
        nullable=False,
    )
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
