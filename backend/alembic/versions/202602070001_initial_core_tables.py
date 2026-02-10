"""initial core tables for D1-D8

Revision ID: 202602070001
Revises:
Create Date: 2026-02-07 00:00:01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602070001"
down_revision = None
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
    asset_status_enum = _enum(
        "asset_status",
        "IN_STOCK",
        "LOCKED",
        "IN_USE",
        "PENDING_INSPECTION",
        "BORROWED",
        "REPAIRING",
        "SCRAPPED",
    )
    stock_flow_action_enum = _enum(
        "stock_flow_action",
        "INBOUND",
        "LOCK",
        "UNLOCK",
        "OUTBOUND",
        "SHIP",
        "RECEIVE",
        "REPAIR_START",
        "REPAIR_FINISH",
        "SCRAP",
        "CANCEL",
    )
    application_type_enum = _enum("application_type", "APPLY", "RETURN", "REPAIR")
    application_status_enum = _enum(
        "application_status",
        "SUBMITTED",
        "LOCKED",
        "LEADER_APPROVED",
        "LEADER_REJECTED",
        "ADMIN_APPROVED",
        "ADMIN_REJECTED",
        "READY_OUTBOUND",
        "OUTBOUNDED",
        "SHIPPED",
        "DONE",
        "CANCELLED",
    )
    delivery_type_enum = _enum("delivery_type", "PICKUP", "EXPRESS")
    approval_node_enum = _enum("approval_node", "LEADER", "ADMIN")
    approval_action_enum = _enum("approval_action", "APPROVE", "REJECT")
    announcement_status_enum = _enum(
        "announcement_status", "DRAFT", "PUBLISHED", "ARCHIVED"
    )
    ocr_doc_type_enum = _enum("ocr_doc_type", "INVOICE", "DELIVERY_NOTE", "OTHER")
    ocr_job_status_enum = _enum(
        "ocr_job_status",
        "PENDING",
        "PROCESSING",
        "READY_FOR_REVIEW",
        "CONFIRMED",
        "FAILED",
    )
    token_blacklist_reason_enum = _enum(
        "token_blacklist_reason",
        "LOGOUT",
        "PASSWORD_CHANGED",
        "ADMIN_FORCED",
    )
    notify_channel_enum = _enum("notify_channel", "EMAIL", "DINGTALK")
    notify_status_enum = _enum("notify_status", "PENDING", "SENT", "FAILED")

    op.create_table(
        "department",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column("manager_user_id", sa.BigInteger(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["department.id"],
            name="fk_department_parent",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("name", name="uk_department_name"),
    )
    op.create_index("idx_department_parent", "department", ["parent_id"], unique=False)

    op.create_table(
        "sys_user",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("employee_no", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("department_id", sa.BigInteger(), nullable=False),
        sa.Column("email", sa.String(length=128), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["department.id"],
            name="fk_sys_user_department",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("employee_no", name="uk_sys_user_employee_no"),
    )
    op.create_index(
        "idx_sys_user_department", "sys_user", ["department_id"], unique=False
    )

    if op.get_bind().dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_department_manager",
            "department",
            "sys_user",
            ["manager_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_table(
        "category",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["category.id"],
            name="fk_category_parent",
            ondelete="SET NULL",
        ),
    )
    op.create_index("idx_category_parent", "category", ["parent_id"], unique=False)

    op.create_table(
        "sku",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("brand", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("spec", sa.String(length=255), nullable=False),
        sa.Column("reference_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("cover_url", sa.String(length=512), nullable=True),
        sa.Column(
            "safety_stock_threshold",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["category.id"],
            name="fk_sku_category",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("idx_sku_category", "sku", ["category_id"], unique=False)
    op.create_index("idx_sku_brand_model", "sku", ["brand", "model"], unique=False)

    op.create_table(
        "application",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("applicant_user_id", sa.BigInteger(), nullable=False),
        sa.Column("type", application_type_enum, nullable=False),
        sa.Column("status", application_status_enum, nullable=False),
        sa.Column("delivery_type", delivery_type_enum, nullable=False),
        sa.Column("pickup_code", sa.CHAR(length=6), nullable=False),
        sa.Column("pickup_qr_string", sa.String(length=512), nullable=True),
        sa.Column("leader_approver_user_id", sa.BigInteger(), nullable=True),
        sa.Column("admin_reviewer_user_id", sa.BigInteger(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["applicant_user_id"],
            ["sys_user.id"],
            name="fk_application_applicant",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("pickup_code", name="uk_application_pickup_code"),
    )
    op.create_index(
        "idx_application_applicant_time",
        "application",
        ["applicant_user_id", "created_at"],
        unique=False,
    )
    op.create_index("idx_application_status", "application", ["status"], unique=False)
    op.create_index(
        "idx_application_delivery_type", "application", ["delivery_type"], unique=False
    )

    op.create_table(
        "asset",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("asset_tag", sa.String(length=64), nullable=False),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("sn", sa.String(length=128), nullable=False),
        sa.Column("status", asset_status_enum, nullable=False),
        sa.Column("holder_user_id", sa.BigInteger(), nullable=True),
        sa.Column("locked_application_id", sa.BigInteger(), nullable=True),
        sa.Column("inbound_at", sa.DateTime(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["holder_user_id"],
            ["sys_user.id"],
            name="fk_asset_holder",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sku_id"], ["sku.id"], name="fk_asset_sku", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("asset_tag", name="uk_asset_asset_tag"),
        sa.UniqueConstraint("sn", name="uk_asset_sn"),
    )
    op.create_index("idx_asset_sku_status", "asset", ["sku_id", "status"], unique=False)
    op.create_index("idx_asset_holder", "asset", ["holder_user_id"], unique=False)
    op.create_index(
        "idx_asset_locked_app", "asset", ["locked_application_id"], unique=False
    )

    op.create_table(
        "stock_flow",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.BigInteger(), nullable=False),
        sa.Column("action", stock_flow_action_enum, nullable=False),
        sa.Column("operator_user_id", sa.BigInteger(), nullable=False),
        sa.Column("related_application_id", sa.BigInteger(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("meta_json", sa.JSON(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["asset.id"], name="fk_stock_flow_asset", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["operator_user_id"],
            ["sys_user.id"],
            name="fk_stock_flow_operator",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "idx_stock_flow_asset_time",
        "stock_flow",
        ["asset_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "idx_stock_flow_app_time",
        "stock_flow",
        ["related_application_id", "occurred_at"],
        unique=False,
    )

    op.create_table(
        "application_item",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("application_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["application.id"],
            name="fk_app_item_app",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sku_id"], ["sku.id"], name="fk_app_item_sku", ondelete="RESTRICT"
        ),
    )
    op.create_index(
        "idx_app_item_app", "application_item", ["application_id"], unique=False
    )
    op.create_index("idx_app_item_sku", "application_item", ["sku_id"], unique=False)

    op.create_table(
        "application_asset",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("application_id", sa.BigInteger(), nullable=False),
        sa.Column("asset_id", sa.BigInteger(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["application.id"],
            name="fk_app_asset_app",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["asset.id"], name="fk_app_asset_asset", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("application_id", "asset_id", name="uk_app_asset"),
    )
    op.create_index(
        "idx_app_asset_asset", "application_asset", ["asset_id"], unique=False
    )

    op.create_table(
        "approval_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("application_id", sa.BigInteger(), nullable=False),
        sa.Column("node", approval_node_enum, nullable=False),
        sa.Column("action", approval_action_enum, nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("comment", sa.String(length=500), nullable=True),
        sa.Column("ai_recommendation_json", sa.JSON(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["application.id"],
            name="fk_approval_app",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["sys_user.id"],
            name="fk_approval_actor",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "idx_approval_app_time",
        "approval_history",
        ["application_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "logistics",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("application_id", sa.BigInteger(), nullable=False),
        sa.Column("receiver_name", sa.String(length=64), nullable=False),
        sa.Column("receiver_phone", sa.String(length=32), nullable=False),
        sa.Column("province", sa.String(length=64), nullable=False),
        sa.Column("city", sa.String(length=64), nullable=False),
        sa.Column("district", sa.String(length=64), nullable=False),
        sa.Column("detail", sa.String(length=255), nullable=False),
        sa.Column("carrier", sa.String(length=64), nullable=False),
        sa.Column("tracking_no", sa.String(length=64), nullable=False),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["application.id"],
            name="fk_logistics_app",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("application_id", name="uk_logistics_app"),
    )
    op.create_index(
        "idx_logistics_tracking", "logistics", ["tracking_no"], unique=False
    )

    op.create_table(
        "announcement",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author_user_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            announcement_status_enum,
            nullable=False,
            server_default=sa.text("'DRAFT'"),
        ),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["author_user_id"],
            ["sys_user.id"],
            name="fk_announcement_author",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "idx_announcement_status_time",
        "announcement",
        ["status", "published_at"],
        unique=False,
    )

    op.create_table(
        "hero_banner",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("subtitle", sa.String(length=255), nullable=True),
        sa.Column("image_url", sa.String(length=512), nullable=True),
        sa.Column("link_url", sa.String(length=512), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")
        ),
        sa.Column(
            "display_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        _created_at(),
        _updated_at(),
    )
    op.create_index(
        "idx_hero_active_order",
        "hero_banner",
        ["is_active", "display_order"],
        unique=False,
    )

    op.create_table(
        "rbac_role",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("role_key", sa.String(length=64), nullable=False),
        sa.Column("role_name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "is_system", sa.Boolean(), nullable=False, server_default=sa.text("0")
        ),
        _created_at(),
        _updated_at(),
        sa.UniqueConstraint("role_key", name="uk_rbac_role_key"),
    )

    op.create_table(
        "rbac_permission",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("resource", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        _created_at(),
        _updated_at(),
        sa.UniqueConstraint("resource", "action", name="uk_rbac_permission"),
    )

    op.create_table(
        "rbac_role_permission",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("permission_id", sa.BigInteger(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["rbac_role.id"],
            name="fk_rbac_role_perm_role",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["rbac_permission.id"],
            name="fk_rbac_role_perm_perm",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("role_id", "permission_id", name="uk_rbac_role_perm"),
    )
    op.create_index(
        "idx_rbac_role_perm_perm",
        "rbac_role_permission",
        ["permission_id"],
        unique=False,
    )

    op.create_table(
        "rbac_user_role",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["sys_user.id"],
            name="fk_rbac_user_role_user",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["rbac_role.id"],
            name="fk_rbac_user_role_role",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("user_id", "role_id", name="uk_rbac_user_role"),
    )
    op.create_index(
        "idx_rbac_user_role_role", "rbac_user_role", ["role_id"], unique=False
    )

    op.create_table(
        "ocr_inbound_job",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("operator_user_id", sa.BigInteger(), nullable=False),
        sa.Column("source_file_url", sa.String(length=512), nullable=False),
        sa.Column("doc_type", ocr_doc_type_enum, nullable=True),
        sa.Column("status", ocr_job_status_enum, nullable=False),
        sa.Column("extracted_json", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.Column("confirmed_sku_id", sa.BigInteger(), nullable=True),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["operator_user_id"],
            ["sys_user.id"],
            name="fk_ocr_job_operator",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["confirmed_sku_id"],
            ["sku.id"],
            name="fk_ocr_job_sku",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "idx_ocr_job_operator_time",
        "ocr_inbound_job",
        ["operator_user_id", "created_at"],
        unique=False,
    )
    op.create_index("idx_ocr_job_status", "ocr_inbound_job", ["status"], unique=False)

    op.create_table(
        "token_blacklist",
        sa.Column("jti", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("reason", token_blacklist_reason_enum, nullable=False),
        _created_at(),
    )
    op.create_index(
        "idx_token_blacklist_expires", "token_blacklist", ["expires_at"], unique=False
    )
    op.create_index(
        "idx_token_blacklist_user", "token_blacklist", ["user_id"], unique=False
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("meta_json", sa.JSON(), nullable=True),
        _created_at(),
    )
    op.create_index(
        "idx_audit_log_user_time", "audit_log", ["user_id", "occurred_at"], unique=False
    )
    op.create_index(
        "idx_audit_log_action_time",
        "audit_log",
        ["action", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "idx_audit_log_resource",
        "audit_log",
        ["resource_type", "resource_id"],
        unique=False,
    )

    op.create_table(
        "user_address",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("receiver_name", sa.String(length=64), nullable=False),
        sa.Column("receiver_phone", sa.String(length=32), nullable=False),
        sa.Column("province", sa.String(length=64), nullable=False),
        sa.Column("city", sa.String(length=64), nullable=False),
        sa.Column("district", sa.String(length=64), nullable=False),
        sa.Column("detail", sa.String(length=255), nullable=False),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.text("0")
        ),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["sys_user.id"],
            name="fk_user_address_user",
            ondelete="CASCADE",
        ),
    )
    op.create_index("idx_user_address_user", "user_address", ["user_id"], unique=False)

    op.create_table(
        "notification_outbox",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("channel", notify_channel_enum, nullable=False),
        sa.Column("receiver", sa.String(length=128), nullable=False),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("status", notify_status_enum, nullable=False),
        sa.Column(
            "retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        _created_at(),
        _updated_at(),
    )
    op.create_index(
        "idx_notification_status_time",
        "notification_outbox",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "sqlite":
        op.drop_constraint("fk_department_manager", "department", type_="foreignkey")

    op.drop_table("notification_outbox")
    op.drop_table("user_address")
    op.drop_table("audit_log")
    op.drop_table("token_blacklist")
    op.drop_table("ocr_inbound_job")
    op.drop_table("rbac_user_role")
    op.drop_table("rbac_role_permission")
    op.drop_table("rbac_permission")
    op.drop_table("rbac_role")
    op.drop_table("hero_banner")
    op.drop_table("announcement")
    op.drop_table("logistics")
    op.drop_table("approval_history")
    op.drop_table("application_asset")
    op.drop_table("application_item")
    op.drop_table("stock_flow")
    op.drop_table("asset")
    op.drop_table("application")
    op.drop_table("sku")
    op.drop_table("category")
    op.drop_table("sys_user")
    op.drop_table("department")
