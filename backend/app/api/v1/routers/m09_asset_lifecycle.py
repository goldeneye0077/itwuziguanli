"""M09 router implementation: asset lifecycle management."""

from __future__ import annotations

from datetime import UTC, datetime
from random import randint

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import Application, ApplicationAsset, ApplicationItem
from ....models.enums import (
    ApplicationStatus,
    ApplicationType,
    AssetStatus,
    DeliveryType,
    StockFlowAction,
)
from ....models.inventory import Asset, StockFlow
from ....models.organization import SysUser
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m09 import (
    AssetRepairRequest,
    AssetReturnConfirmRequest,
    AssetReturnRequest,
    AssetScrapRequest,
    AssetTransferRequest,
)

router = APIRouter(tags=["M09"])


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _pickup_code_exists(db: Session, pickup_code: str) -> bool:
    stmt = select(Application.id).where(Application.pickup_code == pickup_code).limit(1)
    return db.scalar(stmt) is not None


def _create_pickup_code(db: Session) -> str:
    for _ in range(10):
        candidate = f"{randint(0, 999999):06d}"
        if not _pickup_code_exists(db, candidate):
            return candidate
    raise AppException(
        code="INTERNAL_SERVER_ERROR",
        message="无法分配取件码，请稍后重试。",
    )


def _require_admin(context: AuthContext) -> None:
    if context.roles.intersection({"ADMIN", "SUPER_ADMIN"}):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色无权执行该操作。",
    )


def _require_transfer_role(context: AuthContext) -> None:
    if context.roles.intersection({"LEADER", "ADMIN", "SUPER_ADMIN"}):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色无权执行该操作。",
    )


def _get_asset_or_raise(db: Session, *, asset_id: int) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is not None:
        return asset
    raise AppException(code="ASSET_NOT_FOUND", message="资产不存在。")


def _assert_asset_holder(context: AuthContext, asset: Asset, *, event: str) -> None:
    if asset.holder_user_id == context.user.id:
        return
    raise AppException(
        code="PERMISSION_DENIED",
        message="仅资产当前持有人可执行该操作。",
        details={
            "asset_id": asset.id,
            "holder_user_id": asset.holder_user_id,
            "operator_user_id": context.user.id,
            "event": event,
        },
    )


def _assert_asset_status(
    asset: Asset,
    *,
    expected: set[AssetStatus],
    event: str,
) -> None:
    if asset.status in expected:
        return
    raise AppException(
        code="APPLICATION_STATUS_INVALID",
        message=f"资产状态不支持执行 {event}。",
        details={
            "asset_id": asset.id,
            "current_status": asset.status.value,
            "expected_status": sorted(item.value for item in expected),
            "event": event,
        },
    )


def _write_stock_flow(
    db: Session,
    *,
    asset_id: int,
    action: StockFlowAction,
    operator_user_id: int,
    related_application_id: int | None,
    meta_json: dict[str, object],
) -> None:
    db.add(
        StockFlow(
            id=_next_bigint_id(db, StockFlow),
            asset_id=asset_id,
            action=action,
            operator_user_id=operator_user_id,
            related_application_id=related_application_id,
            occurred_at=datetime.now(UTC).replace(tzinfo=None),
            meta_json=meta_json,
        )
    )


