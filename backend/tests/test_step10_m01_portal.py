from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timedelta
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
from app.models.enums import AnnouncementStatus, AssetStatus
from app.models.inventory import Asset
from app.models.organization import Department, SysUser
from app.models.portal import Announcement, HeroBanner
from app.models.rbac import RbacRole, RbacUserRole


def _seed_data(session: Session) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)

    session.add(Department(id=1, name="IT"))
    session.add_all(
        [
            SysUser(
                id=1,
                employee_no="U0001",
                name="Portal User",
                department_id=1,
                email="user@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=2,
                employee_no="U0002",
                name="Other User",
                department_id=1,
                email="other@example.com",
                password_hash=hash_password("User12345"),
            ),
        ]
    )

    session.add(RbacRole(id=1, role_key="USER", role_name="User", is_system=True))
    session.add(RbacUserRole(id=1, user_id=1, role_id=1, created_at=now))
    session.add(RbacUserRole(id=2, user_id=2, role_id=1, created_at=now))

    session.add(Category(id=1, name="Laptop", parent_id=None))
    session.add(
        Sku(
            id=1,
            category_id=1,
            brand="Lenovo",
            model="T14",
            spec="i7/32G/1T",
            reference_price=Decimal("8999.00"),
            cover_url=None,
            safety_stock_threshold=1,
        )
    )

    session.add(
        HeroBanner(
            id=1,
            title="IT 资产管理新体验",
            subtitle="电商化申领 + 智能审批 + OCR 入库",
            image_url="https://example.com/hero.jpg",
            link_url="/store",
            is_active=True,
            display_order=1,
        )
    )

    session.add_all(
        [
            Announcement(
                id=1,
                title="A1",
                content="公告 1",
                author_user_id=1,
                status=AnnouncementStatus.PUBLISHED,
                published_at=now - timedelta(days=3),
            ),
            Announcement(
                id=2,
                title="A2",
                content="公告 2",
                author_user_id=1,
                status=AnnouncementStatus.PUBLISHED,
                published_at=now - timedelta(days=2),
            ),
            Announcement(
                id=3,
                title="A3",
                content="公告 3",
                author_user_id=1,
                status=AnnouncementStatus.PUBLISHED,
                published_at=now - timedelta(days=1),
            ),
            Announcement(
                id=4,
                title="Draft",
                content="隐藏草稿",
                author_user_id=1,
                status=AnnouncementStatus.DRAFT,
                published_at=None,
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
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now - timedelta(days=10),
            ),
            Asset(
                id=2,
                asset_tag="AT-002",
                sku_id=1,
                sn="SN-002",
                status=AssetStatus.REPAIRING,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now - timedelta(days=2),
            ),
            Asset(
                id=3,
                asset_tag="AT-003",
                sku_id=1,
                sn="SN-003",
                status=AssetStatus.IN_USE,
                holder_user_id=2,
                locked_application_id=None,
                inbound_at=now - timedelta(days=1),
            ),
        ]
    )

    session.commit()


def _build_client() -> TestClient:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step10-test-secret"
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
    payload = response.json()
    assert payload["success"] is True
    return payload["data"]["access_token"]


def test_m01_endpoints_require_authentication() -> None:
    with _build_client() as client:
        hero_response = client.get("/api/v1/dashboard/hero")
        announce_response = client.get("/api/v1/announcements")
        assets_response = client.get("/api/v1/me/assets")

    assert hero_response.status_code == 401
    assert announce_response.status_code == 401
    assert assets_response.status_code == 401


def test_dashboard_hero_and_my_assets_success_payload_shape() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        hero_response = client.get("/api/v1/dashboard/hero", headers=headers)
        assets_response = client.get("/api/v1/me/assets", headers=headers)

    assert hero_response.status_code == 200
    hero_payload = hero_response.json()
    assert hero_payload["success"] is True
    assert hero_payload["data"]["title"] == "IT 资产管理新体验"
    assert hero_payload["data"]["subtitle"]
    assert "image_url" in hero_payload["data"]
    assert "link_url" in hero_payload["data"]

    assert assets_response.status_code == 200
    assets_payload = assets_response.json()
    assert assets_payload["success"] is True
    assert len(assets_payload["data"]) == 2
    assert assets_payload["data"][0]["asset_tag"] == "AT-002"
    assert assets_payload["data"][1]["asset_tag"] == "AT-001"
    assert all(item["holder_user_id"] == 1 for item in assets_payload["data"])


def test_announcements_pagination_is_stable() -> None:
    with _build_client() as client:
        access_token = _login_and_get_access_token(client)
        headers = {"Authorization": f"Bearer {access_token}"}

        page1 = client.get("/api/v1/announcements?page=1&page_size=2", headers=headers)
        page2 = client.get("/api/v1/announcements?page=2&page_size=2", headers=headers)

    assert page1.status_code == 200
    payload1 = page1.json()
    assert payload1["success"] is True
    assert payload1["data"]["meta"] == {"page": 1, "page_size": 2, "total": 3}
    assert [item["title"] for item in payload1["data"]["items"]] == ["A3", "A2"]

    assert page2.status_code == 200
    payload2 = page2.json()
    assert payload2["success"] is True
    assert payload2["data"]["meta"] == {"page": 2, "page_size": 2, "total": 3}
    assert [item["title"] for item in payload2["data"]["items"]] == ["A1"]
