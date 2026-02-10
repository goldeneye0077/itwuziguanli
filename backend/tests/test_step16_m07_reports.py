from __future__ import annotations

import os
import sys
from datetime import UTC, datetime
from decimal import Decimal
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
from app.models.application import Application, ApplicationItem
from app.models.catalog import Category, Sku
from app.models.enums import (
    ApplicationStatus,
    ApplicationType,
    AssetStatus,
    DeliveryType,
)
from app.models.inventory import Asset
from app.models.organization import Department, SysUser
from app.models.rbac import RbacRole, RbacUserRole


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
                employee_no="U0001",
                name="M07 User",
                department_id=1,
                email="m07.user@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=2,
                employee_no="U0002",
                name="M07 Admin",
                department_id=1,
                email="m07.admin@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=3,
                employee_no="U0003",
                name="M07 FinanceUser",
                department_id=2,
                email="m07.finance@example.com",
                password_hash=hash_password("User12345"),
            ),
        ]
    )

    session.add_all(
        [
            RbacRole(id=1, role_key="USER", role_name="User", is_system=True),
            RbacRole(id=2, role_key="ADMIN", role_name="Admin", is_system=True),
        ]
    )
    session.add_all(
        [
            RbacUserRole(id=1, user_id=1, role_id=1, created_at=now),
            RbacUserRole(id=2, user_id=2, role_id=2, created_at=now),
            RbacUserRole(id=3, user_id=3, role_id=1, created_at=now),
        ]
    )

    session.add(Category(id=1, name="Laptop", parent_id=None))
    session.add_all(
        [
            Sku(
                id=1,
                category_id=1,
                brand="Lenovo",
                model="T14",
                spec="i7/32G/1T",
                reference_price=Decimal("1000.00"),
                cover_url=None,
                safety_stock_threshold=1,
            ),
            Sku(
                id=2,
                category_id=1,
                brand="Dell",
                model="U2723QE",
                spec="27inch",
                reference_price=Decimal("300.00"),
                cover_url=None,
                safety_stock_threshold=1,
            ),
        ]
    )

    session.add_all(
        [
            Application(
                id=1001,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.DONE,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="111111",
                pickup_qr_string=None,
                created_at=datetime(2026, 2, 1, 10, 0, 0),
            ),
            Application(
                id=1002,
                applicant_user_id=3,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.DONE,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="222222",
                pickup_qr_string=None,
                created_at=datetime(2026, 2, 2, 11, 0, 0),
            ),
            Application(
                id=1003,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.ADMIN_APPROVED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="333333",
                pickup_qr_string=None,
                created_at=datetime(2026, 2, 8, 9, 30, 0),
            ),
        ]
    )

    session.add_all(
        [
            ApplicationItem(
                id=2001,
                application_id=1001,
                sku_id=1,
                quantity=1,
                note=None,
                created_at=datetime(2026, 2, 1, 10, 1, 0),
            ),
            ApplicationItem(
                id=2002,
                application_id=1002,
                sku_id=1,
                quantity=2,
                note=None,
                created_at=datetime(2026, 2, 2, 11, 1, 0),
            ),
            ApplicationItem(
                id=2003,
                application_id=1003,
                sku_id=2,
                quantity=1,
                note=None,
                created_at=datetime(2026, 2, 8, 9, 31, 0),
            ),
        ]
    )

    session.add_all(
        [
            Asset(
                id=3001,
                asset_tag="AT-3001",
                sku_id=1,
                sn="SN-M07-3001",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=datetime(2026, 2, 1, 8, 0, 0),
            ),
            Asset(
                id=3002,
                asset_tag="AT-3002",
                sku_id=1,
                sn="SN-M07-3002",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=datetime(2026, 2, 3, 8, 0, 0),
            ),
            Asset(
                id=3003,
                asset_tag="AT-3003",
                sku_id=2,
                sn="SN-M07-3003",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=datetime(2026, 2, 4, 8, 0, 0),
            ),
            Asset(
                id=3004,
                asset_tag="AT-3004",
                sku_id=2,
                sn="SN-M07-3004",
                status=AssetStatus.REPAIRING,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=datetime(2026, 2, 5, 8, 0, 0),
            ),
        ]
    )

    session.commit()


def _build_client() -> TestClient:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step16-test-secret"
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