@router.post("/assets/return", response_model=ApiResponse)
def create_asset_return_application(
    payload: AssetReturnRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    asset = _get_asset_or_raise(db, asset_id=payload.asset_id)
    _assert_asset_holder(context, asset, event="return_asset")
    _assert_asset_status(asset, expected={AssetStatus.IN_USE}, event="return_asset")

    reason = payload.reason.strip()
    application = Application(
        id=_next_bigint_id(db, Application),
        applicant_user_id=context.user.id,
        type=ApplicationType.RETURN,
        status=ApplicationStatus.SUBMITTED,
        delivery_type=DeliveryType.PICKUP,
        pickup_code=_create_pickup_code(db),
        pickup_qr_string=None,
    )
    db.add(application)
    db.flush()

    db.add(
        ApplicationItem(
            id=_next_bigint_id(db, ApplicationItem),
            application_id=application.id,
            sku_id=asset.sku_id,
            quantity=1,
            note=reason,
        )
    )
    db.add(
        ApplicationAsset(
            id=_next_bigint_id(db, ApplicationAsset),
            application_id=application.id,
            asset_id=asset.id,
        )
    )

    asset.status = AssetStatus.PENDING_INSPECTION
    db.commit()

    return build_success_response(
        {
            "application_id": application.id,
            "application_status": application.status.value,
            "asset_id": asset.id,
            "asset_status": asset.status.value,
        }
    )


@router.post("/admin/assets/return/{id}/confirm", response_model=ApiResponse)
def confirm_asset_return(
    id: int,
    payload: AssetReturnConfirmRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    application = db.get(Application, id)
    if application is None:
        raise AppException(
            code="APPLICATION_NOT_FOUND",
            message="申请单不存在。",
        )
    if application.type != ApplicationType.RETURN:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="申请单类型不是归还。",
            details={"application_id": application.id, "type": application.type.value},
        )
    if application.status != ApplicationStatus.SUBMITTED:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="归还申请单当前状态不支持确认。",
            details={
                "application_id": application.id,
                "current_status": application.status.value,
                "expected_status": ApplicationStatus.SUBMITTED.value,
            },
        )

    relation = db.scalar(
        select(ApplicationAsset)
        .where(ApplicationAsset.application_id == application.id)
        .order_by(ApplicationAsset.id.asc())
        .limit(1)
    )
    if relation is None:
        raise AppException(
            code="ASSET_NOT_FOUND",
            message="归还申请单未绑定资产。",
            details={"application_id": application.id},
        )

    asset = _get_asset_or_raise(db, asset_id=relation.asset_id)
    _assert_asset_status(
        asset,
        expected={AssetStatus.PENDING_INSPECTION},
        event="confirm_return",
    )

    damage_note = payload.damage_note.strip() if payload.damage_note else ""
    application.status = ApplicationStatus.DONE
    application.admin_reviewer_user_id = context.user.id
    asset.holder_user_id = None

    if payload.passed:
        asset.status = AssetStatus.IN_STOCK
        _write_stock_flow(
            db,
            asset_id=asset.id,
            action=StockFlowAction.RECEIVE,
            operator_user_id=context.user.id,
            related_application_id=application.id,
            meta_json={"event": "confirm_return_pass"},
        )
    else:
        asset.status = AssetStatus.REPAIRING
        flow_meta: dict[str, object] = {"event": "confirm_return_fail"}
        if damage_note:
            flow_meta["damage_note"] = damage_note
        _write_stock_flow(
            db,
            asset_id=asset.id,
            action=StockFlowAction.REPAIR_START,
            operator_user_id=context.user.id,
            related_application_id=application.id,
            meta_json=flow_meta,
        )

    db.commit()

    return build_success_response(
        {
            "application_id": application.id,
            "application_status": application.status.value,
            "asset_id": asset.id,
            "asset_status": asset.status.value,
            "passed": payload.passed,
        }
    )


