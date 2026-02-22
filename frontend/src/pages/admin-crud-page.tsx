import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createAdminCrudRecord,
  deleteAdminCrudRecord,
  fetchAdminCrudResource,
  updateAdminCrudRecord,
  type AdminCrudListResult,
  type AdminCrudResource,
} from "../api";
import { useAuthSession } from "../stores";
import { toErrorMessage, toRoleListLabel } from "./page-helpers";

const ADMIN_CRUD_RESOURCES: Array<{ value: AdminCrudResource; label: string }> = [
  { value: "users", label: "用户" },
  { value: "categories", label: "分类" },
  { value: "skus", label: "物料" },
  { value: "assets", label: "资产" },
  { value: "applications", label: "申请单" },
  { value: "announcements", label: "公告" },
];

type CrudFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "datetime-local"
  | "select";

type CrudFieldEmptyStrategy = "omit" | "null";
type CrudFormMode = "create" | "edit";

interface CrudFieldOption {
  readonly value: string;
  readonly label: string;
}

interface CrudFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: CrudFieldKind;
  readonly placeholder?: string;
  readonly options?: readonly CrudFieldOption[];
  readonly defaultValue?: string;
  readonly requiredOnCreate?: boolean;
  readonly requiredOnEdit?: boolean;
  readonly emptyStrategy?: CrudFieldEmptyStrategy;
  readonly min?: number;
  readonly helperText?: string;
}

const STOCK_MODE_OPTIONS: readonly CrudFieldOption[] = [
  { value: "SERIALIZED", label: "SERIALIZED（序列号资产）" },
  { value: "QUANTITY", label: "QUANTITY（数量库存）" },
];

const ASSET_STATUS_OPTIONS: readonly CrudFieldOption[] = [
  { value: "IN_STOCK", label: "IN_STOCK" },
  { value: "LOCKED", label: "LOCKED" },
  { value: "IN_USE", label: "IN_USE" },
  { value: "PENDING_INSPECTION", label: "PENDING_INSPECTION" },
  { value: "BORROWED", label: "BORROWED" },
  { value: "REPAIRING", label: "REPAIRING" },
  { value: "SCRAPPED", label: "SCRAPPED" },
];

const APPLICATION_TYPE_OPTIONS: readonly CrudFieldOption[] = [
  { value: "APPLY", label: "APPLY" },
  { value: "RETURN", label: "RETURN" },
  { value: "REPAIR", label: "REPAIR" },
];

const DELIVERY_TYPE_OPTIONS: readonly CrudFieldOption[] = [
  { value: "PICKUP", label: "PICKUP（自提）" },
  { value: "EXPRESS", label: "EXPRESS（快递）" },
];

const APPLICATION_STATUS_OPTIONS: readonly CrudFieldOption[] = [
  { value: "SUBMITTED", label: "SUBMITTED" },
  { value: "LOCKED", label: "LOCKED" },
  { value: "LEADER_APPROVED", label: "LEADER_APPROVED" },
  { value: "LEADER_REJECTED", label: "LEADER_REJECTED" },
  { value: "ADMIN_APPROVED", label: "ADMIN_APPROVED" },
  { value: "ADMIN_REJECTED", label: "ADMIN_REJECTED" },
  { value: "READY_OUTBOUND", label: "READY_OUTBOUND" },
  { value: "OUTBOUNDED", label: "OUTBOUNDED" },
  { value: "SHIPPED", label: "SHIPPED" },
  { value: "DONE", label: "DONE" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const ANNOUNCEMENT_STATUS_OPTIONS: readonly CrudFieldOption[] = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "PUBLISHED", label: "PUBLISHED" },
  { value: "ARCHIVED", label: "ARCHIVED" },
];