def _login_and_get_access_token(client: TestClient, employee_no: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"employee_no": employee_no, "password": "User12345"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    return payload["data"]["access_token"]


def test_m07_reports_and_copilot_happy_path() -> None:
    client = _build_client()

    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        trend_response = client.get(
            "/api/v1/reports/applications-trend?granularity=DAY&start_date=2026-02-01&end_date=2026-02-08",
            headers=headers,
        )
        assert trend_response.status_code == 200
        trend_payload = trend_response.json()
        assert trend_payload["success"] is True
        assert trend_payload["data"] == [
            {"bucket": "2026-02-01", "count": 1},
            {"bucket": "2026-02-02", "count": 1},
            {"bucket": "2026-02-08", "count": 1},
        ]

        cost_response = client.get(
            "/api/v1/reports/cost-by-department?start_date=2026-02-01&end_date=2026-02-28",
            headers=headers,
        )
        assert cost_response.status_code == 200
        cost_payload = cost_response.json()
        assert cost_payload["success"] is True
        assert cost_payload["data"] == [
            {
                "department_id": 2,
                "department_name": "Finance",
                "total_cost": "2000.00",
                "application_count": 1,
            },
            {
                "department_id": 1,
                "department_name": "IT",
                "total_cost": "1300.00",
                "application_count": 2,
            },
        ]

        distribution_response = client.get(
            "/api/v1/reports/asset-status-distribution",
            headers=headers,
        )
        assert distribution_response.status_code == 200
        distribution_payload = distribution_response.json()
        assert distribution_payload["success"] is True
        assert distribution_payload["data"] == [
            {"status": "IN_STOCK", "count": 2},
            {"status": "IN_USE", "count": 1},
            {"status": "REPAIRING", "count": 1},
        ]

        copilot_response = client.post(
            "/api/v1/copilot/query",
            headers=headers,
            json={
                "question": "按部门统计总成本",
                "constraints": {
                    "start_date": "2026-02-01",
                    "end_date": "2026-02-28",
                    "limit": 5,
                },
            },
        )
        assert copilot_response.status_code == 200
        copilot_payload = copilot_response.json()
        assert copilot_payload["success"] is True

        copilot_data = copilot_payload["data"]
        query_plan = copilot_data["query_plan"]
        assert query_plan["metric"] == "TOTAL_COST"
        assert "DEPARTMENT" in query_plan["dimensions"]
        assert "sql" not in query_plan
        assert copilot_data["columns"] == [
            "department_id",
            "department_name",
            "metric_value",
        ]
        assert copilot_data["rows"] == [
            [2, "Finance", "2000.00"],
            [1, "IT", "1300.00"],
        ]


def test_m07_permission_denied_for_non_admin() -> None:
    client = _build_client()

    with client:
        user_token = _login_and_get_access_token(client, "U0001")
        headers = {"Authorization": f"Bearer {user_token}"}

        trend_response = client.get(
            "/api/v1/reports/applications-trend",
            headers=headers,
        )
        assert trend_response.status_code == 403
        assert trend_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        cost_response = client.get(
            "/api/v1/reports/cost-by-department",
            headers=headers,
        )
        assert cost_response.status_code == 403
        assert cost_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        distribution_response = client.get(
            "/api/v1/reports/asset-status-distribution",
            headers=headers,
        )
        assert distribution_response.status_code == 403
        assert distribution_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        copilot_response = client.post(
            "/api/v1/copilot/query",
            headers=headers,
            json={"question": "按部门统计总成本"},
        )
        assert copilot_response.status_code == 403
        assert copilot_response.json()["error"]["code"] == "ROLE_INSUFFICIENT"


def test_m07_validation_branches() -> None:
    client = _build_client()

    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        trend_validation = client.get(
            "/api/v1/reports/applications-trend?start_date=2026-03-01&end_date=2026-02-01",
            headers=headers,
        )
        assert trend_validation.status_code == 400
        assert trend_validation.json()["error"]["code"] == "VALIDATION_ERROR"

        cost_validation = client.get(
            "/api/v1/reports/cost-by-department?start_date=2026-03-01&end_date=2026-02-01",
            headers=headers,
        )
        assert cost_validation.status_code == 400
        assert cost_validation.json()["error"]["code"] == "VALIDATION_ERROR"

        copilot_question_validation = client.post(
            "/api/v1/copilot/query",
            headers=headers,
            json={"question": ""},
        )
        assert copilot_question_validation.status_code == 400
        assert copilot_question_validation.json()["error"]["code"] == "VALIDATION_ERROR"

        copilot_constraints_validation = client.post(
            "/api/v1/copilot/query",
            headers=headers,
            json={
                "question": "按部门统计总成本",
                "constraints": {"start_date": "2026-13-01"},
            },
        )
        assert copilot_constraints_validation.status_code == 400
        assert (
            copilot_constraints_validation.json()["error"]["code"] == "VALIDATION_ERROR"
        )
