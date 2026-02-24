import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createAdminCrudRecord,
  deleteAdminCrudRecord,
  fetchAdminCrudResource,
  updateAdminCrudRecord,
} from "../api";
import { hasActionPermission } from "../permissions";
import { useAuthSession } from "../stores";
import { toDateLabel, toErrorMessage } from "./page-helpers";

type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type AnnouncementStatusFilter = AnnouncementStatus | "ALL";

interface AnnouncementRow {
  readonly id: number;
  readonly title: string;
  readonly content: string;
  readonly authorUserId: number | null;
  readonly status: AnnouncementStatus;
  readonly publishedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

const STATUS_OPTIONS: ReadonlyArray<{
  readonly value: AnnouncementStatus;
  readonly label: string;
}> = [
  { value: "DRAFT", label: "草稿" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "ARCHIVED", label: "已下线" },
];

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function parseAnnouncementStatus(value: unknown): AnnouncementStatus {
  if (typeof value !== "string") {
    return "DRAFT";
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "PUBLISHED") {
    return "PUBLISHED";
  }
  if (normalized === "ARCHIVED") {
    return "ARCHIVED";
  }
  return "DRAFT";
}

function parseAnnouncementRow(row: Record<string, unknown>): AnnouncementRow | null {
  const id = parseNumber(row.id);
  if (id === null) {
    return null;
  }

  return {
    id,
    title: typeof row.title === "string" ? row.title : "",
    content: typeof row.content === "string" ? row.content : "",
    authorUserId: parseNumber(row.author_user_id),
    status: parseAnnouncementStatus(row.status),
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function toStatusLabel(status: AnnouncementStatus): string {
  const match = STATUS_OPTIONS.find((item) => item.value === status);
  return match ? match.label : status;
}

function toDateTimeLocalValue(isoDate: string | null): string {
  if (!isoDate) {
    return "";
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.valueOf())) {
    return "";
  }
  const timezoneOffsetMinutes = parsed.getTimezoneOffset();
  const localTime = new Date(parsed.getTime() - timezoneOffsetMinutes * 60 * 1000);
  return localTime.toISOString().slice(0, 16);
}

function toIsoDateOrNull(dateTimeLocalValue: string): string | null {
  const normalized = dateTimeLocalValue.trim();
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
}

export function AnnouncementManagePage(): JSX.Element {
  const { state, userRoles, userPermissions } = useAuthSession();
  const accessToken = state.accessToken;
  const currentUserId = state.user?.id ?? null;

  const canManageAnnouncements = hasActionPermission(
    "announcements.manage",
    userRoles,
    userPermissions,
  );

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createStatus, setCreateStatus] = useState<AnnouncementStatus>("DRAFT");
  const [createPublishedAt, setCreatePublishedAt] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState<AnnouncementStatus>("DRAFT");
  const [editPublishedAt, setEditPublishedAt] = useState("");

  const [previewId, setPreviewId] = useState<number | null>(null);

  const previewRow = useMemo(() => {
    if (previewId === null) {
      return null;
    }
    return rows.find((item) => item.id === previewId) ?? null;
  }, [previewId, rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadRows = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const trimmedKeyword = keyword.trim();

      if (statusFilter === "ALL") {
        const result = await fetchAdminCrudResource(accessToken, "announcements", {
          q: trimmedKeyword || undefined,
          page,
          pageSize,
        });
        const parsedRows = result.items
          .map(parseAnnouncementRow)
          .filter((item): item is AnnouncementRow => item !== null);
        setRows(parsedRows);
        setTotal(result.meta.total);
        return;
      }

      const collectedRows: AnnouncementRow[] = [];
      let currentPage = 1;
      let pages = 1;
      const batchSize = 100;

      while (currentPage <= pages && currentPage <= 50) {
        const result = await fetchAdminCrudResource(accessToken, "announcements", {
          q: trimmedKeyword || undefined,
          page: currentPage,
          pageSize: batchSize,
        });
        pages = Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize));
        const parsedBatch = result.items
          .map(parseAnnouncementRow)
          .filter((item): item is AnnouncementRow => item !== null);
        collectedRows.push(...parsedBatch);
        currentPage += 1;
      }

      const filteredRows = collectedRows.filter((item) => item.status === statusFilter);
      const filteredTotal = filteredRows.length;
      const filteredPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
      const normalizedPage = Math.min(page, filteredPages);
      const offset = (normalizedPage - 1) * pageSize;
      const pageRows = filteredRows.slice(offset, offset + pageSize);

      if (normalizedPage !== page) {
        setPage(normalizedPage);
      }

      setRows(pageRows);
      setTotal(filteredTotal);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载公告列表失败。"));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, keyword, page, pageSize, statusFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  function fillEditForm(row: AnnouncementRow): void {
    setEditingId(row.id);
    setEditTitle(row.title);
    setEditContent(row.content);
    setEditStatus(row.status);
    setEditPublishedAt(toDateTimeLocalValue(row.publishedAt));
  }

