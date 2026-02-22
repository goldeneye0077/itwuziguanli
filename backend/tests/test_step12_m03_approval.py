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
    ApprovalHistory,
)
from app.models.catalog import Category, Sku
from app.models.enums import (
    ApplicationStatus,
    ApplicationType,
    ApprovalAction,
    ApprovalNode,
    AssetStatus,
    DeliveryType,
    StockFlowAction,
)
from app.models.inventory import Asset, StockFlow
from app.models.organization import Department, SysUser
from app.models.rbac import RbacRole, RbacUserRole


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
                name="Leader",
                department_id=1,
                email="leader@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=3,
                employee_no="U0003",
                name="Admin",
                department_id=1,
                email="admin@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=4,
                employee_no="U0004",
                name="Super Admin",
                department_id=1,
                email="super@example.com",
                password_hash=hash_password("User12345"),
            ),
        ]
    )

    session.add_all(
        [
            RbacRole(id=1, role_key="USER", role_name="User", is_system=True),
            RbacRole(id=2, role_key="LEADER", role_name="Leader", is_system=True),
            RbacRole(id=3, role_key="ADMIN", role_name="Admin", is_system=True),
            RbacRole(
                id=4,
                role_key="SUPER_ADMIN",
                role_name="Super Admin",
                is_system=True,
            ),
        ]
    )
    session.add_all(
        [
            RbacUserRole(id=1, user_id=1, role_id=1, created_at=now),
            RbacUserRole(id=2, user_id=2, role_id=2, created_at=now),
            RbacUserRole(id=3, user_id=3, role_id=3, created_at=now),
            RbacUserRole(id=4, user_id=4, role_id=4, created_at=now),
        ]
    )

    session.add_all(
        [
            Category(id=1, name="Electronics", parent_id=None),
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
        ]
    )

    session.add_all(
        [
            Application(
                id=101,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.LOCKED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="111101",
                pickup_qr_string=None,
            ),
            Application(
                id=102,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.LEADER_APPROVED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="111102",
                pickup_qr_string=None,
                leader_approver_user_id=2,
            ),
            Application(
                id=103,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.LOCKED,
                delivery_type=DeliveryType.EXPRESS,
                pickup_code="111103",
                pickup_qr_string=None,
            ),
            Application(
                id=104,
                applicant_user_id=1,
                type=ApplicationType.APPLY,
                status=ApplicationStatus.LEADER_APPROVED,
                delivery_type=DeliveryType.PICKUP,
                pickup_code="111104",
                pickup_qr_string=None,
                leader_approver_user_id=2,
            ),
        ]
    )

    session.add_all(
        [
            ApplicationItem(
                id=1001, application_id=101, sku_id=1, quantity=1, note=None
            ),
            ApplicationItem(
                id=1002, application_id=101, sku_id=2, quantity=1, note=None
            ),
            ApplicationItem(
                id=1003, application_id=102, sku_id=1, quantity=1, note=None
            ),
            ApplicationItem(
                id=1004, application_id=103, sku_id=1, quantity=1, note=None
            ),
            ApplicationItem(
                id=1005, application_id=104, sku_id=2, quantity=1, note=None
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
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=101,
                inbound_at=now,
            ),
            Asset(
                id=2,
                asset_tag="AT-002",
                sku_id=2,
                sn="SN-002",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=101,
                inbound_at=now,
            ),
            Asset(
                id=3,
                asset_tag="AT-003",
                sku_id=1,
                sn="SN-003",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=102,
                inbound_at=now,
            ),
            Asset(
                id=4,
                asset_tag="AT-004",
                sku_id=1,
                sn="SN-004",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=103,
                inbound_at=now,
            ),
            Asset(
                id=5,
                asset_tag="AT-005",
                sku_id=1,
                sn="SN-005",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=6,
                asset_tag="AT-006",
                sku_id=2,
                sn="SN-006",
                status=AssetStatus.LOCKED,
                holder_user_id=None,
                locked_application_id=104,
                inbound_at=now,
            ),
        ]
    )

    session.add_all(
        [
            ApplicationAsset(id=2001, application_id=101, asset_id=1),
            ApplicationAsset(id=2002, application_id=101, asset_id=2),
            ApplicationAsset(id=2003, application_id=102, asset_id=3),
            ApplicationAsset(id=2004, application_id=103, asset_id=4),
            ApplicationAsset(id=2005, application_id=104, asset_id=6),
        ]
    )

    session.add(
        ApprovalHistory(
            id=3001,
            application_id=102,
            node=ApprovalNode.LEADER,
            action=ApprovalAction.APPROVE,
            actor_user_id=2,
            comment="Initial approval",
            ai_recommendation_json={"recommendation": "PASS"},
        )
    )

    session.commit()


def _build_client() -> tuple[TestClient, sessionmaker[Session]]:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step12-test-secret"
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
    body = response.json()
    assert body["success"] is True
    return body["data"]["access_token"]


