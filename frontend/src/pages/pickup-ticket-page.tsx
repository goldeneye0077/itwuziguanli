import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  AuthApiError,
  fetchPickupTicket,
  verifyPickup,
  type PickupTicketResult,
  type PickupVerifyResult,
} from "../api";
import { useAuthSession } from "../stores";
import { toApplicationStatusLabel, toDateLabel, toPickupVerifyTypeLabel } from "./page-helpers";

export function PickupTicketPage(): JSX.Element {
  const { applicationId: rawApplicationId } = useParams<{ applicationId: string }>();
  const applicationId = Number(rawApplicationId ?? "0");

  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const [ticket, setTicket] = useState<PickupTicketResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<PickupVerifyResult | null>(null);
  const [verifyType, setVerifyType] = useState<"QR" | "CODE">("CODE");
  const [verifyValue, setVerifyValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTicket = useCallback(async (): Promise<void> => {
    if (!accessToken || !Number.isFinite(applicationId) || applicationId <= 0) {
      setIsLoading(false);
      setErrorMessage("申请单编号无效或会话令牌缺失。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchPickupTicket(accessToken, applicationId);
      setTicket(result);
      setVerifyResult(null);
      setVerifyValue(result.pickupCode);
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "加载取件凭证失败。",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, applicationId]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  async function handleVerify(): Promise<void> {
    if (!accessToken) {
      return;
    }
    const normalizedValue = verifyValue.trim();
    if (!normalizedValue) {
      setErrorMessage("请输入核验值。");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const result = await verifyPickup(accessToken, {
        verifyType,
        value: normalizedValue,
      });
      setVerifyResult(result);
    } catch (error) {
      setVerifyResult(null);
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "取件核验失败。",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="取件凭证头部">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">申请单 #{applicationId} 取件凭证</h2>
          <p className="app-shell__panel-copy">
            展示取件凭证详情，并提供二维码/取件码核验能力。
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

      {isLoading || !ticket ? (
        <section className="app-shell__card" aria-label="取件凭证加载中">
          <p className="app-shell__card-copy">正在加载取件凭证...</p>
        </section>
      ) : (
        <section className="app-shell__grid" aria-label="取件凭证内容">
          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">凭证</p>
              <h3 className="app-shell__card-title">取件码</h3>
            </div>
            <p className="pickup-ticket-code">{ticket.pickupCodeDisplay}</p>
            <p className="dashboard-list__meta">申请单编号：{ticket.applicationId}</p>
            <p className="dashboard-list__meta">失效时间：{toDateLabel(ticket.expiresAt, "长期有效")}</p>
            <p className="dashboard-list__content">二维码内容：{ticket.pickupQrString}</p>

            <p className="app-shell__section-label pickup-ticket-subsection">申请条目</p>
            <ul className="dashboard-list">
              {ticket.items.map((item) => (
                <li key={`${item.skuId}-${item.quantity}`} className="dashboard-list__item">
                  <p className="dashboard-list__title">物料编号 {item.skuId}</p>
                  <p className="dashboard-list__content">数量：{item.quantity}</p>
                </li>
              ))}
            </ul>

            <p className="app-shell__card-copy">
              返回 <Link to={`/applications/${ticket.applicationId}`}>申请单详情</Link>。
            </p>
          </article>

          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">核验工具</p>
              <h3 className="app-shell__card-title">出库前核验</h3>
            </div>
            <div className="outbound-action-grid page-form-grid">
              <label className="store-field">
                核验类型
                <select
                  value={verifyType}
                  onChange={(event) => {
                    const next = event.target.value;
                    setVerifyType(next === "QR" ? "QR" : "CODE");
                  }}
                >
                  <option value="CODE">{toPickupVerifyTypeLabel("CODE")}</option>
                  <option value="QR">{toPickupVerifyTypeLabel("QR")}</option>
                </select>
              </label>

              <label className="store-field">
                核验值
                <input
                  value={verifyValue}
                  onChange={(event) => setVerifyValue(event.target.value)}
                  placeholder="取件码或二维码内容"
                />
              </label>

              <div className="store-action-row page-actions">
                <button
                  className="app-shell__header-action"
                  type="button"
                  onClick={() => setVerifyValue(ticket.pickupCode)}
                >
                  使用取件码
                </button>
                <button
                  className="app-shell__header-action"
                  type="button"
                  onClick={() => setVerifyValue(ticket.pickupQrString)}
                >
                  使用二维码内容
                </button>
                <button
                  className="auth-submit"
                  type="button"
                  disabled={isVerifying}
                  onClick={() => {
                    void handleVerify();
                  }}
                >
                  {isVerifying ? "核验中..." : "开始核验"}
                </button>
              </div>
            </div>

            {verifyResult ? (
              <>
                <p className="app-shell__card-copy">
                  结果：申请单 #{verifyResult.applicationId} · {toApplicationStatusLabel(verifyResult.status)} · 申请人 {verifyResult.applicantUserId}
                </p>
                <ul className="dashboard-list">
                  {verifyResult.assignedAssets.map((asset) => (
                    <li key={asset.assetId} className="dashboard-list__item">
                      <p className="dashboard-list__title">
                        {asset.assetTag} · 资产编号 {asset.assetId}
                      </p>
                      <p className="dashboard-list__content">序列号：{asset.sn}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        </section>
      )}
    </div>
  );
}
