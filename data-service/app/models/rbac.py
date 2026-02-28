from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class RbacRole(TimestampMixin, Base):
    __tablename__ = "rbac_role"
    __table_args__ = (UniqueConstraint("role_key", name="uk_rbac_role_key"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_key: Mapped[str] = mapped_column(String(64), nullable=False)
    role_name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )


class RbacPermission(TimestampMixin, Base):
    __tablename__ = "rbac_permission"
    __table_args__ = (
        UniqueConstraint("resource", "action", name="uk_rbac_permission"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    resource: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class RbacRolePermission(Base):
    __tablename__ = "rbac_role_permission"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uk_rbac_role_perm"),
        Index("idx_rbac_role_perm_perm", "permission_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rbac_role.id", name="fk_rbac_role_perm_role", ondelete="CASCADE"),
        nullable=False,
    )
    permission_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "rbac_permission.id", name="fk_rbac_role_perm_perm", ondelete="CASCADE"
        ),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )


class RbacUserRole(Base):
    __tablename__ = "rbac_user_role"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uk_rbac_user_role"),
        Index("idx_rbac_user_role_role", "role_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sys_user.id", name="fk_rbac_user_role_user", ondelete="CASCADE"),
        nullable=False,
    )
    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rbac_role.id", name="fk_rbac_user_role_role", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )


class RbacUiGuard(TimestampMixin, Base):
    __tablename__ = "rbac_ui_guard"
    __table_args__ = (
        UniqueConstraint("guard_type", "guard_key", name="uk_rbac_ui_guard_type_key"),
        Index("idx_rbac_ui_guard_type", "guard_type"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    guard_type: Mapped[str] = mapped_column(String(16), nullable=False)
    guard_key: Mapped[str] = mapped_column(String(128), nullable=False)
    required_permissions: Mapped[str] = mapped_column(String(2000), nullable=False)
