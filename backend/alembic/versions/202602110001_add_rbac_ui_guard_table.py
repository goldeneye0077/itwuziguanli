"""add rbac ui guard table

Revision ID: 202602110001
Revises: 202602100001
Create Date: 2026-02-11 00:00:01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602110001"
down_revision = "202602100001"
branch_labels = None
depends_on = None


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at",
        sa.DateTime(),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    )


def _updated_at() -> sa.Column:
    return sa.Column(
        "updated_at",
        sa.DateTime(),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    )


def upgrade() -> None:
    op.create_table(
        "rbac_ui_guard",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("guard_type", sa.String(length=16), nullable=False),
        sa.Column("guard_key", sa.String(length=128), nullable=False),
        sa.Column("required_permissions", sa.String(length=2000), nullable=False),
        _created_at(),
        _updated_at(),
        sa.UniqueConstraint(
            "guard_type",
            "guard_key",
            name="uk_rbac_ui_guard_type_key",
        ),
    )
    op.create_index(
        "idx_rbac_ui_guard_type",
        "rbac_ui_guard",
        ["guard_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_rbac_ui_guard_type", table_name="rbac_ui_guard")
    op.drop_table("rbac_ui_guard")
