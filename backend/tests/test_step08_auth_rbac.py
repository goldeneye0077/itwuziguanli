from __future__ import annotations

import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import hash_password
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models.organization import Department, SysUser
from app.models.rbac import (
    RbacPermission,
    RbacRole,
    RbacRolePermission,
    RbacUserRole,
)


def _seed_data(session: Session) -> None:
    department = Department(id=1, name="IT")
    admin_user = SysUser(
        id=1,
        employee_no="A0001",
        name="Admin",
        department_id=1,
        email="admin@example.com",
        password_hash=hash_password("Admin1234"),
    )
    normal_user = SysUser(
        id=2,
        employee_no="U0001",
        name="User",
        department_id=1,
        email="user@example.com",
        password_hash=hash_password("User12345"),
    )
    admin_role = RbacRole(
        id=1, role_key="ADMIN", role_name="Administrator", is_system=True
    )
    user_role = RbacRole(id=2, role_key="USER", role_name="Normal User", is_system=True)
    permission = RbacPermission(
        id=1,
        resource="RBAC_ADMIN",
        action="UPDATE",
        name="RBAC_ADMIN_UPDATE",
    )
    admin_role_permission = RbacRolePermission(id=1, role_id=1, permission_id=1)
    now = datetime.now(UTC).replace(tzinfo=None)
    admin_user_role = RbacUserRole(id=1, user_id=1, role_id=1, created_at=now)
    normal_user_role = RbacUserRole(id=2, user_id=2, role_id=2, created_at=now)
    session.add_all(
        [
            department,
            admin_user,
            normal_user,
            admin_role,
            user_role,
            permission,
            admin_role_permission,
            admin_user_role,
            normal_user_role,
        ]
    )
    session.commit()


def _build_client() -> TestClient:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step08-test-secret"
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
    return TestClient(app)


def _login_and_get_access_token(
    client: TestClient, employee_no: str, password: str
) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"employee_no": employee_no, "password": password},
    )
    assert response.status_code == 200
    assert response.cookies.get("refresh_token")
    body = response.json()
    assert body["success"] is True
    return body["data"]["access_token"]


def test_protected_endpoint_without_auth_returns_401() -> None:
    with _build_client() as client:
        response = client.put(
            "/api/v1/users/me/password",
            json={"old_password": "User12345", "new_password": "User54321"},
        )

    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] in {
        "UNAUTHORIZED",
        "TOKEN_INVALID",
        "TOKEN_EXPIRED",
        "TOKEN_BLACKLISTED",
    }


def test_normal_user_accessing_admin_reset_returns_403() -> None:
    with _build_client() as client:
        user_access_token = _login_and_get_access_token(client, "U0001", "User12345")
        response = client.post(
            "/api/v1/admin/users/1/reset-password",
            json={"new_password": "Admin56789"},
            headers={"Authorization": f"Bearer {user_access_token}"},
        )

    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] in {"PERMISSION_DENIED", "ROLE_INSUFFICIENT"}


def test_logout_blacklists_access_token() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client, "U0001", "User12345")

        logout_response = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert logout_response.status_code == 200
        assert logout_response.json()["success"] is True

        protected_response = client.put(
            "/api/v1/users/me/password",
            json={"old_password": "User12345", "new_password": "User54321"},
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert protected_response.status_code == 401
    body = protected_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "TOKEN_BLACKLISTED"


def test_refresh_cookie_flow_works_without_json_body() -> None:
    with _build_client() as client:
        _login_and_get_access_token(client, "U0001", "User12345")
        refresh_response = client.post("/api/v1/auth/refresh")

    assert refresh_response.status_code == 200
    body = refresh_response.json()
    assert body["success"] is True
    assert isinstance(body["data"]["access_token"], str)
    assert body["data"]["expires_in"] > 0
