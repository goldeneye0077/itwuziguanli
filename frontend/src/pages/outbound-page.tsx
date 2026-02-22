import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AuthApiError,
  confirmOutboundPickup,
  downloadOutboundRecordsCsv,
  fetchOutboundExpressQueue,
  fetchOutboundPickupQueue,
  fetchOutboundRecords,
  shipOutbound,
  type OutboundExpressQueueItem,
  type OutboundPickupQueueItem,
  type OutboundRecordItem,
  type OutboundRecordsQuery,
} from "../api";
import { hasActionPermission } from "../permissions";
import { useAuthSession } from "../stores";
import { toApplicationStatusLabel, toDateLabel } from "./page-helpers";

const RECORD_PAGE_SIZE = 20;

function formatItemSummary(
  items: ReadonlyArray<{
    readonly skuId: number;
    readonly quantity: number;
  }>,
): string {
  return items.map((item) => `物料#${item.skuId} x ${item.quantity}`).join("，");
}

const PICKUP_VERIFY_TYPE_LABELS: Record<"QR" | "CODE" | "APPLICATION_ID", string> = {
  APPLICATION_ID: "申请单编号",
  CODE: "取件码",
  QR: "二维码",
};

type OutboundTab = "PICKUP" | "EXPRESS" | "RECORDS";

type RecordFilterState = {
  readonly from: string;
  readonly to: string;
  readonly action: "" | "OUTBOUND" | "SHIP";
  readonly recordType: "" | "ASSET" | "SKU_QUANTITY";
  readonly deliveryType: "" | "PICKUP" | "EXPRESS";
  readonly applicationId: string;
  readonly operatorUserId: string;
  readonly skuId: string;
  readonly assetId: string;
  readonly q: string;
};

const DEFAULT_RECORD_FILTERS: RecordFilterState = {
  from: "",
  to: "",
  action: "",
  recordType: "",
  deliveryType: "",
  applicationId: "",
  operatorUserId: "",
  skuId: "",
  assetId: "",
  q: "",
};

