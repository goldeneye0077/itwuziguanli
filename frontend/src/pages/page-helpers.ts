import { AuthApiError } from "../api";
import type { AppRole } from "../routes/blueprint-routes";

const SHANGHAI_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function toDateLabel(isoDate: string | null | undefined, emptyLabel?: string): string {
  if (!isoDate) {
    return emptyLabel ?? "";
  }

  const normalized = normalizeIsoDate(isoDate);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    return isoDate;
  }

  return SHANGHAI_DATE_TIME_FORMATTER.format(parsed);
}

function normalizeIsoDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(" ", "T")}Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}Z`;
  }
  return trimmed;
}

export function parsePositiveInteger(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError) {
    return error.message;
  }
  return fallback;
}

function toMappedLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
  emptyLabel = "",
): string {
  if (!value) {
    return emptyLabel;
  }
  return labels[value] ?? value;
}

const ROLE_LABELS: Record<AppRole, string> = {
  PUBLIC: "访客",
  USER: "普通用户",
  LEADER: "部门负责人",
  ADMIN: "管理员",
  SUPER_ADMIN: "超级管理员",
};

export function toRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function toRoleListLabel(roles: readonly AppRole[]): string {
  if (!roles.length) {
    return toRoleLabel("PUBLIC");
  }
  return roles.map(toRoleLabel).join(" / ");
}

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  PICKUP: "自提",
  EXPRESS: "快递",
};

export function toDeliveryTypeLabel(value: string | null | undefined): string {
  return toMappedLabel(value, DELIVERY_TYPE_LABELS);
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  LOCKED: "已锁库",
  LEADER_APPROVED: "领导通过",
  LEADER_REJECTED: "领导驳回",
  ADMIN_APPROVED: "管理员通过",
  ADMIN_REJECTED: "管理员驳回",
  READY_OUTBOUND: "待出库",
  OUTBOUNDED: "已交付",
  SHIPPED: "已发货",
  DONE: "已完结",
  CANCELLED: "已取消",
};

export function toApplicationStatusLabel(value: string | null | undefined): string {
  return toMappedLabel(value, APPLICATION_STATUS_LABELS);
}

const APPLICATION_TYPE_LABELS: Record<string, string> = {
  APPLY: "申领",
  RETURN: "归还",
  REPAIR: "报修",
};

export function toApplicationTypeLabel(value: string | null | undefined): string {
  return toMappedLabel(value, APPLICATION_TYPE_LABELS);
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "在库可用",
  LOCKED: "已锁定",
  IN_USE: "在用",
  PENDING_INSPECTION: "待验收",
  BORROWED: "借用中",
  REPAIRING: "维修中",
  SCRAPPED: "已报废",
};

export function toAssetStatusLabel(value: string | null | undefined): string {
  return toMappedLabel(value, ASSET_STATUS_LABELS);
}

const APPROVAL_NODE_LABELS: Record<string, string> = {
  LEADER: "领导",
  ADMIN: "管理员",
};

export function toApprovalNodeLabel(value: string | null | undefined): string {
  return toMappedLabel(value, APPROVAL_NODE_LABELS);
}

const APPROVAL_ACTION_LABELS: Record<string, string> = {
  APPROVE: "通过",
  REJECT: "驳回",
};

export function toApprovalActionLabel(value: string | null | undefined): string {
  return toMappedLabel(value, APPROVAL_ACTION_LABELS);
}

const PICKUP_VERIFY_TYPE_LABELS: Record<string, string> = {
  APPLICATION_ID: "申请单编号",
  CODE: "取件码",
  QR: "二维码",
};

export function toPickupVerifyTypeLabel(value: string | null | undefined): string {
  return toMappedLabel(value, PICKUP_VERIFY_TYPE_LABELS);
}

const AI_RECOMMENDATION_LABELS: Record<string, string> = {
  PASS: "建议通过",
  REJECT: "建议驳回",
};

export function toAiRecommendationLabel(value: string | null | undefined): string {
  return toMappedLabel(value, AI_RECOMMENDATION_LABELS);
}

const REPAIR_URGENCY_LABELS: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
};

export function toRepairUrgencyLabel(value: string | null | undefined): string {
  return toMappedLabel(value, REPAIR_URGENCY_LABELS);
}

const SCRAP_REASON_LABELS: Record<string, string> = {
  DAMAGE: "损坏",
  OBSOLETE: "淘汰",
  LOST: "丢失",
};

export function toScrapReasonLabel(value: string | null | undefined): string {
  return toMappedLabel(value, SCRAP_REASON_LABELS);
}

const OCR_DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE: "发票",
  DELIVERY_NOTE: "送货单",
  OTHER: "其他",
};

export function toOcrDocTypeLabel(value: string | null | undefined): string {
  return toMappedLabel(value, OCR_DOC_TYPE_LABELS);
}

const OCR_JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "待处理",
  PROCESSING: "识别中",
  READY_FOR_REVIEW: "待确认",
  CONFIRMED: "已确认",
  FAILED: "失败",
};

export function toOcrJobStatusLabel(value: string | null | undefined): string {
  return toMappedLabel(value, OCR_JOB_STATUS_LABELS);
}
