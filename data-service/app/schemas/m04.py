"""Schemas for M04 notification and verification endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import NotifyChannel


class PickupVerifyRequest(BaseModel):
    verify_type: Literal["QR", "CODE"]
    value: str = Field(min_length=1, max_length=512)


class NotificationTestRequest(BaseModel):
    channel: NotifyChannel
    receiver: str = Field(min_length=1, max_length=128)
    message: str | None = Field(default=None, max_length=1000)