const RESOURCE_FORM_FIELDS: Record<AdminCrudResource, readonly CrudFieldDefinition[]> = {
  users: [
    {
      key: "employee_no",
      label: "工号",
      kind: "text",
      placeholder: "例如：U10001",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "name",
      label: "姓名",
      kind: "text",
      placeholder: "例如：张三",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "department_id",
      label: "部门 ID",
      kind: "number",
      placeholder: "例如：2001",
      min: 1,
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    { key: "email", label: "邮箱", kind: "text", placeholder: "可选", emptyStrategy: "null" },
    {
      key: "department_name",
      label: "部门名称",
      kind: "text",
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "section_name",
      label: "科室",
      kind: "text",
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "mobile_phone",
      label: "手机",
      kind: "text",
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "job_title",
      label: "职务",
      kind: "text",
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "password",
      label: "密码",
      kind: "text",
      placeholder: "留空：创建默认 User12345；编辑不修改",
      emptyStrategy: "omit",
      helperText: "仅在需要重置密码时填写。",
    },
  ],
  categories: [
    {
      key: "name",
      label: "分类名称",
      kind: "text",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "parent_id",
      label: "父级分类 ID",
      kind: "number",
      min: 1,
      placeholder: "留空表示一级分类",
      emptyStrategy: "null",
    },
  ],
  skus: [
    {
      key: "category_id",
      label: "分类 ID",
      kind: "number",
      min: 1,
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    { key: "brand", label: "品牌", kind: "text", requiredOnCreate: true, requiredOnEdit: true },
    { key: "model", label: "型号", kind: "text", requiredOnCreate: true, requiredOnEdit: true },
    { key: "spec", label: "规格", kind: "text", requiredOnCreate: true, requiredOnEdit: true },
    {
      key: "reference_price",
      label: "参考价格",
      kind: "decimal",
      min: 0,
      placeholder: "例如：1999.00",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "cover_url",
      label: "封面 URL",
      kind: "text",
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "stock_mode",
      label: "库存模式",
      kind: "select",
      options: STOCK_MODE_OPTIONS,
      defaultValue: "SERIALIZED",
    },
    {
      key: "safety_stock_threshold",
      label: "安全库存阈值",
      kind: "number",
      min: 0,
      defaultValue: "0",
      emptyStrategy: "null",
    },
  ],
  assets: [
    {
      key: "asset_tag",
      label: "资产标签",
      kind: "text",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "sku_id",
      label: "物料 ID",
      kind: "number",
      min: 1,
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "sn",
      label: "序列号 SN",
      kind: "text",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "status",
      label: "资产状态",
      kind: "select",
      options: ASSET_STATUS_OPTIONS,
      defaultValue: "IN_STOCK",
    },
    {
      key: "holder_user_id",
      label: "持有人 ID",
      kind: "number",
      min: 1,
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "locked_application_id",
      label: "锁定申请 ID",
      kind: "number",
      min: 1,
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "inbound_at",
      label: "入库时间",
      kind: "datetime-local",
      placeholder: "可选",
      emptyStrategy: "omit",
    },
  ],
  applications: [
    { key: "title", label: "申请标题", kind: "text", placeholder: "可选", emptyStrategy: "null" },
    {
      key: "applicant_user_id",
      label: "申请人 ID",
      kind: "number",
      min: 1,
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "type",
      label: "申请类型",
      kind: "select",
      options: APPLICATION_TYPE_OPTIONS,
      defaultValue: "APPLY",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "delivery_type",
      label: "交付方式",
      kind: "select",
      options: DELIVERY_TYPE_OPTIONS,
      defaultValue: "PICKUP",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "status",
      label: "单据状态",
      kind: "select",
      options: APPLICATION_STATUS_OPTIONS,
      defaultValue: "SUBMITTED",
    },
    { key: "pickup_code", label: "取件码（6位）", kind: "text", emptyStrategy: "null" },
    { key: "pickup_qr_string", label: "取件二维码字符串", kind: "text", emptyStrategy: "null" },
    { key: "applicant_name_snapshot", label: "申请人姓名快照", kind: "text", emptyStrategy: "null" },
    {
      key: "applicant_department_snapshot",
      label: "申请人部门快照",
      kind: "text",
      emptyStrategy: "null",
    },
    { key: "applicant_phone_snapshot", label: "申请人电话快照", kind: "text", emptyStrategy: "null" },
    {
      key: "applicant_job_title_snapshot",
      label: "申请人职务快照",
      kind: "text",
      emptyStrategy: "null",
    },
    {
      key: "leader_approver_user_id",
      label: "领导审批人 ID",
      kind: "number",
      min: 1,
      placeholder: "可选",
      emptyStrategy: "null",
    },
    {
      key: "admin_reviewer_user_id",
      label: "管理员审批人 ID",
      kind: "number",
      min: 1,
      placeholder: "可选",
      emptyStrategy: "null",
    },
    { key: "express_contact_name", label: "快递联系人", kind: "text", emptyStrategy: "null" },
    { key: "express_contact_phone", label: "快递联系电话", kind: "text", emptyStrategy: "null" },
    {
      key: "express_region",
      label: "快递区域",
      kind: "text",
      placeholder: "例如：广东省 深圳市 南山区",
      emptyStrategy: "null",
    },
    { key: "express_detail", label: "快递详细地址", kind: "textarea", emptyStrategy: "null" },
  ],
  announcements: [
    {
      key: "title",
      label: "公告标题",
      kind: "text",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "content",
      label: "公告内容",
      kind: "textarea",
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "author_user_id",
      label: "作者用户 ID",
      kind: "number",
      min: 1,
      requiredOnCreate: true,
      requiredOnEdit: true,
    },
    {
      key: "status",
      label: "公告状态",
      kind: "select",
      options: ANNOUNCEMENT_STATUS_OPTIONS,
      defaultValue: "DRAFT",
    },
    {
      key: "published_at",
      label: "发布时间",
      kind: "datetime-local",
      placeholder: "可选",
      emptyStrategy: "null",
    },
  ],
};

function toCrudResourceLabel(resource: AdminCrudResource): string {
  return (
    ADMIN_CRUD_RESOURCES.find((item) => item.value === resource)?.label ?? resource
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function collectColumns(items: Record<string, unknown>[]): string[] {
  const columnSet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      columnSet.add(key);
    }
  }
  return Array.from(columnSet);
}

function resolveRecordId(row: Record<string, unknown>): number | null {
  const candidate = row.id;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function buildDefaultFormValues(fields: readonly CrudFieldDefinition[]): Record<string, string> {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = field.defaultValue ?? "";
    return acc;
  }, {});
}

function toDateTimeLocalValue(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "";
  }
  const normalized = value.replace(" ", "T");
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
}