  function resetEditForm(): void {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
    setEditStatus("DRAFT");
    setEditPublishedAt("");
  }

  async function handleCreate(): Promise<void> {
    if (!accessToken) {
      setErrorMessage("会话令牌缺失，请重新登录。");
      return;
    }
    if (!canManageAnnouncements) {
      setErrorMessage("当前账号无公告管理权限。");
      return;
    }
    if (!currentUserId) {
      setErrorMessage("当前会话用户信息缺失，无法创建公告。");
      return;
    }
    if (!createTitle.trim() || !createContent.trim()) {
      setErrorMessage("公告标题和内容不能为空。");
      return;
    }

    const resolvedPublishedAt =
      createStatus === "PUBLISHED"
        ? toIsoDateOrNull(createPublishedAt) ?? new Date().toISOString()
        : toIsoDateOrNull(createPublishedAt);

    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createAdminCrudRecord(accessToken, "announcements", {
        title: createTitle.trim(),
        content: createContent.trim(),
        author_user_id: currentUserId,
        status: createStatus,
        published_at: resolvedPublishedAt,
      });
      setCreateTitle("");
      setCreateContent("");
      setCreateStatus("DRAFT");
      setCreatePublishedAt("");
      setSuccessMessage("公告创建成功。");
      setPage(1);
      await loadRows();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建公告失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!accessToken || editingId === null) {
      return;
    }
    if (!canManageAnnouncements) {
      setErrorMessage("当前账号无公告管理权限。");
      return;
    }
    if (!editTitle.trim() || !editContent.trim()) {
      setErrorMessage("公告标题和内容不能为空。");
      return;
    }

