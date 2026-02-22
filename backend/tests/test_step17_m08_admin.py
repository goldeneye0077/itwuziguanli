from __future__ import annotations

import os
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import hash_password
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models.application import Application
from app.models.catalog import Category, Sku
from app.models.enums import (
    AnnouncementStatus,
    ApplicationStatus,
    ApplicationType,
    AssetStatus,
    DeliveryType,
)
from app.models.inventory import Asset
from app.models.organization import Department, SysUser
from app.models.portal import Announcement
from app.models.rbac import (
    RbacPermission,
    RbacRole,
    RbacRolePermission,
    RbacUiGuard,
    RbacUserRole,
)


def _seed_data(session: Session) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)

    session.add_all(
        [
            Department(id=1, name="IT"),
            Department(id=2, name="Finance"),
        ]
    )
    session.add_all(
        [
            SysUser(
                id=1,
                employee_no="S0001",
                name="Step17 Super Admin",
                department_id=1,
                email="step17.super@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=2,
                employee_no="A0001",
                name="Step17 Admin",
                department_id=1,
                email="step17.admin@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=3,
                employee_no="U0001",
                name="Step17 User",
                department_id=2,
                email="step17.user@example.com",
                password_hash=hash_password("User12345"),
            ),
        ]
    )

    session.add_all(
        [
            RbacRole(id=1, role_key="USER", role_name="User", is_system=True),
            RbacRole(id=2, role_key="ADMIN", role_name="Admin", is_system=True),
            RbacRole(
                id=3,
                role_key="SUPER_ADMIN",
                role_name="Super Admin",
                is_system=True,
            ),
        ]
    )
    session.add_all(
        [
            RbacPermission(
                id=1,
                resource="OUTBOUND",
                action="CONFIRM_PICKUP",
                name="OUTBOUND:CONFIRM_PICKUP",
            ),
            RbacPermission(
                id=2,
                resource="ANALYTICS",
                action="READ",
                name="ANALYTICS:READ",
            ),
            RbacPermission(
                id=3,
                resource="RBAC_ADMIN",
                action="UPDATE",
                name="RBAC_ADMIN:UPDATE",
            ),
            RbacPermission(
                id=4,
                resource="INVENTORY",
                action="READ",
                name="INVENTORY:READ",
            ),
        ]
    )
    session.add_all(
        [
            RbacRolePermission(id=1, role_id=2, permission_id=1, created_at=now),
            RbacRolePermission(id=2, role_id=3, permission_id=1, created_at=now),
            RbacRolePermission(id=3, role_id=3, permission_id=2, created_at=now),
            RbacRolePermission(id=4, role_id=2, permission_id=4, created_at=now),
            RbacRolePermission(id=5, role_id=3, permission_id=3, created_at=now),
            RbacRolePermission(id=6, role_id=3, permission_id=4, created_at=now),
        ]
    )
    session.add_all(
        [
            RbacUserRole(id=1, user_id=1, role_id=3, created_at=now),
            RbacUserRole(id=2, user_id=2, role_id=2, created_at=now),
            RbacUserRole(id=3, user_id=3, role_id=1, created_at=now),
        ]
    )

    session.add_all(
        [
            Category(id=1, name="Laptop", parent_id=None),
            Category(id=2, name="Peripheral", parent_id=None),
        ]
    )
    session.add_all(
        [
            Sku(
                id=1,
                category_id=1,
                brand="Lenovo",
                model="T14",
                spec="i7/32G/1T",
                reference_price=Decimal("8999.00"),
                cover_url=None,
                safety_stock_threshold=2,
            ),
            Sku(
                id=2,
                category_id=2,
                brand="Dell",
                model="P2422",
                spec="24inch",
                reference_price=Decimal("1599.00"),
                cover_url=None,
                safety_stock_threshold=1,
            ),
        ]
    )

    session.add_all(
        [
            Asset(
                id=1,
                asset_tag="AT-000001",
                sku_id=1,
                sn="SN-STEP17-001",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=2,
                asset_tag="AT-000002",
                sku_id=2,
                sn="SN-STEP17-002",
                status=AssetStatus.IN_USE,
                holder_user_id=3,
                locked_application_id=None,
                inbound_at=now,
            ),
        ]
    )

    session.add(
        Application(
            id=1,
            applicant_user_id=3,
            type=ApplicationType.APPLY,
            status=ApplicationStatus.READY_OUTBOUND,
            delivery_type=DeliveryType.PICKUP,
            pickup_code="123456",
            pickup_qr_string="QR-STEP17-001",
        )
    )

    session.add_all(
        [
            Announcement(
                id=1,
                title="Published announcement",
                content="Step17 published content",
                author_user_id=1,
                status=AnnouncementStatus.PUBLISHED,
                published_at=now,
            ),
            Announcement(
                id=2,
                title="Draft announcement",
                content="Step17 draft content",
                author_user_id=1,
                status=AnnouncementStatus.DRAFT,
                published_at=None,
            ),
        ]
    )

    session.commit()


