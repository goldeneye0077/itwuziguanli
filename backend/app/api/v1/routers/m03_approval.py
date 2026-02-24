"""M03 router implementation: intelligent approval flow."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import (
    Application,
    ApplicationAsset,
    ApplicationItem,
    ApprovalHistory,
    Logistics,
)
from ....models.catalog import Sku
from ....models.enums import (
    ApplicationStatus,
    ApprovalAction,
    ApprovalNode,
    AssetStatus,
    SkuStockFlowAction,
    SkuStockMode,
    StockFlowAction,
)
from ....models.inventory import Asset, StockFlow
from ....models.organization import SysUser
from ....models.sku_stock import SkuStock
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m03 import (
    ApplicationApproveRequest,
    ApplicationAssignAssetsRequest,
)
from ....services.sku_stock_service import apply_stock_delta

router = APIRouter(tags=["M03"])


def _to_iso8601(value: datetime) -> str:
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _build_application_title(labels: list[str]) -> str:
    names: list[str] = []
    for raw in labels:
        value = raw.strip()
        if not value or value in names:
            continue
        names.append(value)
    if not names:
        return "关于物料的申请"
    if len(names) <= 2:
        return f"关于{'、'.join(names)}的申请"
    return f"关于{'、'.join(names[:2])}等{len(names)}项的申请"


def _require_any_role(context: AuthContext, allowed_roles: set[str]) -> None:
    if context.roles.intersection(allowed_roles):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色权限不足，无法执行此操作。",
    )


def _build_inbox_query(node: ApprovalNode) -> Select[tuple[Application, SysUser]]:
    if node == ApprovalNode.LEADER:
        status = ApplicationStatus.LOCKED
    else:
        status = ApplicationStatus.LEADER_APPROVED
    return (
        select(Application, SysUser)
        .join(SysUser, SysUser.id == Application.applicant_user_id)
        .where(Application.status == status)
        .order_by(Application.created_at.asc(), Application.id.asc())
    )


def _assert_application_status(
    application: Application,
    *,
    expected: ApplicationStatus,
    event: str,
) -> None:
    if application.status == expected:
        return
    raise AppException(
        code="APPLICATION_STATUS_INVALID",
        message="申请单状态不支持该操作。",
        details={
            "application_id": application.id,
            "current_status": application.status.value,
            "expected_status": expected.value,
            "event": event,
        },
    )


def _unlock_application_assets(
    db: Session,
    *,
    application: Application,
    operator_user_id: int,
    reason: str,
) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)
    locked_assets = db.scalars(
        select(Asset)
        .where(
            Asset.locked_application_id == application.id,
            Asset.status == AssetStatus.LOCKED,
        )
        .order_by(Asset.id.asc())
    ).all()
    for asset in locked_assets:
        asset.status = AssetStatus.IN_STOCK
        asset.locked_application_id = None
        db.add(
            StockFlow(
                id=next_stock_flow_id,
                asset_id=asset.id,
                action=StockFlowAction.UNLOCK,
                operator_user_id=operator_user_id,
                related_application_id=application.id,
                occurred_at=now,
                meta_json={"event": reason},
            )
        )
        next_stock_flow_id += 1
    db.query(ApplicationAsset).filter(
        ApplicationAsset.application_id == application.id
    ).delete()

    # Release quantity-stock reservations.
    items = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    if not items:
        return

    sku_rows = db.scalars(
        select(Sku).where(Sku.id.in_([item.sku_id for item in items]))
    ).all()
    mode_by_sku_id = {int(row.id): row.stock_mode for row in sku_rows}

    for item in items:
        if mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY:
            continue
        apply_stock_delta(
            db,
            sku_id=item.sku_id,
            action=SkuStockFlowAction.UNLOCK,
            on_hand_delta=0,
            reserved_delta=-int(item.quantity),
            operator_user_id=operator_user_id,
            related_application_id=application.id,
            occurred_at=now,
            meta_json={"event": reason},
        )


def _create_pickup_qr_string(application: Application) -> str:
    return f"pickup://application/{application.id}?code={application.pickup_code}"


@router.get("/approvals/inbox", response_model=ApiResponse)
def get_approval_inbox(
    node: ApprovalNode = Query(...),
    status: ApplicationStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    if node == ApprovalNode.LEADER:
        _require_any_role(context, {"LEADER", "ADMIN", "SUPER_ADMIN"})
        expected_status = ApplicationStatus.LOCKED
    else:
        _require_any_role(context, {"ADMIN", "SUPER_ADMIN"})
        expected_status = ApplicationStatus.LEADER_APPROVED

    if status is not None and status != expected_status:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="当前节点不支持该状态筛选。",
            details={
                "node": node.value,
                "status": status.value,
                "expected_status": expected_status.value,
            },
        )

    base_stmt = _build_inbox_query(node)
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    offset = (page - 1) * page_size
    rows = db.execute(base_stmt.offset(offset).limit(page_size)).all()

    application_ids = [application.id for application, _ in rows]
    items_by_application: dict[int, list[dict[str, object]]] = {
        key: [] for key in application_ids
    }
    title_labels_by_application: dict[int, list[str]] = {
        key: [] for key in application_ids
    }
    if application_ids:
        item_rows = db.execute(
            select(ApplicationItem, Sku)
            .join(Sku, Sku.id == ApplicationItem.sku_id)
            .where(ApplicationItem.application_id.in_(application_ids))
            .order_by(ApplicationItem.id.asc())
        ).all()
        for item, sku in item_rows:
            items_by_application.setdefault(int(item.application_id), []).append(
                {
                    "sku_id": int(item.sku_id),
                    "quantity": int(item.quantity),
                    "name": sku.name,
                    "brand": sku.brand,
                    "model": sku.model,
                    "spec": sku.spec,
                    "cover_url": sku.cover_url,
                }
            )
            title_labels_by_application.setdefault(int(item.application_id), []).append(
                sku.name or sku.model or sku.brand
            )

    data = []
    for application, applicant in rows:
        items = items_by_application.get(int(application.id), [])
        title = application.title or _build_application_title(
            title_labels_by_application.get(int(application.id), [])
        )
        data.append(
            {
                "application_id": application.id,
                "title": title,
                "applicant": {
                    "id": applicant.id,
                    "name": applicant.name,
                    "department_id": applicant.department_id,
                    "department_name": (
                        application.applicant_department_snapshot
                        or applicant.department_name
                    ),
                },
                "delivery_type": application.delivery_type.value,
                "status": application.status.value,
                "created_at": _to_iso8601(application.created_at),
                "items_summary": items,
                "ai_suggestion": None,
            }
        )

    return build_success_response(
        {
            "items": data,
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": int(total),
            },
        }
    )


@router.get("/applications/{id}", response_model=ApiResponse)
def get_application_detail(
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    application = db.get(Application, id)
    if application is None:
        raise AppException(code="APPLICATION_NOT_FOUND", message="申请单不存在。")

    is_privileged = bool(context.roles.intersection({"LEADER", "ADMIN", "SUPER_ADMIN"}))
    if not is_privileged and application.applicant_user_id != context.user.id:
        raise AppException(code="PERMISSION_DENIED", message="权限不足。")

    applicant = db.get(SysUser, application.applicant_user_id)
    item_rows = db.execute(
        select(ApplicationItem, Sku)
        .join(Sku, Sku.id == ApplicationItem.sku_id)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    sku_ids = sorted({int(sku.id) for _, sku in item_rows})

    serialized_available_rows = (
        db.execute(
            select(Asset.sku_id, func.count(Asset.id))
            .where(
                Asset.sku_id.in_(sku_ids),
                Asset.status == AssetStatus.IN_STOCK,
                Asset.locked_application_id.is_(None),
            )
            .group_by(Asset.sku_id)
        ).all()
        if sku_ids
        else []
    )
    serialized_available_map = {
        int(sku_id): int(count) for sku_id, count in serialized_available_rows
    }

    quantity_stock_rows = (
        db.scalars(select(SkuStock).where(SkuStock.sku_id.in_(sku_ids))).all()
        if sku_ids
        else []
    )
    quantity_available_map = {
        int(row.sku_id): int(row.on_hand_qty - row.reserved_qty)
        for row in quantity_stock_rows
    }

    available_stock_by_sku: dict[int, int] = {}
    for _, sku in item_rows:
        sku_id = int(sku.id)
        if sku.stock_mode == SkuStockMode.QUANTITY:
            available_stock_by_sku[sku_id] = max(0, quantity_available_map.get(sku_id, 0))
        else:
            available_stock_by_sku[sku_id] = max(0, serialized_available_map.get(sku_id, 0))

    approval_history = db.scalars(
        select(ApprovalHistory)
        .where(ApprovalHistory.application_id == application.id)
        .order_by(ApprovalHistory.id.asc())
    ).all()
    logistics = db.scalar(
        select(Logistics).where(Logistics.application_id == application.id).limit(1)
    )
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

    title_labels = [sku.name or sku.model or sku.brand for _, sku in item_rows]
    resolved_title = application.title or _build_application_title(title_labels)

    return build_success_response(
        {
            "application": {
                "id": application.id,
                "title": resolved_title,
                "applicant_user_id": application.applicant_user_id,
                "type": application.type.value,
                "status": application.status.value,
                "delivery_type": application.delivery_type.value,
                "pickup_code": application.pickup_code,
                "pickup_qr_string": application.pickup_qr_string,
                "created_at": _to_iso8601(application.created_at),
                "leader_approver_user_id": application.leader_approver_user_id,
                "admin_reviewer_user_id": application.admin_reviewer_user_id,
                "applicant_snapshot": {
                    "name": application.applicant_name_snapshot or (applicant.name if applicant else None),
                    "department_name": application.applicant_department_snapshot
                    or (applicant.department_name if applicant else None),
                    "phone": application.applicant_phone_snapshot
                    or (applicant.mobile_phone if applicant else None),
                    "job_title": application.applicant_job_title_snapshot
                    or (applicant.job_title if applicant else None),
                },
                "express_address_snapshot": application.express_address_snapshot,
                "items": [
                    {
                        "id": item.id,
                        "sku_id": item.sku_id,
                        "quantity": item.quantity,
                        "note": item.note,
                        "category_id": sku.category_id,
                        "name": sku.name,
                        "brand": sku.brand,
                        "model": sku.model,
                        "spec": sku.spec,
                        "reference_price": str(sku.reference_price),
                        "cover_url": sku.cover_url,
                        "stock_mode": sku.stock_mode.value,
                        "safety_stock_threshold": sku.safety_stock_threshold,
                        "available_stock": available_stock_by_sku.get(int(sku.id), 0),
                    }
                    for item, sku in item_rows
                ],
            },
            "approval_history": [
                {
                    "id": row.id,
                    "node": row.node.value,
                    "action": row.action.value,
                    "actor_user_id": row.actor_user_id,
                    "comment": row.comment,
                    "ai_recommendation_json": row.ai_recommendation_json,
                    "created_at": _to_iso8601(row.created_at),
                }
                for row in approval_history
            ],
            "logistics": (
                {
                    "id": logistics.id,
                    "application_id": logistics.application_id,
                    "receiver_name": logistics.receiver_name,
                    "receiver_phone": logistics.receiver_phone,
                    "province": logistics.province,
                    "city": logistics.city,
                    "district": logistics.district,
                    "detail": logistics.detail,
                    "carrier": logistics.carrier,
                    "tracking_no": logistics.tracking_no,
                    "shipped_at": (
                        _to_iso8601(logistics.shipped_at)
                        if logistics.shipped_at is not None
                        else None
                    ),
                }
                if logistics is not None
                else None
            ),
            "assigned_assets": [
                {
                    "asset_id": asset.id,
                    "asset_tag": asset.asset_tag,
                    "sn": asset.sn,
                    "sku_id": asset.sku_id,
                    "status": asset.status.value,
                }
                for asset in assigned_assets
            ],
        }
    )


@router.post("/applications/{id}/approve", response_model=ApiResponse)
def approve_application(
    id: int,
    payload: ApplicationApproveRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    application = db.get(Application, id)
    if application is None:
        raise AppException(code="APPLICATION_NOT_FOUND", message="申请单不存在。")

    if payload.node == ApprovalNode.LEADER:
        _require_any_role(context, {"LEADER"})
        _assert_application_status(
            application,
            expected=ApplicationStatus.LOCKED,
            event="leader_approval",
        )
        if payload.action == ApprovalAction.APPROVE:
            application.status = ApplicationStatus.LEADER_APPROVED
            application.leader_approver_user_id = context.user.id
        else:
            application.status = ApplicationStatus.LEADER_REJECTED
            application.leader_approver_user_id = context.user.id
            _unlock_application_assets(
                db,
                application=application,
                operator_user_id=context.user.id,
                reason="leader_reject",
            )
    else:
        _require_any_role(context, {"ADMIN", "SUPER_ADMIN"})
        _assert_application_status(
            application,
            expected=ApplicationStatus.LEADER_APPROVED,
            event="admin_approval",
        )
        if payload.action == ApprovalAction.APPROVE:
            application.status = ApplicationStatus.ADMIN_APPROVED
            application.admin_reviewer_user_id = context.user.id

            # Quantity-only applications do not require asset assignment; they can proceed to outbound directly.
            items = db.scalars(
                select(ApplicationItem).where(ApplicationItem.application_id == application.id)
            ).all()
            if items:
                skus = db.scalars(
                    select(Sku).where(Sku.id.in_([item.sku_id for item in items]))
                ).all()
                if skus and all(row.stock_mode == SkuStockMode.QUANTITY for row in skus):
                    application.status = ApplicationStatus.READY_OUTBOUND
                    application.pickup_qr_string = _create_pickup_qr_string(application)
        else:
            application.status = ApplicationStatus.ADMIN_REJECTED
            application.admin_reviewer_user_id = context.user.id
            _unlock_application_assets(
                db,
                application=application,
                operator_user_id=context.user.id,
                reason="admin_reject",
            )

    history = ApprovalHistory(
        id=_next_bigint_id(db, ApprovalHistory),
        application_id=application.id,
        node=payload.node,
        action=payload.action,
        actor_user_id=context.user.id,
        comment=payload.comment,
        ai_recommendation_json=None,
    )
    db.add(history)
    db.commit()

    return build_success_response(
        {
            "application_id": application.id,
            "status": application.status.value,
        }
    )


@router.post("/applications/{id}/assign-assets", response_model=ApiResponse)
def assign_application_assets(
    id: int,
    payload: ApplicationAssignAssetsRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_any_role(context, {"ADMIN", "SUPER_ADMIN"})

    application = db.get(Application, id)
    if application is None:
        raise AppException(code="APPLICATION_NOT_FOUND", message="申请单不存在。")
    _assert_application_status(
        application,
        expected=ApplicationStatus.ADMIN_APPROVED,
        event="assign_assets",
    )

    item_rows = db.scalars(
        select(ApplicationItem)
        .where(ApplicationItem.application_id == application.id)
        .order_by(ApplicationItem.id.asc())
    ).all()
    required_by_sku = {item.sku_id: item.quantity for item in item_rows}
    sku_rows = db.scalars(select(Sku).where(Sku.id.in_(list(required_by_sku)))).all()
    mode_by_sku_id = {int(row.id): row.stock_mode for row in sku_rows}
    required_serialized_by_sku = {
        item.sku_id: item.quantity
        for item in item_rows
        if mode_by_sku_id.get(int(item.sku_id)) != SkuStockMode.QUANTITY
    }
    assigned_by_sku: dict[int, list[int]] = {}
    provided_asset_ids: set[int] = set()
    for entry in payload.assignments:
        if mode_by_sku_id.get(int(entry.sku_id)) == SkuStockMode.QUANTITY:
            raise AppException(
                code="VALIDATION_ERROR",
                message="数量库存物料无需分配资产，请移除分配清单中的该物料。",
                details={"sku_id": int(entry.sku_id)},
            )
        current = assigned_by_sku.setdefault(entry.sku_id, [])
        for asset_id in entry.asset_ids:
            if asset_id in provided_asset_ids:
                raise AppException(
                    code="VALIDATION_ERROR",
                    message="检测到重复分配的资产。",
                    details={"asset_id": asset_id},
                )
            current.append(asset_id)
            provided_asset_ids.add(asset_id)

    if not required_serialized_by_sku:
        if assigned_by_sku:
            raise AppException(
                code="VALIDATION_ERROR",
                message="该申请单不需要分配资产。",
                details={"application_id": int(application.id)},
            )
        application.status = ApplicationStatus.READY_OUTBOUND
        application.pickup_qr_string = _create_pickup_qr_string(application)
        db.commit()
        return build_success_response(
            {
                "application_id": application.id,
                "status": application.status.value,
                "assigned_assets": [],
            }
        )

    if set(assigned_by_sku) != set(required_serialized_by_sku):
        raise AppException(
            code="VALIDATION_ERROR",
            message="分配清单必须覆盖所有申请的物料。",
            details={
                "required_sku_ids": sorted(required_serialized_by_sku),
                "provided_sku_ids": sorted(assigned_by_sku),
            },
        )

    for sku_id, required_quantity in required_serialized_by_sku.items():
        provided_quantity = len(assigned_by_sku.get(sku_id, []))
        if provided_quantity != required_quantity:
            raise AppException(
                code="VALIDATION_ERROR",
                message="分配数量与申请数量不一致。",
                details={
                    "sku_id": sku_id,
                    "required": required_quantity,
                    "provided": provided_quantity,
                },
            )

    selected_assets = db.scalars(
        select(Asset).where(Asset.id.in_(provided_asset_ids)).order_by(Asset.id.asc())
    ).all()
    if len(selected_assets) != len(provided_asset_ids):
        found_asset_ids = {asset.id for asset in selected_assets}
        missing_asset_ids = sorted(provided_asset_ids - found_asset_ids)
        raise AppException(
            code="ASSET_NOT_FOUND",
            message="部分资产不存在。",
            details={"missing_asset_ids": missing_asset_ids},
        )

    now = datetime.now(UTC).replace(tzinfo=None)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)
    next_relation_id = _next_bigint_id(db, ApplicationAsset)
    selected_assets_by_id = {asset.id: asset for asset in selected_assets}

    current_relations = db.scalars(
        select(ApplicationAsset)
        .where(ApplicationAsset.application_id == application.id)
        .order_by(ApplicationAsset.id.asc())
    ).all()
    current_asset_ids = {row.asset_id for row in current_relations}

    removed_asset_ids = sorted(current_asset_ids - provided_asset_ids)
    added_asset_ids = sorted(provided_asset_ids - current_asset_ids)

    if removed_asset_ids:
        removed_assets = db.scalars(
            select(Asset)
            .where(Asset.id.in_(removed_asset_ids))
            .order_by(Asset.id.asc())
        ).all()
        for asset in removed_assets:
            if (
                asset.status != AssetStatus.LOCKED
                or asset.locked_application_id != application.id
            ):
                raise AppException(
                    code="ASSET_LOCKED",
                    message="无法释放未被该申请单锁定的资产。",
                    details={"asset_id": asset.id},
                )
            asset.status = AssetStatus.IN_STOCK
            asset.locked_application_id = None
            db.add(
                StockFlow(
                    id=next_stock_flow_id,
                    asset_id=asset.id,
                    action=StockFlowAction.UNLOCK,
                    operator_user_id=context.user.id,
                    related_application_id=application.id,
                    occurred_at=now,
                    meta_json={"event": "assign_assets_rebalance"},
                )
            )
            next_stock_flow_id += 1

    for asset_id in added_asset_ids:
        asset = selected_assets_by_id[asset_id]
        if asset.sku_id not in assigned_by_sku:
            raise AppException(
                code="VALIDATION_ERROR",
                message="分配清单中不存在该资产对应的物料。",
                details={"asset_id": asset.id, "sku_id": asset.sku_id},
            )
        if asset.status == AssetStatus.IN_STOCK and asset.locked_application_id is None:
            asset.status = AssetStatus.LOCKED
            asset.locked_application_id = application.id
            db.add(
                StockFlow(
                    id=next_stock_flow_id,
                    asset_id=asset.id,
                    action=StockFlowAction.LOCK,
                    operator_user_id=context.user.id,
                    related_application_id=application.id,
                    occurred_at=now,
                    meta_json={"event": "assign_assets_rebalance"},
                )
            )
            next_stock_flow_id += 1
        elif (
            asset.status == AssetStatus.LOCKED
            and asset.locked_application_id == application.id
        ):
            pass
        else:
            raise AppException(
                code="ASSET_LOCKED",
                message="该资产当前不可分配。",
                details={"asset_id": asset.id},
            )

    for asset in selected_assets:
        expected_skus = [
            sku_id for sku_id, ids in assigned_by_sku.items() if asset.id in ids
        ]
        if len(expected_skus) != 1 or expected_skus[0] != asset.sku_id:
            raise AppException(
                code="VALIDATION_ERROR",
                message="分配的资产与申请的物料不匹配。",
                details={"asset_id": asset.id, "sku_id": asset.sku_id},
            )

    db.query(ApplicationAsset).filter(
        ApplicationAsset.application_id == application.id
    ).delete()
    for entry in payload.assignments:
        for asset_id in entry.asset_ids:
            db.add(
                ApplicationAsset(
                    id=next_relation_id,
                    application_id=application.id,
                    asset_id=asset_id,
                )
            )
            next_relation_id += 1

    application.status = ApplicationStatus.READY_OUTBOUND
    application.pickup_qr_string = _create_pickup_qr_string(application)

    db.commit()

    assigned_assets = db.execute(
        select(Asset, Sku)
        .join(ApplicationAsset, ApplicationAsset.asset_id == Asset.id)
        .join(Sku, Sku.id == Asset.sku_id)
        .where(ApplicationAsset.application_id == application.id)
        .order_by(Asset.id.asc())
    ).all()

    return build_success_response(
        {
            "application_id": application.id,
            "status": application.status.value,
            "assigned_assets": [
                {
                    "asset_id": asset.id,
                    "asset_tag": asset.asset_tag,
                    "sn": asset.sn,
                    "sku_id": asset.sku_id,
                    "sku_label": (sku.name or f"{sku.brand} {sku.model}").strip(),
                }
                for asset, sku in assigned_assets
            ],
        }
    )
