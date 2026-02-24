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
from app.models.catalog import Category, Sku
from app.models.enums import AssetStatus
from app.models.inventory import Asset
from app.models.notification import UserAddress
from app.models.organization import Department, SysUser
from app.models.rbac import RbacRole, RbacUserRole


def _seed_data(session: Session) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)

    session.add(Department(id=1, name="IT"))
    session.add(
        SysUser(
            id=1,
            employee_no="U0001",
            name="M02 User",
            department_id=1,
            email="m02.user@example.com",
            password_hash=hash_password("User12345"),
        )
    )
    session.add(RbacRole(id=1, role_key="USER", role_name="User", is_system=True))
    session.add(RbacUserRole(id=1, user_id=1, role_id=1, created_at=now))

    session.add_all(
        [
            Category(id=1, name="Electronics", parent_id=None),
            Category(id=2, name="Laptop", parent_id=1),
            Category(id=3, name="Monitor", parent_id=1),
        ]
    )
    session.add_all(
        [
            Sku(
                id=1,
                category_id=2,
                brand="Lenovo",
                model="T14",
                spec="i7/32G/1T",
                reference_price=Decimal("8999.00"),
                cover_url=None,
                safety_stock_threshold=1,
            ),
            Sku(
                id=2,
                category_id=3,
                brand="Dell",
                model="U2723QE",
                spec="27inch",
                reference_price=Decimal("3299.00"),
                cover_url=None,
                safety_stock_threshold=1,
            ),
            Sku(
                id=3,
                category_id=2,
                is_visible=False,
                brand="Hidden",
                model="RetiredModel",
                spec="legacy",
                reference_price=Decimal("1.00"),
                cover_url=None,
                safety_stock_threshold=0,
            ),
        ]
    )
    session.add_all(
        [
            Asset(
                id=1,
                asset_tag="AT-001",
                sku_id=1,
                sn="SN-001",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=2,
                asset_tag="AT-002",
                sku_id=1,
                sn="SN-002",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=3,
                asset_tag="AT-003",
                sku_id=1,
                sn="SN-003",
                status=AssetStatus.REPAIRING,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=4,
                asset_tag="AT-004",
                sku_id=2,
                sn="SN-004",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
        ]
    )
    session.add(
        UserAddress(
            id=1,
            user_id=1,
            receiver_name="Alice",
            receiver_phone="13800000000",
            province="Zhejiang",
            city="Hangzhou",
            district="Xihu",
            detail="No.1 Road",
            is_default=True,
        )
    )

    session.commit()


def _build_client() -> TestClient:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step11-test-secret"
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


def _login_and_get_access_token(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"employee_no": "U0001", "password": "User12345"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    return body["data"]["access_token"]


def test_m02_endpoints_require_authentication() -> None:
    with _build_client() as client:
        response = client.get("/api/v1/skus")

    assert response.status_code == 401
    payload = response.json()
    assert payload["success"] is False


def test_categories_and_sku_filters_with_pagination() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        categories = client.get("/api/v1/categories/tree", headers=headers)
        sku_page = client.get(
            "/api/v1/skus?category_id=2&keyword=t14&page=1&page_size=1",
            headers=headers,
        )

    assert categories.status_code == 200
    category_payload = categories.json()
    assert category_payload["success"] is True
    assert category_payload["data"][0]["name"] == "Electronics"
    assert category_payload["data"][0]["children"][0]["name"] == "Laptop"

    assert sku_page.status_code == 200
    sku_payload = sku_page.json()
    assert sku_payload["success"] is True
    assert sku_payload["data"]["meta"] == {"page": 1, "page_size": 1, "total": 1}
    assert sku_payload["data"]["items"][0]["id"] == 1
    assert sku_payload["data"]["items"][0]["available_stock"] == 2


def test_sku_list_hides_invisible_items() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.get("/api/v1/skus?page=1&page_size=20", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    sku_ids = [item["id"] for item in payload["data"]["items"]]
    assert 3 not in sku_ids


def test_address_create_and_list() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        first_list = client.get("/api/v1/me/addresses", headers=headers)
        created = client.post(
            "/api/v1/me/addresses",
            headers=headers,
            json={
                "receiver_name": "Bob",
                "receiver_phone": "13900000000",
                "province": "Shanghai",
                "city": "Shanghai",
                "district": "Pudong",
                "detail": "No.2 Road",
                "is_default": True,
            },
        )
        second_list = client.get("/api/v1/me/addresses", headers=headers)

    assert first_list.status_code == 200
    assert len(first_list.json()["data"]) == 1
    assert first_list.json()["data"][0]["is_default"] is True

    assert created.status_code == 200
    created_payload = created.json()
    assert created_payload["success"] is True
    assert created_payload["data"]["receiver_name"] == "Bob"
    assert created_payload["data"]["is_default"] is True

    assert second_list.status_code == 200
    second_payload = second_list.json()
    assert len(second_payload["data"]) == 2
    assert second_payload["data"][0]["receiver_name"] == "Bob"
    assert second_payload["data"][0]["is_default"] is True
    assert second_payload["data"][1]["receiver_name"] == "Alice"
    assert second_payload["data"][1]["is_default"] is False


def test_application_create_locks_inventory_success() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/v1/applications",
            headers=headers,
            json={
                "type": "APPLY",
                "delivery_type": "PICKUP",
                "items": [
                    {"sku_id": 1, "quantity": 2},
                    {"sku_id": 2, "quantity": 1},
                ],
            },
        )
        skus_after = client.get("/api/v1/skus?page=1&page_size=20", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["status"] == "LOCKED"
    assert payload["data"]["delivery_type"] == "PICKUP"
    assert len(payload["data"]["items"]) == 2
    assert len(payload["data"]["locked_assets"]) == 3

    sku_payload = skus_after.json()
    sku_items = {item["id"]: item for item in sku_payload["data"]["items"]}
    assert sku_items[1]["available_stock"] == 0
    assert sku_items[2]["available_stock"] == 0


def test_application_create_fails_when_stock_insufficient() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/v1/applications",
            headers=headers,
            json={
                "type": "APPLY",
                "delivery_type": "PICKUP",
                "items": [{"sku_id": 1, "quantity": 3}],
            },
        )
        skus_after = client.get("/api/v1/skus?category_id=2", headers=headers)

    assert response.status_code == 409
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "STOCK_INSUFFICIENT"

    sku_payload = skus_after.json()
    assert sku_payload["data"]["items"][0]["available_stock"] == 2


def test_application_express_requires_address_data() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/v1/applications",
            headers=headers,
            json={
                "type": "APPLY",
                "delivery_type": "EXPRESS",
                "items": [{"sku_id": 1, "quantity": 1}],
            },
        )

    assert response.status_code == 400
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "VALIDATION_ERROR"


def test_application_create_rejects_invisible_sku() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/v1/applications",
            headers=headers,
            json={
                "type": "APPLY",
                "delivery_type": "PICKUP",
                "items": [{"sku_id": 3, "quantity": 1}],
            },
        )

    assert response.status_code == 409
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "SKU_NOT_VISIBLE"
    assert payload["error"]["details"]["sku_ids"] == [3]


def test_ai_precheck_response_shape() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/v1/ai/precheck",
            headers=headers,
            json={
                "job_title": "Developer",
                "reason": "Need equipment for feature delivery and incident support.",
                "items": [{"sku_id": 1, "quantity": 1}],
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["recommendation"] in {"PASS", "REJECT"}
    assert isinstance(payload["data"]["reason"], str)
