import { useCallback, useEffect, useMemo, useState } from "react";

import {
  approveApplicationByNode,
  AuthApiError,
  fetchApplicationDetail,
  fetchApprovalInbox,
  type ApplicationDetailResult,
  type ApprovalInboxItem,
} from "../api";
import { useAuthSession } from "../stores";
import {
  toApplicationStatusLabel,
  toApprovalNodeLabel,
  toDateLabel,
  toDeliveryTypeLabel,
} from "./page-helpers";

type ApprovalDecision = "APPROVE" | "REJECT";

export function ApprovalsPage({
  node,
}: {
  readonly node: "LEADER" | "ADMIN";
}): JSX.Element {
  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;
  const canAct = useMemo(() => {
    if (node === "LEADER") {
      return userRoles.includes("LEADER") || userRoles.includes("SUPER_ADMIN");
    }
    return userRoles.includes("ADMIN") || userRoles.includes("SUPER_ADMIN");
  }, [node, userRoles]);

  const [items, setItems] = useState<ApprovalInboxItem[]>([]);
  const [decisionByAppId, setDecisionByAppId] = useState<Record<number, ApprovalDecision>>({});
  const [rejectReasonByAppId, setRejectReasonByAppId] = useState<Record<number, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<ApplicationDetailResult | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

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
      setDecisionByAppId(
        Object.fromEntries(result.items.map((item) => [item.applicationId, "APPROVE" as const])),
      );
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载审批待办失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, node]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function openDetailModal(applicationId: number): Promise<void> {
    if (!accessToken) {
      return;
    }
    setDetailModalOpen(true);
    setIsDetailLoading(true);
    setActiveDetail(null);
    try {
      const detail = await fetchApplicationDetail(accessToken, applicationId);
      setActiveDetail(detail);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载申请详情失败。");
      setDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function submitDecision(applicationId: number): Promise<void> {
    if (!accessToken) {
      return;
    }

    const decision = decisionByAppId[applicationId] ?? "APPROVE";
    const rejectReason = rejectReasonByAppId[applicationId]?.trim() ?? "";
    if (decision === "REJECT" && !rejectReason) {
      setErrorMessage("选择“驳回”时必须填写驳回原因。");
      return;
    }

    setIsActing(applicationId);
    setErrorMessage(null);
    try {
      await approveApplicationByNode(accessToken, {
        applicationId,
        node,
        action: decision,
        comment: decision === "REJECT" ? rejectReason : "同意",
      });
      await loadInbox();
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "提交审批动作失败。");
    } finally {
      setIsActing(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="审批待办头部">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">
            {node === "LEADER" ? "领导审批待办" : "管理员审批待办"}
          </h2>
          <p className="app-shell__panel-copy">当前展示 {toApprovalNodeLabel(node)} 节点的待处理申请。</p>
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
            {items.map((item) => {
              const decision = decisionByAppId[item.applicationId] ?? "APPROVE";
              const rejectReason = rejectReasonByAppId[item.applicationId] ?? "";
              return (
                <li key={item.applicationId} className="dashboard-list__item">
                  <p className="dashboard-list__title">{item.title}</p>
                  <p className="dashboard-list__meta">
                    申请人：{item.applicant.name} - 部门：{item.applicant.departmentName ?? item.applicant.departmentId} -
                    {toDateLabel(item.createdAt)}
                  </p>
                  <p className="dashboard-list__content">
                    状态：{toApplicationStatusLabel(item.status)} - 交付：{toDeliveryTypeLabel(item.deliveryType)} -
                    物料：
                    {item.itemsSummary
                      .map((summary) => `${summary.brand ?? ""} ${summary.model ?? ""} x${summary.quantity}`.trim())
                      .join("、")}
                  </p>

                  <div className="approval-actions page-actions">
                    <button
                      className="app-shell__header-action"
                      type="button"
                      onClick={() => {
                        void openDetailModal(item.applicationId);
                      }}
                    >
                      查看详情
                    </button>

                    {canAct ? (
                      <>
                        <select
                          value={decision}
                          onChange={(event) =>
                            setDecisionByAppId((current) => ({
                              ...current,
                              [item.applicationId]: event.target.value as ApprovalDecision,
                            }))
                          }
                        >
                          <option value="APPROVE">同意</option>
                          <option value="REJECT">驳回</option>
                        </select>

                        {decision === "REJECT" ? (
                          <input
                            className="approval-comment-input"
                            value={rejectReason}
                            onChange={(event) =>
                              setRejectReasonByAppId((current) => ({
                                ...current,
                                [item.applicationId]: event.target.value,
                              }))
                            }
                            placeholder="驳回原因"
                          />
                        ) : null}

                        <button
                          className="auth-submit"
                          type="button"
                          disabled={isActing === item.applicationId}
                          onClick={() => {
                            void submitDecision(item.applicationId);
                          }}
                        >
                          {isActing === item.applicationId ? "提交中..." : "提交审批"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detailModalOpen ? (
        <div className="approval-modal" role="dialog" aria-modal="true" aria-label="申请详情">
          <div className="approval-modal__dialog">
            <div className="approval-modal__head">
              <h3>申请详情</h3>
              <button
                className="app-shell__header-action"
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  setActiveDetail(null);
                }}
              >
                关闭
              </button>
            </div>

            {isDetailLoading || !activeDetail ? (
              <p className="app-shell__card-copy">正在加载详情...</p>
            ) : (
              <div className="approval-modal__body">
                <section className="app-shell__card" aria-label="申请人信息表">
                  <h4 className="app-shell__card-title">申请人信息</h4>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <tbody>
                        <tr>
                          <th scope="row">申请标题</th>
                          <td>{activeDetail.application.title ?? `申请单 #${activeDetail.application.id}`}</td>
                        </tr>
                        <tr>
                          <th scope="row">申请人姓名</th>
                          <td>{activeDetail.application.applicantSnapshot?.name ?? "-"}</td>
                        </tr>
                        <tr>
                          <th scope="row">部门</th>
                          <td>{activeDetail.application.applicantSnapshot?.departmentName ?? "-"}</td>
                        </tr>
                        <tr>
                          <th scope="row">电话</th>
                          <td>{activeDetail.application.applicantSnapshot?.phone ?? "-"}</td>
                        </tr>
                        <tr>
                          <th scope="row">领取方式</th>
                          <td>{toDeliveryTypeLabel(activeDetail.application.deliveryType)}</td>
                        </tr>
                        {activeDetail.application.deliveryType === "EXPRESS" ? (
                          <tr>
                            <th scope="row">快递地址</th>
                            <td>
                              {activeDetail.application.expressAddressSnapshot
                                ? `${activeDetail.application.expressAddressSnapshot.province ?? ""}${activeDetail.application.expressAddressSnapshot.city ?? ""}${activeDetail.application.expressAddressSnapshot.district ?? ""}${activeDetail.application.expressAddressSnapshot.detail ?? ""}`
                                : "-"}
                            </td>
                          </tr>
                        ) : null}
                        <tr>
                          <th scope="row">申请日期</th>
                          <td>{toDateLabel(activeDetail.application.createdAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="app-shell__card" aria-label="领用物料清单">
                  <h4 className="app-shell__card-title">领用物料清单</h4>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th scope="col">缩略图</th>
                          <th scope="col">物料名称</th>
                          <th scope="col">型号</th>
                          <th scope="col">品牌</th>
                          <th scope="col">规格</th>
                          <th scope="col">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDetail.application.items.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              {entry.coverUrl ? (
                                <img className="inventory-cover" src={entry.coverUrl} alt={`${entry.brand ?? ""} ${entry.model ?? ""}`.trim()} />
                              ) : (
                                <span className="muted-text">无图</span>
                              )}
                            </td>
                            <td>{`${entry.brand ?? ""} ${entry.model ?? ""}`.trim() || `SKU ${entry.skuId}`}</td>
                            <td>{entry.model ?? "-"}</td>
                            <td>{entry.brand ?? "-"}</td>
                            <td>{entry.spec ?? "-"}</td>
                            <td>{entry.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

