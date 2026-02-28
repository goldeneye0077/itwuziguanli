"""Schemas for M02 asset application endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ApplicationType, DeliveryType


class UserAddressCreateRequest(BaseModel):
    receiver_name: str = Field(min_length=1, max_length=64)
    receiver_phone: str = Field(min_length=1, max_length=32)
    province: str = Field(min_length=1, max_length=64)
    city: str = Field(min_length=1, max_length=64)
    district: str = Field(min_length=1, max_length=64)
    detail: str = Field(min_length=1, max_length=255)
    is_default: bool = False


class ApplicationItemRequest(BaseModel):
    sku_id: int = Field(ge=1)
    quantity: int = Field(ge=1, le=50)
    note: str | None = Field(default=None, max_length=500)


class ExpressAddressRequest(BaseModel):
    receiver_name: str = Field(min_length=1, max_length=64)
    receiver_phone: str = Field(min_length=1, max_length=32)
    province: str = Field(min_length=1, max_length=64)
    city: str = Field(min_length=1, max_length=64)
    district: str = Field(min_length=1, max_length=64)
    detail: str = Field(min_length=1, max_length=255)


class ApplicationCreateRequest(BaseModel):
    type: ApplicationType
    delivery_type: DeliveryType
    items: list[ApplicationItemRequest] = Field(min_length=1)
    express_address_id: int | None = Field(default=None, ge=1)
    express_address: ExpressAddressRequest | None = None
    applicant_reason: str | None = Field(default=None, max_length=1000)
    applicant_department_name: str | None = Field(default=None, max_length=64)
    applicant_phone: str | None = Field(default=None, max_length=32)
    applicant_job_title: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def validate_delivery_requirements(self) -> "ApplicationCreateRequest":
        if self.delivery_type == DeliveryType.EXPRESS:
            if self.express_address_id is None and self.express_address is None:
                raise ValueError(
                    "delivery_type=EXPRESS requires express_address_id or express_address"
                )
        return self


class AiPrecheckRequest(BaseModel):
    job_title: str = Field(min_length=1, max_length=128)
    reason: str = Field(min_length=1, max_length=1000)
    items: list[ApplicationItemRequest] = Field(min_length=1)
