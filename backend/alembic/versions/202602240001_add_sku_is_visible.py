"""add sku is_visible flag

Revision ID: 202602240001
Revises: 202602120001
Create Date: 2026-02-24 00:00:01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202602240001"
down_revision = "202602120001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sku",
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("sku", "is_visible")