@router.post("/assets/repair", response_model=ApiResponse)
def create_asset_repair_application(
    payload: AssetRepairRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    asset = _get_asset_or_raise(db, asset_id=payload.asset_id)
    _assert_asset_holder(context, asset, event="start_repair")
    _assert_asset_status(asset, expected={AssetStatus.IN_USE}, event="start_repair")

    fault_description = payload.fault_description.strip()
    application = Application(
        id=_next_bigint_id(db, Application),
        applicant_user_id=context.user.id,
        type=ApplicationType.REPAIR,
        status=ApplicationStatus.SUBMITTED,
        delivery_type=DeliveryType.PICKUP,
        pickup_code=_create_pickup_code(db),
        pickup_qr_string=None,
    )
    db.add(application)
    db.flush()

    db.add(
        ApplicationItem(
            id=_next_bigint_id(db, ApplicationItem),
            application_id=application.id,
            sku_id=asset.sku_id,
            quantity=1,
            note=f"[{payload.urgency}] {fault_description}",
        )
    )
    db.add(
        ApplicationAsset(
            id=_next_bigint_id(db, ApplicationAsset),
            application_id=application.id,
            asset_id=asset.id,
        )
    )

    asset.status = AssetStatus.REPAIRING
    _write_stock_flow(
        db,
        asset_id=asset.id,
        action=StockFlowAction.REPAIR_START,
        operator_user_id=context.user.id,
        related_application_id=application.id,
        meta_json={
            "event": "start_repair",
            "fault_description": fault_description,
            "urgency": payload.urgency,
        },
    )

    db.commit()

    return build_success_response(
        {
            "application_id": application.id,
            "application_status": application.status.value,
            "asset_id": asset.id,
            "asset_status": asset.status.value,
        }
    )


@router.post("/assets/transfer", response_model=ApiResponse)
def transfer_asset_holder(
    payload: AssetTransferRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_transfer_role(context)

    asset = _get_asset_or_raise(db, asset_id=payload.asset_id)
    _assert_asset_status(
        asset,
        expected={AssetStatus.IN_USE, AssetStatus.BORROWED},
        event="transfer_asset",
    )
    if asset.holder_user_id is None:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="资产当前没有持有人。",
            details={"asset_id": asset.id},
        )

    if payload.target_user_id == asset.holder_user_id:
        raise AppException(
            code="VALIDATION_ERROR",
            message="目标用户不能与当前持有人相同。",
            details={"asset_id": asset.id, "target_user_id": payload.target_user_id},
        )

    target_user = db.get(SysUser, payload.target_user_id)
    if target_user is None:
        raise AppException(code="USER_NOT_FOUND", message="目标用户不存在。")

    reason = payload.reason.strip()
    previous_holder_id = asset.holder_user_id
    asset.holder_user_id = target_user.id
    _write_stock_flow(
        db,
        asset_id=asset.id,
        action=StockFlowAction.OUTBOUND,
        operator_user_id=context.user.id,
        related_application_id=None,
        meta_json={
            "event": "asset_transfer",
            "from_user_id": previous_holder_id,
            "to_user_id": target_user.id,
            "reason": reason,
        },
    )

    db.commit()

    return build_success_response(
        {
            "asset_id": asset.id,
            "asset_status": asset.status.value,
            "from_user_id": previous_holder_id,
            "to_user_id": target_user.id,
        }
    )


@router.post("/admin/assets/scrap", response_model=ApiResponse)
def scrap_asset(
    payload: AssetScrapRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    asset = _get_asset_or_raise(db, asset_id=payload.asset_id)
    _assert_asset_status(
        asset,
        expected={AssetStatus.IN_STOCK, AssetStatus.REPAIRING},
        event="scrap_asset",
    )

    scrap_note = payload.scrap_note.strip() if payload.scrap_note else ""
    asset.status = AssetStatus.SCRAPPED
    asset.holder_user_id = None
    asset.locked_application_id = None

    flow_meta: dict[str, object] = {
        "event": "asset_scrap",
        "reason": payload.reason,
    }
    if scrap_note:
        flow_meta["scrap_note"] = scrap_note

    _write_stock_flow(
        db,
        asset_id=asset.id,
        action=StockFlowAction.SCRAP,
        operator_user_id=context.user.id,
        related_application_id=None,
        meta_json=flow_meta,
    )

    db.commit()

    return build_success_response(
        {
            "asset_id": asset.id,
            "asset_status": asset.status.value,
            "reason": payload.reason,
        }
    )
