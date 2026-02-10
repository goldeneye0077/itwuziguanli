from __future__ import annotations

import argparse
import os
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, TypeVar

from collections.abc import Callable

from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.auth import hash_password, verify_password
from app.models.application import (
    Application,
    ApplicationAsset,
    ApplicationItem,
    ApprovalHistory,
    Logistics,
)
from app.models.catalog import Category, Sku
from app.models.enums import (
    AnnouncementStatus,
    ApplicationStatus,
    ApplicationType,
    ApprovalAction,
    ApprovalNode,
    AssetStatus,
    DeliveryType,
    NotifyChannel,
    NotifyStatus,
    OcrDocType,
    OcrJobStatus,
    StockFlowAction,
    TokenBlacklistReason,
)
from app.models.inbound import OcrInboundJob
from app.models.inventory import Asset, StockFlow
from app.models.notification import NotificationOutbox, UserAddress
from app.models.organization import Department, SysUser
from app.models.portal import Announcement, HeroBanner
from app.models.rbac import RbacPermission, RbacRole, RbacRolePermission, RbacUserRole
from app.models.security import AuditLog, TokenBlacklist


SEED_TAG = "demo_seed_v1"

T = TypeVar("T")


def _connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _ensure_by_pk(
    session: Session,
    model_cls: type[T],
    pk: Any,
    create: Callable[[], T],
) -> T:
    existing = session.get(model_cls, pk)
    if existing is not None:
        return existing
    obj = create()
    session.add(obj)
    return obj


def _asset_tag_from_id(asset_id: int) -> str:
    return f"AT-{asset_id:06d}"


def _run_migrations(database_url: str) -> None:
    from alembic import command
    from alembic.config import Config

    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")


