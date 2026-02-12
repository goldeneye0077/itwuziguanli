"""expand sys_user profile fields and application snapshots

Revision ID: 202602110002
Revises: 202602110001
Create Date: 2026-02-11 00:00:02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602110002"
down_revision = "202602110001"
branch_labels = None
depends_on = None


def _build_title(models: list[str]) -> str:
    labels: list[str] = []
    for raw in models:
        value = raw.strip()
        if not value or value in labels:
            continue
        labels.append(value)
    if not labels:
        return "关于物料申请"
    if len(labels) <= 2:
        return f"关于{'、'.join(labels)}的申请"
    return f"关于{'、'.join(labels[:2])}等{len(labels)}项的申请"


def upgrade() -> None:
    op.add_column(
        "sys_user",
        sa.Column("department_name", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "sys_user",
        sa.Column("section_name", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "sys_user",
        sa.Column("mobile_phone", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "sys_user",
        sa.Column("job_title", sa.String(length=128), nullable=True),
    )

    op.add_column(
        "application",
        sa.Column("title", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "application",
        sa.Column("applicant_name_snapshot", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "application",
        sa.Column("applicant_department_snapshot", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "application",
        sa.Column("applicant_phone_snapshot", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "application",
        sa.Column("applicant_job_title_snapshot", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "application",
        sa.Column("express_address_snapshot", sa.JSON(), nullable=True),
    )

    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            UPDATE sys_user
            SET department_name = (
                SELECT department.name
                FROM department
                WHERE department.id = sys_user.department_id
            )
            WHERE department_name IS NULL
            """
        )
    )

    app_rows = connection.execute(
        sa.text(
            """
            SELECT
                a.id AS application_id,
                u.name AS applicant_name,
                COALESCE(u.department_name, d.name) AS applicant_department,
                u.mobile_phone AS applicant_phone,
                u.job_title AS applicant_job_title
            FROM application a
            JOIN sys_user u ON u.id = a.applicant_user_id
            LEFT JOIN department d ON d.id = u.department_id
            ORDER BY a.id ASC
            """
        )
    ).mappings()

    for row in app_rows:
        application_id = int(row["application_id"])
        sku_models = [
            str(item["model"])
            for item in connection.execute(
                sa.text(
                    """
                    SELECT s.model
                    FROM application_item ai
                    JOIN sku s ON s.id = ai.sku_id
                    WHERE ai.application_id = :application_id
                    ORDER BY ai.id ASC
                    """
                ),
                {"application_id": application_id},
            ).mappings()
            if item.get("model")
        ]
        title = _build_title(sku_models)
        connection.execute(
            sa.text(
                """
                UPDATE application
                SET
                    title = COALESCE(title, :title),
                    applicant_name_snapshot = COALESCE(applicant_name_snapshot, :applicant_name_snapshot),
                    applicant_department_snapshot = COALESCE(applicant_department_snapshot, :applicant_department_snapshot),
                    applicant_phone_snapshot = COALESCE(applicant_phone_snapshot, :applicant_phone_snapshot),
                    applicant_job_title_snapshot = COALESCE(applicant_job_title_snapshot, :applicant_job_title_snapshot)
                WHERE id = :application_id
                """
            ),
            {
                "application_id": application_id,
                "title": title,
                "applicant_name_snapshot": row.get("applicant_name"),
                "applicant_department_snapshot": row.get("applicant_department"),
                "applicant_phone_snapshot": row.get("applicant_phone"),
                "applicant_job_title_snapshot": row.get("applicant_job_title"),
            },
        )


def downgrade() -> None:
    op.drop_column("application", "express_address_snapshot")
    op.drop_column("application", "applicant_job_title_snapshot")
    op.drop_column("application", "applicant_phone_snapshot")
    op.drop_column("application", "applicant_department_snapshot")
    op.drop_column("application", "applicant_name_snapshot")
    op.drop_column("application", "title")

    op.drop_column("sys_user", "job_title")
    op.drop_column("sys_user", "mobile_phone")
    op.drop_column("sys_user", "section_name")
    op.drop_column("sys_user", "department_name")
