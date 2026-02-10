import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  approveApplicationByNode,
  assignApplicationAssets,
  AuthApiError,
  fetchApplicationDetail,
  type ApplicationDetailResult,
} from "../api";
import { useAuthSession } from "../stores";
import {
  toApplicationStatusLabel,
  toApprovalActionLabel,
  toApprovalNodeLabel,
  toAssetStatusLabel,
  toDateLabel,
  toDeliveryTypeLabel,
} from "./page-helpers";

function groupAssetIdsBySku(detail: ApplicationDetailResult | null): Record<number, string> {
  if (!detail) {
    return {};
  }
  const map: Record<number, number[]> = {};
  detail.assignedAssets.forEach((asset) => {
    map[asset.skuId] = [...(map[asset.skuId] ?? []), asset.assetId];
  });
  return Object.fromEntries(
    Object.entries(map).map(([skuId, assetIds]) => [skuId, assetIds.join(",")]),
  );
}

export function ApplicationDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const applicationId = Number(id ?? "0");

  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;

  const [detail, setDetail] = useState<ApplicationDetailResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [assetDraftBySku, setAssetDraftBySku] = useState<Record<number, string>>({});

  const canLeaderApprove = useMemo(
    () =>
      Boolean(
        detail &&
          detail.application.status === "LOCKED" &&
          (userRoles.includes("LEADER") || userRoles.includes("SUPER_ADMIN")),
      ),
    [detail, userRoles],
  );
  const canAdminApprove = useMemo(
    () =>
      Boolean(
        detail &&
          detail.application.status === "LEADER_APPROVED" &&
          (userRoles.includes("ADMIN") || userRoles.includes("SUPER_ADMIN")),
      ),
    [detail, userRoles],
  );
  const canAssignAssets = useMemo(
    () =>
      Boolean(
        detail &&
          detail.application.status === "ADMIN_APPROVED" &&
          (userRoles.includes("ADMIN") || userRoles.includes("SUPER_ADMIN")),
      ),
    [detail, userRoles],
  );

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!accessToken || !Number.isFinite(applicationId) || applicationId <= 0) {
      setIsLoading(false);
      setErrorMessage("申请单编号无效或会话令牌缺失。");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchApplicationDetail(accessToken, applicationId);
      setDetail(result);
      setAssetDraftBySku(groupAssetIdsBySku(result));
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载申请单详情失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, applicationId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleApprove(node: "LEADER" | "ADMIN", action: "APPROVE" | "REJECT"): Promise<void> {
    if (!accessToken || !detail) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await approveApplicationByNode(accessToken, {
        applicationId: detail.application.id,
        node,
        action,
        comment: comment.trim() || undefined,
      });
      setComment("");
      await loadDetail();
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "提交审批操作失败。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignAssets(): Promise<void> {
    if (!accessToken || !detail) {
      return;
    }

    const assignments = detail.application.items.map((item) => {
      const raw = assetDraftBySku[item.skuId] ?? "";
      const parsed = raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      return {
        skuId: item.skuId,
        assetIds: parsed,
      };
    });

    if (assignments.some((item) => item.assetIds.length === 0)) {
      setErrorMessage("每种物料至少需要填写一个资产编号。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await assignApplicationAssets(accessToken, detail.application.id, { assignments });
      await loadDetail();
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "分配资产失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="申请单详情头部">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M03 申请单详情</p>
          <h2 className="app-shell__panel-title">申请单 #{applicationId}</h2>
          <p className="app-shell__panel-copy">
            查看申请详情、审批历史及角色操作区域。
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

      {isLoading || !detail ? (
        <section className="app-shell__card">
          <p className="app-shell__card-copy">正在加载详情...</p>
        </section>
      ) : (
        <>
          <section className="app-shell__grid" aria-label="申请单详情内容">
            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">申请单</p>
                <h3 className="app-shell__card-title">
                  状态：{toApplicationStatusLabel(detail.application.status)} · 交付方式：{toDeliveryTypeLabel(detail.application.deliveryType)}
                </h3>
              </div>
              <p className="dashboard-list__content">
                申请人：{detail.application.applicantUserId} · 取件码：{detail.application.pickupCode}
              </p>
              <p className="dashboard-list__meta">创建时间：{toDateLabel(detail.application.createdAt)}</p>
              <ul className="dashboard-list">
                {detail.application.items.map((item) => (
                  <li key={item.id} className="dashboard-list__item">
                    <p className="dashboard-list__title">物料编号 {item.skuId}</p>
                    <p className="dashboard-list__content">数量：{item.quantity}</p>
                    {item.note ? <p className="dashboard-list__meta">备注：{item.note}</p> : null}
                  </li>
                ))}
              </ul>
            </article>

            <article className="app-shell__card">
              <div className="page-card-head">
                <p className="app-shell__section-label">分配资产</p>
                <h3 className="app-shell__card-title">资产列表</h3>
              </div>
              {detail.assignedAssets.length === 0 ? (
                <p className="app-shell__card-copy">暂无已分配资产。</p>
              ) : (
                <ul className="dashboard-list">
                  {detail.assignedAssets.map((asset) => (
                    <li key={asset.assetId} className="dashboard-list__item">
                      <p className="dashboard-list__title">
                        {asset.assetTag} · 物料编号 {asset.skuId}
                      </p>
                      <p className="dashboard-list__content">序列号：{asset.sn}</p>
                      <p className="dashboard-list__meta">状态：{toAssetStatusLabel(asset.status)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="app-shell__card" aria-label="审批历史">
            <div className="page-card-head">
              <p className="app-shell__section-label">审批历史</p>
              <h3 className="app-shell__card-title">时间线</h3>
            </div>
            {detail.approvalHistory.length === 0 ? (
              <p className="app-shell__card-copy">暂无审批记录。</p>
            ) : (
              <ul className="dashboard-list">
                {detail.approvalHistory.map((item) => (
                  <li key={item.id} className="dashboard-list__item">
                    <p className="dashboard-list__title">
                      {toApprovalNodeLabel(item.node)} · {toApprovalActionLabel(item.action)} · 操作人 {item.actorUserId}
                    </p>
                    <p className="dashboard-list__meta">{toDateLabel(item.createdAt)}</p>
                    {item.comment ? <p className="dashboard-list__content">{item.comment}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="app-shell__card" aria-label="操作区">
            <div className="page-card-head">
              <p className="app-shell__section-label">操作区</p>
              <h3 className="app-shell__card-title">基于角色的操作</h3>
            </div>

            <label className="store-field">
              审批意见
              <input
                className="approval-comment-input"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="可选审批意见"
              />
            </label>

            {(canLeaderApprove || canAdminApprove) && (
              <div className="store-action-row page-actions">
                <button
                  className="app-shell__header-action"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleApprove(canLeaderApprove ? "LEADER" : "ADMIN", "APPROVE");
                  }}
                >
                  通过
                </button>
                <button
                  className="app-shell__header-action"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleApprove(canLeaderApprove ? "LEADER" : "ADMIN", "REJECT");
                  }}
                >
                  驳回
                </button>
              </div>
            )}

            {canAssignAssets && (
              <div className="approval-assign-grid page-form-grid">
                {detail.application.items.map((item) => (
                  <label key={item.id} className="store-field">
                    物料编号 {item.skuId} 资产编号（逗号分隔）
                    <input
                      className="approval-comment-input"
                      value={assetDraftBySku[item.skuId] ?? ""}
                      onChange={(event) =>
                        setAssetDraftBySku((current) => ({
                          ...current,
                          [item.skuId]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
                <button
                  className="auth-submit"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleAssignAssets();
                  }}
                >
                  {isSubmitting ? "提交中..." : "分配资产并标记待出库"}
                </button>
              </div>
            )}

            {!canLeaderApprove && !canAdminApprove && !canAssignAssets ? (
              <p className="app-shell__card-copy">
                当前状态下你的角色无可执行审批动作。返回
                <Link to="/applications">申请列表</Link>。
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
