import { useCallback, useEffect, useState } from "react";

import {
  AuthApiError,
  confirmOutboundPickup,
  fetchOutboundExpressQueue,
  fetchOutboundPickupQueue,
  shipOutbound,
  type OutboundExpressQueueItem,
  type OutboundPickupQueueItem,
} from "../api";
import { useAuthSession } from "../stores";
import { toDateLabel } from "./page-helpers";

function formatItemSummary(
  items: ReadonlyArray<{
    readonly skuId: number;
    readonly quantity: number;
  }>,
): string {
  return items
    .map((item) => `物料编号 ${item.skuId} 数量 ${item.quantity}`)
    .join("，");
}

const PICKUP_VERIFY_TYPE_LABELS: Record<
  "QR" | "CODE" | "APPLICATION_ID",
  string
> = {
  APPLICATION_ID: "申请单编号",
  CODE: "取件码",
  QR: "二维码",
};

export function OutboundPage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const [activeTab, setActiveTab] = useState<"PICKUP" | "EXPRESS">("PICKUP");
  const [pickupQueue, setPickupQueue] = useState<OutboundPickupQueueItem[]>([]);
  const [expressQueue, setExpressQueue] = useState<OutboundExpressQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const [isShipping, setIsShipping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pickupVerifyType, setPickupVerifyType] = useState<
    "QR" | "CODE" | "APPLICATION_ID"
  >("APPLICATION_ID");
  const [pickupValue, setPickupValue] = useState("");

  const [shipApplicationId, setShipApplicationId] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipTrackingNo, setShipTrackingNo] = useState("");

  const loadQueues = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setErrorMessage("会话令牌缺失，请重新登录。");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [pickupResult, expressResult] = await Promise.all([
        fetchOutboundPickupQueue(accessToken, { page: 1, pageSize: 50 }),
        fetchOutboundExpressQueue(accessToken, { page: 1, pageSize: 50 }),
      ]);
      setPickupQueue(pickupResult.items);
      setExpressQueue(expressResult.items);
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "加载出库队列失败。",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  async function handleConfirmPickup(): Promise<void> {
    if (!accessToken) {
      return;
    }
    const normalizedValue = pickupValue.trim();
    if (!normalizedValue) {
      setErrorMessage("请输入取件核验值。");
      return;
    }

    setIsConfirmingPickup(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await confirmOutboundPickup(accessToken, {
        verifyType: pickupVerifyType,
        value: normalizedValue,
      });
      setSuccessMessage(
        `申请单 #${result.applicationId} 自提核销成功，交付资产 ${result.deliveredAssets.length} 台。`,
      );
      setPickupValue("");
      await loadQueues();
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "确认自提出库失败。",
      );
    } finally {
      setIsConfirmingPickup(false);
    }
  }

  async function handleShipExpress(): Promise<void> {
    if (!accessToken) {
      return;
    }
    const parsedApplicationId = Number(shipApplicationId.trim());
    if (!Number.isFinite(parsedApplicationId) || parsedApplicationId <= 0) {
      setErrorMessage("发货申请单编号必须为正整数。");
      return;
    }
    if (!shipCarrier.trim() || !shipTrackingNo.trim()) {
      setErrorMessage("承运商和运单号不能为空。");
      return;
    }

    setIsShipping(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await shipOutbound(accessToken, {
        applicationId: parsedApplicationId,
        carrier: shipCarrier.trim(),
        trackingNo: shipTrackingNo.trim(),
      });
      setSuccessMessage(`申请单 #${result.applicationId} 快递发货成功。`);
      setShipApplicationId("");
      setShipCarrier("");
      setShipTrackingNo("");
      await loadQueues();
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "提交快递发货失败。",
      );
    } finally {
      setIsShipping(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="出库工作台说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M05 出库</p>
          <h2 className="app-shell__panel-title">出库执行工作台</h2>
          <p className="app-shell__panel-copy">
            查询自提/快递待办队列，并执行核销与发货操作。
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

      <section className="app-shell__card" aria-label="出库标签切换">
        <div className="page-card-head">
          <p className="app-shell__section-label">队列标签</p>
          <h3 className="app-shell__card-title">选择待办队列</h3>
        </div>
        <div className="outbound-tab-row page-toolbar">
          <button
            className={activeTab === "PICKUP" ? "outbound-tab is-active" : "outbound-tab"}
            type="button"
            aria-pressed={activeTab === "PICKUP"}
            onClick={() => setActiveTab("PICKUP")}
          >
            自提队列
          </button>
          <button
            className={activeTab === "EXPRESS" ? "outbound-tab is-active" : "outbound-tab"}
            type="button"
            aria-pressed={activeTab === "EXPRESS"}
            onClick={() => setActiveTab("EXPRESS")}
          >
            快递队列
          </button>
          <button className="app-shell__header-action" type="button" onClick={() => void loadQueues()}>
            刷新
          </button>
        </div>
      </section>

      {activeTab === "PICKUP" ? (
        <section className="app-shell__grid" aria-label="自提队列标签页">
          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">队列</p>
              <h3 className="app-shell__card-title">待自提申请</h3>
            </div>
            {isLoading ? (
              <p className="app-shell__card-copy">正在加载自提队列...</p>
            ) : pickupQueue.length === 0 ? (
              <p className="app-shell__card-copy">当前无待自提申请。</p>
            ) : (
              <ul className="dashboard-list">
                {pickupQueue.map((item) => (
                  <li key={item.applicationId} className="dashboard-list__item">
                    <p className="dashboard-list__title">
                      #{item.applicationId} · 申请人 {item.applicantUserId}
                    </p>
                    <p className="dashboard-list__meta">
                      取件码：{item.pickupCode} · {toDateLabel(item.createdAt)}
                    </p>
                    <p className="dashboard-list__content">
                      申请条目：{formatItemSummary(item.items)}
                    </p>
                    <div className="store-action-row page-actions">
                      <button
                        className="app-shell__header-action"
                        type="button"
                        onClick={() => {
                          setPickupVerifyType("APPLICATION_ID");
                          setPickupValue(String(item.applicationId));
                        }}
                      >
                        使用申请单编号
                      </button>
                      <button
                        className="app-shell__header-action"
                        type="button"
                        onClick={() => {
                          setPickupVerifyType("CODE");
                          setPickupValue(item.pickupCode);
                        }}
                      >
                        使用取件码
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">操作</p>
              <h3 className="app-shell__card-title">确认自提</h3>
            </div>
            <div className="outbound-action-grid page-form-grid">
              <label className="store-field">
                核验类型
                <select
                  value={pickupVerifyType}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPickupVerifyType(
                      next === "QR" || next === "CODE" || next === "APPLICATION_ID"
                        ? next
                        : "APPLICATION_ID",
                    );
                  }}
                >
                  <option value="APPLICATION_ID">
                    {PICKUP_VERIFY_TYPE_LABELS.APPLICATION_ID}
                  </option>
                  <option value="CODE">{PICKUP_VERIFY_TYPE_LABELS.CODE}</option>
                  <option value="QR">{PICKUP_VERIFY_TYPE_LABELS.QR}</option>
                </select>
              </label>

              <label className="store-field">
                核验值
                <input
                  value={pickupValue}
                  onChange={(event) => setPickupValue(event.target.value)}
                  placeholder="申请单编号 / 取件码 / 二维码内容"
                />
              </label>

              <button
                className="auth-submit"
                type="button"
                disabled={isConfirmingPickup}
                onClick={() => {
                  void handleConfirmPickup();
                }}
              >
                {isConfirmingPickup ? "提交中..." : "确认自提"}
              </button>
            </div>
          </article>
        </section>
      ) : (
        <section className="app-shell__grid" aria-label="快递队列标签页">
          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">队列</p>
              <h3 className="app-shell__card-title">待快递申请</h3>
            </div>
            {isLoading ? (
              <p className="app-shell__card-copy">正在加载快递队列...</p>
            ) : expressQueue.length === 0 ? (
              <p className="app-shell__card-copy">当前无待快递申请。</p>
            ) : (
              <ul className="dashboard-list">
                {expressQueue.map((item) => (
                  <li key={item.applicationId} className="dashboard-list__item">
                    <p className="dashboard-list__title">
                      #{item.applicationId} · 申请人 {item.applicantUserId}
                    </p>
                    <p className="dashboard-list__meta">{toDateLabel(item.createdAt)}</p>
                    <p className="dashboard-list__content">
                      申请条目：{formatItemSummary(item.items)}
                    </p>
                  <button
                    className="app-shell__header-action"
                    type="button"
                    onClick={() => setShipApplicationId(String(item.applicationId))}
                  >
                    使用申请单编号
                  </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">操作</p>
              <h3 className="app-shell__card-title">快递发货</h3>
            </div>
            <div className="outbound-action-grid page-form-grid">
              <label className="store-field">
                申请单编号
                <input
                  value={shipApplicationId}
                  onChange={(event) => setShipApplicationId(event.target.value)}
                  placeholder="例如：202"
                />
              </label>

              <label className="store-field">
                承运商
                <input
                  value={shipCarrier}
                  onChange={(event) => setShipCarrier(event.target.value)}
                  placeholder="例如：顺丰"
                />
              </label>

              <label className="store-field">
                运单号
                <input
                  value={shipTrackingNo}
                  onChange={(event) => setShipTrackingNo(event.target.value)}
                  placeholder="例如：SF1234567890"
                />
              </label>

              <button
                className="auth-submit"
                type="button"
                disabled={isShipping}
                onClick={() => {
                  void handleShipExpress();
                }}
              >
                {isShipping ? "提交中..." : "确认发货"}
              </button>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
