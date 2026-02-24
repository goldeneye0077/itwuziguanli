"""add sku name column

Revision ID: 202602240002
Revises: 202602240001
Create Date: 2026-02-24 22:45:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202602240002"
down_revision = "202602240001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sku",
        sa.Column("name", sa.String(length=128), nullable=False, server_default=sa.text("''")),
    )

    sku_table = sa.table(
        "sku",
        sa.column("name", sa.String(length=128)),
        sa.column("brand", sa.String(length=64)),
        sa.column("model", sa.String(length=128)),
    )
    op.execute(
        sku_table.update()
        .where(sku_table.c.name == "")
        .values(
            name=sa.func.trim(
                sa.func.coalesce(sku_table.c.brand, "")
                + sa.literal(" ")
                + sa.func.coalesce(sku_table.c.model, "")
            )
        )
    )


def downgrade() -> None:
    op.drop_column("sku", "name")