def _build_client() -> tuple[TestClient, sessionmaker[Session]]:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step17-test-secret"
    os.environ["REFRESH_COOKIE_SECURE"] = "0"
    get_settings.cache_clear()

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=Session,
    )

    with test_session_factory() as seed_session:
        _seed_data(seed_session)

    def _override_db():
        with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = _override_db
    return TestClient(app), test_session_factory


def _login_and_get_access_token(client: TestClient, employee_no: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"employee_no": employee_no, "password": "User12345"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    return payload["data"]["access_token"]


def test_m08_rbac_happy_path_and_deterministic_replacement() -> None:
    client, session_factory = _build_client()

    with client:
        super_admin_token = _login_and_get_access_token(client, "S0001")
        headers = {"Authorization": f"Bearer {super_admin_token}"}

        list_roles_response = client.get("/api/v1/admin/rbac/roles", headers=headers)
        assert list_roles_response.status_code == 200
        list_roles_payload = list_roles_response.json()
        assert list_roles_payload["success"] is True
        assert any(role["key"] == "SUPER_ADMIN" for role in list_roles_payload["data"])

        create_role_response = client.post(
            "/api/v1/admin/rbac/roles",
            headers=headers,
            json={"key": "auditor", "name": "Auditor"},
        )
        assert create_role_response.status_code == 200
        create_role_payload = create_role_response.json()
        assert create_role_payload["success"] is True
        assert create_role_payload["data"]["key"] == "AUDITOR"

        bind_permissions_response = client.post(
            "/api/v1/admin/rbac/role-bindings",
            headers=headers,
            json={
                "role_key": "AUDITOR",
                "permissions": [
                    {"resource": "REPORTS", "actions": ["READ", "EXPORT"]},
                    {"resource": "USERS", "actions": ["READ"]},
                ],
            },
        )
        assert bind_permissions_response.status_code == 200
        bind_permissions_payload = bind_permissions_response.json()
        assert bind_permissions_payload["success"] is True
        assert bind_permissions_payload["data"]["permission_count"] == 3

        replace_bindings_response = client.post(
            "/api/v1/admin/rbac/role-bindings",
            headers=headers,
            json={
                "role_key": "AUDITOR",
                "permissions": [{"resource": "REPORTS", "actions": ["READ"]}],
            },
        )
        assert replace_bindings_response.status_code == 200
        replace_bindings_payload = replace_bindings_response.json()
        assert replace_bindings_payload["success"] is True
        assert replace_bindings_payload["data"]["permission_count"] == 1

        list_permissions_response = client.get(
            "/api/v1/admin/rbac/permissions",
            headers=headers,
        )
        assert list_permissions_response.status_code == 200
        list_permissions_payload = list_permissions_response.json()
        assert list_permissions_payload["success"] is True
        permission_pairs = {
            (item["resource"], item["action"])
            for item in list_permissions_payload["data"]
        }
        assert ("REPORTS", "READ") in permission_pairs
        assert ("REPORTS", "EXPORT") in permission_pairs
        permission_by_code = {
            item["code"]: item for item in list_permissions_payload["data"]
        }
        assert "RBAC_ADMIN:UPDATE" in permission_by_code
        assert "INVENTORY:READ" in permission_by_code
        assert "OUTBOUND:READ" in permission_by_code
        assert permission_by_code["RBAC_ADMIN:UPDATE"]["is_builtin"] is True
        assert permission_by_code["RBAC_ADMIN:UPDATE"]["zh_description"]
        assert "/admin/rbac" in permission_by_code["RBAC_ADMIN:UPDATE"]["route_refs"]
        assert "outbound.fetch-records" in permission_by_code["OUTBOUND:READ"]["action_refs"]

        get_user_roles_before_replace_response = client.get(
            "/api/v1/admin/users/3/roles",
            headers=headers,
        )
        assert get_user_roles_before_replace_response.status_code == 200
        get_user_roles_before_replace_payload = (
            get_user_roles_before_replace_response.json()
        )
        assert get_user_roles_before_replace_payload["success"] is True
        assert get_user_roles_before_replace_payload["data"]["user_id"] == 3
        assert get_user_roles_before_replace_payload["data"]["employee_no"] == "U0001"
        assert get_user_roles_before_replace_payload["data"]["roles"] == ["USER"]

        list_ui_guards_response = client.get("/api/v1/rbac/ui-guards", headers=headers)
        assert list_ui_guards_response.status_code == 200
        list_ui_guards_payload = list_ui_guards_response.json()
        assert list_ui_guards_payload["success"] is True
        default_route_keys = {
            item["key"] for item in list_ui_guards_payload["data"]["routes"]
        }
        default_action_keys = {
            item["key"] for item in list_ui_guards_payload["data"]["actions"]
        }
        assert "/admin/rbac" in default_route_keys
        assert "rbac.save-role-permissions" in default_action_keys

        replace_ui_guards_response = client.put(
            "/api/v1/admin/rbac/ui-guards",
            headers=headers,
            json={
                "routes": [
                    {"key": "/materials", "required_permissions": ["INVENTORY:READ"]},
                    {"key": "/inventory", "required_permissions": ["INVENTORY:READ"]},
                ],
                "actions": [
                    {
                        "key": "materials.manage-skus",
                        "required_permissions": ["INVENTORY:WRITE"],
                    }
                ],
            },
        )
        assert replace_ui_guards_response.status_code == 200
        replace_ui_guards_payload = replace_ui_guards_response.json()
        assert replace_ui_guards_payload["success"] is True
        assert replace_ui_guards_payload["data"]["routes"] == [
            {"key": "/inventory", "required_permissions": ["INVENTORY:READ"]},
            {"key": "/materials", "required_permissions": ["INVENTORY:READ"]},
        ]
        assert replace_ui_guards_payload["data"]["actions"] == [
            {"key": "materials.manage-skus", "required_permissions": ["INVENTORY:WRITE"]}
        ]

        list_ui_guards_after_replace_response = client.get(
            "/api/v1/rbac/ui-guards",
            headers=headers,
        )
        assert list_ui_guards_after_replace_response.status_code == 200
        list_ui_guards_after_replace_payload = (
            list_ui_guards_after_replace_response.json()
        )
        assert list_ui_guards_after_replace_payload["success"] is True
        assert list_ui_guards_after_replace_payload["data"]["routes"] == [
            {"key": "/inventory", "required_permissions": ["INVENTORY:READ"]},
            {"key": "/materials", "required_permissions": ["INVENTORY:READ"]},
        ]
        assert list_ui_guards_after_replace_payload["data"]["actions"] == [
            {"key": "materials.manage-skus", "required_permissions": ["INVENTORY:WRITE"]}
        ]

        replace_user_roles_response = client.put(
            "/api/v1/admin/users/3/roles",
            headers=headers,
            json={"roles": ["USER", "AUDITOR", "USER"]},
        )
        assert replace_user_roles_response.status_code == 200
        replace_user_roles_payload = replace_user_roles_response.json()
        assert replace_user_roles_payload["success"] is True
        assert replace_user_roles_payload["data"]["roles"] == ["AUDITOR", "USER"]

        get_user_roles_after_replace_response = client.get(
            "/api/v1/admin/users/3/roles",
            headers=headers,
        )
        assert get_user_roles_after_replace_response.status_code == 200
        get_user_roles_after_replace_payload = get_user_roles_after_replace_response.json()
        assert get_user_roles_after_replace_payload["success"] is True
        assert get_user_roles_after_replace_payload["data"]["roles"] == ["AUDITOR", "USER"]

    with session_factory() as session:
        auditor_role_id = session.scalar(
            select(RbacRole.id).where(RbacRole.role_key == "AUDITOR")
        )
        assert auditor_role_id is not None

        bound_permission_pairs = session.execute(
            select(RbacPermission.resource, RbacPermission.action)
            .join(
                RbacRolePermission,
                RbacRolePermission.permission_id == RbacPermission.id,
            )
            .where(RbacRolePermission.role_id == auditor_role_id)
            .order_by(RbacPermission.resource.asc(), RbacPermission.action.asc())
        ).all()
        assert bound_permission_pairs == [("REPORTS", "READ")]

        user_role_keys = session.scalars(
            select(RbacRole.role_key)
            .join(RbacUserRole, RbacUserRole.role_id == RbacRole.id)
            .where(RbacUserRole.user_id == 3)
            .order_by(RbacRole.role_key.asc())
        ).all()
        assert user_role_keys == ["AUDITOR", "USER"]

        ui_guards = session.scalars(
            select(RbacUiGuard)
            .order_by(RbacUiGuard.guard_type.asc(), RbacUiGuard.guard_key.asc())
        ).all()
        assert [
            (item.guard_type, item.guard_key, item.required_permissions)
            for item in ui_guards
        ] == [
            ("ACTION", "materials.manage-skus", "INVENTORY:WRITE"),
            ("ROUTE", "/inventory", "INVENTORY:READ"),
            ("ROUTE", "/materials", "INVENTORY:READ"),
        ]


def test_m08_crud_resources_and_role_guards() -> None:
    client, _ = _build_client()

    with client:
        super_admin_token = _login_and_get_access_token(client, "S0001")
        admin_token = _login_and_get_access_token(client, "A0001")
        user_token = _login_and_get_access_token(client, "U0001")
        super_headers = {"Authorization": f"Bearer {super_admin_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        user_headers = {"Authorization": f"Bearer {user_token}"}

        resources = [
            "users",
            "categories",
            "skus",
            "assets",
            "applications",
            "announcements",
        ]
        for resource in resources:
            response = client.get(
                f"/api/v1/admin/crud/{resource}?page=1&page_size=2",
                headers=super_headers,
            )
            assert response.status_code == 200
            payload = response.json()
            assert payload["success"] is True
            assert payload["data"]["resource"] == resource
            assert payload["data"]["meta"]["page"] == 1
            assert payload["data"]["meta"]["page_size"] == 2
            assert isinstance(payload["data"]["items"], list)

        filter_users_response = client.get(
            "/api/v1/admin/crud/users?q=admin&page=1&page_size=20",
            headers=super_headers,
        )
        assert filter_users_response.status_code == 200
        filter_users_payload = filter_users_response.json()
        filtered_employee_nos = {
            item["employee_no"] for item in filter_users_payload["data"]["items"]
        }
        assert "A0001" in filtered_employee_nos

        create_category_response = client.post(
            "/api/v1/admin/crud/categories",
            headers=super_headers,
            json={"name": "Step17Category", "parent_id": None},
        )
        assert create_category_response.status_code == 200
        created_category = create_category_response.json()["data"]["item"]
        assert created_category["name"] == "Step17Category"

        update_category_response = client.put(
            f"/api/v1/admin/crud/categories/{created_category['id']}",
            headers=super_headers,
            json={"name": "Step17CategoryUpdated"},
        )
        assert update_category_response.status_code == 200
        assert (
            update_category_response.json()["data"]["item"]["name"]
            == "Step17CategoryUpdated"
        )

        delete_category_response = client.delete(
            f"/api/v1/admin/crud/categories/{created_category['id']}",
            headers=super_headers,
        )
        assert delete_category_response.status_code == 200
        assert delete_category_response.json()["data"]["deleted"] is True

        create_application_response = client.post(
            "/api/v1/admin/crud/applications",
            headers=super_headers,
            json={
                "applicant_user_id": 3,
                "type": "APPLY",
                "delivery_type": "PICKUP",
                "title": "Step17 CRUD Application",
            },
        )
        assert create_application_response.status_code == 200
        created_application = create_application_response.json()["data"]["item"]
        assert created_application["title"] == "Step17 CRUD Application"

        update_application_response = client.put(
            f"/api/v1/admin/crud/applications/{created_application['id']}",
            headers=super_headers,
            json={"status": "DONE"},
        )
        assert update_application_response.status_code == 200
        assert update_application_response.json()["data"]["item"]["status"] == "DONE"

        delete_application_response = client.delete(
            f"/api/v1/admin/crud/applications/{created_application['id']}",
            headers=super_headers,
        )
        assert delete_application_response.status_code == 200
        delete_application_payload = delete_application_response.json()
        assert delete_application_payload["data"]["deleted"] is True
        assert delete_application_payload["data"]["status"] == "CANCELLED"

        create_announcement_response = client.post(
            "/api/v1/admin/crud/announcements",
            headers=super_headers,
            json={
                "title": "Step17 Announcement",
                "content": "Step17 Announcement Content",
                "author_user_id": 1,
                "status": "DRAFT",
            },
        )
        assert create_announcement_response.status_code == 200
        created_announcement = create_announcement_response.json()["data"]["item"]
        assert created_announcement["title"] == "Step17 Announcement"

        update_announcement_response = client.put(
            f"/api/v1/admin/crud/announcements/{created_announcement['id']}",
            headers=super_headers,
            json={"status": "PUBLISHED"},
        )
        assert update_announcement_response.status_code == 200
        assert (
            update_announcement_response.json()["data"]["item"]["status"] == "PUBLISHED"
        )

        delete_announcement_response = client.delete(
            f"/api/v1/admin/crud/announcements/{created_announcement['id']}",
            headers=super_headers,
        )
        assert delete_announcement_response.status_code == 200
        assert delete_announcement_response.json()["data"]["deleted"] is True

        forbidden_rbac_response = client.get("/api/v1/admin/rbac/roles", headers=admin_headers)
        assert forbidden_rbac_response.status_code == 403
        assert forbidden_rbac_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        user_list_ui_guards_response = client.get(
            "/api/v1/rbac/ui-guards",
            headers=user_headers,
        )
        assert user_list_ui_guards_response.status_code == 200
        assert user_list_ui_guards_response.json()["success"] is True

        forbidden_crud_response = client.get(
            "/api/v1/admin/crud/users",
            headers=admin_headers,
        )
        assert forbidden_crud_response.status_code == 403
        assert forbidden_crud_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        forbidden_crud_response = client.get(
            "/api/v1/admin/crud/users",
            headers=user_headers,
        )
        assert forbidden_crud_response.status_code == 403
        assert forbidden_crud_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"


def test_m08_validation_and_error_branches() -> None:
    client, _ = _build_client()

    with client:
        super_admin_token = _login_and_get_access_token(client, "S0001")
        headers = {"Authorization": f"Bearer {super_admin_token}"}

        duplicate_role_response = client.post(
            "/api/v1/admin/rbac/roles",
            headers=headers,
            json={"key": "ADMIN", "name": "Duplicate Admin"},
        )
        assert duplicate_role_response.status_code == 400
        assert duplicate_role_response.json()["error"]["code"] == "VALIDATION_ERROR"

        missing_role_binding_response = client.post(
            "/api/v1/admin/rbac/role-bindings",
            headers=headers,
            json={
                "role_key": "NOT_EXISTS",
                "permissions": [{"resource": "USERS", "actions": ["READ"]}],
            },
        )
        assert missing_role_binding_response.status_code == 404
        assert (
            missing_role_binding_response.json()["error"]["code"]
            == "RESOURCE_NOT_FOUND"
        )

        unknown_role_update_response = client.put(
            "/api/v1/admin/users/3/roles",
            headers=headers,
            json={"roles": ["UNKNOWN_ROLE"]},
        )
        assert unknown_role_update_response.status_code == 400
        assert (
            unknown_role_update_response.json()["error"]["code"] == "VALIDATION_ERROR"
        )

        missing_user_response = client.put(
            "/api/v1/admin/users/999/roles",
            headers=headers,
            json={"roles": ["USER"]},
        )
        assert missing_user_response.status_code == 404
        assert missing_user_response.json()["error"]["code"] == "USER_NOT_FOUND"

        missing_user_roles_state_response = client.get(
            "/api/v1/admin/users/999/roles",
            headers=headers,
        )
        assert missing_user_roles_state_response.status_code == 404
        assert (
            missing_user_roles_state_response.json()["error"]["code"] == "USER_NOT_FOUND"
        )

        invalid_resource_response = client.get(
            "/api/v1/admin/crud/unknown",
            headers=headers,
        )
        assert invalid_resource_response.status_code == 400
        assert invalid_resource_response.json()["error"]["code"] == "VALIDATION_ERROR"
