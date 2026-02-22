"""Schemas for M06 inbound and inventory endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from app.models.enums import AssetStatus, SkuStockMode
from pydantic import BaseModel, Field


class OcrInboundConfirmSkuPayload(BaseModel):
    category_id: int = Field(ge=1)
    brand: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=128)
    spec: str = Field(min_length=1, max_length=255)
    reference_price: Decimal = Field(ge=0)
    cover_url: str | None = Field(default=None, max_length=512)
    stock_mode: SkuStockMode = Field(default=SkuStockMode.SERIALIZED)
    safety_stock_threshold: int = Field(default=0, ge=0)


class OcrInboundConfirmAssetPayload(BaseModel):
    sn: str = Field(min_length=1, max_length=128)
    inbound_at: datetime | None = None


class OcrInboundConfirmRequest(BaseModel):
    sku: OcrInboundConfirmSkuPayload
    quantity: int = Field(default=1, ge=1)
    assets: list[OcrInboundConfirmAssetPayload] = Field(default_factory=list)


class AdminSkuCreateRequest(OcrInboundConfirmSkuPayload):
    pass


class AdminSkuUpdateRequest(OcrInboundConfirmSkuPayload):
    pass


class AdminAssetCreateRequest(BaseModel):
    sku_id: int = Field(ge=1)
    assets: list[OcrInboundConfirmAssetPayload] = Field(min_length=1)


class AdminAssetUpdateRequest(BaseModel):
    sku_id: int | None = Field(default=None, ge=1)
    sn: str | None = Field(default=None, max_length=128)
    status: AssetStatus | None = None
    inbound_at: datetime | None = None


class AdminCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    parent_id: int | None = Field(default=None, ge=1)
    leader_approver_user_id: int | None = Field(default=None, ge=1)
    admin_reviewer_user_id: int | None = Field(default=None, ge=1)


class AdminCategoryUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    parent_id: int | None = Field(default=None, ge=1)
    leader_approver_user_id: int | None = Field(default=None, ge=1)
    admin_reviewer_user_id: int | None = Field(default=None, ge=1)


class SkuStockInboundRequest(BaseModel):
    quantity: int = Field(ge=1)
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=200)


class SkuStockOutboundRequest(BaseModel):
    quantity: int = Field(ge=1)
    occurred_at: datetime | None = None
    reason: str = Field(min_length=1, max_length=200)


class SkuStockAdjustRequest(BaseModel):
    new_on_hand_qty: int = Field(ge=0)
    occurred_at: datetime | None = None
    reason: str = Field(min_length=1, max_length=200)
