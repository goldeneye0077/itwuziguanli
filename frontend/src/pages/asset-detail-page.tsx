import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AuthApiError, fetchMyAssets, type MyAssetItem } from "../api";
import { useAuthSession } from "../stores";
import { parsePositiveInteger, toAssetStatusLabel, toDateLabel } from "./page-helpers";

export function AssetDetailPage(): JSX.Element {
  const params = useParams();
  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;

  const assetId = parsePositiveInteger(params.id ?? "");

  const [assets, setAssets] = useState<MyAssetItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssets(): Promise<void> {
      if (!accessToken) {
        if (!cancelled) {
          setErrorMessage("会话令牌缺失，请重新登录。");
          setIsLoading(false);
        }
        return;
      }

      if (!assetId) {
        if (!cancelled) {
          setErrorMessage("资产编号不合法。");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = await fetchMyAssets(accessToken);
        if (!cancelled) {
          setAssets(result);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof AuthApiError ? error.message : "加载资产详情失败。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAssets();
    return () => {
      cancelled = true;
    };
  }, [accessToken, assetId]);

  const asset = useMemo(() => {
    if (!assets || !assetId) {
      return null;
    }
    return assets.find((item) => item.id === assetId) ?? null;
  }, [assets, assetId]);

  const canTransfer = userRoles.includes("LEADER") || userRoles.includes("ADMIN") || userRoles.includes("SUPER_ADMIN");
  const canScrap = userRoles.includes("ADMIN") || userRoles.includes("SUPER_ADMIN");

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="资产详情概览">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">
            {asset ? asset.assetTag : assetId ? `资产 #${assetId}` : "资产详情"}
          </h2>
          <p className="app-shell__panel-copy">
            {asset ? (
              <>
                序列号：<strong>{asset.sn}</strong> · 状态：
                <strong>{toAssetStatusLabel(asset.status)}</strong>
              </>
            ) : (
              "查看资产基础信息，并从这里进入归还/报修/调拨/报废等生命周期操作。"
            )}
          </p>
        </div>

        <div className="page-actions" aria-label="快捷操作">
          <Link className="app-shell__header-action" to="/assets">
            返回资产总览
          </Link>
          {asset ? (
            <>
              <Link
                className="app-shell__header-action"
                to={`/assets/return?assetId=${asset.id}`}
              >
                归还
              </Link>
              <Link
                className="app-shell__header-action"
                to={`/assets/repair?assetId=${asset.id}`}
              >
                报修
              </Link>
              {canTransfer ? (
                <Link
                  className="app-shell__header-action"
                  to={`/assets/transfer?assetId=${asset.id}`}
                >
                  调拨
                </Link>
              ) : null}
              {canScrap ? (
                <Link
                  className="app-shell__header-action"
                  to={`/admin/assets/scrap?assetId=${asset.id}`}
                >
                  报废
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <section className="app-shell__panel" aria-label="加载中">
          <p className="app-shell__panel-copy">正在加载资产详情...</p>
        </section>
      ) : errorMessage ? (
        <section className="app-shell__panel" aria-label="加载失败">
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        </section>
      ) : !asset ? (
        <section className="app-shell__panel" aria-label="未找到资产">
          <p className="app-shell__section-label">提示</p>
          <h3 className="app-shell__panel-title">未找到该资产</h3>
          <p className="app-shell__panel-copy">
            可能原因：资产不属于当前用户，或资产不存在。请返回资产总览确认资产编号。
          </p>
          <Link className="dashboard-link" to="/assets">
            返回资产总览
          </Link>
        </section>
      ) : (
        <section className="app-shell__card" aria-label="资产基础信息">
          <div className="page-card-head">
            <p className="app-shell__section-label">基础信息</p>
            <h3 className="app-shell__card-title">资产信息</h3>
          </div>

          <div className="page-table-wrap">
            <table className="analytics-table" aria-label="资产信息表格">
              <tbody>
                <tr>
                  <th scope="row">资产编号</th>
                  <td>{asset.id}</td>
                </tr>
                <tr>
                  <th scope="row">资产标签</th>
                  <td>{asset.assetTag}</td>
                </tr>
                <tr>
                  <th scope="row">序列号</th>
                  <td>{asset.sn}</td>
                </tr>
                <tr>
                  <th scope="row">SKU</th>
                  <td>{asset.skuId}</td>
                </tr>
                <tr>
                  <th scope="row">状态</th>
                  <td>{toAssetStatusLabel(asset.status)}</td>
                </tr>
                <tr>
                  <th scope="row">入库时间</th>
                  <td>{toDateLabel(asset.inboundAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

