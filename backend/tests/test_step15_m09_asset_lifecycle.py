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
    ApplicationStatus,
    ApplicationType,
    AssetStatus,
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
                name="M09 User",
                department_id=1,
                email="m09.user@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=2,
                employee_no="U0002",
                name="M09 Admin",
                department_id=1,
                email="m09.admin@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=3,
                employee_no="U0003",
                name="M09 Leader",
                department_id=1,
                email="m09.leader@example.com",
                password_hash=hash_password("User12345"),
            ),
            SysUser(
                id=4,
                employee_no="U0004",
                name="M09 Target",
                department_id=1,
                email="m09.target@example.com",
                password_hash=hash_password("User12345"),
            ),
        ]
    )

    session.add_all(
        [
            RbacRole(id=1, role_key="USER", role_name="User", is_system=True),
            RbacRole(id=2, role_key="ADMIN", role_name="Admin", is_system=True),
            RbacRole(id=3, role_key="LEADER", role_name="Leader", is_system=True),
        ]
    )
    session.add_all(
        [
            RbacUserRole(id=1, user_id=1, role_id=1, created_at=now),
            RbacUserRole(id=2, user_id=2, role_id=2, created_at=now),
            RbacUserRole(id=3, user_id=3, role_id=3, created_at=now),
            RbacUserRole(id=4, user_id=4, role_id=1, created_at=now),
        ]
    )

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

    session.add_all(
        [
            Asset(
                id=31,
                asset_tag="AT-031",
                sku_id=1,
                sn="SN-M09-031",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=32,
                asset_tag="AT-032",
                sku_id=1,
                sn="SN-M09-032",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=33,
                asset_tag="AT-033",
                sku_id=1,
                sn="SN-M09-033",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=34,
                asset_tag="AT-034",
                sku_id=1,
                sn="SN-M09-034",
                status=AssetStatus.IN_STOCK,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=35,
                asset_tag="AT-035",
                sku_id=1,
                sn="SN-M09-035",
                status=AssetStatus.REPAIRING,
                holder_user_id=None,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=36,
                asset_tag="AT-036",
                sku_id=1,
                sn="SN-M09-036",
                status=AssetStatus.IN_USE,
                holder_user_id=4,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=37,
                asset_tag="AT-037",
                sku_id=1,
                sn="SN-M09-037",
                status=AssetStatus.IN_USE,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
            Asset(
                id=38,
                asset_tag="AT-038",
                sku_id=1,
                sn="SN-M09-038",
                status=AssetStatus.BORROWED,
                holder_user_id=1,
                locked_application_id=None,
                inbound_at=now,
            ),
        ]
    )

    session.commit()


def _build_client() -> tuple[TestClient, sessionmaker[Session]]:
    os.environ["PASSWORD_HASH_ITERATIONS"] = "2000"
    os.environ["JWT_SECRET"] = "step15-test-secret"
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


def test_m09_return_and_confirm_flow() -> None:
    client, session_factory = _build_client()

    with client:
        user_token = _login_and_get_access_token(client, "U0001")
        admin_token = _login_and_get_access_token(client, "U0002")
        user_headers = {"Authorization": f"Bearer {user_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        return_pass = client.post(
            "/api/v1/assets/return",
            headers=user_headers,
            json={"asset_id": 31, "reason": "Project completed"},
        )
        assert return_pass.status_code == 200
        return_pass_payload = return_pass.json()
        assert return_pass_payload["success"] is True
        assert return_pass_payload["data"]["asset_status"] == "PENDING_INSPECTION"
        return_pass_app_id = return_pass_payload["data"]["application_id"]

        return_fail = client.post(
            "/api/v1/assets/return",
            headers=user_headers,
            json={"asset_id": 37, "reason": "Returned with damage"},
        )
        assert return_fail.status_code == 200
        return_fail_payload = return_fail.json()
        assert return_fail_payload["success"] is True
        return_fail_app_id = return_fail_payload["data"]["application_id"]

        invalid_return = client.post(
            "/api/v1/assets/return",
            headers=user_headers,
            json={"asset_id": 38, "reason": "Invalid status"},
        )
        assert invalid_return.status_code == 422
        assert invalid_return.json()["error"]["code"] == "APPLICATION_STATUS_INVALID"

        forbidden_confirm = client.post(
            f"/api/v1/admin/assets/return/{return_pass_app_id}/confirm",
            headers=user_headers,
            json={"passed": True},
        )
        assert forbidden_confirm.status_code == 403
        assert forbidden_confirm.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        confirm_pass = client.post(
            f"/api/v1/admin/assets/return/{return_pass_app_id}/confirm",
            headers=admin_headers,
            json={"passed": True},
        )
        assert confirm_pass.status_code == 200
        confirm_pass_payload = confirm_pass.json()
        assert confirm_pass_payload["success"] is True
        assert confirm_pass_payload["data"]["application_status"] == "DONE"
        assert confirm_pass_payload["data"]["asset_status"] == "IN_STOCK"

        confirm_fail = client.post(
            f"/api/v1/admin/assets/return/{return_fail_app_id}/confirm",
            headers=admin_headers,
            json={"passed": False, "damage_note": "broken keyboard"},
        )
        assert confirm_fail.status_code == 200
        confirm_fail_payload = confirm_fail.json()
        assert confirm_fail_payload["success"] is True
        assert confirm_fail_payload["data"]["application_status"] == "DONE"
        assert confirm_fail_payload["data"]["asset_status"] == "REPAIRING"

    with session_factory() as session:
        app_pass = session.get(Application, return_pass_app_id)
        app_fail = session.get(Application, return_fail_app_id)
        assert app_pass is not None and app_fail is not None
        assert app_pass.type == ApplicationType.RETURN
        assert app_fail.type == ApplicationType.RETURN
        assert app_pass.status == ApplicationStatus.DONE
        assert app_fail.status == ApplicationStatus.DONE

        asset31 = session.get(Asset, 31)
        asset37 = session.get(Asset, 37)
        assert asset31 is not None and asset37 is not None
        assert asset31.status == AssetStatus.IN_STOCK
        assert asset31.holder_user_id is None
        assert asset37.status == AssetStatus.REPAIRING
        assert asset37.holder_user_id is None

        pass_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == return_pass_app_id,
                StockFlow.action == StockFlowAction.RECEIVE,
            )
        ).all()
        fail_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == return_fail_app_id,
                StockFlow.action == StockFlowAction.REPAIR_START,
            )
        ).all()
        assert len(pass_flows) == 1
        assert len(fail_flows) == 1


