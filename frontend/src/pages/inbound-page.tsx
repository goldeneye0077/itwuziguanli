import { useState } from "react";
import { Link } from "react-router-dom";

import {
  confirmInboundOcrJob,
  createInboundOcrJob,
  fetchInboundOcrJob,
  type InboundOcrDocType,
  type SkuStockMode,
} from "../api";
import { hasActionPermission, PERMISSION_KEYS } from "../permissions";
import { useAuthSession } from "../stores";
import {
  parsePositiveInteger,
  toErrorMessage,
  toOcrDocTypeLabel,
  toOcrJobStatusLabel,
} from "./page-helpers";
import { InboundManualImportCard } from "./inbound-manual-import-card";

function parseSerialNumbers(source: string): string[] {
  return source
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stringifyJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export function InboundPage(): JSX.Element {
  const { state, hasPermission, userRoles, userPermissions } = useAuthSession();
  const accessToken = state.accessToken;
  const canReadInventory = hasPermission(PERMISSION_KEYS.inventoryRead);
  const canWriteInventory = hasPermission(PERMISSION_KEYS.inventoryWrite);
  const canConfirmInbound = hasActionPermission(
    "inbound.confirm-inbound",
    userRoles,
    userPermissions,
  );
  const canPrintTag = hasActionPermission("inbound.print-tag", userRoles, userPermissions);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrDocType, setOcrDocType] = useState<InboundOcrDocType | "">("");
  const [ocrLookupJobId, setOcrLookupJobId] = useState("");
  const [ocrDetailJson, setOcrDetailJson] = useState<string>("");

  const [confirmJobId, setConfirmJobId] = useState("");
  const [confirmCategoryId, setConfirmCategoryId] = useState("1");
  const [confirmStockMode, setConfirmStockMode] = useState<SkuStockMode>("SERIALIZED");
  const [confirmBrand, setConfirmBrand] = useState("联想");
  const [confirmModel, setConfirmModel] = useState("T14");
  const [confirmSpec, setConfirmSpec] = useState("i7/32G/1T");
  const [confirmReferencePrice, setConfirmReferencePrice] = useState("8999.00");
  const [confirmSafetyStockThreshold, setConfirmSafetyStockThreshold] = useState("0");
  const [confirmQuantity, setConfirmQuantity] = useState("1");
  const [confirmSnList, setConfirmSnList] = useState("SN-INBOUND-001\nSN-INBOUND-002");
  const [confirmResultJson, setConfirmResultJson] = useState<string>("");

  const [isCreatingOcrJob, setIsCreatingOcrJob] = useState(false);
  const [isLoadingOcrJob, setIsLoadingOcrJob] = useState(false);
  const [isConfirmingOcrJob, setIsConfirmingOcrJob] = useState(false);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <p className="app-shell__section-label">M06 入库</p>
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const token = accessToken;

  async function handleCreateOcrJob(): Promise<void> {
    if (!canWriteInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法创建识别任务。");
      return;
    }
    if (!ocrFile) {
      setErrorMessage("请先选择文件再创建单据识别任务。");
      return;
    }

    setIsCreatingOcrJob(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await createInboundOcrJob(token, ocrFile, ocrDocType || undefined);
      setSuccessMessage(
        `单据识别任务 #${created.jobId} 创建成功，状态：${toOcrJobStatusLabel(created.status)}。`,
      );
      setOcrLookupJobId(String(created.jobId));
      setConfirmJobId(String(created.jobId));
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建单据识别任务失败。"));
    } finally {
      setIsCreatingOcrJob(false);
    }
  }

  async function handleFetchOcrJob(): Promise<void> {
    if (!canReadInventory) {
      setErrorMessage("当前账号缺少 INVENTORY:READ 权限，无法查询识别任务。");
      return;
    }
    const parsedJobId = parsePositiveInteger(ocrLookupJobId);
    if (!parsedJobId) {
      setErrorMessage("单据识别任务编号必须为正整数。");
      return;
    }

    setIsLoadingOcrJob(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const detail = await fetchInboundOcrJob(token, parsedJobId);
      setOcrDetailJson(stringifyJson(detail));
      setSuccessMessage(`单据识别任务 #${detail.jobId} 加载成功。`);
      setConfirmJobId(String(detail.jobId));
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载单据识别任务详情失败。"));
    } finally {
      setIsLoadingOcrJob(false);
    }
  }

  async function handleConfirmOcrJob(): Promise<void> {
    if (!canConfirmInbound) {
      setErrorMessage("当前账号缺少 INVENTORY:WRITE 权限，无法确认识别入库。");
      return;
    }
    const parsedJobId = parsePositiveInteger(confirmJobId);
    const parsedCategoryId = parsePositiveInteger(confirmCategoryId);
    const parsedSafetyStockThreshold = Number(confirmSafetyStockThreshold);
    const serialNumbers = confirmStockMode === "SERIALIZED" ? parseSerialNumbers(confirmSnList) : [];
    const parsedQuantity =
      confirmStockMode === "QUANTITY" ? Number(confirmQuantity) : serialNumbers.length;

    if (!parsedJobId || !parsedCategoryId) {
      setErrorMessage("确认任务编号与分类编号必须为正整数。");
      return;
    }
    if (!Number.isFinite(parsedSafetyStockThreshold) || parsedSafetyStockThreshold < 0) {
      setErrorMessage("安全库存阈值必须大于等于 0。");
      return;
    }
    if (!confirmReferencePrice.trim()) {
      setErrorMessage("参考价格不能为空。");
      return;
    }
    if (confirmStockMode === "SERIALIZED" && !serialNumbers.length) {
      setErrorMessage("序列号资产入库至少填写一个序列号。");
      return;
    }
    if (
      confirmStockMode === "QUANTITY" &&
      (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)
    ) {
      setErrorMessage("数量库存入库数量必须为正整数。");
      return;
    }

    setIsConfirmingOcrJob(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await confirmInboundOcrJob(token, parsedJobId, {
        sku: {
          categoryId: parsedCategoryId,
          brand: confirmBrand,
          model: confirmModel,
          spec: confirmSpec,
          referencePrice: confirmReferencePrice,
          stockMode: confirmStockMode,
          safetyStockThreshold: Math.trunc(parsedSafetyStockThreshold),
        },
        quantity: Math.trunc(parsedQuantity),
        assets:
          confirmStockMode === "SERIALIZED"
            ? serialNumbers.map((sn) => ({ sn }))
            : undefined,
      });
      setConfirmResultJson(stringifyJson(result));
      setSuccessMessage(
        `单据识别任务 #${parsedJobId} 确认成功，入库数量 ${result.inboundQuantity}；创建资产 ${result.createdAssets.length} 台。`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "确认单据识别任务失败。"));
    } finally {
      setIsConfirmingOcrJob(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="入库工作台说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M06 入库</p>
          <h2 className="app-shell__panel-title">入库执行工作台</h2>
          <p className="app-shell__panel-copy">
            支持手动导入入库、单据识别任务创建/查询/确认。库存查询与管理请前往“库存管理”页面。
          </p>
          <div className="page-actions">
            <Link className="app-shell__header-action" to="/inventory">
              库存管理
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
          {successMessage ? <p className="store-success" aria-live="polite">{successMessage}</p> : null}
        </div>
      ) : null}

      <section className="app-shell__grid inbound-grid" aria-label="入库操作面板">
        <InboundManualImportCard
          accessToken={token}
          canReadInventory={canReadInventory}
          canConfirmInbound={canConfirmInbound}
          canPrintTag={canPrintTag}
          onError={(message) => {
            setErrorMessage(message);
            setSuccessMessage(null);
          }}
          onSuccess={(message) => {
            setSuccessMessage(message);
            setErrorMessage(null);
          }}
        />

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">单据识别任务</p>
            <h3 className="app-shell__card-title">创建与查询单据识别任务</h3>
          </div>
          <div className="outbound-action-grid page-form-grid">
            <label className="store-field">
              上传文件
              <input
                className="inbound-file-input"
                type="file"
                onChange={(event) => {
                  setOcrFile(event.target.files?.[0] ?? null);
                }}
              />
            </label>

            <label className="store-field">
              文档类型（可选）
              <select
                value={ocrDocType}
                onChange={(event) => {
                  const value = event.target.value;
                  setOcrDocType(
                    value === "INVOICE" || value === "DELIVERY_NOTE" || value === "OTHER"
                      ? value
                      : "",
                  );
                }}
              >
                <option value="">（不指定）</option>
                <option value="INVOICE">{toOcrDocTypeLabel("INVOICE")}</option>
                <option value="DELIVERY_NOTE">{toOcrDocTypeLabel("DELIVERY_NOTE")}</option>
                <option value="OTHER">{toOcrDocTypeLabel("OTHER")}</option>
              </select>
            </label>

            <button
              className="auth-submit"
              type="button"
              disabled={isCreatingOcrJob || !canWriteInventory}
              onClick={() => {
                void handleCreateOcrJob();
              }}
              >
              {isCreatingOcrJob ? "提交中..." : "创建识别任务"}
            </button>

            <label className="store-field">
              识别任务编号
              <input
                value={ocrLookupJobId}
                onChange={(event) => setOcrLookupJobId(event.target.value)}
                placeholder="例如：1"
              />
            </label>

            <button
              className="app-shell__header-action"
              type="button"
              disabled={isLoadingOcrJob || !canReadInventory}
              onClick={() => {
                void handleFetchOcrJob();
              }}
            >
              {isLoadingOcrJob ? "加载中..." : "查询识别任务"}
            </button>

            {ocrDetailJson ? <pre className="inbound-result">{ocrDetailJson}</pre> : null}
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">识别确认</p>
            <h3 className="app-shell__card-title">确认识别结果并执行入库</h3>
          </div>
          <div className="outbound-action-grid page-form-grid">
            <label className="store-field">
              任务编号
              <input
                value={confirmJobId}
                onChange={(event) => setConfirmJobId(event.target.value)}
                placeholder="例如：1"
              />
            </label>

            <div className="inbound-inline-fields">
              <label className="store-field">
                分类编号
                <input
                  value={confirmCategoryId}
                  onChange={(event) => setConfirmCategoryId(event.target.value)}
                />
              </label>
              <label className="store-field">
                库存模式
                <select
                  value={confirmStockMode}
                  onChange={(event) =>
                    setConfirmStockMode(event.target.value === "QUANTITY" ? "QUANTITY" : "SERIALIZED")
                  }
                >
                  <option value="SERIALIZED">SERIALIZED（序列号资产）</option>
                  <option value="QUANTITY">QUANTITY（数量库存）</option>
                </select>
              </label>
              <label className="store-field">
                  安全库存阈值
                <input
                  value={confirmSafetyStockThreshold}
                  onChange={(event) => setConfirmSafetyStockThreshold(event.target.value)}
                />
              </label>
            </div>

            <label className="store-field">
              品牌
              <input value={confirmBrand} onChange={(event) => setConfirmBrand(event.target.value)} />
            </label>
            <label className="store-field">
              型号
              <input value={confirmModel} onChange={(event) => setConfirmModel(event.target.value)} />
            </label>
            <label className="store-field">
              规格
              <input value={confirmSpec} onChange={(event) => setConfirmSpec(event.target.value)} />
            </label>
            <label className="store-field">
              参考价格
              <input
                value={confirmReferencePrice}
                onChange={(event) => setConfirmReferencePrice(event.target.value)}
              />
            </label>
            {confirmStockMode === "QUANTITY" ? (
              <label className="store-field">
                入库数量
                <input
                  value={confirmQuantity}
                  onChange={(event) => setConfirmQuantity(event.target.value)}
                  placeholder="例如：10"
                />
              </label>
            ) : (
              <label className="store-field">
                资产序列号（逗号/换行分隔）
                <textarea
                  rows={4}
                  value={confirmSnList}
                  onChange={(event) => setConfirmSnList(event.target.value)}
                />
              </label>
            )}

            <button
              className="auth-submit"
              type="button"
              disabled={isConfirmingOcrJob || !canConfirmInbound}
              onClick={() => {
                void handleConfirmOcrJob();
              }}
              >
              {isConfirmingOcrJob ? "提交中..." : "确认识别任务"}
            </button>

            {confirmResultJson ? <pre className="inbound-result">{confirmResultJson}</pre> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
