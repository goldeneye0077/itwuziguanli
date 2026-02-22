"""add category approver fields

Revision ID: 202602120001
Revises: 202602110002
Create Date: 2026-02-12 00:00:01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602120001"
down_revision = "202602110002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "category",
        sa.Column("leader_approver_user_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "category",
        sa.Column("admin_reviewer_user_id", sa.BigInteger(), nullable=True),
    )

    op.create_index(
        "idx_category_leader_approver",
        "category",
        ["leader_approver_user_id"],
        unique=False,
    )
    op.create_index(
        "idx_category_admin_reviewer",
        "category",
        ["admin_reviewer_user_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_category_leader_approver",
        "category",
        "sys_user",
        ["leader_approver_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_category_admin_reviewer",
        "category",
        "sys_user",
        ["admin_reviewer_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_category_admin_reviewer", "category", type_="foreignkey")
    op.drop_constraint("fk_category_leader_approver", "category", type_="foreignkey")

    op.drop_index("idx_category_admin_reviewer", table_name="category")
    op.drop_index("idx_category_leader_approver", table_name="category")

    op.drop_column("category", "admin_reviewer_user_id")
    op.drop_column("category", "leader_approver_user_id")

