import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchAdminCrudResource,
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

export function AdminCrudPage(): JSX.Element {
  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;

  const [resource, setResource] = useState<AdminCrudResource>("users");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [result, setResult] = useState<AdminCrudListResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const columns = useMemo(() => collectColumns(result?.items ?? []), [result?.items]);

  const token = accessToken ?? "";

  const loadCrudData = useCallback(async (nextArgs?: {
    resource?: AdminCrudResource;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<void> => {
    if (!accessToken) {
      return;
    }

    const nextResource = nextArgs?.resource ?? resource;
    const nextKeyword = nextArgs?.keyword ?? keyword;
    const nextPage = nextArgs?.page ?? page;
    const nextPageSize = nextArgs?.pageSize ?? pageSize;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const nextResult = await fetchAdminCrudResource(token, nextResource, {
        q: nextKeyword.trim() || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      setResult(nextResult);
      const resourceLabel = toCrudResourceLabel(nextResult.resource);
      setSuccessMessage(
        `已加载 ${resourceLabel} ${nextResult.items.length} 行数据，共 ${nextResult.meta.total} 条记录。`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载后台数据面板失败。"));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, keyword, page, pageSize, resource, token]);

  useEffect(() => {
    void loadCrudData();
  }, [loadCrudData]);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <p className="app-shell__section-label">M08 后台数据面板</p>
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize)) : 1;

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="后台数据面板说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M08 后台数据面板</p>
          <h2 className="app-shell__panel-title">通用只读数据面板</h2>
          <p className="app-shell__panel-copy">
            所需角色：<strong>{toRoleListLabel(["ADMIN", "SUPER_ADMIN"])}</strong>。当前角色：<strong>{toRoleListLabel(userRoles)}</strong>。
          </p>
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

      <section className="app-shell__card" aria-label="后台数据面板查询条件">
        <div className="page-card-head">
          <p className="app-shell__section-label">查询控制</p>
          <h3 className="app-shell__card-title">资源 + 关键词 + 分页</h3>
        </div>
        <div className="admin-crud-toolbar page-form-grid">
          <label className="store-field">
            资源
            <select
              value={resource}
              onChange={(event) => {
                const nextResource = event.target.value as AdminCrudResource;
                setResource(nextResource);
                setPage(1);
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
            关键词（可选）
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按文本或数字编号搜索"
            />
          </label>

          <label className="store-field">
            页码
            <input
              type="number"
              min={1}
              value={page}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setPage(Number.isFinite(nextValue) && nextValue > 0 ? Math.trunc(nextValue) : 1);
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
                const nextValue = Number(event.target.value);
                const normalized = Number.isFinite(nextValue) ? Math.trunc(nextValue) : 20;
                setPageSize(Math.min(100, Math.max(1, normalized)));
              }}
            />
          </label>

          <button
            className="auth-submit"
            type="button"
            disabled={isLoading}
            onClick={() => {
              void loadCrudData();
            }}
          >
            {isLoading ? "加载中..." : "加载资源"}
          </button>
        </div>
      </section>

      <section className="app-shell__card" aria-label="后台数据面板查询结果">
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
                  return (
                    <tr key={rowKey}>
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