    const resolvedPublishedAt =
      editStatus === "PUBLISHED"
        ? toIsoDateOrNull(editPublishedAt) ?? new Date().toISOString()
        : toIsoDateOrNull(editPublishedAt);

    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminCrudRecord(accessToken, "announcements", editingId, {
        title: editTitle.trim(),
        content: editContent.trim(),
        status: editStatus,
        published_at: resolvedPublishedAt,
      });
      setSuccessMessage(`公告 #${editingId} 更新成功。`);
      await loadRows();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "更新公告失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!accessToken) {
      return;
    }
    if (!canManageAnnouncements) {
      setErrorMessage("当前账号无公告管理权限。");
      return;
    }
    if (!window.confirm(`确认删除公告 #${id} 吗？`)) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAdminCrudRecord(accessToken, "announcements", id);
      if (editingId === id) {
        resetEditForm();
      }
      if (previewId === id) {
        setPreviewId(null);
      }
      setSuccessMessage(`公告 #${id} 已删除。`);
      await loadRows();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除公告失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleQuickStatusChange(
    row: AnnouncementRow,
    nextStatus: AnnouncementStatus,
  ): Promise<void> {
    if (!accessToken) {
      return;
    }
    if (!canManageAnnouncements) {
      setErrorMessage("当前账号无公告管理权限。");
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const nextPublishedAt =
        nextStatus === "PUBLISHED"
          ? row.publishedAt ?? new Date().toISOString()
          : row.publishedAt;
      await updateAdminCrudRecord(accessToken, "announcements", row.id, {
        status: nextStatus,
        published_at: nextPublishedAt,
      });
      setSuccessMessage(`公告 #${row.id} 状态已更新为${toStatusLabel(nextStatus)}。`);
      await loadRows();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "更新公告状态失败。"));
    } finally {
      setIsMutating(false);
    }
  }

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="公告栏管理说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">公告栏管理</h2>
          <p className="app-shell__panel-copy">
            支持公告创建、编辑、发布、下线、删除与内容预览。发布状态会影响工作台公告栏展示。
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
          {successMessage ? (
            <p className="store-success" aria-live="polite">
              {successMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="app-shell__card" aria-label="公告筛选条件">
        <div className="page-card-head">
          <p className="app-shell__section-label">筛选与分页</p>
          <h3 className="app-shell__card-title">查询公告</h3>
        </div>
        <div className="page-toolbar announcement-toolbar">
          <label className="store-field">
            关键字
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="标题或内容关键字"
            />
          </label>
          <label className="store-field">
            状态
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as AnnouncementStatusFilter);
                setPage(1);
              }}
            >
              <option value="ALL">全部</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="store-field">
            每页条数
            <input
              type="number"
              min={5}
              max={50}
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) {
                  return;
                }
                setPageSize(Math.max(5, Math.min(50, Math.trunc(next))));
                setPage(1);
              }}
            />
          </label>
          <button
            className="app-shell__header-action"
            type="button"
            disabled={isLoading}
            onClick={() => {
              void loadRows();
            }}
          >
            {isLoading ? "加载中..." : "查询公告"}
          </button>
          <button
            className="app-shell__header-action"
            type="button"
            disabled={isLoading}
            onClick={() => {
              setKeyword("");
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            重置
          </button>
        </div>
      </section>

      <section className="app-shell__card" aria-label="公告创建">
        <div className="page-card-head">
          <p className="app-shell__section-label">创建公告</p>
          <h3 className="app-shell__card-title">新增公告</h3>
        </div>
        <div className="page-form-grid announcement-form-grid">
          <label className="store-field">
            标题
            <input
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="请输入公告标题"
            />
          </label>
          <label className="store-field">
            状态
            <select
              value={createStatus}
              onChange={(event) => setCreateStatus(event.target.value as AnnouncementStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="store-field">
            发布时间（可选）
            <input
              type="datetime-local"
              value={createPublishedAt}
              onChange={(event) => setCreatePublishedAt(event.target.value)}
            />
          </label>
          <label className="store-field announcement-form-grid__wide">
            内容
            <textarea
              rows={4}
              value={createContent}
              onChange={(event) => setCreateContent(event.target.value)}
              placeholder="请输入公告内容"
            />
          </label>
        </div>
        <div className="page-actions">
          <button
            className="auth-submit"
            type="button"
            disabled={!canManageAnnouncements || isMutating}
            onClick={() => {
              void handleCreate();
            }}
          >
            {isMutating ? "提交中..." : "创建公告"}
          </button>
        </div>
      </section>

      <section className="app-shell__card" aria-label="公告列表">
        <div className="page-card-head">
          <p className="app-shell__section-label">公告列表</p>
          <h3 className="app-shell__card-title">共 {total} 条公告</h3>
        </div>
        {isLoading ? (
          <p className="app-shell__card-copy">公告加载中...</p>
        ) : rows.length === 0 ? (
          <p className="app-shell__card-copy">当前条件下暂无公告。</p>
        ) : (
          <div className="page-table-wrap" aria-label="公告表格容器">
            <table className="analytics-table" aria-label="公告管理表格">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>作者ID</th>
                  <th>发布时间</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.title}</td>
                    <td>{toStatusLabel(row.status)}</td>
                    <td>{row.authorUserId ?? "-"}</td>
                    <td>{toDateLabel(row.publishedAt, "-")}</td>
                    <td>{toDateLabel(row.updatedAt, "-")}</td>
                    <td>
                      <div className="inbound-table-actions">
                        <button
                          className="app-shell__header-action"
                          type="button"
                          disabled={!canManageAnnouncements}
                          onClick={() => fillEditForm(row)}
                        >
                          编辑
                        </button>
                        <button
                          className="app-shell__header-action"
                          type="button"
                          onClick={() => setPreviewId(row.id)}
                        >
                          预览
                        </button>
                        {row.status !== "PUBLISHED" ? (
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={!canManageAnnouncements || isMutating}
                            onClick={() => {
                              void handleQuickStatusChange(row, "PUBLISHED");
                            }}
                          >
                            发布
                          </button>
                        ) : null}
                        {row.status !== "ARCHIVED" ? (
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={!canManageAnnouncements || isMutating}
                            onClick={() => {
                              void handleQuickStatusChange(row, "ARCHIVED");
                            }}
                          >
                            下线
                          </button>
                        ) : null}
                        <button
                          className="app-shell__header-action inbound-action-danger"
                          type="button"
                          disabled={!canManageAnnouncements || isMutating}
                          onClick={() => {
                            void handleDelete(row.id);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="page-actions">
          <button
            className="app-shell__header-action"
            type="button"
            disabled={isLoading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </button>
          <span className="app-shell__card-copy announcement-page-label">
            第 {page} / {totalPages} 页
          </span>
          <button
            className="app-shell__header-action"
            type="button"
            disabled={isLoading || page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            下一页
          </button>
        </div>
      </section>

      {editingId !== null ? (
        <section className="app-shell__card" aria-label="编辑公告">
          <div className="page-card-head">
            <p className="app-shell__section-label">编辑公告</p>
            <h3 className="app-shell__card-title">公告 #{editingId}</h3>
          </div>
          <div className="page-form-grid announcement-form-grid">
            <label className="store-field">
              标题
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </label>
            <label className="store-field">
              状态
              <select
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as AnnouncementStatus)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="store-field">
              发布时间（可选）
              <input
                type="datetime-local"
                value={editPublishedAt}
                onChange={(event) => setEditPublishedAt(event.target.value)}
              />
            </label>
            <label className="store-field announcement-form-grid__wide">
              内容
              <textarea
                rows={4}
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
              />
            </label>
          </div>
          <div className="page-actions">
            <button
              className="auth-submit"
              type="button"
              disabled={isMutating || !canManageAnnouncements}
              onClick={() => {
                void handleUpdate();
              }}
            >
              {isMutating ? "保存中..." : "保存修改"}
            </button>
            <button
              className="app-shell__header-action"
              type="button"
              disabled={isMutating}
              onClick={resetEditForm}
            >
              取消编辑
            </button>
          </div>
        </section>
      ) : null}

      {previewRow ? (
        <section className="app-shell__card" aria-label="公告预览">
          <div className="page-card-head">
            <p className="app-shell__section-label">内容预览</p>
            <h3 className="app-shell__card-title">{previewRow.title}</h3>
            <p className="app-shell__card-copy">
              状态：{toStatusLabel(previewRow.status)} ｜ 发布时间：
              {toDateLabel(previewRow.publishedAt, "未设置")}
            </p>
          </div>
          <pre className="announcement-content-preview">{previewRow.content}</pre>
          <div className="page-actions">
            <button
              className="app-shell__header-action"
              type="button"
              onClick={() => setPreviewId(null)}
            >
              关闭预览
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

