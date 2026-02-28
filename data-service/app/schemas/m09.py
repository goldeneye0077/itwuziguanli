"""Schemas for M09 asset lifecycle endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AssetReturnRequest(BaseModel):
    asset_id: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=500)


class AssetReturnConfirmRequest(BaseModel):
    passed: bool
    damage_note: str | None = Field(default=None, max_length=1000)


class AssetRepairRequest(BaseModel):
    asset_id: int = Field(ge=1)
    fault_description: str = Field(min_length=1, max_length=1000)
    urgency: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"


class AssetTransferRequest(BaseModel):
    asset_id: int = Field(ge=1)
    target_user_id: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=500)


class AssetScrapRequest(BaseModel):
    asset_id: int = Field(ge=1)
    reason: Literal["DAMAGE", "OBSOLETE", "LOST"]
    scrap_note: str | None = Field(default=None, max_length=1000)