def seed_demo_data(session: Session, *, seed_password: str) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    yesterday = now - timedelta(days=1)
    last_week = now - timedelta(days=7)

    # Departments
    def ensure_department(*, dept_id: int, name: str) -> Department:
        existing = session.scalar(
            select(Department).where(Department.name == name).limit(1)
        )
        if existing is not None:
            return existing
        dept = Department(id=dept_id, name=name, parent_id=None, manager_user_id=None)
        session.add(dept)
        return dept

    dept_it = ensure_department(dept_id=1001, name="\u4fe1\u606f\u6280\u672f\u90e8")
    dept_fin = ensure_department(dept_id=1002, name="\u8d22\u52a1\u90e8")
    dept_hr = ensure_department(dept_id=1003, name="\u4eba\u529b\u8d44\u6e90\u90e8")
    dept_admin = ensure_department(dept_id=1004, name="\u884c\u653f\u540e\u52e4\u90e8")
    dept_rd = ensure_department(dept_id=1005, name="\u7814\u53d1\u90e8")

    # Break circular FK dependency:
    # - sys_user.department_id -> department.id
    # - department.manager_user_id -> sys_user.id
    # Persist departments without managers first.
    session.flush()

    # Users (ensure demo password is usable)
    def ensure_user(
        *,
        user_id: int,
        employee_no: str,
        name: str,
        department_id: int,
        email: str,
    ) -> SysUser:
        user = session.scalar(
            select(SysUser).where(SysUser.employee_no == employee_no).limit(1)
        )
        if user is None:
            user = SysUser(
                id=user_id,
                employee_no=employee_no,
                name=name,
                department_id=department_id,
                email=email,
                password_hash=hash_password(seed_password),
            )
            session.add(user)
            return user
        if not verify_password(seed_password, user.password_hash):
            user.password_hash = hash_password(seed_password)
        return user

    user_super = ensure_user(
        user_id=2001,
        employee_no="SA0001",
        name="\u8d85\u7ea7\u7ba1\u7406\u5458",
        department_id=dept_it.id,
        email="sa0001@example.com",
    )
    user_admin = ensure_user(
        user_id=2002,
        employee_no="A0001",
        name="\u7cfb\u7edf\u7ba1\u7406\u5458",
        department_id=dept_it.id,
        email="a0001@example.com",
    )
    user_leader = ensure_user(
        user_id=2003,
        employee_no="L0001",
        name="\u90e8\u95e8\u4e3b\u7ba1",
        department_id=dept_rd.id,
        email="l0001@example.com",
    )
    user_demo = ensure_user(
        user_id=2004,
        employee_no="U0001",
        name="\u5f20\u4f1f",
        department_id=dept_rd.id,
        email="u0001@example.com",
    )
    user_fin = ensure_user(
        user_id=2005,
        employee_no="U0002",
        name="\u674e\u5a1c",
        department_id=dept_fin.id,
        email="u0002@example.com",
    )
    user_warehouse = ensure_user(
        user_id=2006,
        employee_no="W0001",
        name="\u5e93\u7ba1\u5458",
        department_id=dept_admin.id,
        email="w0001@example.com",
    )

    # Persist users so departments can reference manager_user_id.
    session.flush()

    dept_it.manager_user_id = user_admin.id
    dept_fin.manager_user_id = user_fin.id
    dept_hr.manager_user_id = user_admin.id
    dept_admin.manager_user_id = user_warehouse.id
    dept_rd.manager_user_id = user_leader.id

    # Persist manager assignments.
    session.flush()

    # RBAC roles/permissions use unique keys, so ensure by business key first.
    def ensure_role(
        *,
        role_id: int,
        role_key: str,
        role_name: str,
        description: str,
        is_system: bool,
    ) -> RbacRole:
        existing = session.scalar(
            select(RbacRole).where(RbacRole.role_key == role_key).limit(1)
        )
        if existing is not None:
            return existing
        role = RbacRole(
            id=role_id,
            role_key=role_key,
            role_name=role_name,
            description=description,
            is_system=is_system,
        )
        session.add(role)
        return role

    def ensure_permission(
        *,
        permission_id: int,
        resource: str,
        action: str,
        name: str,
        description: str,
    ) -> RbacPermission:
        existing = session.scalar(
            select(RbacPermission)
            .where(RbacPermission.resource == resource, RbacPermission.action == action)
            .limit(1)
        )
        if existing is not None:
            return existing
        perm = RbacPermission(
            id=permission_id,
            resource=resource,
            action=action,
            name=name,
            description=description,
        )
        session.add(perm)
        return perm

    def ensure_role_permission(
        *, mapping_id: int, role_id: int, permission_id: int
    ) -> RbacRolePermission:
        existing = session.scalar(
            select(RbacRolePermission)
            .where(
                RbacRolePermission.role_id == role_id,
                RbacRolePermission.permission_id == permission_id,
            )
            .limit(1)
        )
        if existing is not None:
            return existing
        row = RbacRolePermission(
            id=mapping_id,
            role_id=role_id,
            permission_id=permission_id,
            created_at=now,
        )
        session.add(row)
        return row

    role_super = ensure_role(
        role_id=3001,
        role_key="SUPER_ADMIN",
        role_name="\u8d85\u7ea7\u7ba1\u7406\u5458",
        description="\u62e5\u6709\u6240\u6709\u7ba1\u7406\u6743\u9650\u3002",
        is_system=True,
    )
    role_admin = ensure_role(
        role_id=3002,
        role_key="ADMIN",
        role_name="\u7ba1\u7406\u5458",
        description="\u7ba1\u7406\u4e0e\u5ba1\u6279\u76f8\u5173\u64cd\u4f5c\u3002",
        is_system=True,
    )
    role_leader = ensure_role(
        role_id=3003,
        role_key="LEADER",
        role_name="\u90e8\u95e8\u4e3b\u7ba1",
        description="\u90e8\u95e8\u7533\u8bf7\u521d\u5ba1\u3002",
        is_system=True,
    )
    role_user = ensure_role(
        role_id=3004,
        role_key="USER",
        role_name="\u666e\u901a\u7528\u6237",
        description="\u53ef\u53d1\u8d77\u7533\u8bf7\u5e76\u67e5\u770b\u8fdb\u5ea6\u3002",
        is_system=True,
    )

    # RBAC permissions (minimal but representative)
    perm_rbac_update = ensure_permission(
        permission_id=4001,
        resource="RBAC_ADMIN",
        action="UPDATE",
        name="RBAC_ADMIN_UPDATE",
        description="\u7ba1\u7406\u6743\u9650\u914d\u7f6e\u3002",
    )
    perm_inventory_read = ensure_permission(
        permission_id=4002,
        resource="INVENTORY",
        action="READ",
        name="INVENTORY_READ",
        description="\u67e5\u770b\u5e93\u5b58\u4e0e\u8d44\u4ea7\u3002",
    )
    perm_inventory_write = ensure_permission(
        permission_id=4003,
        resource="INVENTORY",
        action="WRITE",
        name="INVENTORY_WRITE",
        description="\u7ef4\u62a4\u5e93\u5b58\u4e0e\u8d44\u4ea7\u3002",
    )
    perm_reports_read = ensure_permission(
        permission_id=4004,
        resource="REPORTS",
        action="READ",
        name="REPORTS_READ",
        description="\u67e5\u770b\u62a5\u8868\u4e0e\u5206\u6790\u3002",
    )

    # Role-permission mapping
    ensure_role_permission(
        mapping_id=5001,
        role_id=role_super.id,
        permission_id=perm_rbac_update.id,
    )
    ensure_role_permission(
        mapping_id=5002,
        role_id=role_admin.id,
        permission_id=perm_inventory_read.id,
    )
    ensure_role_permission(
        mapping_id=5003,
        role_id=role_admin.id,
        permission_id=perm_inventory_write.id,
    )
    ensure_role_permission(
        mapping_id=5004,
        role_id=role_admin.id,
        permission_id=perm_reports_read.id,
    )

    # User-role mapping
    def ensure_user_role(
        *, mapping_id: int, user_id: int, role_id: int
    ) -> RbacUserRole:
        existing = session.scalar(
            select(RbacUserRole)
            .where(RbacUserRole.user_id == user_id, RbacUserRole.role_id == role_id)
            .limit(1)
        )
        if existing is not None:
            return existing
        row = RbacUserRole(
            id=mapping_id,
            user_id=user_id,
            role_id=role_id,
            created_at=now,
        )
        session.add(row)
        return row

    ensure_user_role(mapping_id=6001, user_id=user_super.id, role_id=role_super.id)
    ensure_user_role(mapping_id=6002, user_id=user_admin.id, role_id=role_admin.id)
    ensure_user_role(mapping_id=6003, user_id=user_leader.id, role_id=role_leader.id)
    ensure_user_role(mapping_id=6004, user_id=user_demo.id, role_id=role_user.id)
    ensure_user_role(mapping_id=6005, user_id=user_fin.id, role_id=role_user.id)
    ensure_user_role(mapping_id=6006, user_id=user_warehouse.id, role_id=role_admin.id)

    # Categories
    cat_compute = _ensure_by_pk(
        session,
        Category,
        7001,
        lambda: Category(id=7001, name="\u8ba1\u7b97\u8bbe\u5907", parent_id=None),
    )
    cat_laptop = _ensure_by_pk(
        session,
        Category,
        7002,
        lambda: Category(
            id=7002, name="\u7b14\u8bb0\u672c\u7535\u8111", parent_id=cat_compute.id
        ),
    )
    cat_display = _ensure_by_pk(
        session,
        Category,
        7003,
        lambda: Category(id=7003, name="\u663e\u793a\u8bbe\u5907", parent_id=None),
    )
    cat_monitor = _ensure_by_pk(
        session,
        Category,
        7004,
        lambda: Category(id=7004, name="\u663e\u793a\u5668", parent_id=cat_display.id),
    )
    cat_peripheral = _ensure_by_pk(
        session,
        Category,
        7005,
        lambda: Category(id=7005, name="\u529e\u516c\u5916\u8bbe", parent_id=None),
    )
    cat_keyboard_mouse = _ensure_by_pk(
        session,
        Category,
        7006,
        lambda: Category(id=7006, name="\u952e\u9f20", parent_id=cat_peripheral.id),
    )

    # SKUs
    sku_laptop = _ensure_by_pk(
        session,
        Sku,
        8001,
        lambda: Sku(
            id=8001,
            category_id=cat_laptop.id,
            brand="\u8054\u60f3",
            model="ThinkPad T14",
            spec="i7/32G/1T",
            reference_price=Decimal("8999.00"),
            cover_url=None,
            safety_stock_threshold=2,
        ),
    )
    sku_monitor = _ensure_by_pk(
        session,
        Sku,
        8002,
        lambda: Sku(
            id=8002,
            category_id=cat_monitor.id,
            brand="Dell",
            model="U2723QE",
            spec="27\u82f1\u5bf8 4K",
            reference_price=Decimal("2999.00"),
            cover_url=None,
            safety_stock_threshold=2,
        ),
    )
    sku_keyboard = _ensure_by_pk(
        session,
        Sku,
        8003,
        lambda: Sku(
            id=8003,
            category_id=cat_keyboard_mouse.id,
            brand="Logitech",
            model="MX Keys",
            spec="\u65e0\u7ebf\u952e\u76d8",
            reference_price=Decimal("799.00"),
            cover_url=None,
            safety_stock_threshold=5,
        ),
    )
    sku_mouse = _ensure_by_pk(
        session,
        Sku,
        8004,
        lambda: Sku(
            id=8004,
            category_id=cat_keyboard_mouse.id,
            brand="Logitech",
            model="MX Master 3S",
            spec="\u65e0\u7ebf\u9f20\u6807",
            reference_price=Decimal("699.00"),
            cover_url=None,
            safety_stock_threshold=5,
        ),
    )

    # Assets
    assets = [
        (9001, sku_laptop.id, "SN-DEMO-9001", AssetStatus.IN_STOCK, None),
        (9002, sku_laptop.id, "SN-DEMO-9002", AssetStatus.IN_USE, user_demo.id),
        (9003, sku_laptop.id, "SN-DEMO-9003", AssetStatus.REPAIRING, None),
        (9004, sku_monitor.id, "SN-DEMO-9004", AssetStatus.IN_STOCK, None),
        (9005, sku_monitor.id, "SN-DEMO-9005", AssetStatus.IN_STOCK, None),
        (9006, sku_keyboard.id, "SN-DEMO-9006", AssetStatus.IN_STOCK, None),
        (9007, sku_mouse.id, "SN-DEMO-9007", AssetStatus.IN_STOCK, None),
    ]
    for asset_id, sku_id, sn, status, holder_user_id in assets:
        _ensure_by_pk(
            session,
            Asset,
            asset_id,
            lambda asset_id=asset_id,
            sku_id=sku_id,
            sn=sn,
            status=status,
            holder_user_id=holder_user_id: Asset(
                id=asset_id,
                asset_tag=_asset_tag_from_id(asset_id),
                sku_id=sku_id,
                sn=sn,
                status=status,
                holder_user_id=holder_user_id,
                locked_application_id=None,
                inbound_at=last_week,
            ),
        )

    # Portal content
    _ensure_by_pk(
        session,
        HeroBanner,
        17001,
        lambda: HeroBanner(
            id=17001,
            title="IT \u8d44\u4ea7\u5168\u751f\u547d\u5468\u671f\u7cfb\u7edf",
            subtitle="\u7edf\u4e00\u7533\u8bf7\u3001\u5ba1\u6279\u4e0e\u751f\u547d\u5468\u671f\u53ef\u89c6\u5316\u3002",
            image_url=None,
            link_url=None,
            is_active=True,
            display_order=0,
        ),
    )
    _ensure_by_pk(
        session,
        Announcement,
        16001,
        lambda: Announcement(
            id=16001,
            title="\u7cfb\u7edf\u5185\u6d4b\u5f00\u542f\u901a\u77e5",
            content="\u6b22\u8fce\u4f7f\u7528 IT \u8d44\u4ea7\u5168\u751f\u547d\u5468\u671f\u7cfb\u7edf\uff0c\u4eca\u65e5\u8d77\u5f00\u653e\u5185\u6d4b\u3002",
            author_user_id=user_admin.id,
            status=AnnouncementStatus.PUBLISHED,
            published_at=yesterday,
        ),
    )
    _ensure_by_pk(
        session,
        Announcement,
        16002,
        lambda: Announcement(
            id=16002,
            title="\u4f18\u5316\u4e2d\u7684\u529f\u80fd\u9884\u544a",
            content="\u8fd1\u671f\u5c06\u4e0a\u7ebf\u66f4\u591a\u62a5\u8868\u4e0e\u8fdb\u7ea7\u6743\u9650\u7ba1\u7406\u3002",
            author_user_id=user_admin.id,
            status=AnnouncementStatus.DRAFT,
            published_at=None,
        ),
    )

    # User address
    _ensure_by_pk(
        session,
        UserAddress,
        18001,
        lambda: UserAddress(
            id=18001,
            user_id=user_demo.id,
            receiver_name=user_demo.name,
            receiver_phone="13800000000",
            province="\u4e0a\u6d77\u5e02",
            city="\u4e0a\u6d77\u5e02",
            district="\u6d66\u4e1c\u65b0\u533a",
            detail="\u5f20\u6c5f\u79d1\u6280\u56ed \u0031\u53f7\u697c",
            is_default=True,
        ),
    )

    # Applications
    app_locked = _ensure_by_pk(
        session,
        Application,
        11001,
        lambda: Application(
            id=11001,
            applicant_user_id=user_demo.id,
            type=ApplicationType.APPLY,
            status=ApplicationStatus.LOCKED,
            delivery_type=DeliveryType.PICKUP,
            pickup_code="900001",
            pickup_qr_string=None,
            leader_approver_user_id=None,
            admin_reviewer_user_id=None,
        ),
    )
    app_ready = _ensure_by_pk(
        session,
        Application,
        11002,
        lambda: Application(
            id=11002,
            applicant_user_id=user_fin.id,
            type=ApplicationType.APPLY,
            status=ApplicationStatus.READY_OUTBOUND,
            delivery_type=DeliveryType.PICKUP,
            pickup_code="900002",
            pickup_qr_string="pickup://application/11002?code=900002",
            leader_approver_user_id=user_leader.id,
            admin_reviewer_user_id=user_admin.id,
        ),
    )
    app_done = _ensure_by_pk(
        session,
        Application,
        11003,
        lambda: Application(
            id=11003,
            applicant_user_id=user_demo.id,
            type=ApplicationType.APPLY,
            status=ApplicationStatus.DONE,
            delivery_type=DeliveryType.EXPRESS,
            pickup_code="900003",
            pickup_qr_string=None,
            leader_approver_user_id=user_leader.id,
            admin_reviewer_user_id=user_admin.id,
        ),
    )

    # Application items
    _ensure_by_pk(
        session,
        ApplicationItem,
        12001,
        lambda: ApplicationItem(
            id=12001,
            application_id=app_locked.id,
            sku_id=sku_laptop.id,
            quantity=1,
            note="\u65b0\u5165\u804c\u8bbe\u5907\u914d\u7f6e\u3002",
        ),
    )
    _ensure_by_pk(
        session,
        ApplicationItem,
        12002,
        lambda: ApplicationItem(
            id=12002,
            application_id=app_ready.id,
            sku_id=sku_monitor.id,
            quantity=1,
            note=None,
        ),
    )
    _ensure_by_pk(
        session,
        ApplicationItem,
        12003,
        lambda: ApplicationItem(
            id=12003,
            application_id=app_done.id,
            sku_id=sku_keyboard.id,
            quantity=1,
            note=None,
        ),
    )

    # Lock assets to applications (ensure inventory state for demo)
    asset_9001 = session.get(Asset, 9001)
    if asset_9001 is not None and asset_9001.locked_application_id is None:
        asset_9001.status = AssetStatus.LOCKED
        asset_9001.locked_application_id = app_locked.id
        _ensure_by_pk(
            session,
            ApplicationAsset,
            13001,
            lambda: ApplicationAsset(
                id=13001,
                application_id=app_locked.id,
                asset_id=asset_9001.id,
            ),
        )
        _ensure_by_pk(
            session,
            StockFlow,
            10001,
            lambda: StockFlow(
                id=10001,
                asset_id=asset_9001.id,
                action=StockFlowAction.LOCK,
                operator_user_id=user_demo.id,
                related_application_id=app_locked.id,
                occurred_at=now,
                meta_json={"event": "lock_inventory", "seed": SEED_TAG},
            ),
        )

    asset_9004 = session.get(Asset, 9004)
    if asset_9004 is not None and asset_9004.locked_application_id is None:
        asset_9004.status = AssetStatus.LOCKED
        asset_9004.locked_application_id = app_ready.id
        _ensure_by_pk(
            session,
            ApplicationAsset,
            13002,
            lambda: ApplicationAsset(
                id=13002,
                application_id=app_ready.id,
                asset_id=asset_9004.id,
            ),
        )

    # Approvals
    _ensure_by_pk(
        session,
        ApprovalHistory,
        14001,
        lambda: ApprovalHistory(
            id=14001,
            application_id=app_ready.id,
            node=ApprovalNode.LEADER,
            action=ApprovalAction.APPROVE,
            actor_user_id=user_leader.id,
            comment="\u4e1a\u52a1\u9700\u8981\uff0c\u540c\u610f\u3002",
            ai_recommendation_json={"seed": SEED_TAG},
        ),
    )
    _ensure_by_pk(
        session,
        ApprovalHistory,
        14002,
        lambda: ApprovalHistory(
            id=14002,
            application_id=app_ready.id,
            node=ApprovalNode.ADMIN,
            action=ApprovalAction.APPROVE,
            actor_user_id=user_admin.id,
            comment=None,
            ai_recommendation_json={"seed": SEED_TAG},
        ),
    )

    # Logistics (for shipped/done demo)
    _ensure_by_pk(
        session,
        Logistics,
        15001,
        lambda: Logistics(
            id=15001,
            application_id=app_done.id,
            receiver_name=user_demo.name,
            receiver_phone="13800000000",
            province="\u4e0a\u6d77\u5e02",
            city="\u4e0a\u6d77\u5e02",
            district="\u6d66\u4e1c\u65b0\u533a",
            detail="\u5f20\u6c5f\u79d1\u6280\u56ed \u0031\u53f7\u697c",
            carrier="\u987a\u4e30\u901f\u8fd0",
            tracking_no="SF1234567890",
            shipped_at=yesterday,
        ),
    )

    # OCR inbound job
    _ensure_by_pk(
        session,
        OcrInboundJob,
        20001,
        lambda: OcrInboundJob(
            id=20001,
            operator_user_id=user_warehouse.id,
            source_file_url="/mock-storage/inbound/20001-demo.pdf",
            doc_type=OcrDocType.INVOICE,
            status=OcrJobStatus.READY_FOR_REVIEW,
            extracted_json={
                "seed": SEED_TAG,
                "doc_type": "INVOICE",
                "supplier": "\u6a21\u62df\u4f9b\u5e94\u5546\u6709\u9650\u516c\u53f8",
                "document_no": "MOCK-20001",
                "currency": "CNY",
                "line_items": [
                    {
                        "brand": "\u8054\u60f3",
                        "model": "ThinkPad T14",
                        "spec": "i7/32G/1T",
                        "quantity": 2,
                        "reference_price": "8999.00",
                    }
                ],
            },
            error_message=None,
            confirmed_sku_id=None,
        ),
    )

    # Notification outbox
    _ensure_by_pk(
        session,
        NotificationOutbox,
        19001,
        lambda: NotificationOutbox(
            id=19001,
            channel=NotifyChannel.DINGTALK,
            receiver="demo-webhook",
            template_key="APPROVAL_PENDING",
            payload_json={
                "seed": SEED_TAG,
                "message": "\u60a8\u6709\u4e00\u6761\u5f85\u529e\u7533\u8bf7\u9700\u8981\u5ba1\u6279\u3002",
                "application_id": int(app_locked.id),
            },
            status=NotifyStatus.PENDING,
            retry_count=0,
            last_error=None,
        ),
    )

    # Audit log
    _ensure_by_pk(
        session,
        AuditLog,
        21001,
        lambda: AuditLog(
            id=21001,
            user_id=user_admin.id,
            action="SEED",
            resource_type="SYSTEM",
            resource_id=SEED_TAG,
            ip_address="127.0.0.1",
            user_agent="seed-script",
            request_id=None,
            occurred_at=now,
            meta_json={"seed": SEED_TAG},
        ),
    )

    # Token blacklist
    _ensure_by_pk(
        session,
        TokenBlacklist,
        "seed_demo_jti_001",
        lambda: TokenBlacklist(
            jti="seed_demo_jti_001",
            user_id=user_demo.id,
            revoked_at=now,
            expires_at=now + timedelta(days=1),
            reason=TokenBlacklistReason.LOGOUT,
        ),
    )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed demo data (idempotent).")
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Run alembic migrations before seeding.",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("DEMO_SEED_PASSWORD", "Admin1234"),
        help="Password for demo accounts (default: env DEMO_SEED_PASSWORD or Admin1234).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    engine: Engine = create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args=_connect_args(database_url),
    )

    if args.migrate:
        _run_migrations(database_url)

    with Session(engine) as session:
        seed_demo_data(session, seed_password=args.password)
        session.commit()

    print("Seed complete.")
    print("Demo accounts:")
    print("- SA0001 / %s (SUPER_ADMIN)" % args.password)
    print("- A0001  / %s (ADMIN)" % args.password)
    print("- L0001  / %s (LEADER)" % args.password)
    print("- U0001  / %s (USER)" % args.password)
    print("- U0002  / %s (USER)" % args.password)
    print("- W0001  / %s (ADMIN)" % args.password)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
