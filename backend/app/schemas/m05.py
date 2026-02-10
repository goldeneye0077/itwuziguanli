"""Schemas for M05 outbound endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class OutboundConfirmPickupRequest(BaseModel):
    verify_type: Literal["QR", "CODE", "APPLICATION_ID"]
    value: str = Field(min_length=1, max_length=512)


class OutboundShipRequest(BaseModel):
    application_id: int = Field(ge=1)
    carrier: str = Field(min_length=1, max_length=64)
    tracking_no: str = Field(min_length=1, max_length=64)
    shipped_at: datetime | None = None
