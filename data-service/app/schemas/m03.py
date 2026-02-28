"""Schemas for M03 intelligent approval endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import ApprovalAction, ApprovalNode


class ApplicationApproveRequest(BaseModel):
    node: ApprovalNode
    action: ApprovalAction
    comment: str | None = Field(default=None, max_length=500)


class AssignAssetsEntry(BaseModel):
    sku_id: int = Field(ge=1)
    asset_ids: list[int] = Field(min_length=1)


class ApplicationAssignAssetsRequest(BaseModel):
    assignments: list[AssignAssetsEntry] = Field(min_length=1)
