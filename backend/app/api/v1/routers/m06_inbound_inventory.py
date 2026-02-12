"""M06 router implementation: inbound and inventory operations."""

from __future__ import annotations

import re
import csv
import io
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import ApplicationAsset, ApplicationItem
from ....models.catalog import Category, Sku
from ....models.enums import (
    AssetStatus,
    OcrDocType,
    OcrJobStatus,
    SkuStockFlowAction,
    SkuStockMode,
    StockFlowAction,
)
from ....models.inbound import OcrInboundJob
from ....models.inventory import Asset, StockFlow
from ....models.organization import SysUser
from ....models.sku_stock import SkuStock, SkuStockFlow
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m06 import (
    AdminAssetCreateRequest,
    AdminAssetUpdateRequest,
    AdminCategoryCreateRequest,
    AdminCategoryUpdateRequest,
    AdminSkuCreateRequest,
    AdminSkuUpdateRequest,
    OcrInboundConfirmAssetPayload,
    OcrInboundConfirmRequest,
    OcrInboundConfirmSkuPayload,
    SkuStockAdjustRequest,
    SkuStockInboundRequest,
    SkuStockOutboundRequest,
)
from ....services.sku_stock_service import apply_stock_delta, get_or_create_stock_for_update

router = APIRouter(tags=["M06"])
PERMISSION_INVENTORY_READ = "INVENTORY:READ"
PERMISSION_INVENTORY_WRITE = "INVENTORY:WRITE"


def _to_iso8601(value: datetime) -> str:
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


def _to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _next_bigint_id(db: Session, model: type[object]) -> int:
    value = db.scalar(select(func.max(getattr(model, "id"))))
    return int(value or 0) + 1


def _require_admin(
    context: AuthContext,
    *,
    required_permissions: set[str] | None = None,
) -> None:
    if not context.roles.intersection({"ADMIN", "SUPER_ADMIN"}):
        raise AppException(
            code="ROLE_INSUFFICIENT",
            message="当前角色权限不足，无法执行此操作。",
        )

    if "SUPER_ADMIN" in context.roles:
        return

    normalized = {
        str(value).strip().upper()
        for value in (required_permissions or set())
        if str(value).strip()
    }
    if not normalized:
        return
    if normalized.intersection(context.permissions):
        return
    raise AppException(
        code="PERMISSION_DENIED",
        message="当前账号缺少执行该操作所需权限。",
        details={"required_permissions": sorted(normalized)},
    )


def _sanitize_filename(filename: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "-", filename).strip("-")
    return normalized or "upload.bin"


def _build_mock_extracted_payload(
    *, filename: str, doc_type: OcrDocType | None
) -> dict[str, object]:
    resolved_doc_type = doc_type or OcrDocType.OTHER
    document_key = filename.rsplit(".", 1)[0].upper()[:24] or "UPLOAD"
    return {
        "doc_type": resolved_doc_type.value,
        "supplier": "\u6a21\u62df\u4f9b\u5e94\u5546\u6709\u9650\u516c\u53f8",
        "document_no": f"MOCK-{document_key}",
        "currency": "CNY",
        "line_items": [
            {
                "brand": "Lenovo",
                "model": "ThinkPad T14",
                "spec": "i7/32G/1T",
                "quantity": 2,
                "reference_price": "8999.00",
            }
        ],
    }


def _normalize_sku_payload(
    payload: OcrInboundConfirmSkuPayload,
) -> tuple[int, str, str, str, Decimal, str | None, SkuStockMode, int]:
    brand = payload.brand.strip()
    model = payload.model.strip()
    spec = payload.spec.strip()
    if not brand or not model or not spec:
        raise AppException(
            code="VALIDATION_ERROR",
            message="物料品牌/型号/规格不能为空。",
        )

    cover_url = payload.cover_url.strip() if payload.cover_url else None
    if cover_url == "":
        cover_url = None

    return (
        payload.category_id,
        brand,
        model,
        spec,
        payload.reference_price,
        cover_url,
        payload.stock_mode,
        payload.safety_stock_threshold,
    )


def _assert_category_exists(db: Session, *, category_id: int) -> None:
    category_exists = db.scalar(
        select(Category.id).where(Category.id == category_id).limit(1)
    )
    if category_exists is not None:
        return
    raise AppException(
        code="RESOURCE_NOT_FOUND",
        message="分类不存在。",
        details={"category_id": category_id},
    )


def _create_sku(
    db: Session,
    *,
    payload: OcrInboundConfirmSkuPayload,
) -> Sku:
    (
        category_id,
        brand,
        model,
        spec,
        reference_price,
        cover_url,
        stock_mode,
        safety_stock_threshold,
    ) = _normalize_sku_payload(payload)
    _assert_category_exists(db, category_id=category_id)

    sku = Sku(
        id=_next_bigint_id(db, Sku),
        category_id=category_id,
        brand=brand,
        model=model,
        spec=spec,
        reference_price=reference_price,
        cover_url=cover_url,
        stock_mode=stock_mode,
        safety_stock_threshold=safety_stock_threshold,
    )
    db.add(sku)
    db.flush()
    return sku


