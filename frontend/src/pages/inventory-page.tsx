import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  adjustSkuStock,
  createAdminAssets,
  deleteAdminAsset,
  downloadSkuStockFlowsCsv,
  fetchAdminAssets,
  fetchInventorySummary,
  fetchSkuStockFlows,
  inboundSkuStock,
  outboundSkuStock,
  updateAdminAsset,
  type AdminAssetItem,
  type AdminAssetStatus,
  type InventorySummaryItem,
  type SkuStockMode,
  type SkuStockFlowAction,
  type SkuStockFlowItem,
} from "../api";
import { hasActionPermission, PERMISSION_KEYS } from "../permissions";
import { useAuthSession } from "../stores";
import { parsePositiveInteger, toAssetStatusLabel, toDateLabel, toErrorMessage } from "./page-helpers";

function parseSerialNumbers(source: string): string[] {
  return source
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stringifyJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function toMaterialName(
  name: string | null | undefined,
  brand: string,
  model: string,
  skuId: number,
): string {
  const explicit = (name ?? "").trim();
  if (explicit) {
    return explicit;
  }
  const fallback = `${brand} ${model}`.trim();
  return fallback.length > 0 ? fallback : `SKU-${skuId}`;
}

export function InventoryPage(): JSX.Element {
  const { state, hasPermission, userRoles, userPermissions } = useAuthSession();
  const accessToken = state.accessToken;
  const canReadInventory = hasPermission(PERMISSION_KEYS.inventoryRead);
  const canWriteInventory = hasPermission(PERMISSION_KEYS.inventoryWrite);
  const canFetchAssets = hasActionPermission(
    "inventory.fetch-assets",
    userRoles,
    userPermissions,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [assetCreateSkuId, setAssetCreateSkuId] = useState("");
  const [assetCreateSnList, setAssetCreateSnList] = useState("SN-ASSET-001");
  const [assetFilterSkuId, setAssetFilterSkuId] = useState("");
  const [assetFilterStatus, setAssetFilterStatus] = useState<AdminAssetStatus | "">("");

  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editAssetSkuId, setEditAssetSkuId] = useState("");
  const [editAssetSn, setEditAssetSn] = useState("");
  const [editAssetStatus, setEditAssetStatus] = useState<AdminAssetStatus | "">("");

  const [summaryQuerySkuId, setSummaryQuerySkuId] = useState("");
  const [summaryQueryCategoryId, setSummaryQueryCategoryId] = useState("");
  const [summaryQueryKeyword, setSummaryQueryKeyword] = useState("");
  const [summaryBelowThresholdOnly, setSummaryBelowThresholdOnly] = useState(false);

  const [assetItems, setAssetItems] = useState<AdminAssetItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<InventorySummaryItem[]>([]);
  const materialNameBySkuId = useMemo(() => {
    const map = new Map<number, string>();
    summaryItems.forEach((item) => {
      map.set(item.skuId, toMaterialName(item.name, item.brand, item.model, item.skuId));
    });
    return map;
  }, [summaryItems]);

  const [stockOpsSkuId, setStockOpsSkuId] = useState<number | null>(null);
  const stockOpsSku = useMemo(
    () => summaryItems.find((item) => item.skuId === stockOpsSkuId) ?? null,
    [stockOpsSkuId, summaryItems],
  );
  const [stockInboundQuantity, setStockInboundQuantity] = useState("1");
  const [stockInboundNote, setStockInboundNote] = useState("");
  const [stockOutboundQuantity, setStockOutboundQuantity] = useState("1");
  const [stockOutboundReason, setStockOutboundReason] = useState("");
  const [stockAdjustNewOnHand, setStockAdjustNewOnHand] = useState("0");
  const [stockAdjustReason, setStockAdjustReason] = useState("");
  const [isSubmittingStockOp, setIsSubmittingStockOp] = useState(false);

  const [flowAction, setFlowAction] = useState<SkuStockFlowAction | "">("");
  const [flowFrom, setFlowFrom] = useState("");
  const [flowTo, setFlowTo] = useState("");
  const [flowPage, setFlowPage] = useState(1);
  const [flowPageSize, setFlowPageSize] = useState(20);
  const [flowItems, setFlowItems] = useState<SkuStockFlowItem[]>([]);
  const [flowTotal, setFlowTotal] = useState(0);
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);
  const [isExportingFlows, setIsExportingFlows] = useState(false);

  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isCreatingAssets, setIsCreatingAssets] = useState(false);
  const [isUpdatingAsset, setIsUpdatingAsset] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const token = accessToken;

  async function handleFetchAssets(): Promise<void> {
    if (!canFetchAssets) {
      setErrorMessage("当前账号缺少 INVENTORY:READ 权限，无法查询资产。");
      return;
    }
    const normalizedFilterSkuId = assetFilterSkuId.trim();
    const parsedFilterSkuId = normalizedFilterSkuId
      ? parsePositiveInteger(normalizedFilterSkuId)
      : null;
    if (normalizedFilterSkuId && parsedFilterSkuId === null) {
      setErrorMessage("资产筛选物料编号必须为正整数。");
      return;
    }

    setIsLoadingAssets(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await fetchAdminAssets(token, {
        skuId: parsedFilterSkuId ?? undefined,
        status: assetFilterStatus || undefined,
      });
      setAssetItems(result);
      setSuccessMessage(`已加载 ${result.length} 条资产记录。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载后台资产失败。"));
    } finally {
      setIsLoadingAssets(false);
    }
  }

  async function handleCreateAssets(): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法创建资产。");
      return;
    }
    const parsedSkuId = parsePositiveInteger(assetCreateSkuId);
    const serialNumbers = parseSerialNumbers(assetCreateSnList);
    if (!parsedSkuId || !serialNumbers.length) {
      setErrorMessage("创建资产时，物料编号必须有效且至少填写一个序列号。");
      return;
    }

    setIsCreatingAssets(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await createAdminAssets(token, {
        skuId: parsedSkuId,
        assets: serialNumbers.map((sn) => ({ sn })),
      });
      setSuccessMessage(`已为物料 #${created.skuId} 创建 ${created.createdAssets.length} 台资产。`);
      await handleFetchAssets();
      await handleFetchSummary();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建后台资产失败。"));
    } finally {
      setIsCreatingAssets(false);
    }
  }

  function handleStartEditAsset(item: AdminAssetItem): void {
    setEditingAssetId(item.id);
    setEditAssetSkuId(String(item.skuId));
    setEditAssetSn(item.sn);
    setEditAssetStatus(item.status);
  }

  function handleCancelEditAsset(): void {
    setEditingAssetId(null);
    setEditAssetSkuId("");
    setEditAssetSn("");
    setEditAssetStatus("");
  }

  async function handleUpdateAsset(): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法更新资产。");
      return;
    }
    if (!editingAssetId) {
      setErrorMessage("请先选择要编辑的资产。");
      return;
    }

    const parsedSkuId = parsePositiveInteger(editAssetSkuId);
    if (!parsedSkuId) {
      setErrorMessage("资产物料编号必须为正整数。");
      return;
    }

    const normalizedSn = editAssetSn.trim();
    if (!normalizedSn) {
      setErrorMessage("资产序列号不能为空。");
      return;
    }

    if (!editAssetStatus) {
      setErrorMessage("请选择资产状态。");
      return;
    }

    setIsUpdatingAsset(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateAdminAsset(token, editingAssetId, {
        skuId: parsedSkuId,
        sn: normalizedSn,
        status: editAssetStatus,
      });
      setSuccessMessage(`资产 #${updated.id} 更新成功。`);
      handleCancelEditAsset();
      await handleFetchAssets();
      await handleFetchSummary();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "更新资产失败。"));
    } finally {
      setIsUpdatingAsset(false);
    }
  }

  async function handleDeleteAsset(assetId: number): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法删除资产。");
      return;
    }
    const confirmed = window.confirm(
      `确认删除资产 #${assetId}？\n\n注意：仅允许删除在库且未被锁定/未被流程引用的资产。`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingAssetId(assetId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAdminAsset(token, assetId);
      if (editingAssetId === assetId) {
        handleCancelEditAsset();
      }
      setSuccessMessage(`资产 #${assetId} 已删除。`);
      await handleFetchAssets();
      await handleFetchSummary();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "删除资产失败。"));
    } finally {
      setDeletingAssetId(null);
    }
  }

  async function handleFetchSummary(): Promise<void> {
    if (!canReadInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:READ 权限，无法查询库存汇总。");
      return;
    }
    const normalizedSummarySkuId = summaryQuerySkuId.trim();
    const parsedSummarySkuId = normalizedSummarySkuId
      ? parsePositiveInteger(normalizedSummarySkuId)
      : null;
    if (normalizedSummarySkuId && parsedSummarySkuId === null) {
      setErrorMessage("汇总筛选 SKU 编号必须为正整数。");
      return;
    }

    const normalizedSummaryCategoryId = summaryQueryCategoryId.trim();
    const parsedSummaryCategoryId = normalizedSummaryCategoryId
      ? parsePositiveInteger(normalizedSummaryCategoryId)
      : null;
    if (normalizedSummaryCategoryId && parsedSummaryCategoryId === null) {
      setErrorMessage("汇总筛选分类编号必须为正整数。");
      return;
    }

    setIsLoadingSummary(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await fetchInventorySummary(token, {
        skuId: parsedSummarySkuId ?? undefined,
        categoryId: parsedSummaryCategoryId ?? undefined,
        q: summaryQueryKeyword.trim() || undefined,
        belowThreshold: summaryBelowThresholdOnly,
      });
      setSummaryItems(result);
      setSuccessMessage(`已加载库存汇总 ${result.length} 行。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载库存汇总失败。"));
    } finally {
      setIsLoadingSummary(false);
    }
  }

  async function handleResetSummaryFilters(): Promise<void> {
    if (!canReadInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:READ 权限，无法重置并查询库存汇总。");
      return;
    }
    setSummaryQuerySkuId("");
    setSummaryQueryCategoryId("");
    setSummaryQueryKeyword("");
    setSummaryBelowThresholdOnly(false);

    setIsLoadingSummary(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await fetchInventorySummary(token);
      setSummaryItems(result);
      setSuccessMessage(`已加载库存汇总 ${result.length} 行。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载库存汇总失败。"));
    } finally {
      setIsLoadingSummary(false);
    }
  }

  async function handleInboundStock(): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法执行库存入库。");
      return;
    }
    if (!stockOpsSkuId || !stockOpsSku || stockOpsSku.stockMode !== "QUANTITY") {
      setErrorMessage("请先在库存汇总中选择一个“数量库存(QUANTITY)”的物料。");
      return;
    }

    const quantity = Number(stockInboundQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorMessage("入库数量必须为正整数。");
      return;
    }

    setIsSubmittingStockOp(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const snapshot = await inboundSkuStock(token, stockOpsSkuId, {
        quantity: Math.trunc(quantity),
        note: stockInboundNote.trim() || undefined,
      });
      setSuccessMessage(
        `数量入库成功：SKU #${snapshot.skuId}，现存 ${snapshot.onHandQty}，预占 ${snapshot.reservedQty}，可用 ${snapshot.availableQty}。`,
      );
      await handleFetchSummary();
      if (isLoadingFlows === false) {
        // Keep flow panel fresh if user has it open.
        void handleFetchFlows(1);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "数量入库失败。"));
    } finally {
      setIsSubmittingStockOp(false);
    }
  }

  async function handleOutboundStock(): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法执行库存出库。");
      return;
    }
    if (!stockOpsSkuId || !stockOpsSku || stockOpsSku.stockMode !== "QUANTITY") {
      setErrorMessage("请先在库存汇总中选择一个“数量库存(QUANTITY)”的物料。");
      return;
    }

    const quantity = Number(stockOutboundQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorMessage("出库数量必须为正整数。");
      return;
    }
    if (!stockOutboundReason.trim()) {
      setErrorMessage("出库原因不能为空。");
      return;
    }

    setIsSubmittingStockOp(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const snapshot = await outboundSkuStock(token, stockOpsSkuId, {
        quantity: Math.trunc(quantity),
        reason: stockOutboundReason.trim(),
      });
      setSuccessMessage(
        `数量出库成功：SKU #${snapshot.skuId}，现存 ${snapshot.onHandQty}，预占 ${snapshot.reservedQty}，可用 ${snapshot.availableQty}。`,
      );
      await handleFetchSummary();
      void handleFetchFlows(1);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "数量出库失败。"));
    } finally {
      setIsSubmittingStockOp(false);
    }
  }

  async function handleAdjustStock(): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法执行库存盘点调整。");
      return;
    }
    if (!stockOpsSkuId || !stockOpsSku || stockOpsSku.stockMode !== "QUANTITY") {
      setErrorMessage("请先在库存汇总中选择一个“数量库存(QUANTITY)”的物料。");
      return;
    }

    const newValue = Number(stockAdjustNewOnHand);
    if (!Number.isFinite(newValue) || newValue < 0) {
      setErrorMessage("盘点后的现存数量必须为整数且大于等于 0。");
      return;
    }
    if (!stockAdjustReason.trim()) {
      setErrorMessage("盘点原因不能为空。");
      return;
    }

    setIsSubmittingStockOp(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const snapshot = await adjustSkuStock(token, stockOpsSkuId, {
        newOnHandQty: Math.trunc(newValue),
        reason: stockAdjustReason.trim(),
      });
      setSuccessMessage(
        `盘点调整成功：SKU #${snapshot.skuId}，现存 ${snapshot.onHandQty}，预占 ${snapshot.reservedQty}，可用 ${snapshot.availableQty}。`,
      );
      await handleFetchSummary();
      void handleFetchFlows(1);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "盘点调整失败。"));
    } finally {
      setIsSubmittingStockOp(false);
    }
  }

  async function handleFetchFlows(nextPage?: number): Promise<void> {
    if (!canReadInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:READ 权限，无法查询库存流水。");
      return;
    }
    if (!stockOpsSkuId || !stockOpsSku || stockOpsSku.stockMode !== "QUANTITY") {
      setErrorMessage("仅支持查询数量库存(QUANTITY)的库存流水。");
      return;
    }

    const page = nextPage ?? flowPage;
    setIsLoadingFlows(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await fetchSkuStockFlows(token, stockOpsSkuId, {
        action: flowAction || undefined,
        from: flowFrom.trim() || undefined,
        to: flowTo.trim() || undefined,
        page,
        pageSize: flowPageSize,
      });
      setFlowItems(result.items);
      setFlowTotal(result.meta.total);
      setFlowPage(result.meta.page);
      setFlowPageSize(result.meta.pageSize);
      setSuccessMessage(`已加载库存流水 ${result.items.length} 行，共 ${result.meta.total} 条。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载库存流水失败。"));
    } finally {
      setIsLoadingFlows(false);
    }
  }

  async function handleExportFlows(): Promise<void> {
    if (!canReadInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:READ 权限，无法导出库存流水。");
      return;
    }
    if (!stockOpsSkuId || !stockOpsSku || stockOpsSku.stockMode !== "QUANTITY") {
      setErrorMessage("仅支持导出数量库存(QUANTITY)的库存流水。");
      return;
    }

    setIsExportingFlows(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { fileName, blob } = await downloadSkuStockFlowsCsv(token, stockOpsSkuId, {
        action: flowAction || undefined,
        from: flowFrom.trim() || undefined,
        to: flowTo.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSuccessMessage("库存流水 CSV 导出成功。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "导出库存流水失败。"));
    } finally {
      setIsExportingFlows(false);
    }
  }

  useEffect(() => {
    if (!canReadInventory) {
      return;
    }
    void handleFetchSummary();
  }, [canReadInventory, token]);

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="库存管理说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">物料与库存管理</h2>
          <p className="app-shell__panel-copy">
            管理物料（SKU）、资产台账与库存汇总。入库执行请前往“入库”页面。
          </p>
          <div className="page-actions">
            <Link className="app-shell__header-action" to="/inbound">
              前往入库
            </Link>
            <Link className="app-shell__header-action" to="/materials">
              物料管理
            </Link>
          </div>
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

      <section className="app-shell__grid inbound-grid" aria-label="库存管理面板">
        <article className="app-shell__card inbound-wide">
          <div className="page-card-head">
            <p className="app-shell__section-label">库存汇总</p>
            <h3 className="app-shell__card-title">查询库存汇总</h3>
          </div>
          <div className="outbound-action-grid page-form-grid">
            <div className="page-toolbar" aria-label="库存汇总说明">
              <p className="app-shell__section-label">库存汇总</p>
              <p className="inbound-import-meta">
                按物料聚合展示库存状态；数量库存支持入库/出库/盘点/流水导出。SKU 主数据请前往“物料管理”页面维护。
              </p>
            </div>

            <div className="inbound-inline-fields">
              <label className="store-field">
                SKU 编号（可选）
                <input
                  value={summaryQuerySkuId}
                  onChange={(event) => setSummaryQuerySkuId(event.target.value)}
                  placeholder="例如：8001"
                />
              </label>
              <label className="store-field">
                分类编号（可选）
                <input
                  value={summaryQueryCategoryId}
                  onChange={(event) => setSummaryQueryCategoryId(event.target.value)}
                  placeholder="例如：7002"
                />
              </label>
            </div>

            <label className="store-field">
              关键字（品牌/型号/规格，可选）
              <input
                value={summaryQueryKeyword}
                onChange={(event) => setSummaryQueryKeyword(event.target.value)}
                placeholder="例如：联想 / ThinkPad / 4K"
              />
            </label>

            <div className="page-actions">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingSummary || !canReadInventory}
                onClick={() => {
                  void handleFetchSummary();
                }}
              >
                {isLoadingSummary ? "加载中..." : "查询库存汇总"}
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingSummary || !canReadInventory}
                onClick={() => {
                  void handleResetSummaryFilters();
                }}
              >
                重置
              </button>
              <label className="inbound-import-meta inbound-checkbox">
                <input
                  type="checkbox"
                  checked={summaryBelowThresholdOnly}
                  onChange={(event) => setSummaryBelowThresholdOnly(event.target.checked)}
                />
                仅显示低于安全库存阈值
              </label>
            </div>

            {summaryItems.length ? (
              <>
                <div className="page-table-wrap" aria-label="库存汇总表格容器">
                  <table className="analytics-table" aria-label="库存汇总表格">
                    <thead>
                      <tr>
                        <th>封面</th>
                        <th>SKU</th>
                        <th>模式</th>
                        <th>分类</th>
                        <th>物料名称</th>
                        <th>品牌</th>
                        <th>型号</th>
                        <th>规格</th>
                        <th>现存</th>
                        <th>预占</th>
                        <th>可用</th>
                        <th>使用中（仅序列号资产）</th>
                        <th>安全阈值</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryItems.map((item) => (
                        <tr key={item.skuId}>
                          <td>
                            {item.coverUrl ? (
                              <img
                                className="inbound-sku-thumb"
                                src={item.coverUrl}
                                alt={`${item.brand} ${item.model}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="inbound-sku-thumb is-empty" aria-label="无封面" />
                            )}
                          </td>
                          <td>{item.skuId}</td>
                          <td>{item.stockMode}</td>
                          <td>{item.categoryId}</td>
                          <td>{toMaterialName(item.name, item.brand, item.model, item.skuId)}</td>
                          <td>{item.brand}</td>
                          <td>{item.model}</td>
                          <td>{item.spec}</td>
                          <td>{item.onHandQty}</td>
                          <td>{item.reservedQty}</td>
                          <td>{item.availableQty}</td>
                          <td>
                            {item.stockMode === "QUANTITY" ? (
                              <span
                                className="inventory-na-cell"
                                title="数量库存不区分使用中状态"
                              >
                                -
                              </span>
                            ) : (
                              item.inUseCount
                            )}
                          </td>
                          <td>{item.safetyStockThreshold}</td>
                          <td>{item.belowSafetyStock ? "低库存" : "正常"}</td>
                          <td>
                            <div className="inbound-table-actions">
                              {item.stockMode === "QUANTITY" ? (
                                <button
                                  className="app-shell__header-action"
                                  type="button"
                                  onClick={() => {
                                    setStockOpsSkuId(item.skuId);
                                    setStockAdjustNewOnHand(String(item.onHandQty));
                                    setFlowItems([]);
                                    setFlowTotal(0);
                                    setFlowPage(1);
                                  }}
                                >
                                  库存操作
                                </button>
                              ) : (
                                <Link className="app-shell__header-action" to="/inbound">
                                  去入库
                                </Link>
                              )}
                              <Link className="app-shell__header-action" to="/materials">
                                物料管理
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {stockOpsSku && stockOpsSku.stockMode === "QUANTITY" ? (
                  <section
                    className="inbound-crud-panel inbound-crud-panel--editor"
                    aria-label="数量库存操作面板"
                  >
                    <div className="inbound-crud-panel__head">
                      <p className="app-shell__section-label">数量库存操作</p>
                      <p className="inbound-import-meta">
                        SKU #{stockOpsSku.skuId} ·{" "}
                        {toMaterialName(
                          stockOpsSku.name,
                          stockOpsSku.brand,
                          stockOpsSku.model,
                          stockOpsSku.skuId,
                        )}{" "}
                        · 现存{" "}
                        {stockOpsSku.onHandQty} · 预占 {stockOpsSku.reservedQty} · 可用{" "}
                        {stockOpsSku.availableQty}
                      </p>
                    </div>

                    <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                      <div className="page-actions">
                        <button
                          className="app-shell__header-action"
                          type="button"
                          onClick={() => {
                            setStockOpsSkuId(null);
                            setFlowItems([]);
                            setFlowTotal(0);
                          }}
                        >
                          关闭面板
                        </button>
                        <button
                          className="app-shell__header-action"
                          type="button"
                          disabled={isLoadingFlows || !canReadInventory}
                          onClick={() => {
                            void handleFetchFlows(1);
                          }}
                        >
                          {isLoadingFlows ? "加载中..." : "刷新流水"}
                        </button>
                        <button
                          className="app-shell__header-action"
                          type="button"
                          disabled={isExportingFlows || !canReadInventory}
                          onClick={() => {
                            void handleExportFlows();
                          }}
                        >
                          {isExportingFlows ? "导出中..." : "导出 CSV"}
                        </button>
                      </div>

                      <details className="inbound-crud-panel">
                        <summary>数量入库</summary>
                        <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                          <label className="store-field">
                            入库数量
                            <input
                              value={stockInboundQuantity}
                              onChange={(event) => setStockInboundQuantity(event.target.value)}
                            />
                          </label>
                          <label className="store-field">
                            备注（可选）
                            <input
                              value={stockInboundNote}
                              onChange={(event) => setStockInboundNote(event.target.value)}
                              placeholder="例如：采购到货入库"
                            />
                          </label>
                          <button
                            className="auth-submit"
                            type="button"
                            disabled={isSubmittingStockOp || !canWriteInventory}
                            onClick={() => {
                              void handleInboundStock();
                            }}
                          >
                            {isSubmittingStockOp ? "提交中..." : "提交入库"}
                          </button>
                        </div>
                      </details>

                      <details className="inbound-crud-panel">
                        <summary>数量出库</summary>
                        <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                          <label className="store-field">
                            出库数量
                            <input
                              value={stockOutboundQuantity}
                              onChange={(event) => setStockOutboundQuantity(event.target.value)}
                            />
                          </label>
                          <label className="store-field">
                            出库原因
                            <input
                              value={stockOutboundReason}
                              onChange={(event) => setStockOutboundReason(event.target.value)}
                              placeholder="例如：借出/报废/调拨"
                            />
                          </label>
                          <button
                            className="auth-submit"
                            type="button"
                            disabled={isSubmittingStockOp || !canWriteInventory}
                            onClick={() => {
                              void handleOutboundStock();
                            }}
                          >
                            {isSubmittingStockOp ? "提交中..." : "提交出库"}
                          </button>
                        </div>
                      </details>

                      <details className="inbound-crud-panel">
                        <summary>盘点调整</summary>
                        <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                          <label className="store-field">
                            盘点后现存数量
                            <input
                              value={stockAdjustNewOnHand}
                              onChange={(event) => setStockAdjustNewOnHand(event.target.value)}
                            />
                          </label>
                          <label className="store-field">
                            调整原因
                            <input
                              value={stockAdjustReason}
                              onChange={(event) => setStockAdjustReason(event.target.value)}
                              placeholder="例如：月度盘点差异"
                            />
                          </label>
                          <button
                            className="auth-submit"
                            type="button"
                            disabled={isSubmittingStockOp || !canWriteInventory}
                            onClick={() => {
                              void handleAdjustStock();
                            }}
                          >
                            {isSubmittingStockOp ? "提交中..." : "提交调整"}
                          </button>
                        </div>
                      </details>

                      <details className="inbound-crud-panel">
                        <summary>库存流水（可筛选）</summary>
                        <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                          <div className="inbound-inline-fields">
                            <label className="store-field">
                              动作
                              <select
                                value={flowAction}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setFlowAction(value ? (value as SkuStockFlowAction) : "");
                                  setFlowPage(1);
                                }}
                              >
                                <option value="">（全部）</option>
                                <option value="INBOUND">INBOUND</option>
                                <option value="OUTBOUND">OUTBOUND</option>
                                <option value="ADJUST">ADJUST</option>
                                <option value="LOCK">LOCK</option>
                                <option value="UNLOCK">UNLOCK</option>
                                <option value="SHIP">SHIP</option>
                              </select>
                            </label>
                            <label className="store-field">
                              每页
                              <input
                                type="number"
                                min={1}
                                max={200}
                                value={flowPageSize}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value);
                                  const normalized = Number.isFinite(nextValue)
                                    ? Math.trunc(nextValue)
                                    : 20;
                                  setFlowPageSize(Math.min(200, Math.max(1, normalized)));
                                }}
                              />
                            </label>
                          </div>

                          <div className="inbound-inline-fields">
                            <label className="store-field">
                              从（可选）
                              <input
                                type="datetime-local"
                                value={flowFrom}
                                onChange={(event) => setFlowFrom(event.target.value)}
                              />
                            </label>
                            <label className="store-field">
                              到（可选）
                              <input
                                type="datetime-local"
                                value={flowTo}
                                onChange={(event) => setFlowTo(event.target.value)}
                              />
                            </label>
                          </div>

                          <div className="page-actions">
                            <button
                              className="app-shell__header-action"
                              type="button"
                              disabled={isLoadingFlows || !canReadInventory}
                              onClick={() => {
                                void handleFetchFlows(1);
                              }}
                            >
                              {isLoadingFlows ? "加载中..." : "查询流水"}
                            </button>
                            <button
                              className="app-shell__header-action"
                              type="button"
                              disabled={isExportingFlows || !canReadInventory}
                              onClick={() => {
                                void handleExportFlows();
                              }}
                            >
                              {isExportingFlows ? "导出中..." : "导出 CSV"}
                            </button>
                            <span className="inbound-import-meta">
                              {flowTotal ? `共 ${flowTotal} 条` : "尚未查询"}
                            </span>
                          </div>

                          {flowItems.length ? (
                            <div className="page-table-wrap" aria-label="库存流水表格容器">
                              <table className="analytics-table" aria-label="库存流水表格">
                                <thead>
                                  <tr>
                                    <th>时间</th>
                                    <th>动作</th>
                                    <th>现存Δ</th>
                                    <th>预占Δ</th>
                                    <th>现存(后)</th>
                                    <th>预占(后)</th>
                                    <th>操作人</th>
                                    <th>关联申请</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {flowItems.map((flow) => (
                                    <tr key={flow.id}>
                                      <td>{toDateLabel(flow.occurredAt, "-")}</td>
                                      <td>{flow.action}</td>
                                      <td>{flow.onHandDelta}</td>
                                      <td>{flow.reservedDelta}</td>
                                      <td>{flow.onHandQtyAfter}</td>
                                      <td>{flow.reservedQtyAfter}</td>
                                      <td>{flow.operatorUserName}</td>
                                      <td>{flow.relatedApplicationId ?? "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="app-shell__card-copy">
                              {isLoadingFlows ? "流水加载中..." : "暂无流水数据。"}
                            </p>
                          )}

                          {flowTotal ? (
                            <div className="page-actions">
                              <button
                                className="app-shell__header-action"
                                type="button"
                                disabled={isLoadingFlows || flowPage <= 1 || !canReadInventory}
                                onClick={() => {
                                  void handleFetchFlows(Math.max(1, flowPage - 1));
                                }}
                              >
                                上一页
                              </button>
                              <span className="inbound-import-meta">
                                页码 {flowPage} / {Math.max(1, Math.ceil(flowTotal / flowPageSize))}
                              </span>
                              <button
                                className="app-shell__header-action"
                                type="button"
                                disabled={
                                  isLoadingFlows ||
                                  flowPage >= Math.max(1, Math.ceil(flowTotal / flowPageSize)) ||
                                  !canReadInventory
                                }
                                onClick={() => {
                                  void handleFetchFlows(flowPage + 1);
                                }}
                              >
                                下一页
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <p className="app-shell__card-copy">暂无库存汇总数据，可调整筛选条件并点击“查询库存汇总”。</p>
            )}
          </div>
        </article>
        <article className="app-shell__card inbound-wide">
          <div className="page-card-head">
            <p className="app-shell__section-label">后台资产</p>
            <h3 className="app-shell__card-title">资产创建/查询</h3>
          </div>
          <div className="outbound-action-grid page-form-grid">
            <div className="inbound-inline-fields">
              <label className="store-field">
                创建资产物料编号
                <input
                  value={assetCreateSkuId}
                  onChange={(event) => setAssetCreateSkuId(event.target.value)}
                />
              </label>
              <label className="store-field">
                资产筛选物料编号
                <input
                  value={assetFilterSkuId}
                  onChange={(event) => setAssetFilterSkuId(event.target.value)}
                />
              </label>
            </div>

            <label className="store-field">
              创建资产序列号（逗号/换行分隔）
              <textarea
                rows={3}
                value={assetCreateSnList}
                onChange={(event) => setAssetCreateSnList(event.target.value)}
              />
            </label>

            <label className="store-field">
              资产筛选状态
              <select
                value={assetFilterStatus}
                onChange={(event) => {
                  const value = event.target.value;
                  const validStatus: AdminAssetStatus[] = [
                    "IN_STOCK",
                    "LOCKED",
                    "IN_USE",
                    "PENDING_INSPECTION",
                    "BORROWED",
                    "REPAIRING",
                    "SCRAPPED",
                  ];
                  setAssetFilterStatus(
                    validStatus.includes(value as AdminAssetStatus)
                      ? (value as AdminAssetStatus)
                      : "",
                  );
                }}
              >
                <option value="">（全部）</option>
                <option value="IN_STOCK">{toAssetStatusLabel("IN_STOCK")}</option>
                <option value="LOCKED">{toAssetStatusLabel("LOCKED")}</option>
                <option value="IN_USE">{toAssetStatusLabel("IN_USE")}</option>
                <option value="PENDING_INSPECTION">{toAssetStatusLabel("PENDING_INSPECTION")}</option>
                <option value="BORROWED">{toAssetStatusLabel("BORROWED")}</option>
                <option value="REPAIRING">{toAssetStatusLabel("REPAIRING")}</option>
                <option value="SCRAPPED">{toAssetStatusLabel("SCRAPPED")}</option>
              </select>
            </label>

            <div className="store-action-row page-actions">
              <button
                className="auth-submit"
                type="button"
                disabled={isCreatingAssets || !canWriteInventory}
                onClick={() => {
                  void handleCreateAssets();
                }}
              >
                {isCreatingAssets ? "提交中..." : "创建资产"}
              </button>

              <button
                className="app-shell__header-action"
                type="button"
                disabled={isLoadingAssets || !canFetchAssets}
                onClick={() => {
                  void handleFetchAssets();
                }}
              >
                {isLoadingAssets ? "加载中..." : "查询资产"}
              </button>
            </div>

            <p className="inbound-import-meta">查询结果将以表格呈现，支持编辑/删除。</p>

            {assetItems.length ? (
              <div className="page-table-wrap" aria-label="后台资产表格容器">
                <table className="analytics-table" aria-label="后台资产表格">
                  <thead>
                    <tr>
                      <th>ID</th>
                        <th>资产标签</th>
                        <th>SKU</th>
                        <th>物料名称</th>
                        <th>序列号</th>
                        <th>状态</th>
                      <th>持有人</th>
                      <th>锁定申请</th>
                      <th>入库时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.assetTag}</td>
                        <td>{item.skuId}</td>
                        <td>{materialNameBySkuId.get(item.skuId) ?? `SKU-${item.skuId}`}</td>
                        <td>{item.sn}</td>
                        <td>{toAssetStatusLabel(item.status)}</td>
                        <td>{item.holderUserId ?? "-"}</td>
                        <td>{item.lockedApplicationId ?? "-"}</td>
                        <td>{toDateLabel(item.inboundAt, "-")}</td>
                        <td>
                          <div className="inbound-table-actions">
                            <button
                              className="app-shell__header-action"
                              type="button"
                              disabled={!canWriteInventory}
                              onClick={() => {
                                handleStartEditAsset(item);
                              }}
                            >
                              编辑
                            </button>
                            <button
                              className="app-shell__header-action inbound-action-danger"
                              type="button"
                              disabled={deletingAssetId === item.id || !canWriteInventory}
                              onClick={() => {
                                void handleDeleteAsset(item.id);
                              }}
                            >
                              {deletingAssetId === item.id ? "删除中..." : "删除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="app-shell__card-copy">暂无资产数据，可调整筛选条件并点击“查询资产”。</p>
            )}

            {editingAssetId ? (
              <section className="inbound-crud-panel inbound-crud-panel--editor" aria-label="编辑资产">
                <div className="inbound-crud-panel__head">
                  <p className="app-shell__section-label">编辑资产</p>
                  <p className="inbound-import-meta">资产 #{editingAssetId}</p>
                </div>

                <div className="outbound-action-grid page-form-grid inbound-crud-panel__body">
                  <label className="store-field">
                    物料编号
                    <input
                      value={editAssetSkuId}
                      onChange={(event) => setEditAssetSkuId(event.target.value)}
                    />
                  </label>
                  <label className="store-field">
                    资产序列号（SN）
                    <input value={editAssetSn} onChange={(event) => setEditAssetSn(event.target.value)} />
                  </label>
                  <label className="store-field">
                    资产状态
                    <select
                      value={editAssetStatus}
                      onChange={(event) => {
                        const value = event.target.value;
                        const validStatus: AdminAssetStatus[] = [
                          "IN_STOCK",
                          "LOCKED",
                          "IN_USE",
                          "PENDING_INSPECTION",
                          "BORROWED",
                          "REPAIRING",
                          "SCRAPPED",
                        ];
                        setEditAssetStatus(
                          validStatus.includes(value as AdminAssetStatus)
                            ? (value as AdminAssetStatus)
                            : "",
                        );
                      }}
                    >
                      <option value="">（请选择）</option>
                      <option value="IN_STOCK">{toAssetStatusLabel("IN_STOCK")}</option>
                      <option value="LOCKED">{toAssetStatusLabel("LOCKED")}</option>
                      <option value="IN_USE">{toAssetStatusLabel("IN_USE")}</option>
                      <option value="PENDING_INSPECTION">
                        {toAssetStatusLabel("PENDING_INSPECTION")}
                      </option>
                      <option value="BORROWED">{toAssetStatusLabel("BORROWED")}</option>
                      <option value="REPAIRING">{toAssetStatusLabel("REPAIRING")}</option>
                      <option value="SCRAPPED">{toAssetStatusLabel("SCRAPPED")}</option>
                    </select>
                  </label>

                  <p className="inbound-import-meta">
                    提示：若资产处于锁定状态或已被申请流程引用，系统将禁止修改关键字段或删除。
                  </p>

                  <div className="page-actions">
                    <button
                      className="auth-submit"
                      type="button"
                      disabled={isUpdatingAsset || !canWriteInventory}
                      onClick={() => {
                        void handleUpdateAsset();
                      }}
                    >
                      {isUpdatingAsset ? "保存中..." : "保存修改"}
                    </button>
                    <button
                      className="app-shell__header-action"
                      type="button"
                      disabled={isUpdatingAsset || !canWriteInventory}
                      onClick={() => {
                        handleCancelEditAsset();
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

          </div>
        </article>
      </section>
    </div>
  );
}