def test_inbox_role_filtering_by_node() -> None:
    with _build_client()[0] as client:
        leader_token = _login_and_get_access_token(client, "U0002")
        admin_token = _login_and_get_access_token(client, "U0003")

        leader_inbox = client.get(
            "/api/v1/approvals/inbox?node=LEADER&page=1&page_size=20",
            headers={"Authorization": f"Bearer {leader_token}"},
        )
        admin_inbox = client.get(
            "/api/v1/approvals/inbox?node=ADMIN&page=1&page_size=20",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    assert leader_inbox.status_code == 200
    leader_payload = leader_inbox.json()
    assert leader_payload["success"] is True
    assert {item["application_id"] for item in leader_payload["data"]["items"]} == {
        101,
        103,
    }
    assert all(item["status"] == "LOCKED" for item in leader_payload["data"]["items"])

    assert admin_inbox.status_code == 200
    admin_payload = admin_inbox.json()
    assert admin_payload["success"] is True
    assert {item["application_id"] for item in admin_payload["data"]["items"]} == {
        102,
        104,
    }
    assert all(
        item["status"] == "LEADER_APPROVED" for item in admin_payload["data"]["items"]
    )


def test_leader_approve_and_reject_transitions_with_unlock() -> None:
    client, session_factory = _build_client()
    with client:
        leader_token = _login_and_get_access_token(client, "U0002")
        headers = {"Authorization": f"Bearer {leader_token}"}

        approve_response = client.post(
            "/api/v1/applications/101/approve",
            headers=headers,
            json={"node": "LEADER", "action": "APPROVE", "comment": "ok"},
        )
        reject_response = client.post(
            "/api/v1/applications/103/approve",
            headers=headers,
            json={"node": "LEADER", "action": "REJECT", "comment": "no"},
        )

    assert approve_response.status_code == 200
    assert approve_response.json()["data"]["status"] == "LEADER_APPROVED"
    assert reject_response.status_code == 200
    assert reject_response.json()["data"]["status"] == "LEADER_REJECTED"

    with session_factory() as session:
        app103 = session.get(Application, 103)
        assert app103 is not None
        assert app103.status == ApplicationStatus.LEADER_REJECTED

        asset4 = session.get(Asset, 4)
        assert asset4 is not None
        assert asset4.status == AssetStatus.IN_STOCK
        assert asset4.locked_application_id is None

        unlock_rows = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == 103,
                StockFlow.action == StockFlowAction.UNLOCK,
            )
        ).all()
        assert len(unlock_rows) == 1

        history_rows = session.scalars(
            select(ApprovalHistory)
            .where(ApprovalHistory.application_id.in_([101, 103]))
            .order_by(ApprovalHistory.id.asc())
        ).all()
        assert any(
            row.node == ApprovalNode.LEADER and row.action == ApprovalAction.APPROVE
            for row in history_rows
        )
        assert any(
            row.node == ApprovalNode.LEADER and row.action == ApprovalAction.REJECT
            for row in history_rows
        )


def test_admin_approve_reject_assign_and_detail_payload() -> None:
    client, session_factory = _build_client()
    with client:
        admin_token = _login_and_get_access_token(client, "U0003")
        headers = {"Authorization": f"Bearer {admin_token}"}

        approve_response = client.post(
            "/api/v1/applications/102/approve",
            headers=headers,
            json={"node": "ADMIN", "action": "APPROVE", "comment": "reviewed"},
        )
        reject_response = client.post(
            "/api/v1/applications/104/approve",
            headers=headers,
            json={"node": "ADMIN", "action": "REJECT", "comment": "deny"},
        )
        assign_response = client.post(
            "/api/v1/applications/102/assign-assets",
            headers=headers,
            json={"assignments": [{"sku_id": 1, "asset_ids": [5]}]},
        )
        detail_response = client.get("/api/v1/applications/102", headers=headers)

    assert approve_response.status_code == 200
    assert approve_response.json()["data"]["status"] == "ADMIN_APPROVED"
    assert reject_response.status_code == 200
    assert reject_response.json()["data"]["status"] == "ADMIN_REJECTED"

    assert assign_response.status_code == 200
    assign_payload = assign_response.json()
    assert assign_payload["success"] is True
    assert assign_payload["data"]["status"] == "READY_OUTBOUND"
    assert assign_payload["data"]["assigned_assets"][0]["asset_id"] == 5

    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["success"] is True
    assert detail_payload["data"]["application"]["id"] == 102
    assert detail_payload["data"]["application"]["status"] == "READY_OUTBOUND"
    first_item = detail_payload["data"]["application"]["items"][0]
    assert first_item["category_id"] == 1
    assert first_item["reference_price"] == "8999.00"
    assert first_item["stock_mode"] == "SERIALIZED"
    assert first_item["safety_stock_threshold"] == 1
    assert first_item["available_stock"] >= 0
    assert len(detail_payload["data"]["approval_history"]) >= 2
    assert detail_payload["data"]["assigned_assets"][0]["asset_id"] == 5

    with session_factory() as session:
        app102 = session.get(Application, 102)
        app104 = session.get(Application, 104)
        assert app102 is not None and app104 is not None
        assert app102.status == ApplicationStatus.READY_OUTBOUND
        assert app104.status == ApplicationStatus.ADMIN_REJECTED

        asset3 = session.get(Asset, 3)
        asset5 = session.get(Asset, 5)
        asset6 = session.get(Asset, 6)
        assert asset3 is not None and asset5 is not None and asset6 is not None
        assert asset3.status == AssetStatus.IN_STOCK
        assert asset3.locked_application_id is None
        assert asset5.status == AssetStatus.LOCKED
        assert asset5.locked_application_id == 102
        assert asset6.status == AssetStatus.IN_STOCK
        assert asset6.locked_application_id is None

        unlock_102 = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == 102,
                StockFlow.action == StockFlowAction.UNLOCK,
            )
        ).all()
        lock_102 = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == 102,
                StockFlow.action == StockFlowAction.LOCK,
            )
        ).all()
        unlock_104 = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == 104,
                StockFlow.action == StockFlowAction.UNLOCK,
            )
        ).all()
        assert len(unlock_102) == 1
        assert len(lock_102) == 1
        assert len(unlock_104) == 1