function isFieldRequired(field: CrudFieldDefinition, mode: CrudFormMode): boolean {
  if (mode === "create") {
    return field.requiredOnCreate ?? false;
  }
  if (field.requiredOnEdit !== undefined) {
    return field.requiredOnEdit;
  }
  return field.requiredOnCreate ?? false;
}

function parseIntegerField(field: CrudFieldDefinition, text: string): number {
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${field.label} 必须是整数。`);
  }
  if (field.min !== undefined && parsed < field.min) {
    throw new Error(`${field.label} 不能小于 ${field.min}。`);
  }
  return parsed;
}

function parseDecimalField(field: CrudFieldDefinition, text: string): string {
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field.label} 必须是数字。`);
  }
  if (field.min !== undefined && parsed < field.min) {
    throw new Error(`${field.label} 不能小于 ${field.min}。`);
  }
  return text;
}

function buildExpressAddressSnapshot(values: Record<string, string>): Record<string, string> {
  const contactName = values.express_contact_name?.trim() ?? "";
  const contactPhone = values.express_contact_phone?.trim() ?? "";
  const region = values.express_region?.trim() ?? "";
  const detail = values.express_detail?.trim() ?? "";
  const snapshot: Record<string, string> = {};
  if (contactName) {
    snapshot.contact_name = contactName;
  }
  if (contactPhone) {
    snapshot.contact_phone = contactPhone;
  }
  if (region) {
    snapshot.region = region;
  }
  if (detail) {
    snapshot.detail = detail;
  }
  return snapshot;
}

function buildCrudPayload(
  resource: AdminCrudResource,
  fields: readonly CrudFieldDefinition[],
  values: Record<string, string>,
  mode: CrudFormMode,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (resource === "applications" && field.key.startsWith("express_")) {
      continue;
    }
    const rawValue = values[field.key] ?? "";
    const normalizedValue = rawValue.trim();
    const required = isFieldRequired(field, mode);
    const emptyStrategy = field.emptyStrategy ?? "omit";

    if (!normalizedValue) {
      if (required) {
        throw new Error(`${field.label} 不能为空。`);
      }
      if (emptyStrategy === "null") {
        payload[field.key] = null;
      }
      continue;
    }

    switch (field.kind) {
      case "number":
        payload[field.key] = parseIntegerField(field, normalizedValue);
        break;
      case "decimal":
        payload[field.key] = parseDecimalField(field, normalizedValue);
        break;
      default:
        payload[field.key] = normalizedValue;
        break;
    }
  }

  if (resource === "applications") {
    const snapshot = buildExpressAddressSnapshot(values);
    payload.express_address_snapshot = Object.keys(snapshot).length ? snapshot : null;
  }

  return payload;
}