def _resolve_or_create_sku(
    db: Session,
    *,
    payload: OcrInboundConfirmSkuPayload,
) -> Sku:
    (
        category_id,
        brand,
        model,
        spec,
        reference_price,
        cover_url,
        stock_mode,
        safety_stock_threshold,
    ) = _normalize_sku_payload(payload)
    _assert_category_exists(db, category_id=category_id)

    existing = db.scalar(
        select(Sku)
        .where(
            Sku.category_id == category_id,
            Sku.brand == brand,
            Sku.model == model,
            Sku.spec == spec,
            Sku.reference_price == reference_price,
        )
        .limit(1)
    )
    if existing is not None:
        if existing.stock_mode != stock_mode:
            raise AppException(
                code="VALIDATION_ERROR",
                message="SKU 库存模式与已有记录不一致，无法复用该物料。",
                details={
                    "sku_id": int(existing.id),
                    "existing_stock_mode": existing.stock_mode.value,
                    "payload_stock_mode": stock_mode.value,
                },
            )
        return existing

    sku = Sku(
        id=_next_bigint_id(db, Sku),
        category_id=category_id,
        brand=brand,
        model=model,
        spec=spec,
        reference_price=reference_price,
        cover_url=cover_url,
        stock_mode=stock_mode,
        safety_stock_threshold=safety_stock_threshold,
    )
    db.add(sku)
    db.flush()
    return sku


def _prepare_assets_for_creation(
    db: Session,
    *,
    assets: list[OcrInboundConfirmAssetPayload],
) -> list[tuple[str, datetime | None]]:
    prepared: list[tuple[str, datetime | None]] = []
    seen: set[str] = set()
    duplicate_sns: set[str] = set()

    for row in assets:
        normalized_sn = row.sn.strip()
        if not normalized_sn:
            raise AppException(
                code="VALIDATION_ERROR",
                message="资产序列号不能为空。",
            )
        prepared.append((normalized_sn, row.inbound_at))
        if normalized_sn in seen:
            duplicate_sns.add(normalized_sn)
        seen.add(normalized_sn)

    if duplicate_sns:
        raise AppException(
            code="DUPLICATE_SN",
            message="检测到重复的资产序列号。",
            details={"sns": sorted(duplicate_sns)},
        )

    existing_sns = set(
        db.scalars(
            select(Asset.sn).where(Asset.sn.in_([item[0] for item in prepared]))
        ).all()
    )
    if existing_sns:
        raise AppException(
            code="DUPLICATE_SN",
            message="资产序列号已存在。",
            details={"sns": sorted(existing_sns)},
        )

    return prepared


def _allocate_asset_tag(db: Session, *, asset_id: int) -> str:
    sequence = 0
    while True:
        suffix = "" if sequence == 0 else f"-{sequence}"
        candidate = f"AT-{asset_id:06d}{suffix}"
        exists = db.scalar(
            select(Asset.id).where(Asset.asset_tag == candidate).limit(1)
        )
        if exists is None:
            return candidate
        sequence += 1


def _create_assets_for_sku(
    db: Session,
    *,
    sku_id: int,
    assets: list[OcrInboundConfirmAssetPayload],
    operator_user_id: int,
    flow_meta_base: dict[str, object],
) -> list[Asset]:
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")
    if sku.stock_mode != SkuStockMode.SERIALIZED:
        raise AppException(
            code="VALIDATION_ERROR",
            message="该物料为数量库存模式，不能创建序列号资产。",
            details={"sku_id": int(sku_id), "stock_mode": sku.stock_mode.value},
        )

    prepared_assets = _prepare_assets_for_creation(db, assets=assets)
    now = datetime.now(UTC).replace(tzinfo=None)
    next_asset_id = _next_bigint_id(db, Asset)
    next_stock_flow_id = _next_bigint_id(db, StockFlow)
    created_assets: list[Asset] = []

    for serial_number, inbound_at in prepared_assets:
        asset_id = next_asset_id
        asset = Asset(
            id=asset_id,
            asset_tag=_allocate_asset_tag(db, asset_id=asset_id),
            sku_id=sku_id,
            sn=serial_number,
            status=AssetStatus.IN_STOCK,
            holder_user_id=None,
            locked_application_id=None,
            inbound_at=_to_naive_utc(inbound_at) if inbound_at is not None else now,
        )
        db.add(asset)
        db.add(
            StockFlow(
                id=next_stock_flow_id,
                asset_id=asset_id,
                action=StockFlowAction.INBOUND,
                operator_user_id=operator_user_id,
                related_application_id=None,
                occurred_at=now,
                meta_json={**flow_meta_base, "sn": serial_number},
            )
        )
        created_assets.append(asset)
        next_asset_id += 1
        next_stock_flow_id += 1

    db.flush()
    return created_assets


def _serialize_sku(sku: Sku) -> dict[str, object]:
    return {
        "id": sku.id,
        "category_id": sku.category_id,
        "brand": sku.brand,
        "model": sku.model,
        "spec": sku.spec,
        "reference_price": str(sku.reference_price),
        "cover_url": sku.cover_url,
        "stock_mode": sku.stock_mode.value,
        "safety_stock_threshold": sku.safety_stock_threshold,
    }


