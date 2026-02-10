"""Schemas for M07 reports and copilot endpoints."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ReportGranularity = Literal["DAY", "WEEK", "MONTH"]
CopilotMetric = Literal["TOTAL_COST", "MAX_COST", "COUNT_APPLICATIONS", "COUNT_ASSETS"]
CopilotDimension = Literal["USER", "DEPARTMENT", "SKU", "CATEGORY", "STATUS", "MONTH"]
CopilotFilterField = Literal[
    "CREATED_DATE",
    "DEPARTMENT_ID",
    "USER_ID",
    "SKU_ID",
    "CATEGORY_ID",
    "STATUS",
]
CopilotFilterOp = Literal["EQ", "IN", "GTE", "LTE", "BETWEEN", "CONTAINS"]
CopilotSortDirection = Literal["ASC", "DESC"]
CopilotOrderByField = Literal["metric_value"]


class CopilotFilter(BaseModel):
    field: CopilotFilterField
    op: CopilotFilterOp
    value: Any


class CopilotOrderBy(BaseModel):
    field: CopilotOrderByField
    direction: CopilotSortDirection = "DESC"


class CopilotQueryPlan(BaseModel):
    metric: CopilotMetric
    dimensions: list[CopilotDimension] = Field(default_factory=list)
    filters: list[CopilotFilter] = Field(default_factory=list)
    order_by: list[CopilotOrderBy] = Field(default_factory=list)
    limit: int = Field(default=50, ge=1, le=200)


class CopilotQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    constraints: dict[str, Any] | None = None
