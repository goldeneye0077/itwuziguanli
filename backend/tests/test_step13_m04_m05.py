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
from app.models.application import (
    Application,
    ApplicationAsset,
    ApplicationItem,
    Logistics,
)
from app.models.catalog import Category, Sku
from app.models.enums import (
    ApplicationStatus,
    ApplicationType,
    AssetStatus,
    DeliveryType,
    NotifyChannel,
    NotifyStatus,
    SkuStockFlowAction,
    SkuStockMode,
    StockFlowAction,
)
from app.models.inventory import Asset, StockFlow
from app.models.notification import NotificationOutbox, UserAddress
from app.models.organization import Department, SysUser
from app.models.rbac import (
    RbacPermission,
    RbacRole,
    RbacRolePermission,
    RbacUserRole,
)
from app.models.sku_stock import SkuStockFlow


def _seed_data(session: Session) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)

    session.add(Department(id=1, name="IT"))
    session.add_all(
        [
            SysUser(
                id=1,
                employee_no="U0001",
                name="Applicant",
                department_id=1,
                email="applicant@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=2,
                employee_no="U0002",
                name="Admin",
                department_id=1,
                email="admin@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=3,
                employee_no="U0003",
                name="Other User",
                department_id=1,
                email="other@example.com",
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
    session.add(
        RbacPermission(
            id=11,
            resource="OUTBOUND",
            action="READ",
            name="OUTBOUND:READ",
        )
    )
    session.add(
        RbacRolePermission(
            id=11,
            role_id=2,
            permission_id=11,
            created_at=now,
        )
    )
    session.add_all(
        [
            RbacUserRole(id=1, user_id=1, role_id=1, created_at=now),
            RbacUserRole(id=2, user_id=2, role_id=2, created_at=now),
            RbacUserRole(id=3, user_id=3, role_id=1, created_at=now),
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
                safety_stock_threshold=1,
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
            Sku(
                id=3,
                category_id=1,
                brand="HP",
                model="LaserJet Toner",
                spec="Q2612A",
                reference_price=Decimal("399.00"),
                cover_url=None,
                stock_mode=SkuStockMode.QUANTITY,
                safety_stock_threshold=5,
            ),
        ]
    )

    session.add_all(
        [
            Application(
                id=201,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.READY_OUTBOUND,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="222201",
                pickup_qr_string="pickup://application/201?code=222201",
            ),
            Application(
                id=202,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.READY_OUTBOUND,
                delivery_type=DeliveryType.EXPRESS,
                pickup_code="222202",
                pickup_qr_string="pickup://application/202?code=222202",
            ),
            Application(
                id=203,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.OUTBOUNDED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="222203",
                pickup_qr_string="pickup://application/203?code=222203",
            ),
            Application(
                id=204,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.OUTBOUNDED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="222204",
                pickup_qr_string="pickup://application/204?code=222204",
                title="关于打印耗材的申请",
                applicant_name_snapshot="Applicant Snapshot",
                applicant_department_snapshot="IT",
                applicant_phone_snapshot="13800000000",
                applicant_job_title_snapshot="Engineer",
            ),
            Application(
                id=205,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.ADMIN_APPROVED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="222205",
                pickup_qr_string=None,
                title="关于待分配资产自提单的申请",
            ),
            Application(
                id=206,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.ADMIN_APPROVED,
                delivery_type=DeliveryType.EXPRESS,
                pickup_code="222206",
                pickup_qr_string=None,
                title="关于待分配资产快递单的申请",
            ),
        ]
    )

    session.add_all(
        [
            ApplicationItem(
                id=3001, application_id=201, sku_id=1, quantity=1, note=None
            ),
            ApplicationItem(
                id=3002, application_id=202, sku_id=2, quantity=1, note=None
            ),
            ApplicationItem(
                id=3003, application_id=203, sku_id=1, quantity=1, note=None
            ),
            ApplicationItem(
                id=3004, application_id=204, sku_id=3, quantity=3, note=None
            ),
            ApplicationItem(
                id=3005, application_id=205, sku_id=1, quantity=1, note=None
            ),
            ApplicationItem(
                id=3006, application_id=206, sku_id=2, quantity=1, note=None
            ),
        ]
    )

    session.add_all(
        [
            Asset(
                id=11,
                asset_tag="AT-011",
                sku_id=1,
                sn="SN-011",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=201,
                inbound_at=now,
            ),
            Asset(
                id=12,
                asset_tag="AT-012",
                sku_id=2,
                sn="SN-012",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=202,
                inbound_at=now,
            ),
            Asset(
                id=13,
                asset_tag="AT-013",
                sku_id=1,
                sn="SN-013",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=14,
                asset_tag="AT-014",
                sku_id=1,
                sn="SN-014",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
        ]
    )

    session.add_all(
        [
            ApplicationAsset(id=4001, application_id=201, asset_id=11),
            ApplicationAsset(id=4002, application_id=202, asset_id=12),
            ApplicationAsset(id=4003, application_id=203, asset_id=13),
        ]
    )

    session.add_all(
        [
            StockFlow(
                id=1000001,
                asset_id=11,
                action=StockFlowAction.LOCK,
                operator_user_id=2,
                related_application_id=201,
                occurred_at=now,
                meta_json={"event": "assign_assets"},
            ),
            StockFlow(
                id=1000002,
                asset_id=12,
                action=StockFlowAction.LOCK,
                operator_user_id=2,
                related_application_id=202,
                occurred_at=now,
                meta_json={"event": "assign_assets"},
            ),
            StockFlow(
                id=1000003,
                asset_id=13,
                action=StockFlowAction.LOCK,
                operator_user_id=2,
                related_application_id=203,
                occurred_at=now,
                meta_json={"event": "assign_assets"},
            ),
        ]
    )
    session.flush()

    session.add(
        SkuStockFlow(
            id=9001,
            sku_id=3,
            action=SkuStockFlowAction.OUTBOUND,
            on_hand_delta=-3,
            reserved_delta=-3,
            on_hand_qty_after=20,
            reserved_qty_after=2,
            operator_user_id=2,
            related_application_id=204,
            occurred_at=now,
            meta_json={"event": "confirm_pickup"},
        )
    )

    session.add(
        UserAddress(
            id=5001,
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


def _build_client() -> tuple[TestClient, sessionmaker[Session]]:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step13-test-secret"
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


def test_m04_pickup_ticket_verify_and_notification_test() -> None:
    client, session_factory = _build_client()
    with client:
        user_token = _login_and_get_access_token(client, "U0001")
        admin_token = _login_and_get_access_token(client, "U0002")

        user_headers = {"Authorization": f"Bearer {user_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        ticket_response = client.get(
            "/api/v1/applications/201/pickup-ticket",
            headers=user_headers,
        )
        verify_response = client.post(
            "/api/v1/pickup/verify",
            headers=user_headers,
            json={"verify_type": "CODE", "value": "222201"},
        )
        invalid_status_verify = client.post(
            "/api/v1/pickup/verify",
            headers=user_headers,
            json={
                "verify_type": "QR",
                "value": "pickup://application/203?code=222203",
            },
        )
        forbidden_notification = client.post(
            "/api/v1/admin/notifications/test",
            headers=user_headers,
            json={
                "channel": "EMAIL",
                "receiver": "ops@example.com",
                "message": "forbidden",
            },
        )
        ok_notification = client.post(
            "/api/v1/admin/notifications/test",
            headers=admin_headers,
            json={
                "channel": "EMAIL",
                "receiver": "ops@example.com",
                "message": "step13 notification",
            },
        )

    assert ticket_response.status_code == 200
    ticket_payload = ticket_response.json()
    assert ticket_payload["success"] is True
    assert ticket_payload["data"]["application_id"] == 201
    assert ticket_payload["data"]["pickup_code"] == "222201"
    assert ticket_payload["data"]["pickup_code_display"] == "222-201"
    assert ticket_payload["data"]["pickup_qr_string"]

    assert verify_response.status_code == 200
    verify_payload = verify_response.json()
    assert verify_payload["success"] is True
    assert verify_payload["data"]["application_id"] == 201
    assert verify_payload["data"]["status"] == "READY_OUTBOUND"
    assert verify_payload["data"]["assigned_assets"][0]["asset_id"] == 11

    assert invalid_status_verify.status_code == 422
    assert invalid_status_verify.json()["error"]["code"] == "APPLICATION_STATUS_INVALID"

    assert forbidden_notification.status_code == 403
    assert forbidden_notification.json()["error"]["code"] == "ROLE_INSUFFICIENT"

    assert ok_notification.status_code == 200
    ok_notification_payload = ok_notification.json()
    assert ok_notification_payload["success"] is True
    assert ok_notification_payload["data"]["status"] == "SENT"

    with session_factory() as session:
        app201 = session.get(Application, 201)
        assert app201 is not None
        assert app201.status == ApplicationStatus.READY_OUTBOUND

        outbox_rows = session.scalars(
            select(NotificationOutbox).order_by(NotificationOutbox.id.asc())
        ).all()
        assert len(outbox_rows) == 1
        assert outbox_rows[0].channel == NotifyChannel.EMAIL
        assert outbox_rows[0].status == NotifyStatus.SENT
        assert outbox_rows[0].receiver == "ops@example.com"


def test_m05_outbound_pickup_and_ship_transitions() -> None:
    client, session_factory = _build_client()
    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        pickup_queue = client.get(
            "/api/v1/outbound/pickup-queue?page=1&page_size=20",
            headers=headers,
        )
        express_queue = client.get(
            "/api/v1/outbound/express-queue?page=1&page_size=20",
            headers=headers,
        )

        confirm_pickup_blocked = client.post(
            "/api/v1/outbound/confirm-pickup",
            headers=headers,
            json={"verify_type": "APPLICATION_ID", "value": "205"},
        )
        confirm_pickup = client.post(
            "/api/v1/outbound/confirm-pickup",
            headers=headers,
            json={"verify_type": "APPLICATION_ID", "value": "201"},
        )
        ship_response = client.post(
            "/api/v1/outbound/ship",
            headers=headers,
            json={
                "application_id": 202,
                "receiver_name": "运维小组",
                "receiver_phone": "13900000000",
                "province": "广东省",
                "city": "深圳市",
                "district": "南山区",
                "detail": "科技园 1 号楼 8F",
                "carrier": "SF",
                "tracking_no": "SF1234567890",
            },
        )
        detail_pickup_outbounded = client.get(
            "/api/v1/applications/201",
            headers=headers,
        )
        detail_express_shipped = client.get(
            "/api/v1/applications/202",
            headers=headers,
        )

    assert pickup_queue.status_code == 200
    pickup_payload = pickup_queue.json()
    assert pickup_payload["success"] is True
    assert pickup_payload["data"]["meta"] == {"page": 1, "page_size": 20, "total": 2}
    pickup_items = {
        item["application_id"]: item["status"]
        for item in pickup_payload["data"]["items"]
    }
    assert pickup_items == {201: "READY_OUTBOUND", 205: "ADMIN_APPROVED"}

    assert express_queue.status_code == 200
    express_payload = express_queue.json()
    assert express_payload["success"] is True
    assert express_payload["data"]["meta"] == {"page": 1, "page_size": 20, "total": 2}
    express_items = {
        item["application_id"]: item["status"]
        for item in express_payload["data"]["items"]
    }
    assert express_items == {202: "READY_OUTBOUND", 206: "ADMIN_APPROVED"}
    express_item_by_id = {
        item["application_id"]: item for item in express_payload["data"]["items"]
    }
    assert express_item_by_id[202]["receiver_name"] == "Alice"
    assert express_item_by_id[202]["receiver_phone"] == "13800000000"
    assert express_item_by_id[202]["detail"] == "No.1 Road"
    assert express_item_by_id[206]["receiver_name"] == "Alice"
    assert express_item_by_id[206]["receiver_phone"] == "13800000000"
    assert express_item_by_id[206]["detail"] == "No.1 Road"

    assert confirm_pickup_blocked.status_code == 200
    confirm_pickup_blocked_payload = confirm_pickup_blocked.json()
    assert confirm_pickup_blocked_payload["success"] is True
    assert confirm_pickup_blocked_payload["data"]["application_id"] == 205
    assert confirm_pickup_blocked_payload["data"]["status"] == "OUTBOUNDED"

    assert confirm_pickup.status_code == 200
    confirm_payload = confirm_pickup.json()
    assert confirm_payload["success"] is True
    assert confirm_payload["data"]["application_id"] == 201
    assert confirm_payload["data"]["status"] == "OUTBOUNDED"
    assert confirm_payload["data"]["delivered_assets"][0]["asset_id"] == 11

    assert ship_response.status_code == 200
    ship_payload = ship_response.json()
    assert ship_payload["success"] is True
    assert ship_payload["data"]["application_id"] == 202
    assert ship_payload["data"]["status"] == "SHIPPED"
    assert any(item["asset_id"] == 12 for item in ship_payload["data"]["delivered_assets"])
    assert ship_payload["data"]["delivered_items"] == [{"sku_id": 2, "quantity": 1}]

    assert detail_pickup_outbounded.status_code == 200
    detail_pickup_payload = detail_pickup_outbounded.json()
    assert detail_pickup_payload["success"] is True
    assert detail_pickup_payload["data"]["outbound_timeline"]["action"] == "OUTBOUND"
    assert detail_pickup_payload["data"]["outbound_timeline"]["operator_user_id"] == 2
    assert detail_pickup_payload["data"]["outbound_timeline"]["occurred_at"]

    assert detail_express_shipped.status_code == 200
    detail_express_payload = detail_express_shipped.json()
    assert detail_express_payload["success"] is True
    assert detail_express_payload["data"]["outbound_timeline"]["action"] == "SHIP"
    assert detail_express_payload["data"]["outbound_timeline"]["operator_user_id"] == 2
    assert detail_express_payload["data"]["outbound_timeline"]["occurred_at"]

    with session_factory() as session:
        app201 = session.get(Application, 201)
        app202 = session.get(Application, 202)
        assert app201 is not None and app202 is not None
        assert app201.status == ApplicationStatus.OUTBOUNDED
        assert app202.status == ApplicationStatus.SHIPPED

        asset11 = session.get(Asset, 11)
        asset12 = session.get(Asset, 12)
        assert asset11 is not None and asset12 is not None
        assert asset11.status == AssetStatus.IN_USE
        assert asset11.holder_user_id == 1
        assert asset11.locked_application_id is None
        assert asset12.status == AssetStatus.IN_USE
        assert asset12.holder_user_id == 1
        assert asset12.locked_application_id is None

        outbound_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == 201,
                StockFlow.action == StockFlowAction.OUTBOUND,
            )
        ).all()
        ship_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == 202,
                StockFlow.action == StockFlowAction.SHIP,
            )
        ).all()
        assert len(outbound_flows) == 1
        assert len(ship_flows) == 1

        logistics = session.scalar(
            select(Logistics).where(Logistics.application_id == 202).limit(1)
        )
        assert logistics is not None
        assert logistics.receiver_name == "运维小组"
        assert logistics.receiver_phone == "13900000000"
        assert logistics.province == "广东省"
        assert logistics.city == "深圳市"
        assert logistics.district == "南山区"
        assert logistics.detail == "科技园 1 号楼 8F"
        assert logistics.carrier == "SF"
        assert logistics.tracking_no == "SF1234567890"


def test_m05_outbound_records_and_export() -> None:
    client, _ = _build_client()
    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {admin_token}"}

        confirm_pickup_response = client.post(
            "/api/v1/outbound/confirm-pickup",
            headers=headers,
            json={"verify_type": "APPLICATION_ID", "value": "201"},
        )
        assert confirm_pickup_response.status_code == 200

        ship_response = client.post(
            "/api/v1/outbound/ship",
            headers=headers,
            json={
                "application_id": 202,
                "carrier": "SF",
                "tracking_no": "SF1234567890",
            },
        )
        assert ship_response.status_code == 200

        records_response = client.get(
            "/api/v1/outbound/records?page=1&page_size=50",
            headers=headers,
        )
        assert records_response.status_code == 200
        records_payload = records_response.json()
        assert records_payload["success"] is True
        assert records_payload["data"]["meta"]["total"] >= 1

        items = records_payload["data"]["items"]
        assert any(item["record_type"] == "ASSET" for item in items)
        assert any(item["record_type"] == "SKU_QUANTITY" for item in items)

        quantity_item = next(
            item for item in items if item["record_key"] == "SKU_FLOW-9001"
        )
        assert quantity_item["application_id"] == 204
        assert quantity_item["quantity"] == 3
        assert quantity_item["applicant_name_snapshot"] == "Applicant Snapshot"
        assert quantity_item["applicant_department_snapshot"] == "IT"

        filtered_response = client.get(
            "/api/v1/outbound/records?page=1&page_size=20&record_type=ASSET",
            headers=headers,
        )
        assert filtered_response.status_code == 200
        filtered_payload = filtered_response.json()
        assert filtered_payload["success"] is True
        assert filtered_payload["data"]["items"]
        assert all(item["record_type"] == "ASSET" for item in filtered_payload["data"]["items"])

        export_response = client.get(
            "/api/v1/outbound/records/export?record_type=SKU_QUANTITY",
            headers=headers,
        )
        assert export_response.status_code == 200
        assert "text/csv" in export_response.headers.get("content-type", "")
        csv_text = export_response.content.decode("utf-8-sig")
        assert "record_key,record_type,action,occurred_at" in csv_text
        assert "SKU_FLOW-9001" in csv_text