def _serialize_asset(asset: Asset) -> dict[str, object]:
    return {
        "id": asset.id,
        "asset_tag": asset.asset_tag,
        "sku_id": asset.sku_id,
        "sn": asset.sn,
        "status": asset.status.value,
        "holder_user_id": asset.holder_user_id,
        "locked_application_id": asset.locked_application_id,
        "inbound_at": _to_iso8601(asset.inbound_at),
    }


@router.post("/inbound/ocr-jobs", response_model=ApiResponse)
def create_ocr_job(
    file: UploadFile = File(...),
    doc_type: OcrDocType | None = Form(default=None),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    safe_name = _sanitize_filename(file.filename or "upload.bin")
    job_id = _next_bigint_id(db, OcrInboundJob)
    job = OcrInboundJob(
        id=job_id,
        operator_user_id=context.user.id,
        source_file_url=f"/mock-storage/inbound/{job_id}-{safe_name}",
        doc_type=doc_type,
        status=OcrJobStatus.READY_FOR_REVIEW,
        extracted_json=_build_mock_extracted_payload(
            filename=safe_name, doc_type=doc_type
        ),
        error_message=None,
        confirmed_sku_id=None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return build_success_response({"job_id": job.id, "status": job.status.value})


@router.get("/inbound/ocr-jobs/{id}", response_model=ApiResponse)
def get_ocr_job_detail(
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_READ})

    job = db.get(OcrInboundJob, id)
    if job is None:
        raise AppException(
            code="RESOURCE_NOT_FOUND",
            message="识别入库任务不存在。",
        )

    return build_success_response(
        {
            "job_id": job.id,
            "status": job.status.value,
            "source_file_url": job.source_file_url,
            "extracted": job.extracted_json or {},
        }
    )


@router.post("/inbound/ocr-jobs/{id}/confirm", response_model=ApiResponse)
def confirm_ocr_job(
    id: int,
    payload: OcrInboundConfirmRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    job = db.get(OcrInboundJob, id)
    if job is None:
        raise AppException(
            code="RESOURCE_NOT_FOUND",
            message="识别入库任务不存在。",
        )
    if job.status != OcrJobStatus.READY_FOR_REVIEW:
        raise AppException(
            code="APPLICATION_STATUS_INVALID",
            message="识别入库任务当前状态不允许确认。",
            details={
                "job_id": job.id,
                "current_status": job.status.value,
                "expected_status": OcrJobStatus.READY_FOR_REVIEW.value,
            },
        )

    sku = _resolve_or_create_sku(db, payload=payload.sku)
    inbound_meta = {"event": "ocr_confirm_inbound", "ocr_job_id": job.id}
    if sku.stock_mode == SkuStockMode.QUANTITY:
        if payload.assets:
            raise AppException(
                code="VALIDATION_ERROR",
                message="数量库存入库不需要填写序列号资产清单。",
                details={"sku_id": int(sku.id)},
            )
        apply_stock_delta(
            db,
            sku_id=sku.id,
            action=SkuStockFlowAction.INBOUND,
            on_hand_delta=int(payload.quantity),
            reserved_delta=0,
            operator_user_id=context.user.id,
            related_application_id=None,
            occurred_at=datetime.now(UTC).replace(tzinfo=None),
            meta_json=inbound_meta,
        )
        created_assets: list[Asset] = []
    else:
        if not payload.assets:
            raise AppException(
                code="VALIDATION_ERROR",
                message="序列号资产入库必须填写至少 1 条序列号。",
                details={"sku_id": int(sku.id)},
            )
        created_assets = _create_assets_for_sku(
            db,
            sku_id=sku.id,
            assets=payload.assets,
            operator_user_id=context.user.id,
            flow_meta_base=inbound_meta,
        )

    job.status = OcrJobStatus.CONFIRMED
    job.confirmed_sku_id = sku.id
    db.commit()

    return build_success_response(
        {
            "sku_id": sku.id,
            "inbound_quantity": int(payload.quantity),
            "created_assets": [
                {"asset_id": item.id, "asset_tag": item.asset_tag, "sn": item.sn}
                for item in created_assets
            ],
        }
    )


@router.get("/admin/skus", response_model=ApiResponse)
def list_admin_skus(
    sku_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    q: str | None = Query(default=None, max_length=80),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_READ})

    stmt = select(Sku)
    if sku_id is not None:
        stmt = stmt.where(Sku.id == sku_id)
    if category_id is not None:
        stmt = stmt.where(Sku.category_id == category_id)

    normalized_q = (q or "").strip()
    if normalized_q:
        like = f"%{normalized_q}%"
        stmt = stmt.where(
            or_(
                Sku.brand.like(like),
                Sku.model.like(like),
                Sku.spec.like(like),
            )
        )

    rows = db.scalars(stmt.order_by(Sku.id.asc())).all()
    return build_success_response([_serialize_sku(item) for item in rows])


@router.post("/admin/skus", response_model=ApiResponse)
def create_admin_sku(
    payload: AdminSkuCreateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    record = _create_sku(db, payload=payload)
    db.commit()
    db.refresh(record)
    return build_success_response(_serialize_sku(record))


@router.put("/admin/skus/{id}", response_model=ApiResponse)
def update_admin_sku(
    id: int,
    payload: AdminSkuUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    record = db.get(Sku, id)
    if record is None:
        raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")

    (
        category_id,
        brand,
        model,
        spec,
        reference_price,
        cover_url,
        stock_mode,
        safety_stock_threshold,
    ) = _normalize_sku_payload(payload)
    _assert_category_exists(db, category_id=category_id)

    record.category_id = category_id
    record.brand = brand
    record.model = model
    record.spec = spec
    record.reference_price = reference_price
    record.cover_url = cover_url
    if record.stock_mode != stock_mode:
        referenced_asset_id = db.scalar(
            select(Asset.id).where(Asset.sku_id == id).limit(1)
        )
        referenced_item_id = db.scalar(
            select(ApplicationItem.id).where(ApplicationItem.sku_id == id).limit(1)
        )
        referenced_flow_id = db.scalar(
            select(SkuStockFlow.id).where(SkuStockFlow.sku_id == id).limit(1)
        )
        referenced_stock = db.get(SkuStock, id)
        stock_in_use = (
            referenced_stock is not None
            and (
                int(referenced_stock.on_hand_qty) != 0
                or int(referenced_stock.reserved_qty) != 0
            )
        )
        if (
            referenced_asset_id is not None
            or referenced_item_id is not None
            or referenced_flow_id is not None
            or stock_in_use
        ):
            raise AppException(
                code="SKU_IN_USE",
                message="物料已被使用，无法切换库存模式。",
                details={
                    "sku_id": int(id),
                    "referenced_asset_id": (
                        int(referenced_asset_id) if referenced_asset_id is not None else None
                    ),
                    "referenced_application_item_id": (
                        int(referenced_item_id) if referenced_item_id is not None else None
                    ),
                    "referenced_sku_stock_flow_id": (
                        int(referenced_flow_id) if referenced_flow_id is not None else None
                    ),
                    "sku_stock_on_hand_qty": (
                        int(referenced_stock.on_hand_qty) if referenced_stock is not None else 0
                    ),
                    "sku_stock_reserved_qty": (
                        int(referenced_stock.reserved_qty) if referenced_stock is not None else 0
                    ),
                },
            )
        record.stock_mode = stock_mode
    record.safety_stock_threshold = safety_stock_threshold

    db.commit()
    db.refresh(record)
    return build_success_response(_serialize_sku(record))


@router.delete("/admin/skus/{id}", response_model=ApiResponse)
def delete_admin_sku(
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    record = db.get(Sku, id)
    if record is None:
        raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")

    referenced_asset_id = db.scalar(
        select(Asset.id).where(Asset.sku_id == id).limit(1)
    )
    if referenced_asset_id is not None:
        raise AppException(
            code="SKU_IN_USE",
            message="物料已有关联资产，无法删除。",
            details={"asset_id": int(referenced_asset_id)},
        )

    referenced_item_id = db.scalar(
        select(ApplicationItem.id).where(ApplicationItem.sku_id == id).limit(1)
    )
    if referenced_item_id is not None:
        raise AppException(
            code="SKU_IN_USE",
            message="物料已有关联申请记录，无法删除。",
            details={"application_item_id": int(referenced_item_id)},
        )

    referenced_flow_id = db.scalar(
        select(SkuStockFlow.id).where(SkuStockFlow.sku_id == id).limit(1)
    )
    if referenced_flow_id is not None:
        raise AppException(
            code="SKU_IN_USE",
            message="物料已存在库存流水记录，无法删除。",
            details={"sku_stock_flow_id": int(referenced_flow_id)},
        )

    referenced_stock = db.get(SkuStock, id)
    if referenced_stock is not None:
        if int(referenced_stock.on_hand_qty) != 0 or int(referenced_stock.reserved_qty) != 0:
            raise AppException(
                code="SKU_IN_USE",
                message="物料仍存在库存数量，无法删除。",
                details={
                    "sku_id": int(id),
                    "on_hand_qty": int(referenced_stock.on_hand_qty),
                    "reserved_qty": int(referenced_stock.reserved_qty),
                },
            )
        db.delete(referenced_stock)

    try:
        db.delete(record)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppException(
            code="SKU_IN_USE",
            message="物料已被引用，无法删除。",
        ) from None

    return build_success_response({"deleted": True, "id": id})


@router.get("/admin/assets", response_model=ApiResponse)
def list_admin_assets(
    sku_id: int | None = Query(default=None, ge=1),
    status: AssetStatus | None = Query(default=None),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_READ})

    stmt = select(Asset)
    if sku_id is not None:
        stmt = stmt.where(Asset.sku_id == sku_id)
    if status is not None:
        stmt = stmt.where(Asset.status == status)

    rows = db.scalars(stmt.order_by(Asset.id.asc())).all()
    return build_success_response([_serialize_asset(item) for item in rows])


@router.post("/admin/assets", response_model=ApiResponse)
def create_admin_assets(
    payload: AdminAssetCreateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    created_assets = _create_assets_for_sku(
        db,
        sku_id=payload.sku_id,
        assets=payload.assets,
        operator_user_id=context.user.id,
        flow_meta_base={"event": "admin_assets_create"},
    )
    db.commit()

    return build_success_response(
        {
            "sku_id": payload.sku_id,
            "created_assets": [
                {"asset_id": item.id, "asset_tag": item.asset_tag, "sn": item.sn}
                for item in created_assets
            ],
        }
    )


@router.put("/admin/assets/{id}", response_model=ApiResponse)
def update_admin_asset(
    id: int,
    payload: AdminAssetUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    asset = db.get(Asset, id)
    if asset is None:
        raise AppException(code="ASSET_NOT_FOUND", message="资产不存在。")

    referenced_mapping_id = db.scalar(
        select(ApplicationAsset.id).where(ApplicationAsset.asset_id == id).limit(1)
    )
    is_locked = asset.locked_application_id is not None or referenced_mapping_id is not None

    if payload.sku_id is not None and payload.sku_id != asset.sku_id:
        if is_locked:
            raise AppException(
                code="ASSET_LOCKED",
                message="资产已被锁定或已被申请流程引用，无法修改物料编号。",
                details={"asset_id": int(id)},
            )
        sku_exists = db.scalar(select(Sku.id).where(Sku.id == payload.sku_id).limit(1))
        if sku_exists is None:
            raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")
        asset.sku_id = payload.sku_id

    if payload.sn is not None:
        normalized_sn = payload.sn.strip()
        if not normalized_sn:
            raise AppException(code="VALIDATION_ERROR", message="资产序列号不能为空。")
        if normalized_sn != asset.sn:
            if is_locked:
                raise AppException(
                    code="ASSET_LOCKED",
                    message="资产已被锁定或已被申请流程引用，无法修改资产序列号。",
                    details={"asset_id": int(id)},
                )
            existing_asset_id = db.scalar(
                select(Asset.id).where(Asset.sn == normalized_sn).limit(1)
            )
            if existing_asset_id is not None:
                raise AppException(
                    code="DUPLICATE_SN",
                    message="资产序列号已存在。",
                    details={"sn": normalized_sn},
                )
            asset.sn = normalized_sn

    if payload.status is not None and payload.status != asset.status:
        if is_locked:
            raise AppException(
                code="ASSET_LOCKED",
                message="资产已被锁定或已被申请流程引用，无法修改资产状态。",
                details={"asset_id": int(id)},
            )
        asset.status = payload.status

    if payload.inbound_at is not None:
        asset.inbound_at = _to_naive_utc(payload.inbound_at)

    db.commit()
    db.refresh(asset)
    return build_success_response(_serialize_asset(asset))


@router.delete("/admin/assets/{id}", response_model=ApiResponse)
def delete_admin_asset(
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    asset = db.get(Asset, id)
    if asset is None:
        raise AppException(code="ASSET_NOT_FOUND", message="资产不存在。")

    if asset.status != AssetStatus.IN_STOCK:
        raise AppException(
            code="ASSET_LOCKED",
            message="仅允许删除“在库”状态的资产。",
            details={"asset_id": int(id), "status": asset.status.value},
        )
    if asset.locked_application_id is not None:
        raise AppException(
            code="ASSET_LOCKED",
            message="资产已被锁定，无法删除。",
            details={"asset_id": int(id), "locked_application_id": asset.locked_application_id},
        )

    referenced_mapping_id = db.scalar(
        select(ApplicationAsset.id).where(ApplicationAsset.asset_id == id).limit(1)
    )
    if referenced_mapping_id is not None:
        raise AppException(
            code="ASSET_LOCKED",
            message="资产已被申请流程引用，无法删除。",
            details={"asset_id": int(id)},
        )

    try:
        referenced_flow_app_id = db.scalar(
            select(StockFlow.related_application_id)
            .where(
                StockFlow.asset_id == id,
                StockFlow.related_application_id.is_not(None),
            )
            .limit(1)
        )
        if referenced_flow_app_id is not None:
            raise AppException(
                code="ASSET_LOCKED",
                message="资产库存流水已关联申请，无法删除。",
                details={"asset_id": int(id), "related_application_id": int(referenced_flow_app_id)},
            )

        # 删除资产前先清理库存流水，避免外键 RESTRICT 导致无法删除。
        db.execute(delete(StockFlow).where(StockFlow.asset_id == id))
        db.delete(asset)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppException(
            code="ASSET_LOCKED",
            message="资产已被引用，无法删除。",
            details={"asset_id": int(id)},
        ) from None

    return build_success_response({"deleted": True, "id": id})


@router.get("/inventory/summary", response_model=ApiResponse)
def get_inventory_summary(
    sku_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    q: str | None = Query(default=None, max_length=80),
    below_threshold: bool = Query(default=False),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_READ})

    sku_stmt = select(Sku)
    if sku_id is not None:
        sku_stmt = sku_stmt.where(Sku.id == sku_id)
    if category_id is not None:
        sku_stmt = sku_stmt.where(Sku.category_id == category_id)

    normalized_q = (q or "").strip()
    if normalized_q:
        like = f"%{normalized_q}%"
        sku_stmt = sku_stmt.where(
            or_(
                Sku.brand.like(like),
                Sku.model.like(like),
                Sku.spec.like(like),
            )
        )

    skus = db.scalars(sku_stmt.order_by(Sku.id.asc())).all()
    if not skus:
        return build_success_response([])

    sku_ids = [int(item.id) for item in skus]
    stock_rows = db.scalars(
        select(SkuStock).where(SkuStock.sku_id.in_(sku_ids)).order_by(SkuStock.sku_id.asc())
    ).all()
    stock_by_sku_id = {int(row.sku_id): row for row in stock_rows}
    asset_stmt = (
        select(Asset.sku_id, Asset.status, func.count(Asset.id))
        .where(Asset.sku_id.in_(sku_ids))
        .group_by(Asset.sku_id, Asset.status)
        .order_by(Asset.sku_id.asc())
    )
    rows = db.execute(asset_stmt).all()

    summary_by_sku: dict[int, dict[str, object]] = {}
    for sku in skus:
        summary_by_sku[int(sku.id)] = {
            "sku_id": int(sku.id),
            "category_id": sku.category_id,
            "brand": sku.brand,
            "model": sku.model,
            "spec": sku.spec,
            "reference_price": str(sku.reference_price),
            "cover_url": sku.cover_url,
            "stock_mode": sku.stock_mode.value,
            "safety_stock_threshold": sku.safety_stock_threshold,
            "total_count": 0,
            "in_stock_count": 0,
            "locked_count": 0,
            "in_use_count": 0,
            "repairing_count": 0,
            "scrapped_count": 0,
            "on_hand_qty": 0,
            "reserved_qty": 0,
            "available_qty": 0,
        }

    for current_sku_id, current_status, count in rows:
        record = summary_by_sku.get(int(current_sku_id))
        if record is None:
            continue

        count_value = int(count)
        record["total_count"] = int(record["total_count"]) + count_value

        if current_status == AssetStatus.IN_STOCK:
            record["in_stock_count"] = int(record["in_stock_count"]) + count_value
        elif current_status == AssetStatus.LOCKED:
            record["locked_count"] = int(record["locked_count"]) + count_value
        elif current_status in {AssetStatus.IN_USE, AssetStatus.BORROWED}:
            record["in_use_count"] = int(record["in_use_count"]) + count_value
        elif current_status == AssetStatus.REPAIRING:
            record["repairing_count"] = int(record["repairing_count"]) + count_value
        elif current_status == AssetStatus.SCRAPPED:
            record["scrapped_count"] = int(record["scrapped_count"]) + count_value

    result: list[dict[str, object]] = []
    for record_key in sorted(summary_by_sku):
        record = summary_by_sku[record_key]
        if record.get("stock_mode") == SkuStockMode.QUANTITY.value:
            stock = stock_by_sku_id.get(int(record_key))
            on_hand_qty = int(stock.on_hand_qty) if stock is not None else 0
            reserved_qty = int(stock.reserved_qty) if stock is not None else 0
            available_qty = on_hand_qty - reserved_qty
            record["on_hand_qty"] = on_hand_qty
            record["reserved_qty"] = reserved_qty
            record["available_qty"] = available_qty
            record["total_count"] = on_hand_qty
            record["in_stock_count"] = available_qty
            record["locked_count"] = reserved_qty
            record["in_use_count"] = 0
            record["repairing_count"] = 0
            record["scrapped_count"] = 0
        else:
            in_stock_count = int(record.get("in_stock_count") or 0)
            locked_count = int(record.get("locked_count") or 0)
            record["on_hand_qty"] = in_stock_count + locked_count
            record["reserved_qty"] = locked_count
            record["available_qty"] = in_stock_count

        threshold = int(record.get("safety_stock_threshold") or 0)
        available_qty = int(record.get("available_qty") or 0)
        below = threshold > 0 and available_qty < threshold
        record["below_safety_stock"] = below
        if below_threshold and not below:
            continue
        result.append(record)

    return build_success_response(result)


def _serialize_category(category: Category) -> dict[str, object]:
    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "created_at": _to_iso8601(category.created_at),
        "updated_at": _to_iso8601(category.updated_at),
    }


def _normalize_category_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise AppException(code="VALIDATION_ERROR", message="分类名称不能为空。")
    if len(normalized) > 64:
        raise AppException(
            code="VALIDATION_ERROR",
            message="分类名称长度超出限制。",
            details={"max_length": 64},
        )
    return normalized


def _assert_category_parent_valid(
    db: Session,
    *,
    category_id: int,
    parent_id: int | None,
) -> None:
    if parent_id is None:
        return
    if parent_id == category_id:
        raise AppException(code="VALIDATION_ERROR", message="分类不能以自身作为父级。")

    parent_exists = db.scalar(select(Category.id).where(Category.id == parent_id).limit(1))
    if parent_exists is None:
        raise AppException(
            code="RESOURCE_NOT_FOUND",
            message="父级分类不存在。",
            details={"parent_id": int(parent_id)},
        )

    current: int | None = parent_id
    visited: set[int] = set()
    while current is not None:
        if current == category_id:
            raise AppException(code="VALIDATION_ERROR", message="分类层级不允许形成环。")
        if current in visited:
            raise AppException(code="INTERNAL_SERVER_ERROR", message="分类层级数据异常。")
        visited.add(current)
        current = db.scalar(select(Category.parent_id).where(Category.id == current).limit(1))


@router.post("/admin/categories", response_model=ApiResponse)
def create_admin_category(
    payload: AdminCategoryCreateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    name = _normalize_category_name(payload.name)
    parent_id = payload.parent_id
    if parent_id is not None:
        _assert_category_exists(db, category_id=parent_id)

    record = Category(id=_next_bigint_id(db, Category), name=name, parent_id=parent_id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return build_success_response(_serialize_category(record))


@router.put("/admin/categories/{id}", response_model=ApiResponse)
def update_admin_category(
    id: int,
    payload: AdminCategoryUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    record = db.get(Category, id)
    if record is None:
        raise AppException(code="RESOURCE_NOT_FOUND", message="分类不存在。")

    name = _normalize_category_name(payload.name)
    parent_id = payload.parent_id
    _assert_category_parent_valid(db, category_id=int(id), parent_id=parent_id)

    record.name = name
    record.parent_id = parent_id
    db.commit()
    db.refresh(record)
    return build_success_response(_serialize_category(record))


@router.delete("/admin/categories/{id}", response_model=ApiResponse)
def delete_admin_category(
    id: int,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})

    record = db.get(Category, id)
    if record is None:
        raise AppException(code="RESOURCE_NOT_FOUND", message="分类不存在。")

    child_id = db.scalar(select(Category.id).where(Category.parent_id == id).limit(1))
    if child_id is not None:
        raise AppException(
            code="VALIDATION_ERROR",
            message="分类存在子分类，无法删除。",
            details={"child_category_id": int(child_id)},
        )

    referenced_sku_id = db.scalar(select(Sku.id).where(Sku.category_id == id).limit(1))
    if referenced_sku_id is not None:
        raise AppException(
            code="VALIDATION_ERROR",
            message="分类已被物料引用，无法删除。",
            details={"sku_id": int(referenced_sku_id)},
        )

    try:
        db.delete(record)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppException(
            code="VALIDATION_ERROR",
            message="分类已被引用，无法删除。",
            details={"category_id": int(id)},
        ) from None

    return build_success_response({"deleted": True, "id": id})


def _require_quantity_sku(db: Session, *, sku_id: int) -> Sku:
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise AppException(code="SKU_NOT_FOUND", message="物料不存在。")
    if sku.stock_mode != SkuStockMode.QUANTITY:
        raise AppException(
            code="VALIDATION_ERROR",
            message="该物料不是数量库存模式，无法执行数量库存操作。",
            details={"sku_id": int(sku_id), "stock_mode": sku.stock_mode.value},
        )
    return sku


@router.post("/admin/sku-stocks/{sku_id}/inbound", response_model=ApiResponse)
def inbound_sku_stock(
    sku_id: int,
    payload: SkuStockInboundRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})
    _require_quantity_sku(db, sku_id=sku_id)

    occurred_at = (
        _to_naive_utc(payload.occurred_at)
        if payload.occurred_at is not None
        else datetime.now(UTC).replace(tzinfo=None)
    )
    stock = apply_stock_delta(
        db,
        sku_id=sku_id,
        action=SkuStockFlowAction.INBOUND,
        on_hand_delta=int(payload.quantity),
        reserved_delta=0,
        operator_user_id=context.user.id,
        related_application_id=None,
        occurred_at=occurred_at,
        meta_json={"event": "admin_inbound", "note": payload.note},
    )
    db.commit()
    return build_success_response(
        {
            "sku_id": int(sku_id),
            "on_hand_qty": int(stock.on_hand_qty),
            "reserved_qty": int(stock.reserved_qty),
            "available_qty": int(stock.on_hand_qty) - int(stock.reserved_qty),
        }
    )


@router.post("/admin/sku-stocks/{sku_id}/outbound", response_model=ApiResponse)
def outbound_sku_stock(
    sku_id: int,
    payload: SkuStockOutboundRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})
    _require_quantity_sku(db, sku_id=sku_id)

    occurred_at = (
        _to_naive_utc(payload.occurred_at)
        if payload.occurred_at is not None
        else datetime.now(UTC).replace(tzinfo=None)
    )
    stock = apply_stock_delta(
        db,
        sku_id=sku_id,
        action=SkuStockFlowAction.OUTBOUND,
        on_hand_delta=-int(payload.quantity),
        reserved_delta=0,
        operator_user_id=context.user.id,
        related_application_id=None,
        occurred_at=occurred_at,
        meta_json={"event": "admin_outbound", "reason": payload.reason},
    )
    db.commit()
    return build_success_response(
        {
            "sku_id": int(sku_id),
            "on_hand_qty": int(stock.on_hand_qty),
            "reserved_qty": int(stock.reserved_qty),
            "available_qty": int(stock.on_hand_qty) - int(stock.reserved_qty),
        }
    )


@router.post("/admin/sku-stocks/{sku_id}/adjust", response_model=ApiResponse)
def adjust_sku_stock(
    sku_id: int,
    payload: SkuStockAdjustRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_WRITE})
    _require_quantity_sku(db, sku_id=sku_id)

    occurred_at = (
        _to_naive_utc(payload.occurred_at)
        if payload.occurred_at is not None
        else datetime.now(UTC).replace(tzinfo=None)
    )
    current = get_or_create_stock_for_update(db, sku_id=sku_id)
    delta = int(payload.new_on_hand_qty) - int(current.on_hand_qty)
    stock = apply_stock_delta(
        db,
        sku_id=sku_id,
        action=SkuStockFlowAction.ADJUST,
        on_hand_delta=delta,
        reserved_delta=0,
        operator_user_id=context.user.id,
        related_application_id=None,
        occurred_at=occurred_at,
        meta_json={"event": "admin_adjust", "reason": payload.reason},
    )
    db.commit()
    return build_success_response(
        {
            "sku_id": int(sku_id),
            "on_hand_qty": int(stock.on_hand_qty),
            "reserved_qty": int(stock.reserved_qty),
            "available_qty": int(stock.on_hand_qty) - int(stock.reserved_qty),
        }
    )


@router.get("/admin/sku-stocks/{sku_id}/flows", response_model=ApiResponse)
def list_sku_stock_flows(
    sku_id: int,
    action: SkuStockFlowAction | None = Query(default=None),
    from_at: datetime | None = Query(default=None, alias="from"),
    to_at: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_READ})
    _require_quantity_sku(db, sku_id=sku_id)

    stmt = (
        select(SkuStockFlow, SysUser)
        .join(SysUser, SysUser.id == SkuStockFlow.operator_user_id)
        .where(SkuStockFlow.sku_id == sku_id)
    )
    if action is not None:
        stmt = stmt.where(SkuStockFlow.action == action)
    if from_at is not None:
        stmt = stmt.where(SkuStockFlow.occurred_at >= _to_naive_utc(from_at))
    if to_at is not None:
        stmt = stmt.where(SkuStockFlow.occurred_at <= _to_naive_utc(to_at))

    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = db.execute(
        stmt.order_by(SkuStockFlow.occurred_at.desc(), SkuStockFlow.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for flow, user in rows:
        items.append(
            {
                "id": int(flow.id),
                "sku_id": int(flow.sku_id),
                "action": flow.action.value,
                "on_hand_delta": int(flow.on_hand_delta),
                "reserved_delta": int(flow.reserved_delta),
                "on_hand_qty_after": int(flow.on_hand_qty_after),
                "reserved_qty_after": int(flow.reserved_qty_after),
                "operator_user_id": int(flow.operator_user_id),
                "operator_user_name": user.name,
                "related_application_id": (
                    int(flow.related_application_id) if flow.related_application_id is not None else None
                ),
                "occurred_at": _to_iso8601(flow.occurred_at),
                "meta_json": flow.meta_json,
            }
        )

    return build_success_response(
        {
            "items": items,
            "meta": {"page": page, "page_size": page_size, "total": total},
        }
    )


@router.get("/admin/sku-stocks/{sku_id}/flows/export")
def export_sku_stock_flows_csv(
    sku_id: int,
    action: SkuStockFlowAction | None = Query(default=None),
    from_at: datetime | None = Query(default=None, alias="from"),
    to_at: datetime | None = Query(default=None, alias="to"),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    _require_admin(context, required_permissions={PERMISSION_INVENTORY_READ})
    _require_quantity_sku(db, sku_id=sku_id)

    stmt = (
        select(SkuStockFlow, SysUser)
        .join(SysUser, SysUser.id == SkuStockFlow.operator_user_id)
        .where(SkuStockFlow.sku_id == sku_id)
    )
    if action is not None:
        stmt = stmt.where(SkuStockFlow.action == action)
    if from_at is not None:
        stmt = stmt.where(SkuStockFlow.occurred_at >= _to_naive_utc(from_at))
    if to_at is not None:
        stmt = stmt.where(SkuStockFlow.occurred_at <= _to_naive_utc(to_at))

    rows = db.execute(stmt.order_by(SkuStockFlow.occurred_at.desc(), SkuStockFlow.id.desc())).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "occurred_at",
            "sku_id",
            "action",
            "on_hand_delta",
            "reserved_delta",
            "on_hand_qty_after",
            "reserved_qty_after",
            "operator_user_id",
            "operator_user_name",
            "related_application_id",
            "meta_json",
        ]
    )
    for flow, user in rows:
        writer.writerow(
            [
                _to_iso8601(flow.occurred_at),
                int(flow.sku_id),
                flow.action.value,
                int(flow.on_hand_delta),
                int(flow.reserved_delta),
                int(flow.on_hand_qty_after),
                int(flow.reserved_qty_after),
                int(flow.operator_user_id),
                user.name,
                int(flow.related_application_id) if flow.related_application_id is not None else "",
                "" if flow.meta_json is None else str(flow.meta_json),
            ]
        )

    filename = f"sku_stock_flows_{int(sku_id)}.csv"
    content = "\ufeff" + buffer.getvalue()
    response = StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
    )
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
