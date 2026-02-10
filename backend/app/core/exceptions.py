"""Unified exception types and FastAPI exception handler registration."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..schemas.common import build_error_response
from .config import get_settings
from .logging import get_logger
from .middleware import extract_request_id

logger = get_logger(__name__)

ERROR_CODE_TO_STATUS: dict[str, int] = {
    "VALIDATION_ERROR": HTTPStatus.BAD_REQUEST,
    "MISSING_REQUIRED_FIELD": HTTPStatus.BAD_REQUEST,
    "INVALID_FIELD_FORMAT": HTTPStatus.BAD_REQUEST,
    "UNAUTHORIZED": HTTPStatus.UNAUTHORIZED,
    "TOKEN_EXPIRED": HTTPStatus.UNAUTHORIZED,
    "TOKEN_INVALID": HTTPStatus.UNAUTHORIZED,
    "TOKEN_BLACKLISTED": HTTPStatus.UNAUTHORIZED,
    "PERMISSION_DENIED": HTTPStatus.FORBIDDEN,
    "ROLE_INSUFFICIENT": HTTPStatus.FORBIDDEN,
    "RESOURCE_NOT_FOUND": HTTPStatus.NOT_FOUND,
    "USER_NOT_FOUND": HTTPStatus.NOT_FOUND,
    "APPLICATION_NOT_FOUND": HTTPStatus.NOT_FOUND,
    "ASSET_NOT_FOUND": HTTPStatus.NOT_FOUND,
    "SKU_NOT_FOUND": HTTPStatus.NOT_FOUND,
    "SKU_IN_USE": HTTPStatus.CONFLICT,
    "RATE_LIMIT_EXCEEDED": HTTPStatus.TOO_MANY_REQUESTS,
    "STOCK_INSUFFICIENT": HTTPStatus.CONFLICT,
    "APPLICATION_STATUS_INVALID": HTTPStatus.UNPROCESSABLE_ENTITY,
    "ALREADY_APPROVED": HTTPStatus.CONFLICT,
    "PICKUP_CODE_INVALID": HTTPStatus.UNPROCESSABLE_ENTITY,
    "DUPLICATE_SN": HTTPStatus.CONFLICT,
    "ASSET_LOCKED": HTTPStatus.CONFLICT,
    "INTERNAL_SERVER_ERROR": HTTPStatus.INTERNAL_SERVER_ERROR,
    "DATABASE_ERROR": HTTPStatus.INTERNAL_SERVER_ERROR,
    "EXTERNAL_SERVICE_ERROR": HTTPStatus.INTERNAL_SERVER_ERROR,
}

ERROR_CODE_TO_MESSAGE: dict[str, str] = {
    "VALIDATION_ERROR": "请求参数校验失败。",
    "UNAUTHORIZED": "需要登录后才能访问。",
    "PERMISSION_DENIED": "权限不足。",
    "RESOURCE_NOT_FOUND": "资源不存在。",
    "RATE_LIMIT_EXCEEDED": "请求过于频繁，请稍后再试。",
    "INTERNAL_SERVER_ERROR": "系统繁忙，请稍后再试。",
}

HTTP_STATUS_TO_ERROR_CODE: dict[int, str] = {
    HTTPStatus.BAD_REQUEST: "VALIDATION_ERROR",
    HTTPStatus.UNAUTHORIZED: "UNAUTHORIZED",
    HTTPStatus.FORBIDDEN: "PERMISSION_DENIED",
    HTTPStatus.NOT_FOUND: "RESOURCE_NOT_FOUND",
    HTTPStatus.TOO_MANY_REQUESTS: "RATE_LIMIT_EXCEEDED",
}


class AppException(Exception):
    """Business-safe exception carrying standardized error semantics."""

    def __init__(
        self,
        *,
        code: str,
        message: str | None = None,
        details: dict[str, Any] | list[Any] | None = None,
        status_code: int | None = None,
    ) -> None:
        self.code = code
        self.message = message or ERROR_CODE_TO_MESSAGE.get(
            code,
            "请求失败。",
        )
        self.details = details
        self.status_code = status_code or resolve_status_code(code)
        super().__init__(self.message)


def resolve_status_code(code: str) -> int:
    """Translate business error code into HTTP status code."""

    return int(ERROR_CODE_TO_STATUS.get(code, HTTPStatus.INTERNAL_SERVER_ERROR))


def _json_error_response(
    *,
    code: str,
    message: str,
    details: dict[str, Any] | list[Any] | None,
    request_id: str | None,
    status_code: int,
) -> JSONResponse:
    payload = build_error_response(
        code=code,
        message=message,
        details=details,
        request_id=request_id,
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def _build_validation_details(exc: RequestValidationError) -> dict[str, Any]:
    def _contains_chinese(text: str) -> bool:
        return any("\u4e00" <= ch <= "\u9fff" for ch in text)

    def _localize_validation_message(item: dict[str, Any]) -> str:
        error_type = item.get("type")
        ctx = item.get("ctx") if isinstance(item.get("ctx"), dict) else {}

        if error_type == "missing":
            return "必填项不能为空。"
        if error_type == "string_too_short":
            min_length = ctx.get("min_length")
            if isinstance(min_length, int):
                return f"长度不能少于 {min_length} 个字符。"
            return "长度过短。"
        if error_type == "string_too_long":
            max_length = ctx.get("max_length")
            if isinstance(max_length, int):
                return f"长度不能超过 {max_length} 个字符。"
            return "长度过长。"
        if error_type in {"string_pattern_mismatch", "url_parsing", "uuid_parsing"}:
            return "格式不正确。"
        if error_type in {"int_parsing", "int_from_float"}:
            return "必须为整数。"
        if error_type in {"float_parsing"}:
            return "必须为数字。"
        if error_type in {"bool_parsing"}:
            return "必须为布尔值。"
        if error_type in {"date_parsing"}:
            return "日期格式不正确。"
        if error_type in {"datetime_parsing"}:
            return "日期时间格式不正确。"
        if error_type in {"time_parsing"}:
            return "时间格式不正确。"
        if error_type in {"literal_error"}:
            return "参数值不在允许范围内。"
        if error_type in {"list_type"}:
            return "必须为数组。"
        if error_type in {"dict_type"}:
            return "必须为对象。"
        if error_type == "greater_than":
            gt = ctx.get("gt")
            return f"必须大于 {gt}。" if gt is not None else "必须大于指定值。"
        if error_type == "greater_than_equal":
            ge = ctx.get("ge")
            return f"必须大于等于 {ge}。" if ge is not None else "必须大于等于指定值。"
        if error_type == "less_than":
            lt = ctx.get("lt")
            return f"必须小于 {lt}。" if lt is not None else "必须小于指定值。"
        if error_type == "less_than_equal":
            le = ctx.get("le")
            return f"必须小于等于 {le}。" if le is not None else "必须小于等于指定值。"

        msg = item.get("msg")
        if isinstance(msg, str) and _contains_chinese(msg):
            return msg
        return "参数值不合法。"

    field_errors: list[dict[str, str]] = []
    for item in exc.errors():
        location = ".".join(
            str(part)
            for part in item.get("loc", ())
            if str(part) not in {"body", "query", "path", "header"}
        )
        field_errors.append(
            {
                "field": location or "request",
                "message": _localize_validation_message(item),
            }
        )
    return {"fields": field_errors}


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers with unified response shape."""

    @app.exception_handler(AppException)
    async def _app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        request_id = extract_request_id(request)
        logger.warning(
            "app_exception",
            extra={
                "event": "exception.app",
                "error_code": exc.code,
                "status_code": exc.status_code,
                "request_id": request_id,
            },
        )
        return _json_error_response(
            code=exc.code,
            message=exc.message,
            details=exc.details,
            request_id=request_id,
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        request_id = extract_request_id(request)
        logger.warning(
            "request_validation_error",
            extra={
                "event": "exception.validation",
                "error_code": "VALIDATION_ERROR",
                "status_code": HTTPStatus.BAD_REQUEST,
                "request_id": request_id,
            },
        )
        return _json_error_response(
            code="VALIDATION_ERROR",
            message=ERROR_CODE_TO_MESSAGE.get("VALIDATION_ERROR", "请求参数校验失败。"),
            details=_build_validation_details(exc),
            request_id=request_id,
            status_code=int(HTTPStatus.BAD_REQUEST),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        request_id = extract_request_id(request)
        error_code = HTTP_STATUS_TO_ERROR_CODE.get(
            exc.status_code, "INTERNAL_SERVER_ERROR"
        )
        message = (
            exc.detail
            if isinstance(exc.detail, str)
            else ERROR_CODE_TO_MESSAGE.get(error_code, "请求失败。")
        )
        details = exc.detail if isinstance(exc.detail, dict) else None

        logger.warning(
            "http_exception",
            extra={
                "event": "exception.http",
                "error_code": error_code,
                "status_code": exc.status_code,
                "request_id": request_id,
            },
        )
        return _json_error_response(
            code=error_code,
            message=message,
            details=details,
            request_id=request_id,
            status_code=exc.status_code,
        )

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        settings = get_settings()
        request_id = extract_request_id(request)

        logger.exception(
            "unhandled_exception",
            extra={
                "event": "exception.unhandled",
                "error_code": "INTERNAL_SERVER_ERROR",
                "status_code": HTTPStatus.INTERNAL_SERVER_ERROR,
                "request_id": request_id,
            },
        )

        details: dict[str, Any] | None = None
        if settings.expose_error_details:
            details = {"reason": str(exc)}

        return _json_error_response(
            code="INTERNAL_SERVER_ERROR",
            message=ERROR_CODE_TO_MESSAGE["INTERNAL_SERVER_ERROR"],
            details=details,
            request_id=request_id,
            status_code=int(HTTPStatus.INTERNAL_SERVER_ERROR),
        )
