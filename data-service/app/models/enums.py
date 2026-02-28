from enum import StrEnum

from sqlalchemy import Enum as SqlEnum


class RoleKey(StrEnum):
    USER = "USER"
    LEADER = "LEADER"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class DeliveryType(StrEnum):
    PICKUP = "PICKUP"
    EXPRESS = "EXPRESS"


class ApplicationType(StrEnum):
    APPLY = "APPLY"
    RETURN = "RETURN"
    REPAIR = "REPAIR"


class ApplicationStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    LOCKED = "LOCKED"
    LEADER_APPROVED = "LEADER_APPROVED"
    LEADER_REJECTED = "LEADER_REJECTED"
    ADMIN_APPROVED = "ADMIN_APPROVED"
    ADMIN_REJECTED = "ADMIN_REJECTED"
    READY_OUTBOUND = "READY_OUTBOUND"
    OUTBOUNDED = "OUTBOUNDED"
    SHIPPED = "SHIPPED"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class AssetStatus(StrEnum):
    IN_STOCK = "IN_STOCK"
    LOCKED = "LOCKED"
    IN_USE = "IN_USE"
    PENDING_INSPECTION = "PENDING_INSPECTION"
    BORROWED = "BORROWED"
    REPAIRING = "REPAIRING"
    SCRAPPED = "SCRAPPED"


class ApprovalNode(StrEnum):
    LEADER = "LEADER"
    ADMIN = "ADMIN"


class ApprovalAction(StrEnum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class StockFlowAction(StrEnum):
    INBOUND = "INBOUND"
    LOCK = "LOCK"
    UNLOCK = "UNLOCK"
    OUTBOUND = "OUTBOUND"
    SHIP = "SHIP"
    RECEIVE = "RECEIVE"
    REPAIR_START = "REPAIR_START"
    REPAIR_FINISH = "REPAIR_FINISH"
    SCRAP = "SCRAP"
    CANCEL = "CANCEL"


class AnnouncementStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class OcrDocType(StrEnum):
    INVOICE = "INVOICE"
    DELIVERY_NOTE = "DELIVERY_NOTE"
    OTHER = "OTHER"


class OcrJobStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class SkuStockMode(StrEnum):
    SERIALIZED = "SERIALIZED"
    QUANTITY = "QUANTITY"


class SkuStockFlowAction(StrEnum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    ADJUST = "ADJUST"
    LOCK = "LOCK"
    UNLOCK = "UNLOCK"
    SHIP = "SHIP"


class TokenBlacklistReason(StrEnum):
    LOGOUT = "LOGOUT"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    ADMIN_FORCED = "ADMIN_FORCED"


class NotifyChannel(StrEnum):
    EMAIL = "EMAIL"
    DINGTALK = "DINGTALK"


class NotifyStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


def enum_column(enum_cls: type[StrEnum], name: str) -> SqlEnum:
    return SqlEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
    )
