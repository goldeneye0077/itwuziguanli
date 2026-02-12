import { useEffect, useMemo, useRef, useState } from "react";

import {
  createAdminAssets,
  fetchAdminSkus,
  fetchCategoryTree,
  inboundSkuStock,
  type AdminSkuItem,
  type CategoryTreeNode,
  type InboundCreatedAsset,
} from "../api";
import { parsePositiveInteger, toErrorMessage } from "./page-helpers";

interface WalkCategoryOption {
  readonly id: number;
  readonly name: string;
  readonly depth: number;
}

function walkCategoryTree(
  nodes: readonly CategoryTreeNode[],
  depth = 0,
): WalkCategoryOption[] {
  const result: WalkCategoryOption[] = [];
  nodes.forEach((node) => {
    result.push({ id: node.id, name: node.name, depth });
    if (node.children.length > 0) {
      result.push(...walkCategoryTree(node.children, depth + 1));
    }
  });
  return result;
}

function parseSerialNumbers(source: string): string[] {
  return source
    .split(/[,\n\r\t ]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toLocalDatetimeInputValue(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function toCsv(rows: Array<readonly string[]>): string {
  return rows
    .map((columns) =>
      columns
        .map((cell) => {
          const normalized = String(cell ?? "");
          const escaped = normalized.replace(/"/g, '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

export function InboundManualImportCard(props: {
  readonly accessToken: string;
  readonly canReadInventory: boolean;
  readonly canConfirmInbound: boolean;
  readonly canPrintTag: boolean;
  readonly onError: (message: string) => void;
  readonly onSuccess: (message: string) => void;
}): JSX.Element {
  const {
    accessToken,
    canReadInventory,
    canConfirmInbound,
    canPrintTag,
    onError,
    onSuccess,
  } = props;

  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [adminSkus, setAdminSkus] = useState<AdminSkuItem[]>([]);
  const [isLoadingSkus, setIsLoadingSkus] = useState(true);

  const categoryOptions = useMemo(() => walkCategoryTree(categories), [categories]);

  const [selectedSkuId, setSelectedSkuId] = useState<string>("");
  const [inboundQuantity, setInboundQuantity] = useState<string>("1");

  const [scanSn, setScanSn] = useState<string>("");
  const [bulkSn, setBulkSn] = useState<string>("");
  const [snItems, setSnItems] = useState<string[]>([]);
  const [snNote, setSnNote] = useState<string | null>(null);
  const [inboundAt, setInboundAt] = useState<string>(() =>
    toLocalDatetimeInputValue(new Date()),
  );

  const [createdAssets, setCreatedAssets] = useState<InboundCreatedAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSku = useMemo(() => {
    const parsedId = parsePositiveInteger(selectedSkuId);
    if (!parsedId) {
      return null;
    }
    return adminSkus.find((item) => item.id === parsedId) ?? null;
  }, [adminSkus, selectedSkuId]);

  const isSerializedStockMode = selectedSku?.stockMode === "SERIALIZED";

  useEffect(() => {
    let cancelled = false;

    async function loadBase(): Promise<void> {
      if (!canReadInventory) {
        onError("当前账号缺少 INVENTORY:READ 权限，无法加载入库基础数据。");
        setIsLoadingCategories(false);
        setIsLoadingSkus(false);
        return;
      }

      setIsLoadingCategories(true);
      setIsLoadingSkus(true);
      try {
        const [categoryResult, skuResult] = await Promise.all([
          fetchCategoryTree(accessToken),
          fetchAdminSkus(accessToken),
        ]);
        if (cancelled) {
          return;
        }
        setCategories(categoryResult);
        setAdminSkus(skuResult);
      } catch (error) {
        if (!cancelled) {
          onError(toErrorMessage(error, "加载入库基础数据失败。"));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCategories(false);
          setIsLoadingSkus(false);
        }
      }
    }

    void loadBase();
    return () => {
      cancelled = true;
    };
  }, [accessToken, canReadInventory, onError]);

  useEffect(() => {
    setCreatedAssets([]);
    setSnItems([]);
    setSnNote(null);
    setScanSn("");
    setBulkSn("");
    setInboundQuantity("1");
  }, [selectedSkuId]);

  function addSerialNumbers(items: string[], sourceLabel: string): void {
    const normalized = items.map((item) => item.trim()).filter((item) => item.length > 0);
    if (normalized.length === 0) {
      return;
    }

    const existing = new Set(snItems);
    const next: string[] = [...snItems];
    const duplicates: string[] = [];

    normalized.forEach((sn) => {
      if (existing.has(sn)) {
        duplicates.push(sn);
        return;
      }
      existing.add(sn);
      next.push(sn);
    });

    setSnItems(next);
    if (duplicates.length) {
      setSnNote(`${sourceLabel}：已自动忽略 ${duplicates.length} 条重复序列号。`);
    } else {
      setSnNote(null);
    }

    window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  }

  function resolveInboundAtIso(): string | undefined {
    const normalized = inboundAt.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed.toISOString();
  }

  async function handleSubmit(): Promise<void> {
    if (!accessToken) {
      return;
    }
    if (!canConfirmInbound) {
      onError("当前账号缺少入库提交权限。");
      return;
    }

    setIsSubmitting(true);
    setCreatedAssets([]);

    const inboundAtIso = resolveInboundAtIso();
    try {
      const parsedSkuId = parsePositiveInteger(selectedSkuId);
      if (!parsedSkuId || !selectedSku) {
        onError("请选择有效的物料。");
        return;
      }

      const skuLabel = `#${selectedSku.id} ${selectedSku.brand} ${selectedSku.model}`;

      if (selectedSku.stockMode === "SERIALIZED") {
        if (snItems.length === 0) {
          onError("序列号物料入库必须录入至少一个 SN。");
          return;
        }

        const createdAssetResult = await createAdminAssets(accessToken, {
          skuId: parsedSkuId,
          assets: snItems.map((sn) => ({
            sn,
            inboundAt: inboundAtIso,
          })),
        });
        setCreatedAssets(createdAssetResult.createdAssets);
        onSuccess(`已为物料 ${skuLabel} 入库 ${createdAssetResult.createdAssets.length} 台资产。`);
        return;
      }

      const normalizedQty = Number(inboundQuantity);
      if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
        onError("入库数量必须为正整数。");
        return;
      }
      const qty = Math.trunc(normalizedQty);

      await inboundSkuStock(accessToken, parsedSkuId, { quantity: qty, occurredAt: inboundAtIso });
      onSuccess(`已为物料 ${skuLabel} 入库 ${qty} 件数量库存。`);
      setSnItems([]);
      setSnNote(null);
      setScanSn("");
      setBulkSn("");
      setInboundQuantity("1");
    } catch (error) {
      onError(toErrorMessage(error, "物料入库失败。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function downloadCsv(): void {
    if (!canPrintTag) {
      onError("当前账号缺少标签导出权限。");
      return;
    }
    if (!createdAssets.length) {
      onError("当前没有可导出的入库结果。");
      return;
    }

    const rows: Array<readonly string[]> = [
      ["asset_id", "asset_tag", "sn"],
      ...createdAssets.map((item) => [String(item.assetId), item.assetTag, item.sn]),
    ];

    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "inbound_created_assets.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const skuSelectOptions = useMemo(() => {
    const visitedCategoryIds = new Set<number>();
    const skusByCategory = new Map<number, AdminSkuItem[]>();

    adminSkus.forEach((sku) => {
      const list = skusByCategory.get(sku.categoryId);
      if (list) {
        list.push(sku);
      } else {
        skusByCategory.set(sku.categoryId, [sku]);
      }
    });

    for (const list of skusByCategory.values()) {
      list.sort((a, b) => a.id - b.id);
    }

    const options: Array<{
      readonly key: string;
      readonly value: string;
      readonly label: string;
      readonly disabled?: boolean;
    }> = [];

    function indent(depth: number): string {
      return depth > 0 ? `${"-- ".repeat(depth)}` : "";
    }

    categoryOptions.forEach((category) => {
      visitedCategoryIds.add(category.id);
      const prefix = indent(category.depth);
      options.push({
        key: `cat-${category.id}`,
        value: `__cat_${category.id}`,
        label: `${prefix}${category.name}`,
        disabled: true,
      });

      const skus = skusByCategory.get(category.id) ?? [];
      skus.forEach((sku) => {
        options.push({
          key: `sku-${sku.id}`,
          value: String(sku.id),
          label: `${indent(category.depth + 1)}#${sku.id} · ${sku.brand} ${sku.model} · ${sku.spec}`,
        });
      });
    });

    const uncategorized = adminSkus
      .filter((sku) => !visitedCategoryIds.has(sku.categoryId))
      .slice()
      .sort((a, b) => a.id - b.id);

    if (uncategorized.length) {
      options.push({
        key: "cat-uncategorized",
        value: "__cat_uncategorized",
        label: "未分类",
        disabled: true,
      });
      uncategorized.forEach((sku) => {
        options.push({
          key: `sku-${sku.id}`,
          value: String(sku.id),
          label: `  #${sku.id} · ${sku.brand} ${sku.model} · ${sku.spec}`,
        });
      });
    }

    return options;
  }, [adminSkus, categoryOptions]);

  const inboundQuantityValue = isSerializedStockMode ? String(snItems.length) : inboundQuantity;

  return (
    <article className="app-shell__card inbound-wide" aria-label="物料入库">
      <div className="page-card-head">
        <p className="app-shell__section-label">物料入库</p>
        <h3 className="app-shell__card-title">物料入库（SN 扫码/数量）</h3>
        <p className="app-shell__card-copy">
          物料需先在“物料管理”中创建。本页支持选择物料入库：序列号物料可扫码/粘贴 SN 批量入库；数量物料可直接录入入库数量。
        </p>
      </div>

      <div className="inbound-import-toolbar page-toolbar">
        <span className="inbound-import-meta">
          {isLoadingCategories || isLoadingSkus
            ? "基础数据加载中..."
            : `物料：${adminSkus.length} · 分类：${categoryOptions.length}`}
        </span>
      </div>

      <div className="inbound-import-grid page-form-grid" aria-label="入库导入表单">
        <label className="store-field inbound-field-wide">
          物料入库
          <select
            value={selectedSkuId}
            onChange={(event) => setSelectedSkuId(event.target.value)}
          >
            <option value="">（请选择物料）</option>
            {skuSelectOptions.map((item) => (
              <option key={item.key} value={item.value} disabled={item.disabled}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {selectedSku ? (
          <p className="store-precheck-result inbound-field-wide" role="note">
            当前库存模式：
            {selectedSku.stockMode === "SERIALIZED"
              ? "SERIALIZED（序列号资产，必须录入 SN；入库数量自动等于 SN 条数）"
              : "QUANTITY（数量库存，无需 SN；仅填写入库数量即可入库）"}
          </p>
        ) : null}

        <label className="store-field">
          {isSerializedStockMode ? "入库数量（自动）" : "入库数量"}
          <input
            value={inboundQuantityValue}
            inputMode="numeric"
            onChange={(event) => {
              if (!isSerializedStockMode) {
                setInboundQuantity(event.target.value);
              }
            }}
            disabled={isSerializedStockMode || !selectedSku}
          />
        </label>

        <label className="store-field">
          入库时间（可选）
          <input
            value={inboundAt}
            onChange={(event) => setInboundAt(event.target.value)}
            type="datetime-local"
          />
        </label>

        {isSerializedStockMode ? (
          <div className="inbound-sn">
            <div className="inbound-sn__head">
              <p className="inbound-sn__label">资产序列号（SN）</p>
              <p className="inbound-sn__count">已录入 {snItems.length} 条</p>
            </div>

            <div className="inbound-sn__scan">
              <label className="store-field inbound-field-wide">
                扫码输入（回车添加）
                <input
                  ref={scanInputRef}
                  value={scanSn}
                  onChange={(event) => setScanSn(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    const normalized = scanSn.trim();
                    if (!normalized) {
                      return;
                    }
                    setScanSn("");
                    addSerialNumbers([normalized], "扫码输入");
                  }}
                  placeholder="将光标放在此处，使用扫码枪扫描 SN"
                />
              </label>
              <button
                className="app-shell__header-action"
                type="button"
                onClick={() => {
                  const normalized = scanSn.trim();
                  if (!normalized) {
                    return;
                  }
                  setScanSn("");
                  addSerialNumbers([normalized], "扫码输入");
                }}
              >
                添加
              </button>
            </div>

            <label className="store-field inbound-field-wide">
              批量粘贴（逗号/空格/换行分隔）
              <textarea
                rows={3}
                value={bulkSn}
                onChange={(event) => setBulkSn(event.target.value)}
                placeholder="SN001\nSN002\nSN003"
              />
            </label>

            <div className="store-action-row page-actions">
              <button
                className="app-shell__header-action"
                type="button"
                disabled={!bulkSn.trim()}
                onClick={() => {
                  const items = parseSerialNumbers(bulkSn);
                  setBulkSn("");
                  addSerialNumbers(items, "批量粘贴");
                }}
              >
                批量添加
              </button>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={snItems.length === 0}
                onClick={() => {
                  setSnItems([]);
                  setCreatedAssets([]);
                  setSnNote(null);
                }}
              >
                清空 SN
              </button>
            </div>

            {snNote ? (
              <p className="store-precheck-result" role="note">
                {snNote}
              </p>
            ) : null}

            {snItems.length ? (
              <ul className="inbound-sn__list" aria-label="已录入序列号列表">
                {snItems.slice(0, 50).map((sn) => (
                  <li key={sn} className="inbound-sn__item">
                    <code className="inbound-sn__value">{sn}</code>
                    <button
                      className="app-shell__header-action"
                      type="button"
                      onClick={() => setSnItems((current) => current.filter((item) => item !== sn))}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {snItems.length > 50 ? (
              <p className="app-shell__card-copy">
                列表仅预览前 50 条，实际将按已录入数量全部入库。
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="inbound-import-actions">
          <button
            className="auth-submit"
            type="button"
            disabled={isSubmitting || !canConfirmInbound}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "入库中..." : "提交入库"}
          </button>
          {isSerializedStockMode ? (
            <button
              className="app-shell__header-action"
              type="button"
              disabled={!createdAssets.length || !canPrintTag}
              onClick={() => downloadCsv()}
            >
              导出本次入库 CSV
            </button>
          ) : null}
        </div>

        {createdAssets.length ? (
          <div className="inbound-created" aria-label="入库结果">
            <p className="inbound-created__title">已创建资产（{createdAssets.length}）</p>
            <ul className="inbound-created__list">
              {createdAssets.slice(0, 20).map((item) => (
                <li key={item.assetId} className="inbound-created__item">
                  <span className="inbound-created__tag">{item.assetTag}</span>
                  <span className="inbound-created__sn">{item.sn}</span>
                </li>
              ))}
            </ul>
            {createdAssets.length > 20 ? (
              <p className="app-shell__card-copy">仅预览前 20 条，可使用 CSV 导出查看全量。</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