function mapApplicationAddressValue(
  snapshot: Record<string, unknown> | null,
  fieldKey: string,
): string {
  if (!snapshot) {
    return "";
  }
  if (fieldKey === "express_contact_name") {
    return String(snapshot.contact_name ?? snapshot.receiver_name ?? "");
  }
  if (fieldKey === "express_contact_phone") {
    return String(snapshot.contact_phone ?? snapshot.receiver_phone ?? "");
  }
  if (fieldKey === "express_region") {
    const region = snapshot.region;
    if (typeof region === "string" && region.trim()) {
      return region;
    }
    const parts = [snapshot.province, snapshot.city, snapshot.district].filter(
      (item) => typeof item === "string" && item.trim(),
    );
    return parts.length ? String(parts.join(" ")) : "";
  }
  if (fieldKey === "express_detail") {
    return String(snapshot.detail ?? snapshot.address ?? "");
  }
  return "";
}

function mapRowToFormValues(
  resource: AdminCrudResource,
  row: Record<string, unknown>,
  fields: readonly CrudFieldDefinition[],
): Record<string, string> {
  const nextValues = buildDefaultFormValues(fields);
  const addressSnapshot =
    resource === "applications" &&
    row.express_address_snapshot &&
    typeof row.express_address_snapshot === "object" &&
    !Array.isArray(row.express_address_snapshot)
      ? (row.express_address_snapshot as Record<string, unknown>)
      : null;

  for (const field of fields) {
    if (resource === "applications" && field.key.startsWith("express_")) {
      nextValues[field.key] = mapApplicationAddressValue(addressSnapshot, field.key);
      continue;
    }
    const source = row[field.key];
    if (source === null || source === undefined) {
      continue;
    }
    if (field.kind === "datetime-local") {
      nextValues[field.key] = toDateTimeLocalValue(source);
      continue;
    }
    nextValues[field.key] = String(source);
  }

  return nextValues;
}

