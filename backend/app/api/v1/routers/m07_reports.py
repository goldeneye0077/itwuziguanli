"""M07 router implementation: reports and copilot analytics."""

from __future__ import annotations

import json
import os
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....core.exceptions import AppException
from ....db.session import get_db_session
from ....models.application import Application, ApplicationItem
from ....models.catalog import Category, Sku
from ....models.inventory import Asset
from ....models.organization import Department, SysUser
from ....schemas.common import ApiResponse, build_success_response
from ....schemas.m07 import (
    CopilotDimension,
    CopilotFilter,
    CopilotMetric,
    CopilotOrderBy,
    CopilotQueryPlan,
    CopilotQueryRequest,
    ReportGranularity,
)

from urllib import error as urllib_error
from urllib import request as urllib_request

router = APIRouter(tags=["M07"])

_ADMIN_ROLES = {"ADMIN", "SUPER_ADMIN"}


def _require_admin(context: AuthContext) -> None:
    if context.roles.intersection(_ADMIN_ROLES):
        return
    raise AppException(
        code="ROLE_INSUFFICIENT",
        message="当前角色权限不足，无法执行此操作。",
    )


def _resolve_datetime_window(
    start_date: date | None,
    end_date: date | None,
) -> tuple[datetime | None, datetime | None]:
    if start_date and end_date and start_date > end_date:
        raise AppException(
            code="VALIDATION_ERROR",
            message="开始日期不能晚于结束日期。",
            details={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

    start_at = datetime.combine(start_date, time.min) if start_date else None
    end_at = (
        datetime.combine(end_date + timedelta(days=1), time.min) if end_date else None
    )
    return start_at, end_at


def _bucket_from_datetime(value: datetime, granularity: ReportGranularity) -> str:
    day_value = value.date()
    if granularity == "DAY":
        return day_value.isoformat()
    if granularity == "WEEK":
        return (day_value - timedelta(days=day_value.weekday())).isoformat()
    return day_value.replace(day=1).isoformat()


def _to_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _decimal_text(value: Any) -> str:
    return f"{_to_decimal(value).quantize(Decimal('0.01'))}"


@router.get("/reports/applications-trend", response_model=ApiResponse)
def get_applications_trend(
    granularity: ReportGranularity = Query(default="DAY"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)
    start_at, end_at = _resolve_datetime_window(start_date, end_date)

    stmt = select(Application.created_at)
    if start_at is not None:
        stmt = stmt.where(Application.created_at >= start_at)
    if end_at is not None:
        stmt = stmt.where(Application.created_at < end_at)

    rows = db.scalars(stmt.order_by(Application.created_at.asc())).all()
    bucket_counts: dict[str, int] = {}
    for item in rows:
        bucket = _bucket_from_datetime(item, granularity)
        bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1

    data = [
        {"bucket": bucket, "count": bucket_counts[bucket]}
        for bucket in sorted(bucket_counts)
    ]
    return build_success_response(data)


@router.get("/reports/cost-by-department", response_model=ApiResponse)
def get_cost_by_department(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)
    start_at, end_at = _resolve_datetime_window(start_date, end_date)

    total_cost_expr = func.coalesce(
        func.sum(ApplicationItem.quantity * Sku.reference_price),
        0,
    )
    application_count_expr = func.count(func.distinct(Application.id))

    stmt = (
        select(
            Department.id,
            Department.name,
            total_cost_expr,
            application_count_expr,
        )
        .join(SysUser, SysUser.department_id == Department.id)
        .join(Application, Application.applicant_user_id == SysUser.id)
        .join(ApplicationItem, ApplicationItem.application_id == Application.id)
        .join(Sku, Sku.id == ApplicationItem.sku_id)
        .group_by(Department.id, Department.name)
        .order_by(total_cost_expr.desc(), Department.id.asc())
    )
    if start_at is not None:
        stmt = stmt.where(Application.created_at >= start_at)
    if end_at is not None:
        stmt = stmt.where(Application.created_at < end_at)

    rows = db.execute(stmt).all()
    data = [
        {
            "department_id": int(department_id),
            "department_name": department_name,
            "total_cost": _decimal_text(total_cost),
            "application_count": int(application_count),
        }
        for department_id, department_name, total_cost, application_count in rows
    ]
    return build_success_response(data)


@router.get("/reports/asset-status-distribution", response_model=ApiResponse)
def get_asset_status_distribution(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    stmt = (
        select(Asset.status, func.count(Asset.id))
        .group_by(Asset.status)
        .order_by(Asset.status.asc())
    )
    rows = db.execute(stmt).all()
    data = [{"status": status.value, "count": int(count)} for status, count in rows]
    return build_success_response(data)


def _parse_iso_date(value: Any, field_name: str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as error:
            raise AppException(
                code="VALIDATION_ERROR",
                message="日期格式不正确，必须为 2026-02-08 这种格式。",
                details={field_name: value},
            ) from error
    raise AppException(
        code="VALIDATION_ERROR",
        message="日期格式不正确，必须为 2026-02-08 这种格式。",
        details={field_name: value},
    )


def _normalize_int_list(value: Any, field_name: str) -> list[int]:
    if not isinstance(value, list):
        raise AppException(
            code="VALIDATION_ERROR",
            message="参数格式不正确，必须为正整数数组。",
            details={field_name: value},
        )

    normalized: list[int] = []
    for item in value:
        if not isinstance(item, int) or item <= 0:
            raise AppException(
                code="VALIDATION_ERROR",
                message="参数格式不正确，必须为正整数数组。",
                details={field_name: value},
            )
        normalized.append(item)
    return normalized


def _build_copilot_filters(constraints: dict[str, Any] | None) -> list[CopilotFilter]:
    if not constraints:
        return []

    filters: list[CopilotFilter] = []
    start_date_raw = constraints.get("start_date")
    end_date_raw = constraints.get("end_date")
    start_date = (
        _parse_iso_date(start_date_raw, "start_date")
        if start_date_raw is not None
        else None
    )
    end_date = (
        _parse_iso_date(end_date_raw, "end_date") if end_date_raw is not None else None
    )

    if start_date and end_date and start_date > end_date:
        raise AppException(
            code="VALIDATION_ERROR",
            message="开始日期不能晚于结束日期。",
            details={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

    if start_date is not None:
        filters.append(
            CopilotFilter(
                field="CREATED_DATE",
                op="GTE",
                value=start_date.isoformat(),
            )
        )
    if end_date is not None:
        filters.append(
            CopilotFilter(
                field="CREATED_DATE",
                op="LTE",
                value=end_date.isoformat(),
            )
        )

    if (
        isinstance(constraints.get("department_id"), int)
        and constraints["department_id"] > 0
    ):
        filters.append(
            CopilotFilter(
                field="DEPARTMENT_ID", op="EQ", value=constraints["department_id"]
            )
        )
    if "department_ids" in constraints:
        filters.append(
            CopilotFilter(
                field="DEPARTMENT_ID",
                op="IN",
                value=_normalize_int_list(
                    constraints["department_ids"], "department_ids"
                ),
            )
        )

    if isinstance(constraints.get("user_id"), int) and constraints["user_id"] > 0:
        filters.append(
            CopilotFilter(field="USER_ID", op="EQ", value=constraints["user_id"])
        )
    if "user_ids" in constraints:
        filters.append(
            CopilotFilter(
                field="USER_ID",
                op="IN",
                value=_normalize_int_list(constraints["user_ids"], "user_ids"),
            )
        )

    if isinstance(constraints.get("sku_id"), int) and constraints["sku_id"] > 0:
        filters.append(
            CopilotFilter(field="SKU_ID", op="EQ", value=constraints["sku_id"])
        )
    if "sku_ids" in constraints:
        filters.append(
            CopilotFilter(
                field="SKU_ID",
                op="IN",
                value=_normalize_int_list(constraints["sku_ids"], "sku_ids"),
            )
        )

    if (
        isinstance(constraints.get("category_id"), int)
        and constraints["category_id"] > 0
    ):
        filters.append(
            CopilotFilter(
                field="CATEGORY_ID", op="EQ", value=constraints["category_id"]
            )
        )
    if "category_ids" in constraints:
        filters.append(
            CopilotFilter(
                field="CATEGORY_ID",
                op="IN",
                value=_normalize_int_list(constraints["category_ids"], "category_ids"),
            )
        )

    if isinstance(constraints.get("status"), str) and constraints["status"].strip():
        filters.append(
            CopilotFilter(
                field="STATUS",
                op="EQ",
                value=constraints["status"].strip().upper(),
            )
        )
    statuses_raw = constraints.get("statuses")
    if isinstance(statuses_raw, list):
        statuses = [
            item.strip().upper()
            for item in statuses_raw
            if isinstance(item, str) and item.strip()
        ]
        if statuses:
            filters.append(CopilotFilter(field="STATUS", op="IN", value=statuses))

    return filters


def _extract_limit(constraints: dict[str, Any] | None) -> int:
    if not constraints:
        return 50
    raw_limit = constraints.get("limit")
    if isinstance(raw_limit, int):
        return min(max(raw_limit, 1), 200)
    if isinstance(raw_limit, str) and raw_limit.strip().isdigit():
        return min(max(int(raw_limit.strip()), 1), 200)
    return 50


def _infer_metric(question_text: str) -> CopilotMetric:
    if any(token in question_text for token in ("最贵", "最高", "max", "maximum")):
        return "MAX_COST"
    if any(
        token in question_text for token in ("资产数量", "asset count", "count assets")
    ):
        return "COUNT_ASSETS"
    if any(
        token in question_text for token in ("申请数量", "申请数", "count applications")
    ):
        return "COUNT_APPLICATIONS"
    if any(token in question_text for token in ("多少", "数量", "count")):
        if "资产" in question_text or "asset" in question_text:
            return "COUNT_ASSETS"
        return "COUNT_APPLICATIONS"
    return "TOTAL_COST"


def _infer_dimensions(
    question_text: str,
    metric: CopilotMetric,
) -> list[CopilotDimension]:
    dimensions: list[CopilotDimension] = []

    if any(
        token in question_text for token in ("谁", "用户", "人员", "employee", "user")
    ):
        dimensions.append("USER")
    if any(token in question_text for token in ("部门", "department")):
        dimensions.append("DEPARTMENT")
    if any(token in question_text for token in ("sku", "型号", "物资")):
        dimensions.append("SKU")
    if any(token in question_text for token in ("分类", "category")):
        dimensions.append("CATEGORY")
    if any(token in question_text for token in ("状态", "status")):
        dimensions.append("STATUS")
    if any(
        token in question_text
        for token in ("月", "month", "季度", "quarter", "趋势", "trend")
    ):
        dimensions.append("MONTH")

    if not dimensions:
        dimensions.append("STATUS" if metric == "COUNT_ASSETS" else "DEPARTMENT")

    # Preserve insertion order and remove duplicates.
    return list(dict.fromkeys(dimensions))


def _build_copilot_plan(payload: CopilotQueryRequest) -> CopilotQueryPlan:
    question_text = payload.question.strip().lower()
    metric = _infer_metric(question_text)
    dimensions = _infer_dimensions(question_text, metric)
    filters = _build_copilot_filters(payload.constraints)
    limit = _extract_limit(payload.constraints)

    direction: Literal["ASC", "DESC"] = (
        "ASC"
        if any(token in question_text for token in ("最低", "最少", "least", "lowest"))
        else "DESC"
    )
    return CopilotQueryPlan(
        metric=metric,
        dimensions=dimensions,
        filters=filters,
        order_by=[CopilotOrderBy(field="metric_value", direction=direction)],
        limit=limit,
    )


def _deepseek_build_copilot_plan(payload: CopilotQueryRequest) -> CopilotQueryPlan:
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    api_base = (os.getenv("OPENAI_API_BASE") or "https://api.deepseek.com/v1").strip()
    model = (os.getenv("OPENAI_MODEL") or "deepseek-chat").strip()

    if not api_key:
        raise RuntimeError("missing_openai_api_key")

    endpoint = f"{api_base.rstrip('/')}/chat/completions"

    system_prompt = (
        "你是企业内部 IT 资产系统的报表 Copilot 规划器。\n"
        "你的任务是把自然语言问题转换为机器可读的查询计划。\n"
        "必须只输出一个 JSON 对象，且不包含任何解释文字。\n"
        "禁止输出 SQL、禁止输出代码、禁止输出 markdown。\n"
        "JSON 结构必须严格为：{metric, dimensions, filters, order_by, limit}。\n"
        "字段约束：\n"
        "- metric 只能取：TOTAL_COST, MAX_COST, COUNT_APPLICATIONS, COUNT_ASSETS\n"
        "- dimensions 数组元素只能取：USER, DEPARTMENT, SKU, CATEGORY, STATUS, MONTH\n"
        "- filters 为数组，每项为 {field, op, value}\n"
        "  - field 只能取：CREATED_DATE, DEPARTMENT_ID, USER_ID, SKU_ID, CATEGORY_ID, STATUS\n"
        "  - op 只能取：EQ, IN, GTE, LTE, BETWEEN, CONTAINS\n"
        "  - value 为字符串/数字/数组（与 op 匹配），日期使用 YYYY-MM-DD 形式的字符串\n"
        "- order_by 为数组，每项为 {field, direction}，field 固定为 metric_value\n"
        "  - direction 只能取：ASC 或 DESC\n"
        "- limit 为 1-200 的整数\n"
        '输出示例（仅示例）：{"metric":"TOTAL_COST","dimensions":["DEPARTMENT"],"filters":[],"order_by":[{"field":"metric_value","direction":"DESC"}],"limit":50}'
    )

    user_payload = {
        "question": payload.question,
        "constraints": payload.constraints or {},
    }
    user_prompt = "请基于以下输入生成查询计划 JSON（仅 JSON）：\n" + json.dumps(
        user_payload, ensure_ascii=False
    )

    request_body = {
        "model": model,
        "temperature": 0,
        "max_tokens": 512,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
    }

    data = json.dumps(request_body, ensure_ascii=False).encode("utf-8")
    req = urllib_request.Request(
        endpoint,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
    except urllib_error.HTTPError as exc:
        raise RuntimeError("deepseek_http_error") from exc
    except urllib_error.URLError as exc:
        raise RuntimeError("deepseek_unreachable") from exc

    payload_json = json.loads(raw)
    content = payload_json.get("choices", [{}])[0].get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("deepseek_empty_response")

    plan_dict = json.loads(content)
    if not isinstance(plan_dict, dict):
        raise RuntimeError("deepseek_non_object")

    expected_keys = {"metric", "dimensions", "filters", "order_by", "limit"}
    if set(plan_dict.keys()) != expected_keys:
        raise RuntimeError("deepseek_unexpected_keys")

    return CopilotQueryPlan.model_validate(plan_dict)


def _build_copilot_plan_with_fallback(
    payload: CopilotQueryRequest,
) -> tuple[CopilotQueryPlan, str]:
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        return _build_copilot_plan(payload), "heuristic"

    try:
        plan = _deepseek_build_copilot_plan(payload)
        return plan, "deepseek"
    except Exception:
        return _build_copilot_plan(payload), "heuristic"


def _extract_filter_date_window(
    filters: list[CopilotFilter],
) -> tuple[date | None, date | None]:
    start_date: date | None = None
    end_date: date | None = None
    for item in filters:
        if item.field != "CREATED_DATE":
            continue
        if item.op == "GTE":
            start_date = _parse_iso_date(item.value, "start_date")
        elif item.op == "LTE":
            end_date = _parse_iso_date(item.value, "end_date")
        elif (
            item.op == "BETWEEN"
            and isinstance(item.value, list)
            and len(item.value) == 2
        ):
            start_date = _parse_iso_date(item.value[0], "start_date")
            end_date = _parse_iso_date(item.value[1], "end_date")
    return start_date, end_date


def _build_application_facts(
    db: Session,
    filters: list[CopilotFilter],
) -> list[dict[str, Any]]:
    start_date, end_date = _extract_filter_date_window(filters)
    start_at, end_at = _resolve_datetime_window(start_date, end_date)

    stmt = (
        select(
            Application.id,
            Application.created_at,
            Application.status,
            SysUser.id,
            SysUser.name,
            Department.id,
            Department.name,
            ApplicationItem.sku_id,
            Sku.brand,
            Sku.model,
            Sku.spec,
            Category.id,
            Category.name,
            ApplicationItem.quantity,
            Sku.reference_price,
        )
        .join(SysUser, Application.applicant_user_id == SysUser.id)
        .join(Department, SysUser.department_id == Department.id, isouter=True)
        .join(
            ApplicationItem,
            ApplicationItem.application_id == Application.id,
            isouter=True,
        )
        .join(Sku, Sku.id == ApplicationItem.sku_id, isouter=True)
        .join(Category, Category.id == Sku.category_id, isouter=True)
    )
    if start_at is not None:
        stmt = stmt.where(Application.created_at >= start_at)
    if end_at is not None:
        stmt = stmt.where(Application.created_at < end_at)

    rows = db.execute(stmt.order_by(Application.id.asc())).all()
    facts: list[dict[str, Any]] = []
    for row in rows:
        quantity = int(row[13] or 0)
        reference_price = _to_decimal(row[14])
        sku_label = " ".join(
            part.strip()
            for part in (row[8] or "", row[9] or "", row[10] or "")
            if part and part.strip()
        )
        facts.append(
            {
                "application_id": int(row[0]),
                "created_date": row[1].date().isoformat(),
                "month": row[1].date().replace(day=1).isoformat(),
                "application_status": row[2].value,
                "user_id": int(row[3]),
                "user_name": row[4],
                "department_id": int(row[5]) if row[5] is not None else None,
                "department_name": row[6],
                "sku_id": int(row[7]) if row[7] is not None else None,
                "sku_label": sku_label,
                "category_id": int(row[11]) if row[11] is not None else None,
                "category_name": row[12],
                "row_cost": reference_price * Decimal(quantity),
            }
        )
    return facts


def _build_asset_facts(
    db: Session,
    filters: list[CopilotFilter],
) -> list[dict[str, Any]]:
    start_date, end_date = _extract_filter_date_window(filters)
    start_at, end_at = _resolve_datetime_window(start_date, end_date)

    stmt = (
        select(
            Asset.id,
            Asset.status,
            Asset.inbound_at,
            Sku.id,
            Sku.brand,
            Sku.model,
            Sku.spec,
            Category.id,
            Category.name,
            SysUser.id,
            SysUser.name,
            Department.id,
            Department.name,
        )
        .join(Sku, Asset.sku_id == Sku.id)
        .join(Category, Category.id == Sku.category_id, isouter=True)
        .join(SysUser, Asset.holder_user_id == SysUser.id, isouter=True)
        .join(Department, SysUser.department_id == Department.id, isouter=True)
    )
    if start_at is not None:
        stmt = stmt.where(Asset.inbound_at >= start_at)
    if end_at is not None:
        stmt = stmt.where(Asset.inbound_at < end_at)

    rows = db.execute(stmt.order_by(Asset.id.asc())).all()
    facts: list[dict[str, Any]] = []
    for row in rows:
        sku_label = " ".join(
            part.strip()
            for part in (row[4] or "", row[5] or "", row[6] or "")
            if part and part.strip()
        )
        facts.append(
            {
                "asset_id": int(row[0]),
                "asset_status": row[1].value,
                "created_date": row[2].date().isoformat(),
                "month": row[2].date().replace(day=1).isoformat(),
                "sku_id": int(row[3]),
                "sku_label": sku_label,
                "category_id": int(row[7]) if row[7] is not None else None,
                "category_name": row[8],
                "user_id": int(row[9]) if row[9] is not None else None,
                "user_name": row[10],
                "department_id": int(row[11]) if row[11] is not None else None,
                "department_name": row[12],
            }
        )
    return facts


def _resolve_filter_field_value(
    row: dict[str, Any],
    field: str,
    source: Literal["application", "asset"],
) -> Any:
    if field == "DEPARTMENT_ID":
        return row.get("department_id")
    if field == "USER_ID":
        return row.get("user_id")
    if field == "SKU_ID":
        return row.get("sku_id")
    if field == "CATEGORY_ID":
        return row.get("category_id")
    if field == "CREATED_DATE":
        return row.get("created_date")
    if field == "STATUS":
        return row.get("asset_status" if source == "asset" else "application_status")
    return None


def _matches_filter(
    row: dict[str, Any],
    item: CopilotFilter,
    source: Literal["application", "asset"],
) -> bool:
    left = _resolve_filter_field_value(row, item.field, source)
    if left is None:
        return item.field not in {
            "DEPARTMENT_ID",
            "USER_ID",
            "SKU_ID",
            "CATEGORY_ID",
            "CREATED_DATE",
            "STATUS",
        }

    if item.op == "EQ":
        return left == item.value
    if item.op == "IN":
        values = item.value if isinstance(item.value, list) else [item.value]
        return left in values
    if item.op == "GTE":
        return str(left) >= str(item.value)
    if item.op == "LTE":
        return str(left) <= str(item.value)
    if item.op == "BETWEEN":
        if not isinstance(item.value, list) or len(item.value) != 2:
            return False
        return str(item.value[0]) <= str(left) <= str(item.value[1])
    if item.op == "CONTAINS":
        return str(item.value).lower() in str(left).lower()
    return False


def _dimension_columns(dimension: CopilotDimension) -> list[str]:
    if dimension == "USER":
        return ["user_id", "user_name"]
    if dimension == "DEPARTMENT":
        return ["department_id", "department_name"]
    if dimension == "SKU":
        return ["sku_id", "sku_label"]
    if dimension == "CATEGORY":
        return ["category_id", "category_name"]
    if dimension == "STATUS":
        return ["status"]
    return ["month"]


def _dimension_values(
    row: dict[str, Any],
    dimension: CopilotDimension,
    source: Literal["application", "asset"],
) -> list[Any]:
    if dimension == "USER":
        return [row.get("user_id"), row.get("user_name")]
    if dimension == "DEPARTMENT":
        return [row.get("department_id"), row.get("department_name")]
    if dimension == "SKU":
        return [row.get("sku_id"), row.get("sku_label")]
    if dimension == "CATEGORY":
        return [row.get("category_id"), row.get("category_name")]
    if dimension == "STATUS":
        return [row.get("asset_status" if source == "asset" else "application_status")]
    return [row.get("month")]


def _sort_metric_rows(
    rows: list[tuple[list[Any], Any]],
    order_by: list[CopilotOrderBy],
) -> list[tuple[list[Any], Any]]:
    if not order_by:
        return rows
    direction = order_by[0].direction
    return sorted(rows, key=lambda item: item[1], reverse=(direction == "DESC"))


def _serialize_metric_value(metric: CopilotMetric, value: Any) -> Any:
    if metric in {"TOTAL_COST", "MAX_COST"}:
        return _decimal_text(value)
    return int(value)


def _execute_copilot_plan(
    db: Session,
    plan: CopilotQueryPlan,
) -> tuple[list[str], list[list[Any]]]:
    source: Literal["application", "asset"] = (
        "asset" if plan.metric == "COUNT_ASSETS" else "application"
    )
    facts = (
        _build_asset_facts(db, plan.filters)
        if source == "asset"
        else _build_application_facts(db, plan.filters)
    )
    filtered_facts = [
        item
        for item in facts
        if all(_matches_filter(item, condition, source) for condition in plan.filters)
    ]

    groups: dict[tuple[Any, ...], dict[str, Any]] = {}
    for fact in filtered_facts:
        dimension_values_flat: list[Any] = []
        for dimension in plan.dimensions:
            dimension_values_flat.extend(_dimension_values(fact, dimension, source))
        key = tuple(dimension_values_flat)
        entry = groups.setdefault(
            key,
            {
                "dimensions": dimension_values_flat,
                "application_ids": set(),
                "total_cost": Decimal("0"),
                "max_cost": Decimal("0"),
                "asset_count": 0,
            },
        )

        if source == "asset":
            entry["asset_count"] += 1
            continue

        entry["application_ids"].add(fact["application_id"])
        row_cost = _to_decimal(fact.get("row_cost"))
        entry["total_cost"] += row_cost
        if row_cost > entry["max_cost"]:
            entry["max_cost"] = row_cost

    if plan.metric == "TOTAL_COST":
        metric_rows = [
            (group["dimensions"], group["total_cost"]) for group in groups.values()
        ]
    elif plan.metric == "MAX_COST":
        metric_rows = [
            (group["dimensions"], group["max_cost"]) for group in groups.values()
        ]
    elif plan.metric == "COUNT_APPLICATIONS":
        metric_rows = [
            (group["dimensions"], len(group["application_ids"]))
            for group in groups.values()
        ]
    else:
        metric_rows = [
            (group["dimensions"], int(group["asset_count"]))
            for group in groups.values()
        ]

    sorted_rows = _sort_metric_rows(metric_rows, plan.order_by)
    limited_rows = sorted_rows[: plan.limit]

    columns: list[str] = []
    for dimension in plan.dimensions:
        columns.extend(_dimension_columns(dimension))
    columns.append("metric_value")

    rows = [
        dimensions + [_serialize_metric_value(plan.metric, metric_value)]
        for dimensions, metric_value in limited_rows
    ]
    return columns, rows


@router.post("/copilot/query", response_model=ApiResponse)
def query_copilot(
    payload: CopilotQueryRequest,
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    _require_admin(context)

    plan, planner = _build_copilot_plan_with_fallback(payload)
    columns, rows = _execute_copilot_plan(db, plan)
    return build_success_response(
        {
            "planner": planner,
            "query_plan": plan.model_dump(),
            "columns": columns,
            "rows": rows,
        }
    )


@router.post("/copilot/plan", response_model=ApiResponse)
def plan_copilot(
    payload: CopilotQueryRequest,
    context: AuthContext = Depends(get_auth_context),
) -> ApiResponse:
    _require_admin(context)

    plan, planner = _build_copilot_plan_with_fallback(payload)
    return build_success_response(
        {
            "planner": planner,
            "query_plan": plan.model_dump(),
        }
    )
