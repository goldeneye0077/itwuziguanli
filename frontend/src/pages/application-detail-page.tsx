import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  assignApplicationAssets,
  AuthApiError,
  fetchApplicationDetail,
  type ApplicationDetailResult,
} from "../api";
import { useAuthSession } from "../stores";
import {
  toApprovalActionLabel,
  toApprovalNodeLabel,
  toDateLabel,
  toDeliveryTypeLabel,
} from "./page-helpers";

function groupAssetIdsBySku(detail: ApplicationDetailResult | null): Record<number, string> {
  if (!detail) {
    return {};
  }
  const grouped: Record<number, number[]> = {};
  detail.assignedAssets.forEach((asset) => {
    grouped[asset.skuId] = [...(grouped[asset.skuId] ?? []), asset.assetId];
  });
  return Object.fromEntries(
    Object.entries(grouped).map(([skuId, ids]) => [skuId, ids.join(",")]),
  );
}

function toMaterialName(
  name: string | null | undefined,
  brand: string | null | undefined,
  model: string | null | undefined,
  skuId: number,
): string {
  const explicit = (name ?? "").trim();
  if (explicit) {
    return explicit;
  }
  const fallback = `${brand ?? ""} ${model ?? ""}`.trim();
  return fallback || `SKU ${skuId}`;
}

export function ApplicationDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const applicationId = Number(id ?? "0");

  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;

  const [detail, setDetail] = useState<ApplicationDetailResult | null>(null);
  const [assetDraftBySku, setAssetDraftBySku] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载申请详情失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, applicationId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleAssignAssets(): Promise<void> {
    if (!accessToken || !detail) {
      return;
    }

    const assignments = detail.application.items
      .map((item) => {
        const raw = assetDraftBySku[item.skuId] ?? "";
        const parsed = raw
          .split(",")
          .map((part) => Number(part.trim()))
          .filter((value) => Number.isFinite(value) && value > 0);
        return {
          skuId: item.skuId,
          assetIds: parsed,
        };
      })
      .filter((item) => item.assetIds.length > 0);

    if (!assignments.length) {
      setErrorMessage("请至少为一类物料填写资产编号后再提交。");
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
          <h2 className="app-shell__panel-title">申请单 #{applicationId}</h2>
          <p className="app-shell__panel-copy">查看申请人信息、领用物料明细与审批历史。</p>
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
          <section className="app-shell__card" aria-label="申请人信息表">
            <div className="page-card-head">
              <h3 className="app-shell__card-title">申请人信息</h3>
            </div>
            <div className="page-table-wrap">
              <table className="analytics-table">
                <tbody>
                  <tr>
                    <th scope="row">申请标题</th>
                    <td>{detail.application.title ?? `申请单 #${detail.application.id}`}</td>
                  </tr>
                  <tr>
                    <th scope="row">申请人姓名</th>
                    <td>{detail.application.applicantSnapshot?.name ?? "-"}</td>
                  </tr>
                  <tr>
                    <th scope="row">部门</th>
                    <td>{detail.application.applicantSnapshot?.departmentName ?? "-"}</td>
                  </tr>
                  <tr>
                    <th scope="row">电话</th>
                    <td>{detail.application.applicantSnapshot?.phone ?? "-"}</td>
                  </tr>
                  <tr>
                    <th scope="row">领取方式</th>
                    <td>{toDeliveryTypeLabel(detail.application.deliveryType)}</td>
                  </tr>
                  {detail.application.deliveryType === "EXPRESS" ? (
                    <tr>
                      <th scope="row">地址详情</th>
                      <td>
                        {detail.application.expressAddressSnapshot
                          ? `${detail.application.expressAddressSnapshot.province ?? ""}${detail.application.expressAddressSnapshot.city ?? ""}${detail.application.expressAddressSnapshot.district ?? ""}${detail.application.expressAddressSnapshot.detail ?? ""}`
                          : "-"}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <th scope="row">申请日期</th>
                    <td>{toDateLabel(detail.application.createdAt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="app-shell__card" aria-label="领用物料清单表">
            <div className="page-card-head">
              <h3 className="app-shell__card-title">领用物料清单</h3>
            </div>
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
                  {detail.application.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.coverUrl ? (
                          <img className="application-detail-cover" src={item.coverUrl} alt={`${item.brand ?? ""} ${item.model ?? ""}`.trim()} />
                        ) : (
                          <span className="muted-text">无图</span>
                        )}
                      </td>
                      <td>{toMaterialName(item.name, item.brand, item.model, item.skuId)}</td>
                      <td>{item.model ?? "-"}</td>
                      <td>{item.brand ?? "-"}</td>
                      <td>{item.spec ?? "-"}</td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                      {toApprovalNodeLabel(item.node)} - {toApprovalActionLabel(item.action)} - 操作人 {item.actorUserId}
                    </p>
                    <p className="dashboard-list__meta">{toDateLabel(item.createdAt)}</p>
                    {item.comment ? <p className="dashboard-list__content">{item.comment}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canAssignAssets ? (
            <section className="app-shell__card" aria-label="资产分配">
              <div className="page-card-head">
                <p className="app-shell__section-label">管理员操作</p>
                <h3 className="app-shell__card-title">分配资产并标记待出库</h3>
              </div>
              <div className="approval-assign-grid page-form-grid">
                {detail.application.items.map((item) => (
                  <label key={item.id} className="store-field">
                    {toMaterialName(item.name, item.brand, item.model, item.skuId)} 资产编号（逗号分隔）
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
                <button className="auth-submit" type="button" disabled={isSubmitting} onClick={() => void handleAssignAssets()}>
                  {isSubmitting ? "提交中..." : "确认资产分配"}
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