def test_m09_repair_and_transfer_flow() -> None:
    client, session_factory = _build_client()

    with client:
        user_token = _login_and_get_access_token(client, "U0001")
        leader_token = _login_and_get_access_token(client, "U0003")
        user_headers = {"Authorization": f"Bearer {user_token}"}
        leader_headers = {"Authorization": f"Bearer {leader_token}"}

        repair_ok = client.post(
            "/api/v1/assets/repair",
            headers=user_headers,
            json={
                "asset_id": 32,
                "fault_description": "Display flickers after startup",
                "urgency": "HIGH",
            },
        )
        assert repair_ok.status_code == 200
        repair_ok_payload = repair_ok.json()
        assert repair_ok_payload["success"] is True
        assert repair_ok_payload["data"]["asset_status"] == "REPAIRING"
        repair_app_id = repair_ok_payload["data"]["application_id"]

        repair_forbidden = client.post(
            "/api/v1/assets/repair",
            headers=user_headers,
            json={
                "asset_id": 36,
                "fault_description": "Not holder",
                "urgency": "LOW",
            },
        )
        assert repair_forbidden.status_code == 403
        assert repair_forbidden.json()["error"]["code"] == "PERMISSION_DENIED"

        transfer_forbidden = client.post(
            "/api/v1/assets/transfer",
            headers=user_headers,
            json={"asset_id": 33, "target_user_id": 4, "reason": "handover"},
        )
        assert transfer_forbidden.status_code == 403
        assert transfer_forbidden.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        transfer_invalid_status = client.post(
            "/api/v1/assets/transfer",
            headers=leader_headers,
            json={"asset_id": 34, "target_user_id": 4, "reason": "handover"},
        )
        assert transfer_invalid_status.status_code == 422
        assert (
            transfer_invalid_status.json()["error"]["code"]
            == "APPLICATION_STATUS_INVALID"
        )

        transfer_ok = client.post(
            "/api/v1/assets/transfer",
            headers=leader_headers,
            json={"asset_id": 33, "target_user_id": 4, "reason": "team transfer"},
        )
        assert transfer_ok.status_code == 200
        transfer_ok_payload = transfer_ok.json()
        assert transfer_ok_payload["success"] is True
        assert transfer_ok_payload["data"]["asset_status"] == "IN_USE"
        assert transfer_ok_payload["data"]["to_user_id"] == 4

    with session_factory() as session:
        repair_application = session.get(Application, repair_app_id)
        assert repair_application is not None
        assert repair_application.type == ApplicationType.REPAIR
        assert repair_application.status == ApplicationStatus.SUBMITTED

        asset32 = session.get(Asset, 32)
        asset33 = session.get(Asset, 33)
        assert asset32 is not None and asset33 is not None
        assert asset32.status == AssetStatus.REPAIRING
        assert asset33.status == AssetStatus.IN_USE
        assert asset33.holder_user_id == 4

        repair_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.related_application_id == repair_app_id,
                StockFlow.action == StockFlowAction.REPAIR_START,
            )
        ).all()
        transfer_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.asset_id == 33,
                StockFlow.action == StockFlowAction.OUTBOUND,
            )
        ).all()
        assert len(repair_flows) == 1
        assert len(transfer_flows) == 1
        assert transfer_flows[0].meta_json is not None
        assert transfer_flows[0].meta_json.get("event") == "asset_transfer"


