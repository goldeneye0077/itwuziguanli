"""M04 router implementation: notifications and verification."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Sequence

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import Application, ApplicationAsset, ApplicationItem
from ....models.enums import ApplicationStatus, DeliveryType, NotifyStatus
from ....models.inventory import Asset
from ....models.notification import NotificationOutbox
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m04 import NotificationTestRequest, PickupVerifyRequest

router = APIRouter(tags=["M04"])


def _to_iso8601(value: datetime) -> str:
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _require_admin(context: AuthContext) -> None:
    if context.roles.intersection({"ADMIN", "SUPER_ADMIN"}):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色无权执行该操作。",
    )


def _assert_can_access_application(
    context: AuthContext, application: Application
) -> None:
    if context.roles.intersection({"LEADER", "ADMIN", "SUPER_ADMIN"}):
        return
    if application.applicant_user_id == context.user.id:
        return
    raise AppException(code="PERMISSION_DENIED", message="权限不足。")


def _resolve_application_by_verify(
    db: Session,
    *,
    verify_type: str,
    value: str,
) -> Application:
    candidate = value.strip()
    if not candidate:
        raise AppException(
            code="VALIDATION_ERROR",
            message="核验值不能为空。",
        )

    if verify_type == "QR":
        stmt = (
            select(Application)
            .where(Application.pickup_qr_string == candidate)
            .limit(1)
        )
    else:
        stmt = select(Application).where(Application.pickup_code == candidate).limit(1)

    application = db.scalar(stmt)
    if application is None:
        raise AppException(
            code="PICKUP_CODE_INVALID",
            message="取件核验值不正确。",
        )
    return application


def _serialize_items(items: Sequence[ApplicationItem]) -> list[dict[str, int]]:
    return [{"sku_id": item.sku_id, "quantity": item.quantity} for item in items]


def _serialize_assigned_assets(assets: Sequence[Asset]) -> list[dict[str, object]]:
    return [
        {
            "asset_id": asset.id,
            "asset_tag": asset.asset_tag,
            "sn": asset.sn,
        }
        for asset in assets
    ]


@router.get("/applications/{id}/pickup-ticket", response_model=ApiResponse)
def get_pickup_ticket(
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    application = db.get(Application, id)
    if application is None:
        raise AppException(
            code="APPLICATION_NOT_FOUND",
            message="申请单不存在。",
        )

    _assert_can_access_application(context, application)

    if application.delivery_type != DeliveryType.PICKUP:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="取件凭证仅适用于自提交付。",
            details={"application_id": application.id},
        )
    if application.pickup_qr_string is None:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="取件凭证尚未生成。",
            details={
                "application_id": application.id,
                "current_status": application.status.value,
                "expected_status": ApplicationStatus.READY_OUTBOUND.value,
            },
        )

    items = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    pickup_code_display = (
        f"{application.pickup_code[:3]}-{application.pickup_code[3:]}"
        if len(application.pickup_code) == 6
        else application.pickup_code
    )

    return build_success_response(
        {
            "application_id": application.id,
            "pickup_code": application.pickup_code,
            "pickup_code_display": pickup_code_display,
            "pickup_qr_string": application.pickup_qr_string,
            "expires_at": None,
            "items": _serialize_items(items),
        }
    )


@router.post("/pickup/verify", response_model=ApiResponse)
def verify_pickup_before_outbound(
    payload: PickupVerifyRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    application = _resolve_application_by_verify(
        db,
        verify_type=payload.verify_type,
        value=payload.value,
    )
    _assert_can_access_application(context, application)

    if application.status != ApplicationStatus.READY_OUTBOUND:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="申请单当前状态不支持出库核验。",
            details={
                "application_id": application.id,
                "current_status": application.status.value,
                "expected_status": ApplicationStatus.READY_OUTBOUND.value,
            },
        )

    items = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    assigned_assets = (
        db.execute(
            select(Asset)
            .join(ApplicationAsset, ApplicationAsset.asset_id == Asset.id)
            .where(ApplicationAsset.application_id == application.id)
            .order_by(Asset.id.asc())
        )
        .scalars()
        .all()
    )

    return build_success_response(
        {
            "application_id": application.id,
            "status": application.status.value,
            "applicant_user_id": application.applicant_user_id,
            "items": _serialize_items(items),
            "assigned_assets": _serialize_assigned_assets(assigned_assets),
        }
    )


@router.post("/admin/notifications/test", response_model=ApiResponse)
def send_test_notification(
    payload: NotificationTestRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    now = datetime.now(UTC).replace(tzinfo=None)
    message = payload.message.strip() if payload.message else "步骤 13 测试通知"
    outbox = NotificationOutbox(
        id=_next_bigint_id(db, NotificationOutbox),
        channel=payload.channel,
        receiver=payload.receiver.strip(),
        template_key="TEST_NOTIFICATION",
        payload_json={"message": message, "requested_by": context.user.id},
        status=NotifyStatus.SENT,
        retry_count=0,
        last_error=None,
    )
    db.add(outbox)
    db.commit()
    db.refresh(outbox)

    return build_success_response(
        {
            "id": outbox.id,
            "channel": outbox.channel.value,
            "receiver": outbox.receiver,
            "template_key": outbox.template_key,
            "status": outbox.status.value,
            "created_at": _to_iso8601(outbox.created_at),
            "requested_at": _to_iso8601(now),
        }
    )
