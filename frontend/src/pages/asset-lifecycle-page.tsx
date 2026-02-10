import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  submitAssetRepair,
  submitAssetReturn,
  submitAssetScrap,
  submitAssetTransfer,
  type AssetScrapReason,
  type RepairUrgency,
} from "../api";
import { useAuthSession } from "../stores";
import {
  parsePositiveInteger,
  toAssetStatusLabel,
  toErrorMessage,
  toRepairUrgencyLabel,
  toScrapReasonLabel,
} from "./page-helpers";

type LifecycleRoute =
  | "/assets/return"
  | "/assets/repair"
  | "/assets/transfer"
  | "/admin/assets/scrap";

interface AssetLifecyclePageProps {
  readonly routePath: LifecycleRoute;
}

export function AssetLifecyclePage({ routePath }: AssetLifecyclePageProps): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [returnAssetId, setReturnAssetId] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const [repairAssetId, setRepairAssetId] = useState("");
  const [repairFaultDescription, setRepairFaultDescription] = useState("");
  const [repairUrgency, setRepairUrgency] = useState<RepairUrgency>("MEDIUM");

  const [transferAssetId, setTransferAssetId] = useState("");
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const [scrapAssetId, setScrapAssetId] = useState("");
  const [scrapReason, setScrapReason] = useState<AssetScrapReason>("DAMAGE");
  const [scrapNote, setScrapNote] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("assetId");
    const normalized = raw?.trim();
    if (!normalized) {
      return;
    }

    if (routePath === "/assets/return") {
      setReturnAssetId(normalized);
    } else if (routePath === "/assets/repair") {
      setRepairAssetId(normalized);
    } else if (routePath === "/assets/transfer") {
      setTransferAssetId(normalized);
    } else if (routePath === "/admin/assets/scrap") {
      setScrapAssetId(normalized);
    }
  }, [location.search, routePath]);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <p className="app-shell__section-label">M09 资产生命周期</p>
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const ROUTE_LABELS: Record<LifecycleRoute, string> = {
    "/assets/return": "资产归还",
    "/assets/repair": "资产报修",
    "/assets/transfer": "资产调拨",
    "/admin/assets/scrap": "资产报废",
  };

  const token = accessToken;

  async function handleSubmitReturn(): Promise<void> {
    const parsedAssetId = parsePositiveInteger(returnAssetId);
    const normalizedReason = returnReason.trim();
    if (!parsedAssetId || !normalizedReason) {
      setErrorMessage("资产编号和归还原因不能为空。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await submitAssetReturn(token, {
        assetId: parsedAssetId,
        reason: normalizedReason,
      });
      setSuccessMessage(
        `归还申请单 #${result.applicationId} 创建成功，资产状态：${toAssetStatusLabel(result.assetStatus)}。`,
      );
      setReturnReason("");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "提交归还申请失败。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitRepair(): Promise<void> {
    const parsedAssetId = parsePositiveInteger(repairAssetId);
    const normalizedFault = repairFaultDescription.trim();
    if (!parsedAssetId || !normalizedFault) {
      setErrorMessage("资产编号和故障描述不能为空。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await submitAssetRepair(token, {
        assetId: parsedAssetId,
        faultDescription: normalizedFault,
        urgency: repairUrgency,
      });
      setSuccessMessage(
        `报修申请单 #${result.applicationId} 创建成功，资产状态：${toAssetStatusLabel(result.assetStatus)}。`,
      );
      setRepairFaultDescription("");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "提交报修申请失败。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitTransfer(): Promise<void> {
    const parsedAssetId = parsePositiveInteger(transferAssetId);
    const parsedTargetUserId = parsePositiveInteger(transferTargetUserId);
    const normalizedReason = transferReason.trim();
    if (!parsedAssetId || !parsedTargetUserId || !normalizedReason) {
      setErrorMessage("资产编号、目标用户编号和调拨原因不能为空。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await submitAssetTransfer(token, {
        assetId: parsedAssetId,
        targetUserId: parsedTargetUserId,
        reason: normalizedReason,
      });
      setSuccessMessage(
        `资产编号 ${result.assetId} 已从用户编号 ${result.fromUserId} 调拨至用户编号 ${result.toUserId}。`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "资产调拨失败。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitScrap(): Promise<void> {
    const parsedAssetId = parsePositiveInteger(scrapAssetId);
    if (!parsedAssetId) {
      setErrorMessage("资产编号不能为空。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await submitAssetScrap(token, {
        assetId: parsedAssetId,
        reason: scrapReason,
        scrapNote: scrapNote.trim() || undefined,
      });
      setSuccessMessage(
        `资产编号 ${result.assetId} 已报废，最终状态：${toAssetStatusLabel(result.assetStatus)}。`,
      );
      setScrapNote("");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "资产报废失败。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="资产生命周期说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M09 资产生命周期</p>
          <h2 className="app-shell__panel-title">生命周期操作台</h2>
          <p className="app-shell__panel-copy">
            当前功能：<strong>{ROUTE_LABELS[routePath]}</strong>，已连接到真实生命周期接口。
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

      {routePath === "/assets/return" ? (
        <section className="app-shell__card" aria-label="资产归还表单">
          <div className="page-card-head">
            <p className="app-shell__section-label">资产归还</p>
            <h3 className="app-shell__card-title">创建归还申请</h3>
          </div>
          <div className="lifecycle-form-grid page-form-grid">
            <label className="store-field">
              资产编号
              <input
                value={returnAssetId}
                onChange={(event) => setReturnAssetId(event.target.value)}
                placeholder="例如：31"
              />
            </label>
            <label className="store-field">
              归还原因
              <textarea
                rows={4}
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder="请填写归还原因"
              />
            </label>
            <button
              className="auth-submit"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void handleSubmitReturn();
              }}
            >
              {isSubmitting ? "提交中..." : "提交归还申请"}
            </button>
          </div>
        </section>
      ) : null}

      {routePath === "/assets/repair" ? (
        <section className="app-shell__card" aria-label="资产报修表单">
          <div className="page-card-head">
            <p className="app-shell__section-label">资产报修</p>
            <h3 className="app-shell__card-title">创建报修申请</h3>
          </div>
          <div className="lifecycle-form-grid page-form-grid">
            <label className="store-field">
              资产编号
              <input
                value={repairAssetId}
                onChange={(event) => setRepairAssetId(event.target.value)}
                placeholder="例如：32"
              />
            </label>
            <label className="store-field">
              紧急程度
              <select
                value={repairUrgency}
                onChange={(event) => {
                  const value = event.target.value;
                  setRepairUrgency(
                    value === "LOW" || value === "MEDIUM" || value === "HIGH"
                      ? value
                      : "MEDIUM",
                  );
                }}
              >
                <option value="LOW">{toRepairUrgencyLabel("LOW")}</option>
                <option value="MEDIUM">{toRepairUrgencyLabel("MEDIUM")}</option>
                <option value="HIGH">{toRepairUrgencyLabel("HIGH")}</option>
              </select>
            </label>
            <label className="store-field">
              故障描述
              <textarea
                rows={4}
                value={repairFaultDescription}
                onChange={(event) => setRepairFaultDescription(event.target.value)}
                placeholder="请描述故障现象"
              />
            </label>
            <button
              className="auth-submit"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void handleSubmitRepair();
              }}
            >
              {isSubmitting ? "提交中..." : "提交报修申请"}
            </button>
          </div>
        </section>
      ) : null}

      {routePath === "/assets/transfer" ? (
        <section className="app-shell__card" aria-label="资产调拨表单">
          <div className="page-card-head">
            <p className="app-shell__section-label">资产调拨</p>
            <h3 className="app-shell__card-title">变更持有人</h3>
          </div>
          <div className="lifecycle-form-grid page-form-grid">
            <div className="lifecycle-form-inline">
              <label className="store-field">
                资产编号
                <input
                  value={transferAssetId}
                  onChange={(event) => setTransferAssetId(event.target.value)}
                  placeholder="例如：33"
                />
              </label>
              <label className="store-field">
                目标用户编号
                <input
                  value={transferTargetUserId}
                  onChange={(event) => setTransferTargetUserId(event.target.value)}
                  placeholder="例如：4"
                />
              </label>
            </div>
            <label className="store-field">
              调拨原因
              <textarea
                rows={3}
                value={transferReason}
                onChange={(event) => setTransferReason(event.target.value)}
                placeholder="请填写调拨原因"
              />
            </label>
            <button
              className="auth-submit"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void handleSubmitTransfer();
              }}
            >
              {isSubmitting ? "提交中..." : "提交调拨"}
            </button>
          </div>
        </section>
      ) : null}

      {routePath === "/admin/assets/scrap" ? (
        <section className="app-shell__card" aria-label="资产报废表单">
          <div className="page-card-head">
            <p className="app-shell__section-label">资产报废</p>
            <h3 className="app-shell__card-title">执行报废</h3>
          </div>
          <div className="lifecycle-form-grid page-form-grid">
            <label className="store-field">
              资产编号
              <input
                value={scrapAssetId}
                onChange={(event) => setScrapAssetId(event.target.value)}
                placeholder="例如：34"
              />
            </label>
            <label className="store-field">
              报废原因
              <select
                value={scrapReason}
                onChange={(event) => {
                  const value = event.target.value;
                  setScrapReason(
                    value === "DAMAGE" || value === "OBSOLETE" || value === "LOST"
                      ? value
                      : "DAMAGE",
                  );
                }}
              >
                <option value="DAMAGE">{toScrapReasonLabel("DAMAGE")}</option>
                <option value="OBSOLETE">{toScrapReasonLabel("OBSOLETE")}</option>
                <option value="LOST">{toScrapReasonLabel("LOST")}</option>
              </select>
            </label>
            <label className="store-field">
              备注（可选）
              <textarea
                rows={3}
                value={scrapNote}
                onChange={(event) => setScrapNote(event.target.value)}
                placeholder="可选报废说明"
              />
            </label>
            <button
              className="auth-submit"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void handleSubmitScrap();
              }}
            >
              {isSubmitting ? "提交中..." : "提交报废"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
