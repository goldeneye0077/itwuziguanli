import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  approveApplicationByNode,
  AuthApiError,
  fetchApprovalInbox,
  type ApprovalInboxItem,
} from "../api";
import { useAuthSession } from "../stores";
import {
  toApplicationStatusLabel,
  toApprovalNodeLabel,
  toDateLabel,
  toDeliveryTypeLabel,
} from "./page-helpers";

export function ApprovalsPage({
  node,
}: {
  readonly node: "LEADER" | "ADMIN";
}): JSX.Element {
  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;
  const canAct = useMemo(() => {
    if (node === "LEADER") {
      return userRoles.includes("LEADER");
    }
    return userRoles.includes("ADMIN") || userRoles.includes("SUPER_ADMIN");
  }, [node, userRoles]);

  const [items, setItems] = useState<ApprovalInboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commentByAppId, setCommentByAppId] = useState<Record<number, string>>({});

  const loadInbox = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setIsLoading(false);
      setErrorMessage("会话令牌缺失，请重新登录。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchApprovalInbox(accessToken, { node, page: 1, pageSize: 50 });
      setItems(result.items);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载审批待办失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, node]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function handleAction(
    applicationId: number,
    action: "APPROVE" | "REJECT",
  ): Promise<void> {
    if (!accessToken) {
      return;
    }

    setIsActing(applicationId);
    setErrorMessage(null);
    try {
      await approveApplicationByNode(accessToken, {
        applicationId,
        node,
        action,
        comment: commentByAppId[applicationId]?.trim() || undefined,
      });
      await loadInbox();
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "提交审批动作失败。",
      );
    } finally {
      setIsActing(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="审批待办头部">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M03 审批待办</p>
          <h2 className="app-shell__panel-title">
            {node === "LEADER" ? "领导审批待办" : "管理员审批待办"}
          </h2>
          <p className="app-shell__panel-copy">
            当前展示 <strong>{toApprovalNodeLabel(node)}</strong> 节点的待处理申请。
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="page-stack__messages">
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <section className="app-shell__card" aria-label="审批待办列表">
        <div className="page-card-head">
          <p className="app-shell__section-label">待办列表</p>
          <h3 className="app-shell__card-title">待处理申请</h3>
        </div>

        {isLoading ? (
          <p className="app-shell__card-copy">正在加载待办...</p>
        ) : items.length === 0 ? (
          <p className="app-shell__card-copy">当前没有待处理申请。</p>
        ) : (
          <ul className="dashboard-list">
            {items.map((item) => (
              <li key={item.applicationId} className="dashboard-list__item">
                <p className="dashboard-list__title">
                  #{item.applicationId} · {toApplicationStatusLabel(item.status)} · {toDeliveryTypeLabel(item.deliveryType)}
                </p>
                <p className="dashboard-list__meta">
                  申请人：{item.applicant.name} · 部门：{item.applicant.departmentId} ·
                  {toDateLabel(item.createdAt)}
                </p>
                <p className="dashboard-list__content">
                  申请条目：{item.itemsSummary
                    .map((summary) => `物料编号 ${summary.skuId} 数量 ${summary.quantity}`)
                    .join("，")}
                </p>
                <div className="approval-actions page-actions">
                  <Link className="dashboard-link" to={`/applications/${item.applicationId}`}>
                    查看详情
                  </Link>
                  {canAct ? (
                    <>
                      <input
                        className="approval-comment-input"
                        value={commentByAppId[item.applicationId] ?? ""}
                        onChange={(event) =>
                          setCommentByAppId((current) => ({
                            ...current,
                            [item.applicationId]: event.target.value,
                          }))
                        }
                        placeholder="可选审批意见"
                      />
                      <button
                        className="app-shell__header-action"
                        type="button"
                        disabled={isActing === item.applicationId}
                        onClick={() => {
                          void handleAction(item.applicationId, "APPROVE");
                        }}
                      >
                        通过
                      </button>
                      <button
                        className="app-shell__header-action"
                        type="button"
                        disabled={isActing === item.applicationId}
                        onClick={() => {
                          void handleAction(item.applicationId, "REJECT");
                        }}
                      >
                        驳回
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
