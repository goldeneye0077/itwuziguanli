"""add sku stock_mode + quantity stock tables

Revision ID: 202602100001
Revises: 202602070001
Create Date: 2026-02-10 00:00:01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602100001"
down_revision = "202602070001"
branch_labels = None
depends_on = None


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True)


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
    sku_stock_mode_enum = _enum("sku_stock_mode", "SERIALIZED", "QUANTITY")
    sku_stock_flow_action_enum = _enum(
        "sku_stock_flow_action",
        "INBOUND",
        "OUTBOUND",
        "ADJUST",
        "LOCK",
        "UNLOCK",
        "SHIP",
    )

    op.add_column(
        "sku",
        sa.Column(
            "stock_mode",
            sku_stock_mode_enum,
            nullable=False,
            server_default=sa.text("'SERIALIZED'"),
        ),
    )

    op.create_table(
        "sku_stock",
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "on_hand_qty",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "reserved_qty",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["sku_id"],
            ["sku.id"],
            name="fk_sku_stock_sku",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("sku_id", name="pk_sku_stock"),
    )

    op.create_table(
        "sku_stock_flow",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("action", sku_stock_flow_action_enum, nullable=False),
        sa.Column("on_hand_delta", sa.Integer(), nullable=False),
        sa.Column("reserved_delta", sa.Integer(), nullable=False),
        sa.Column("on_hand_qty_after", sa.Integer(), nullable=False),
        sa.Column("reserved_qty_after", sa.Integer(), nullable=False),
        sa.Column("operator_user_id", sa.BigInteger(), nullable=False),
        sa.Column("related_application_id", sa.BigInteger(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("meta_json", sa.JSON(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["sku_id"],
            ["sku.id"],
            name="fk_sku_stock_flow_sku",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["operator_user_id"],
            ["sys_user.id"],
            name="fk_sku_stock_flow_operator",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "idx_sku_stock_flow_sku_time",
        "sku_stock_flow",
        ["sku_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "idx_sku_stock_flow_app_time",
        "sku_stock_flow",
        ["related_application_id", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_sku_stock_flow_app_time", table_name="sku_stock_flow")
    op.drop_index("idx_sku_stock_flow_sku_time", table_name="sku_stock_flow")
    op.drop_table("sku_stock_flow")
    op.drop_table("sku_stock")
    op.drop_column("sku", "stock_mode")