function toOptionalPositiveInteger(raw: string): number | undefined {
  const normalized = raw.trim();
  if (!normalized) {
    return undefined;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}

function toDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function buildRecordQuery(filters: RecordFilterState, page: number): OutboundRecordsQuery {
  const applicationId = toOptionalPositiveInteger(filters.applicationId);
  const operatorUserId = toOptionalPositiveInteger(filters.operatorUserId);
  const skuId = toOptionalPositiveInteger(filters.skuId);
  const assetId = toOptionalPositiveInteger(filters.assetId);
  return {
    page,
    pageSize: RECORD_PAGE_SIZE,
    ...(filters.from.trim() ? { from: filters.from.trim() } : {}),
    ...(filters.to.trim() ? { to: filters.to.trim() } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.recordType ? { recordType: filters.recordType } : {}),
    ...(filters.deliveryType ? { deliveryType: filters.deliveryType } : {}),
    ...(applicationId ? { applicationId } : {}),
    ...(operatorUserId ? { operatorUserId } : {}),
    ...(skuId ? { skuId } : {}),
    ...(assetId ? { assetId } : {}),
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
  };
}

export function OutboundPage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;
  const userRoles = state.user?.roles ?? [];
  const userPermissions = state.user?.permissions ?? [];

  const canFetchRecords = hasActionPermission("outbound.fetch-records", userRoles, userPermissions);
  const canExportRecords = hasActionPermission(
    "outbound.export-records",
    userRoles,
    userPermissions,
  );

  const [activeTab, setActiveTab] = useState<OutboundTab>("PICKUP");
  const [pickupQueue, setPickupQueue] = useState<OutboundPickupQueueItem[]>([]);
  const [expressQueue, setExpressQueue] = useState<OutboundExpressQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const [isShipping, setIsShipping] = useState(false);

  const [recordFilters, setRecordFilters] = useState<RecordFilterState>(DEFAULT_RECORD_FILTERS);
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordItems, setRecordItems] = useState<OutboundRecordItem[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isExportingRecords, setIsExportingRecords] = useState(false);
  const [recordsLoaded, setRecordsLoaded] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pickupVerifyType, setPickupVerifyType] = useState<"QR" | "CODE" | "APPLICATION_ID">(
    "APPLICATION_ID",
  );
  const [pickupValue, setPickupValue] = useState("");

  const [shipApplicationId, setShipApplicationId] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipTrackingNo, setShipTrackingNo] = useState("");

  const recordPageTotal = useMemo(
    () => Math.max(1, Math.ceil(recordTotal / RECORD_PAGE_SIZE)),
    [recordTotal],
  );

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
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载出库队列失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const loadRecords = useCallback(
    async (page: number, filters: RecordFilterState): Promise<void> => {
      if (!accessToken) {
        setErrorMessage("会话令牌缺失，请重新登录。");
        return;
      }
      if (!canFetchRecords) {
        setErrorMessage("当前账号缺少查询出库记录权限。");
        return;
      }

      setIsLoadingRecords(true);
      setErrorMessage(null);
      try {
        const result = await fetchOutboundRecords(accessToken, buildRecordQuery(filters, page));
        setRecordItems(result.items);
        setRecordTotal(result.meta.total);
        setRecordPage(result.meta.page);
        setRecordsLoaded(true);
      } catch (error) {
        setErrorMessage(error instanceof AuthApiError ? error.message : "加载出库记录失败。");
      } finally {
        setIsLoadingRecords(false);
      }
    },
    [accessToken, canFetchRecords],
  );

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  useEffect(() => {
    if (activeTab === "RECORDS" && !recordsLoaded && canFetchRecords) {
      void loadRecords(1, recordFilters);
    }
  }, [activeTab, canFetchRecords, loadRecords, recordFilters, recordsLoaded]);

  async function handleConfirmPickup(): Promise<void> {
    if (!accessToken) {
      return;
    }
    const normalizedValue = pickupValue.trim();
    if (!normalizedValue) {
      setErrorMessage("请输入取件核验值。");
      return;
    }
    if (pickupVerifyType === "APPLICATION_ID") {
      const matched = pickupQueue.find(
        (item) => String(item.applicationId) === normalizedValue,
      );
      if (matched && matched.status !== "READY_OUTBOUND") {
        setErrorMessage("该申请单尚未完成资产分配，请先到管理员审批页完成分配。");
        return;
      }
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
      if (activeTab === "RECORDS" && canFetchRecords) {
        await loadRecords(1, recordFilters);
      }
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "确认自提出库失败。");
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
    const matched = expressQueue.find((item) => item.applicationId === parsedApplicationId);
    if (matched && matched.status !== "READY_OUTBOUND") {
      setErrorMessage("该申请单尚未完成资产分配，请先到管理员审批页完成分配。");
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
      if (activeTab === "RECORDS" && canFetchRecords) {
        await loadRecords(1, recordFilters);
      }
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "提交快递发货失败。");
    } finally {
      setIsShipping(false);
    }
  }

  async function handleQueryRecords(): Promise<void> {
    await loadRecords(1, recordFilters);
  }

  async function handleResetRecords(): Promise<void> {
    const next = { ...DEFAULT_RECORD_FILTERS };
    setRecordFilters(next);
    await loadRecords(1, next);
  }

  async function handleExportRecords(): Promise<void> {
    if (!accessToken) {
      return;
    }
    if (!canExportRecords) {
      setErrorMessage("当前账号缺少导出出库记录权限。");
      return;
    }

    setIsExportingRecords(true);
    setErrorMessage(null);
    try {
      const query = buildRecordQuery(recordFilters, 1);
      const { fileName, blob } = await downloadOutboundRecordsCsv(accessToken, {
        from: query.from,
        to: query.to,
        action: query.action,
        recordType: query.recordType,
        deliveryType: query.deliveryType,
        applicationId: query.applicationId,
        operatorUserId: query.operatorUserId,
        skuId: query.skuId,
        assetId: query.assetId,
        q: query.q,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSuccessMessage("出库记录导出成功。");
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "导出出库记录失败。");
    } finally {
      setIsExportingRecords(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="出库执行说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">出库执行工作台</h2>
          <p className="app-shell__panel-copy">查询自提/快递队列，并可审计出库记录与导出。</p>
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
          <button
            className={activeTab === "RECORDS" ? "outbound-tab is-active" : "outbound-tab"}
            type="button"
            aria-pressed={activeTab === "RECORDS"}
            onClick={() => setActiveTab("RECORDS")}
          >
            出库记录
          </button>
          <button className="app-shell__header-action" type="button" onClick={() => void loadQueues()}>
            刷新队列
          </button>
        </div>
      </section>

      {activeTab === "PICKUP" ? (
        <section className="app-shell__grid" aria-label="自提队列">
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
                      状态：{toApplicationStatusLabel(item.status)} · 取件码：{item.pickupCode} ·{" "}
                      {toDateLabel(item.createdAt)}
                    </p>
                    <p className="dashboard-list__content">申请条目：{formatItemSummary(item.items)}</p>
                    {item.status !== "READY_OUTBOUND" ? (
                      <p className="app-shell__card-copy">待分配资产，请先在管理员审批页完成资产分配。</p>
                    ) : null}
                    <div className="store-action-row page-actions">
                      <button
                        className="app-shell__header-action"
                        type="button"
                        disabled={item.status !== "READY_OUTBOUND"}
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
                        disabled={item.status !== "READY_OUTBOUND"}
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
                  <option value="APPLICATION_ID">{PICKUP_VERIFY_TYPE_LABELS.APPLICATION_ID}</option>
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
      ) : null}

      {activeTab === "EXPRESS" ? (
        <section className="app-shell__grid" aria-label="快递队列">
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
                    <p className="dashboard-list__meta">
                      状态：{toApplicationStatusLabel(item.status)} · {toDateLabel(item.createdAt)}
                    </p>
                    <p className="dashboard-list__content">申请条目：{formatItemSummary(item.items)}</p>
                    {item.status !== "READY_OUTBOUND" ? (
                      <p className="app-shell__card-copy">待分配资产，请先在管理员审批页完成资产分配。</p>
                    ) : null}
                    <button
                      className="app-shell__header-action"
                      type="button"
                      disabled={item.status !== "READY_OUTBOUND"}
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
                  placeholder="例如：102"
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
      ) : null}

      {activeTab === "RECORDS" ? (
        <section className="page-stack" aria-label="出库记录">
          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">审计</p>
              <h3 className="app-shell__card-title">出库记录筛选</h3>
            </div>
            <div className="outbound-record-filter-grid page-form-grid">
              <label className="store-field">
                开始时间
                <input
                  type="datetime-local"
                  value={recordFilters.from}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({ ...prev, from: event.target.value }))
                  }
                />
              </label>
              <label className="store-field">
                结束时间
                <input
                  type="datetime-local"
                  value={recordFilters.to}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({ ...prev, to: event.target.value }))
                  }
                />
              </label>
              <label className="store-field">
                动作
                <select
                  value={recordFilters.action}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({
                      ...prev,
                      action:
                        event.target.value === "OUTBOUND" || event.target.value === "SHIP"
                          ? event.target.value
                          : "",
                    }))
                  }
                >
                  <option value="">全部</option>
                  <option value="OUTBOUND">OUTBOUND</option>
                  <option value="SHIP">SHIP</option>
                </select>
              </label>
              <label className="store-field">
                记录类型
                <select
                  value={recordFilters.recordType}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({
                      ...prev,
                      recordType:
                        event.target.value === "ASSET" || event.target.value === "SKU_QUANTITY"
                          ? event.target.value
                          : "",
                    }))
                  }
                >
                  <option value="">全部</option>
                  <option value="ASSET">ASSET</option>
                  <option value="SKU_QUANTITY">SKU_QUANTITY</option>
                </select>
              </label>
              <label className="store-field">
                交付方式
                <select
                  value={recordFilters.deliveryType}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({
                      ...prev,
                      deliveryType:
                        event.target.value === "PICKUP" || event.target.value === "EXPRESS"
                          ? event.target.value
                          : "",
                    }))
                  }
                >
                  <option value="">全部</option>
                  <option value="PICKUP">PICKUP</option>
                  <option value="EXPRESS">EXPRESS</option>
                </select>
              </label>
              <label className="store-field">
                申请单ID
                <input
                  value={recordFilters.applicationId}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({ ...prev, applicationId: event.target.value }))
                  }
                  placeholder="例如：202"
                />
              </label>
              <label className="store-field">
                操作者ID
                <input
                  value={recordFilters.operatorUserId}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({ ...prev, operatorUserId: event.target.value }))
                  }
                  placeholder="例如：2002"
                />
              </label>
              <label className="store-field">
                物料ID
                <input
                  value={recordFilters.skuId}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({ ...prev, skuId: event.target.value }))
                  }
                  placeholder="例如：8002"
                />
              </label>
              <label className="store-field">
                资产ID
                <input
                  value={recordFilters.assetId}
                  onChange={(event) =>
                    setRecordFilters((prev) => ({ ...prev, assetId: event.target.value }))
                  }
                  placeholder="例如：30001"
                />
              </label>
              <label className="store-field inbound-field-wide">
                关键字
                <input
                  value={recordFilters.q}
                  onChange={(event) => setRecordFilters((prev) => ({ ...prev, q: event.target.value }))}
                  placeholder="申请单ID/标题/资产标签/SN/运单号/操作者"
                />
              </label>
            </div>

            <div className="page-actions outbound-record-actions">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={!canFetchRecords || isLoadingRecords}
                onClick={() => {
                  void handleQueryRecords();
                }}
              >
                {isLoadingRecords ? "查询中..." : "查询记录"}
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={!canFetchRecords || isLoadingRecords}
                onClick={() => {
                  void handleResetRecords();
                }}
              >
                重置筛选
              </button>
              <button
                className="auth-submit"
                type="button"
                disabled={!canExportRecords || isExportingRecords}
                onClick={() => {
                  void handleExportRecords();
                }}
              >
                {isExportingRecords ? "导出中..." : "导出记录"}
              </button>
            </div>
          </article>

          <article className="app-shell__card">
            <div className="page-card-head">
              <p className="app-shell__section-label">明细</p>
              <h3 className="app-shell__card-title">出库记录列表</h3>
              <p className="app-shell__card-copy">当前共 {recordTotal} 条记录。</p>
            </div>
            <div className="page-table-wrap outbound-record-table-wrap">
              <table className="analytics-table" aria-label="出库记录列表">
                <thead>
                  <tr>
                    <th>记录键</th>
                    <th>记录类型</th>
                    <th>动作</th>
                    <th>发生时间</th>
                    <th>元数据</th>
                    <th>申请单ID</th>
                    <th>申请标题</th>
                    <th>申请类型</th>
                    <th>申请状态</th>
                    <th>交付方式</th>
                    <th>取件码</th>
                    <th>取件二维码</th>
                    <th>申请创建时间</th>
                    <th>申请人用户ID</th>
                    <th>申请人姓名快照</th>
                    <th>申请人部门快照</th>
                    <th>申请人电话快照</th>
                    <th>申请人职务快照</th>
                    <th>承运商</th>
                    <th>运单号</th>
                    <th>发货时间</th>
                    <th>收件人</th>
                    <th>收件电话</th>
                    <th>省</th>
                    <th>市</th>
                    <th>区/县</th>
                    <th>详细地址</th>
                    <th>物料ID</th>
                    <th>分类ID</th>
                    <th>分类名称</th>
                    <th>品牌</th>
                    <th>型号</th>
                    <th>规格</th>
                    <th>库存模式</th>
                    <th>参考价格</th>
                    <th>封面地址</th>
                    <th>安全库存阈值</th>
                    <th>资产ID</th>
                    <th>资产标签</th>
                    <th>序列号</th>
                    <th>资产状态</th>
                    <th>当前持有人ID</th>
                    <th>入库时间</th>
                    <th>数量</th>
                    <th>现存变动</th>
                    <th>预占变动</th>
                    <th>变更后现存</th>
                    <th>变更后预占</th>
                    <th>操作人ID</th>
                    <th>操作人名称</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRecords ? (
                    <tr>
                      <td colSpan={50}>正在加载出库记录...</td>
                    </tr>
                  ) : recordItems.length === 0 ? (
                    <tr>
                      <td colSpan={50}>暂无记录</td>
                    </tr>
                  ) : (
                    recordItems.map((item) => (
                      <tr key={item.recordKey}>
                        <td>{item.recordKey}</td>
                        <td>{item.recordType}</td>
                        <td>{item.action}</td>
                        <td>{toDateLabel(item.occurredAt)}</td>
                        <td>{toDisplayValue(item.metaJson)}</td>
                        <td>{toDisplayValue(item.applicationId)}</td>
                        <td>{toDisplayValue(item.applicationTitle)}</td>
                        <td>{toDisplayValue(item.applicationType)}</td>
                        <td>{toDisplayValue(item.applicationStatus)}</td>
                        <td>{toDisplayValue(item.deliveryType)}</td>
                        <td>{toDisplayValue(item.pickupCode)}</td>
                        <td>{toDisplayValue(item.pickupQrString)}</td>
                        <td>{toDisplayValue(item.applicationCreatedAt ? toDateLabel(item.applicationCreatedAt) : null)}</td>
                        <td>{toDisplayValue(item.applicantUserId)}</td>
                        <td>{toDisplayValue(item.applicantNameSnapshot)}</td>
                        <td>{toDisplayValue(item.applicantDepartmentSnapshot)}</td>
                        <td>{toDisplayValue(item.applicantPhoneSnapshot)}</td>
                        <td>{toDisplayValue(item.applicantJobTitleSnapshot)}</td>
                        <td>{toDisplayValue(item.carrier)}</td>
                        <td>{toDisplayValue(item.trackingNo)}</td>
                        <td>{toDisplayValue(item.shippedAt ? toDateLabel(item.shippedAt) : null)}</td>
                        <td>{toDisplayValue(item.logisticsReceiverName)}</td>
                        <td>{toDisplayValue(item.logisticsReceiverPhone)}</td>
                        <td>{toDisplayValue(item.logisticsProvince)}</td>
                        <td>{toDisplayValue(item.logisticsCity)}</td>
                        <td>{toDisplayValue(item.logisticsDistrict)}</td>
                        <td>{toDisplayValue(item.logisticsDetail)}</td>
                        <td>{toDisplayValue(item.skuId)}</td>
                        <td>{toDisplayValue(item.categoryId)}</td>
                        <td>{toDisplayValue(item.categoryName)}</td>
                        <td>{toDisplayValue(item.brand)}</td>
                        <td>{toDisplayValue(item.model)}</td>
                        <td>{toDisplayValue(item.spec)}</td>
                        <td>{toDisplayValue(item.stockMode)}</td>
                        <td>{toDisplayValue(item.referencePrice)}</td>
                        <td>{toDisplayValue(item.coverUrl)}</td>
                        <td>{toDisplayValue(item.safetyStockThreshold)}</td>
                        <td>{toDisplayValue(item.assetId)}</td>
                        <td>{toDisplayValue(item.assetTag)}</td>
                        <td>{toDisplayValue(item.sn)}</td>
                        <td>{toDisplayValue(item.assetStatus)}</td>
                        <td>{toDisplayValue(item.holderUserId)}</td>
                        <td>{toDisplayValue(item.inboundAt ? toDateLabel(item.inboundAt) : null)}</td>
                        <td>{toDisplayValue(item.quantity)}</td>
                        <td>{toDisplayValue(item.onHandDelta)}</td>
                        <td>{toDisplayValue(item.reservedDelta)}</td>
                        <td>{toDisplayValue(item.onHandQtyAfter)}</td>
                        <td>{toDisplayValue(item.reservedQtyAfter)}</td>
                        <td>{toDisplayValue(item.operatorUserId)}</td>
                        <td>{toDisplayValue(item.operatorName)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-crud-pagination">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingRecords || recordPage <= 1}
                onClick={() => {
                  void loadRecords(recordPage - 1, recordFilters);
                }}
              >
                上一页
              </button>
              <p className="app-shell__card-copy">
                第 {recordPage} / {recordPageTotal} 页
              </p>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingRecords || recordPage >= recordPageTotal}
                onClick={() => {
                  void loadRecords(recordPage + 1, recordFilters);
                }}
              >
                下一页
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}