export function AdminCrudPage(): JSX.Element {
  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;
  const isSuperAdmin = userRoles.includes("SUPER_ADMIN");

  const [resource, setResource] = useState<AdminCrudResource>("users");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [result, setResult] = useState<AdminCrudListResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resourceFields = RESOURCE_FORM_FIELDS[resource];
  const [createFormValues, setCreateFormValues] = useState<Record<string, string>>(
    buildDefaultFormValues(resourceFields),
  );
  const [editRecordId, setEditRecordId] = useState<number | null>(null);
  const [editFormValues, setEditFormValues] = useState<Record<string, string>>(
    buildDefaultFormValues(resourceFields),
  );

  useEffect(() => {
    setCreateFormValues(buildDefaultFormValues(resourceFields));
    setEditFormValues(buildDefaultFormValues(resourceFields));
    setEditRecordId(null);
  }, [resourceFields]);

  const columns = useMemo(() => collectColumns(result?.items ?? []), [result?.items]);

  const loadCrudData = useCallback(async (nextArgs?: {
    resource?: AdminCrudResource;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<void> => {
    if (!accessToken || !isSuperAdmin) {
      return;
    }

    const nextResource = nextArgs?.resource ?? resource;
    const nextKeyword = nextArgs?.keyword ?? keyword;
    const nextPage = nextArgs?.page ?? page;
    const nextPageSize = nextArgs?.pageSize ?? pageSize;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const nextResult = await fetchAdminCrudResource(accessToken, nextResource, {
        q: nextKeyword.trim() || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      setResult(nextResult);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载数据面板失败。"));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isSuperAdmin, keyword, page, pageSize, resource]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }
    void loadCrudData();
  }, [isSuperAdmin, loadCrudData]);

  async function handleCreate(): Promise<void> {
    if (!accessToken || !isSuperAdmin) {
      return;
    }
    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = buildCrudPayload(resource, resourceFields, createFormValues, "create");
      await createAdminCrudRecord(accessToken, resource, payload);
      setSuccessMessage(`已创建 ${toCrudResourceLabel(resource)} 记录。`);
      setCreateFormValues(buildDefaultFormValues(resourceFields));
      await loadCrudData({ page: 1 });
      setPage(1);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建记录失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!accessToken || !isSuperAdmin || editRecordId === null) {
      return;
    }
    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = buildCrudPayload(resource, resourceFields, editFormValues, "edit");
      await updateAdminCrudRecord(accessToken, resource, editRecordId, payload);
      setSuccessMessage(`已更新 ${toCrudResourceLabel(resource)} #${editRecordId}。`);
      await loadCrudData();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "更新记录失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!accessToken || !isSuperAdmin) {
      return;
    }
    const confirmed = window.confirm(`确认删除 ${toCrudResourceLabel(resource)} #${id} ?`);
    if (!confirmed) {
      return;
    }
    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAdminCrudRecord(accessToken, resource, id);
      setSuccessMessage(`已删除 ${toCrudResourceLabel(resource)} #${id}。`);
      if (editRecordId === id) {
        setEditRecordId(null);
        setEditFormValues(buildDefaultFormValues(resourceFields));
      }
      await loadCrudData();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除记录失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  function renderField(
    field: CrudFieldDefinition,
    mode: CrudFormMode,
    values: Record<string, string>,
    onChange: (key: string, value: string) => void,
  ): JSX.Element {
    const value = values[field.key] ?? "";
    const required = isFieldRequired(field, mode);
    const label = required ? `${field.label}（必填）` : field.label;

    let inputNode: JSX.Element;
    if (field.kind === "select") {
      inputNode = (
        <select value={value} onChange={(event) => onChange(field.key, event.target.value)}>
          {!required ? <option value="">请选择（可空）</option> : null}
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    } else if (field.kind === "textarea") {
      inputNode = (
        <textarea
          rows={3}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      );
    } else {
      const inputType = field.kind === "datetime-local" ? "datetime-local" : "text";
      inputNode = (
        <input
          type={inputType}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      );
    }

    return (
      <label key={field.key} className="store-field">
        {label}
        {inputNode}
        {field.helperText ? <span className="admin-crud-field-helper">{field.helperText}</span> : null}
      </label>
    );
  }

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  if (!isSuperAdmin) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">当前角色无权访问该页面。</h2>
        <p className="forbidden-state__detail">
          所需角色：<strong>{toRoleListLabel(["SUPER_ADMIN"])}</strong>，当前角色：
          <strong>{toRoleListLabel(userRoles)}</strong>
        </p>
      </section>
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize)) : 1;

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="后台数据面板说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">通用数据 CRUD 面板</h2>
          <p className="app-shell__panel-copy">仅 SUPER_ADMIN 可执行增删改查。</p>
        </div>
      </section>

      {errorMessage || successMessage ? (
        <div className="page-stack__messages">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? <p className="store-success" aria-live="polite">{successMessage}</p> : null}
        </div>
      ) : null}

      <section className="app-shell__card" aria-label="查询条件">
        <div className="page-card-head">
          <p className="app-shell__section-label">查询控制</p>
          <h3 className="app-shell__card-title">资源 + 关键字 + 分页</h3>
        </div>
        <div className="admin-crud-toolbar page-form-grid">
          <label className="store-field">
            资源
            <select
              value={resource}
              onChange={(event) => {
                const next = event.target.value as AdminCrudResource;
                setResource(next);
                setPage(1);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              {ADMIN_CRUD_RESOURCES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="store-field admin-field-wide">
            关键字（可选）
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按字段关键字搜索"
            />
          </label>

          <label className="store-field">
            页码
            <input
              type="number"
              min={1}
              value={page}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPage(Number.isFinite(next) && next > 0 ? Math.trunc(next) : 1);
              }}
            />
          </label>

          <label className="store-field">
            每页条数
            <input
              type="number"
              min={1}
              max={100}
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                const normalized = Number.isFinite(next) ? Math.trunc(next) : 20;
                setPageSize(Math.max(1, Math.min(100, normalized)));
              }}
            />
          </label>

          <button
            className="auth-submit"
            type="button"
            disabled={isLoading}
            onClick={() => void loadCrudData()}
          >
            {isLoading ? "加载中..." : "加载资源"}
          </button>
        </div>
      </section>

      <section className="app-shell__card" aria-label="写操作">
        <div className="page-card-head">
          <p className="app-shell__section-label">写操作</p>
          <h3 className="app-shell__card-title">可视化创建 / 编辑 / 删除</h3>
        </div>

        <div className="admin-crud-form-panels">
          <section className="admin-crud-form-panel" aria-label="创建记录">
            <div className="page-card-head">
              <p className="app-shell__section-label">创建</p>
              <h4 className="app-shell__card-title">创建 {toCrudResourceLabel(resource)}</h4>
            </div>
            <div className="admin-form-grid">
              {resourceFields.map((field) =>
                renderField(field, "create", createFormValues, (key, value) =>
                  setCreateFormValues((prev) => ({ ...prev, [key]: value })),
                ),
              )}
            </div>
            <div className="page-actions">
              <button className="auth-submit" type="button" disabled={isMutating} onClick={() => void handleCreate()}>
                {isMutating ? "提交中..." : "创建记录"}
              </button>
            </div>
          </section>

          <section className="admin-crud-form-panel" aria-label="编辑记录">
            <div className="page-card-head">
              <p className="app-shell__section-label">编辑</p>
              <h4 className="app-shell__card-title">编辑 {toCrudResourceLabel(resource)}</h4>
            </div>
            <p className="app-shell__card-copy">
              {editRecordId === null
                ? "请在下方结果表格点击“编辑”以载入记录。"
                : `当前编辑记录 ID：${editRecordId}`}
            </p>
            <div className="admin-form-grid">
              {resourceFields.map((field) =>
                renderField(field, "edit", editFormValues, (key, value) =>
                  setEditFormValues((prev) => ({ ...prev, [key]: value })),
                ),
              )}
            </div>
            <div className="page-actions">
              <button
                className="auth-submit"
                type="button"
                disabled={isMutating || editRecordId === null}
                onClick={() => void handleUpdate()}
              >
                {isMutating ? "提交中..." : "更新记录"}
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isMutating}
                onClick={() => {
                  setEditRecordId(null);
                  setEditFormValues(buildDefaultFormValues(resourceFields));
                }}
              >
                清空编辑
              </button>
            </div>
          </section>
        </div>
      </section>

      <section className="app-shell__card" aria-label="查询结果">
        <div className="page-card-head">
          <p className="app-shell__section-label">数据结果</p>
          <h3 className="app-shell__card-title">资源：{toCrudResourceLabel(resource)}</h3>
        </div>

        {isLoading ? (
          <p className="app-shell__card-copy">正在加载资源数据...</p>
        ) : !result ? (
          <p className="app-shell__card-copy">尚未执行查询。</p>
        ) : !result.items.length ? (
          <p className="app-shell__card-copy">当前筛选条件下没有数据。</p>
        ) : (
          <div className="admin-crud-table-wrap page-table-wrap">
            <table className="analytics-table">
              <caption className="visually-hidden">
                后台数据面板查询结果表（所选资源）
              </caption>
              <thead>
                <tr>
                  <th scope="col">操作</th>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((row, rowIndex) => {
                  const keyParts = columns.map((column) => formatCellValue(row[column]));
                  const rowKey = `${rowIndex}-${keyParts.join("|")}`;
                  const rowId = resolveRecordId(row);
                  return (
                    <tr key={rowKey}>
                      <td>
                        <div className="page-actions">
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={rowId === null}
                            onClick={() => {
                              if (rowId === null) {
                                return;
                              }
                              setEditRecordId(rowId);
                              setEditFormValues(mapRowToFormValues(resource, row, resourceFields));
                            }}
                          >
                            编辑
                          </button>
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={rowId === null || isMutating}
                            onClick={() => {
                              if (rowId !== null) {
                                void handleDelete(rowId);
                              }
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                      {columns.map((column) => (
                        <td key={`${rowKey}-${column}`}>{formatCellValue(row[column])}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result ? (
          <div className="admin-crud-pagination">
            <p className="app-shell__card-copy">
              第 {result.meta.page} / {totalPages} 页 | 每页 {result.meta.pageSize} 条 | 共 {result.meta.total} 条
            </p>
            <div className="store-action-row page-actions">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoading || result.meta.page <= 1}
                onClick={() => {
                  const nextPage = Math.max(1, result.meta.page - 1);
                  setPage(nextPage);
                  void loadCrudData({ page: nextPage });
                }}
              >
                上一页
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoading || result.meta.page >= totalPages}
                onClick={() => {
                  const nextPage = Math.min(totalPages, result.meta.page + 1);
                  setPage(nextPage);
                  void loadCrudData({ page: nextPage });
                }}
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
