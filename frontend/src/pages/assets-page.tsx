import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AuthApiError, fetchMyAssets, type MyAssetItem } from "../api";
import { useAuthSession } from "../stores";
import { toAssetStatusLabel, toDateLabel } from "./page-helpers";

function toInboundTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

export function AssetsPage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const [assets, setAssets] = useState<MyAssetItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");

  const statusOptions = useMemo(() => {
    if (!assets) {
      return [];
    }
    return Array.from(new Set(assets.map((item) => item.status))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!assets) {
      return [];
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedStatus = status.trim();

    const result = assets.filter((item) => {
      if (normalizedStatus && item.status !== normalizedStatus) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      const haystacks = [
        String(item.id),
        item.assetTag,
        item.sn,
        String(item.skuId),
      ].map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(normalizedKeyword));
    });

    return result.sort(
      (a, b) => toInboundTimestamp(b.inboundAt) - toInboundTimestamp(a.inboundAt),
    );
  }, [assets, keyword, status]);

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
            error instanceof AuthApiError ? error.message : "加载我的资产失败。",
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
  }, [accessToken, reloadKey]);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  const totalCount = assets?.length ?? 0;
  const filteredCount = filteredAssets.length;

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="我的资产概览">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">我的资产</h2>
          <p className="app-shell__panel-copy">
            展示当前登录用户持有的资产清单，可按关键词与状态筛选后查看详情或发起生命周期操作。
          </p>
        </div>

        <div className="page-toolbar" aria-label="筛选与快捷操作">
          <label className="store-field">
            关键词
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="资产标签 / SN / 编号 / SKU"
            />
          </label>

          <label className="store-field">
            状态
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {toAssetStatusLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="app-shell__header-action"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
          >
            刷新
          </button>
          <Link className="app-shell__header-action" to="/store">
            去领用商城
          </Link>
        </div>
      </section>

      {isLoading ? (
        <section className="app-shell__panel" aria-label="加载中">
          <p className="app-shell__panel-copy">正在加载我的资产...</p>
        </section>
      ) : errorMessage ? (
        <section className="app-shell__panel" aria-label="加载失败">
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
          <div className="page-actions">
            <button
              className="app-shell__header-action"
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              重试
            </button>
          </div>
        </section>
      ) : !assets || assets.length === 0 ? (
        <section className="app-shell__panel" aria-label="空态">
          <p className="app-shell__section-label">提示</p>
          <h3 className="app-shell__panel-title">当前没有分配中的资产</h3>
          <p className="app-shell__panel-copy">
            你当前名下没有在用资产，可前往领用商城发起申领。
          </p>
          <Link className="dashboard-link" to="/store">
            去领用商城
          </Link>
        </section>
      ) : (
        <section className="app-shell__card" aria-label="资产列表">
          <div className="page-card-head">
            <p className="app-shell__section-label">资产清单</p>
            <h3 className="app-shell__card-title">
              我的资产（{filteredCount}/{totalCount}）
            </h3>
          </div>

          {filteredAssets.length === 0 ? (
            <p className="app-shell__card-copy">当前筛选条件下没有匹配的资产。</p>
          ) : (
            <div className="page-table-wrap">
              <table className="analytics-table" aria-label="我的资产表格">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">资产标签</th>
                    <th scope="col">SN</th>
                    <th scope="col">SKU</th>
                    <th scope="col">状态</th>
                    <th scope="col">入库时间</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.assetTag}</td>
                      <td>{item.sn}</td>
                      <td>{item.skuId}</td>
                      <td>{toAssetStatusLabel(item.status)}</td>
                      <td>{toDateLabel(item.inboundAt)}</td>
                      <td>
                        <Link className="app-shell__header-action" to={`/assets/${item.id}`}>
                          查看
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