def test_m09_scrap_flow() -> None:
    client, session_factory = _build_client()

    with client:
        admin_token = _login_and_get_access_token(client, "U0002")
        leader_token = _login_and_get_access_token(client, "U0003")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        leader_headers = {"Authorization": f"Bearer {leader_token}"}

        forbidden_scrap = client.post(
            "/api/v1/admin/assets/scrap",
            headers=leader_headers,
            json={"asset_id": 35, "reason": "OBSOLETE", "scrap_note": "legacy"},
        )
        assert forbidden_scrap.status_code == 403
        assert forbidden_scrap.json()["error"]["code"] == "ROLE_INSUFFICIENT"

        invalid_status_scrap = client.post(
            "/api/v1/admin/assets/scrap",
            headers=admin_headers,
            json={"asset_id": 33, "reason": "DAMAGE"},
        )
        assert invalid_status_scrap.status_code == 422
        assert (
            invalid_status_scrap.json()["error"]["code"] == "APPLICATION_STATUS_INVALID"
        )

        scrap_ok = client.post(
            "/api/v1/admin/assets/scrap",
            headers=admin_headers,
            json={"asset_id": 34, "reason": "DAMAGE", "scrap_note": "mainboard"},
        )
        assert scrap_ok.status_code == 200
        scrap_ok_payload = scrap_ok.json()
        assert scrap_ok_payload["success"] is True
        assert scrap_ok_payload["data"]["asset_status"] == "SCRAPPED"

    with session_factory() as session:
        asset34 = session.get(Asset, 34)
        assert asset34 is not None
        assert asset34.status == AssetStatus.SCRAPPED

        scrap_flows = session.scalars(
            select(StockFlow).where(
                StockFlow.asset_id == 34,
                StockFlow.action == StockFlowAction.SCRAP,
            )
        ).all()
        assert len(scrap_flows) == 1
        assert scrap_flows[0].meta_json is not None
        assert scrap_flows[0].meta_json.get("reason") == "DAMAGE"
