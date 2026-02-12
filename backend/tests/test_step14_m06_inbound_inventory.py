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
from app.models.catalog import Category, Sku
from app.models.enums import AssetStatus, OcrJobStatus, StockFlowAction
from app.models.inbound import OcrInboundJob
from app.models.inventory import Asset, StockFlow
from app.models.organization import Department, SysUser
from app.models.rbac import RbacPermission, RbacRole, RbacRolePermission, RbacUserRole


def _seed_data(session: Session) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)

    session.add(Department(id=1, name="IT"))
    session.add_all(
        [
            SysUser(
                id=1,
                employee_no="U0001",
                name="M06 User",
                department_id=1,
                email="m06.user@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=2,
                employee_no="U0002",
                name="M06 Admin",
                department_id=1,
                email="m06.admin@example.com",
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
            RbacPermission(
                id=1,
                resource="INVENTORY",
                action="READ",
                name="INVENTORY:READ",
            ),
            RbacPermission(
                id=2,
                resource="INVENTORY",
                action="WRITE",
                name="INVENTORY:WRITE",
            ),
        ]
    )
    session.add_all(
        [
            RbacRolePermission(id=1, role_id=2, permission_id=1, created_at=now),
            RbacRolePermission(id=2, role_id=2, permission_id=2, created_at=now),
        ]
    )
    session.add_all(
        [
            RbacUserRole(id=1, user_id=1, role_id=1, created_at=now),
            RbacUserRole(id=2, user_id=2, role_id=2, created_at=now),
        ]
    )

    session.add_all(
        [
            Category(id=1, name="Laptop", parent_id=None),
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
                category_id=1,
                brand="Dell",
                model="U2723QE",
                spec="27inch",
                reference_price=Decimal("3299.00"),
                cover_url=None,
                safety_stock_threshold=1,
            ),
        ]
    )

    session.add_all(
        [
            Asset(
                id=101,
                asset_tag="AT-101",
                sku_id=1,
                sn="SN-M06-BASE-101",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=102,
                asset_tag="AT-102",
                sku_id=1,
                sn="SN-M06-BASE-102",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=999,
                inbound_at=now,
            ),
            Asset(
                id=103,
                asset_tag="AT-103",
                sku_id=1,
                sn="SN-M06-BASE-103",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=104,
                asset_tag="AT-104",
                sku_id=1,
                sn="SN-M06-BASE-104",
                status=AssetStatus.BORROWED,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=105,
                asset_tag="AT-105",
                sku_id=1,
                sn="SN-M06-BASE-105",
                status=AssetStatus.REPAIRING,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=106,
                asset_tag="AT-106",
                sku_id=1,
                sn="SN-M06-BASE-106",
                status=AssetStatus.SCRAPPED,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=201,
                asset_tag="AT-201",
                sku_id=2,
                sn="SN-M06-BASE-201",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
        ]
    )

    session.commit()


def _build_client() -> tuple[TestClient, sessionmaker[Session]]:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step14-test-secret"
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


def test_m06_ocr_job_lifecycle_and_side_effects() -> None:
    client, session_factory = _build_client()

    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        create_job = client.post(
            "/api/v1/inbound/ocr-jobs",
            headers=headers,
            data={"doc_type": "INVOICE"},
            files={"file": ("invoice-001.png", b"fake-png", "image/png")},
        )
        assert create_job.status_code == 200
        create_payload = create_job.json()
        assert create_payload["success"] is True
        assert create_payload["data"]["status"] == "READY_FOR_REVIEW"
        job_id = create_payload["data"]["job_id"]

        detail = client.get(f"/api/v1/inbound/ocr-jobs/{job_id}", headers=headers)
        assert detail.status_code == 200
        detail_payload = detail.json()
        assert detail_payload["success"] is True
        assert detail_payload["data"]["job_id"] == job_id
        assert detail_payload["data"]["status"] == "READY_FOR_REVIEW"
        assert "invoice-001.png" in detail_payload["data"]["source_file_url"]
        assert detail_payload["data"]["extracted"]["doc_type"] == "INVOICE"

        confirm = client.post(
            f"/api/v1/inbound/ocr-jobs/{job_id}/confirm",
            headers=headers,
            json={
                "sku": {
                    "category_id": 1,
                    "brand": "Lenovo",
                    "model": "T14",
                    "spec": "i7/32G/1T",
                    "reference_price": "8999.00",
                    "cover_url": None,
                    "safety_stock_threshold": 2,
                },
                "assets": [
                    {"sn": "SN-M06-NEW-301"},
                    {"sn": "SN-M06-NEW-302"},
                ],
            },
        )
        assert confirm.status_code == 200
        confirm_payload = confirm.json()
        assert confirm_payload["success"] is True
        assert confirm_payload["data"]["sku_id"] == 1
        assert len(confirm_payload["data"]["created_assets"]) == 2

        confirm_again = client.post(
            f"/api/v1/inbound/ocr-jobs/{job_id}/confirm",
            headers=headers,
            json={
                "sku": {
                    "category_id": 1,
                    "brand": "Lenovo",
                    "model": "T14",
                    "spec": "i7/32G/1T",
                    "reference_price": "8999.00",
                    "cover_url": None,
                    "safety_stock_threshold": 2,
                },
                "assets": [{"sn": "SN-M06-NEW-303"}],
            },
        )
        assert confirm_again.status_code == 422
        assert confirm_again.json()["error"]["code"] == "APPLICATION_STATUS_INVALID"

    with session_factory() as session:
        job = session.get(OcrInboundJob, job_id)
        assert job is not None
        assert job.status == OcrJobStatus.CONFIRMED
        assert job.confirmed_sku_id == 1

        created_assets = session.scalars(
            select(Asset)
            .where(Asset.sn.in_(["SN-M06-NEW-301", "SN-M06-NEW-302"]))
            .order_by(Asset.id.asc())
        ).all()
        assert len(created_assets) == 2
        assert all(item.status == AssetStatus.IN_STOCK for item in created_assets)

        created_asset_ids = [item.id for item in created_assets]
        inbound_flows = session.scalars(
            select(StockFlow)
            .where(
                StockFlow.asset_id.in_(created_asset_ids),
                StockFlow.action == StockFlowAction.INBOUND,
            )
            .order_by(StockFlow.id.asc())
        ).all()
        assert len(inbound_flows) == 2
        assert all(
            flow.meta_json and flow.meta_json.get("ocr_job_id") == job_id
            for flow in inbound_flows
        )


def test_m06_admin_sku_asset_create_and_duplicate_sn() -> None:
    client, _ = _build_client()

    with client:
        user_token = _login_and_get_access_token(client, "U0001")
        admin_token = _login_and_get_access_token(client, "U0002")
        user_headers = {"Authorization": f"Bearer {user_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        forbidden_list = client.get("/api/v1/admin/skus", headers=user_headers)
        assert forbidden_list.status_code == 403
        assert forbidden_list.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        create_sku = client.post(
            "/api/v1/admin/skus",
            headers=admin_headers,
            json={
                "category_id": 1,
                "brand": "Apple",
                "model": "MacBook Pro 16",
                "spec": "M3 Max/64G/2T",
                "reference_price": "23999.00",
                "cover_url": None,
                "safety_stock_threshold": 1,
            },
        )
        assert create_sku.status_code == 200
        create_sku_payload = create_sku.json()
        assert create_sku_payload["success"] is True
        created_sku_id = create_sku_payload["data"]["id"]

        list_skus = client.get("/api/v1/admin/skus", headers=admin_headers)
        assert list_skus.status_code == 200
        list_skus_payload = list_skus.json()
        assert list_skus_payload["success"] is True
        assert any(item["id"] == created_sku_id for item in list_skus_payload["data"])

        create_assets = client.post(
            "/api/v1/admin/assets",
            headers=admin_headers,
            json={
                "sku_id": created_sku_id,
                "assets": [{"sn": "SN-M06-ADMIN-001"}],
            },
        )
        assert create_assets.status_code == 200
        create_assets_payload = create_assets.json()
        assert create_assets_payload["success"] is True
        assert len(create_assets_payload["data"]["created_assets"]) == 1

        duplicate_assets = client.post(
            "/api/v1/admin/assets",
            headers=admin_headers,
            json={
                "sku_id": created_sku_id,
                "assets": [{"sn": "SN-M06-ADMIN-001"}],
            },
        )
        assert duplicate_assets.status_code == 409
        duplicate_payload = duplicate_assets.json()
        assert duplicate_payload["success"] is False
        assert duplicate_payload["error"]["code"] == "DUPLICATE_SN"


def test_m06_inventory_summary_aggregation() -> None:
    client, _ = _build_client()

    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        summary = client.get("/api/v1/inventory/summary", headers=headers)
        filtered = client.get("/api/v1/inventory/summary?sku_id=1", headers=headers)

    assert summary.status_code == 200
    summary_payload = summary.json()
    assert summary_payload["success"] is True

    sku1_summary = next(item for item in summary_payload["data"] if item["sku_id"] == 1)
    assert sku1_summary["sku_id"] == 1
    assert sku1_summary["stock_mode"] == "SERIALIZED"
    assert sku1_summary["total_count"] == 6
    assert sku1_summary["in_stock_count"] == 1
    assert sku1_summary["locked_count"] == 1
    assert sku1_summary["in_use_count"] == 2
    assert sku1_summary["repairing_count"] == 1
    assert sku1_summary["scrapped_count"] == 1
    assert sku1_summary["on_hand_qty"] == 2
    assert sku1_summary["reserved_qty"] == 1
    assert sku1_summary["available_qty"] == 1

    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert filtered_payload["success"] is True
    assert len(filtered_payload["data"]) == 1
    assert filtered_payload["data"][0]["sku_id"] == 1


def test_m06_quantity_stock_ops_and_export() -> None:
    client, _ = _build_client()

    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        created_sku = client.post(
            "/api/v1/admin/skus",
            headers=headers,
            json={
                "category_id": 1,
                "brand": "DemoConsumable",
                "model": "A4 Paper",
                "spec": "500 sheets",
                "reference_price": "12.34",
                "cover_url": None,
                "stock_mode": "QUANTITY",
                "safety_stock_threshold": 5,
            },
        )
        assert created_sku.status_code == 200
        created_payload = created_sku.json()
        assert created_payload["success"] is True
        assert created_payload["data"]["stock_mode"] == "QUANTITY"
        sku_id = int(created_payload["data"]["id"])

        inbound = client.post(
            f"/api/v1/admin/sku-stocks/{sku_id}/inbound",
            headers=headers,
            json={"quantity": 10, "note": "test inbound"},
        )
        assert inbound.status_code == 200
        inbound_payload = inbound.json()
        assert inbound_payload["success"] is True
        assert inbound_payload["data"] == {
            "sku_id": sku_id,
            "on_hand_qty": 10,
            "reserved_qty": 0,
            "available_qty": 10,
        }

        outbound = client.post(
            f"/api/v1/admin/sku-stocks/{sku_id}/outbound",
            headers=headers,
            json={"quantity": 3, "reason": "test outbound"},
        )
        assert outbound.status_code == 200
        outbound_payload = outbound.json()
        assert outbound_payload["success"] is True
        assert outbound_payload["data"] == {
            "sku_id": sku_id,
            "on_hand_qty": 7,
            "reserved_qty": 0,
            "available_qty": 7,
        }

        adjust = client.post(
            f"/api/v1/admin/sku-stocks/{sku_id}/adjust",
            headers=headers,
            json={"new_on_hand_qty": 20, "reason": "test adjust"},
        )
        assert adjust.status_code == 200
        adjust_payload = adjust.json()
        assert adjust_payload["success"] is True
        assert adjust_payload["data"] == {
            "sku_id": sku_id,
            "on_hand_qty": 20,
            "reserved_qty": 0,
            "available_qty": 20,
        }

        summary = client.get(f"/api/v1/inventory/summary?sku_id={sku_id}", headers=headers)
        assert summary.status_code == 200
        summary_payload = summary.json()
        assert summary_payload["success"] is True
        assert len(summary_payload["data"]) == 1
        assert summary_payload["data"][0]["sku_id"] == sku_id
        assert summary_payload["data"][0]["stock_mode"] == "QUANTITY"
        assert summary_payload["data"][0]["on_hand_qty"] == 20
        assert summary_payload["data"][0]["reserved_qty"] == 0
        assert summary_payload["data"][0]["available_qty"] == 20

        flows = client.get(
            f"/api/v1/admin/sku-stocks/{sku_id}/flows?page=1&page_size=20",
            headers=headers,
        )
        assert flows.status_code == 200
        flows_payload = flows.json()
        assert flows_payload["success"] is True
        actions = {row["action"] for row in flows_payload["data"]["items"]}
        assert {"INBOUND", "OUTBOUND", "ADJUST"}.issubset(actions)

        exported = client.get(
            f"/api/v1/admin/sku-stocks/{sku_id}/flows/export",
            headers=headers,
        )
        assert exported.status_code == 200
        assert exported.content.startswith(b"\xef\xbb\xbf")
        assert b"occurred_at,sku_id,action" in exported.content
        assert b"INBOUND" in exported.content
