import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  AuthApiError,
  fetchApplicationDetail,
  fetchMyApplications,
  type MyApplicationSummary,
  type SkuItem,
} from "../api";
import { useAuthSession } from "../stores";
import { useM02Cart } from "./m02-cart";
import { toApplicationStatusLabel, toDateLabel, toDeliveryTypeLabel } from "./page-helpers";

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
  const value = `${brand} ${model}`.trim();
  return value.length > 0 ? value : `SKU-${skuId}`;
}

const APPLICATIONS_PAGE_SIZE = 10;

export function ApplicationsPage(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useAuthSession();
  const accessToken = state.accessToken;
  const currentUserId = state.user?.id ?? null;
  const { replaceCartItems } = useM02Cart(currentUserId);

  const [items, setItems] = useState<MyApplicationSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRollingBackAppId, setIsRollingBackAppId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));
  }, [total]);

  const loadApplications = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setIsLoading(false);
      setErrorMessage("会话令牌缺失，请重新登录。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchMyApplications(accessToken, {
        page,
        pageSize: APPLICATIONS_PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.meta.total);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载我的申请失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function rollbackToCart(applicationId: number): Promise<void> {
    if (!accessToken) {
      setErrorMessage("会话令牌缺失，请重新登录。");
      return;
    }

    if (!currentUserId) {
      setErrorMessage("当前用户信息未初始化，请稍后重试。");
      return;
    }

    setIsRollingBackAppId(applicationId);
    setErrorMessage(null);
    try {
      const detail = await fetchApplicationDetail(accessToken, applicationId);
      const entries = detail.application.items.map((item) => {
        const normalizedBrand = item.brand?.trim() ? item.brand : "未知品牌";
        const normalizedModel = item.model?.trim() ? item.model : `SKU-${item.skuId}`;
        const normalizedName = toMaterialName(
          item.name,
          normalizedBrand,
          normalizedModel,
          item.skuId,
        );
        const normalizedSpec = item.spec?.trim() ? item.spec : "-";
        const normalizedQuantity = Math.max(1, Math.floor(item.quantity));
        const normalizedAvailable = Math.max(
          normalizedQuantity,
          Math.floor(item.availableStock),
          1,
        );
        const sku: SkuItem = {
          id: item.skuId,
          categoryId: item.categoryId,
          name: normalizedName,
          brand: normalizedBrand,
          model: normalizedModel,
          spec: normalizedSpec,
          referencePrice: item.referencePrice,
          coverUrl: item.coverUrl,
          stockMode: item.stockMode,
          safetyStockThreshold: item.safetyStockThreshold,
          availableStock: normalizedAvailable,
        };
        return {
          sku,
          quantity: normalizedQuantity,
        };
      });

      if (entries.length === 0) {
        setErrorMessage("该申请单没有可回退的物料明细。");
        return;
      }

      replaceCartItems(entries);
      navigate("/store/cart");
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "回退购物车失败。");
    } finally {
      setIsRollingBackAppId(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="我的申请说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">我的申请单</h2>
          <p className="app-shell__panel-copy">仅展示当前登录用户提交的申请。</p>
        </div>
      </section>

      {errorMessage ? (
        <div className="page-stack__messages">
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <section className="app-shell__card" aria-label="我的申请列表">
        <div className="page-card-head">
          <p className="app-shell__section-label">已提交</p>
          <h3 className="app-shell__card-title">最近申请</h3>
        </div>

        {isLoading ? (
          <p className="app-shell__card-copy">正在加载申请列表...</p>
        ) : items.length === 0 ? (
          <p className="app-shell__card-copy">
            当前没有申请记录，请先前往 <Link to="/store">领用商城</Link> 创建申请。
          </p>
        ) : (
          <ul className="dashboard-list">
            {items.map((item) => (
              <li key={item.id} className="dashboard-list__item">
                <p className="dashboard-list__title">{`\u7533\u8bf7\u5355\u53f7\uff1a${item.id} \u00b7 ${item.title}`}</p>
                <p className="dashboard-list__meta">
                  {toDateLabel(item.createdAt)} - 状态：{toApplicationStatusLabel(item.status)} - 交付方式：
                  {toDeliveryTypeLabel(item.deliveryType)}
                </p>
                <p className="dashboard-list__content">
                  取件码：{item.pickupCode} - 物料：
                  {item.itemsSummary
                    .map(
                      (entry) =>
                        `物料名称：${toMaterialName(entry.name, entry.brand, entry.model, entry.skuId)}（型号：${entry.model}，品牌：${entry.brand}）x${entry.quantity}`,
                    )
                    .join("；")}
                </p>
                <div className="page-actions">
                  <Link className="dashboard-link" to={`/applications/${item.id}`}>
                    查看详情
                  </Link>
                  {item.status === "LEADER_REJECTED" ? (
                    <button
                      className="app-shell__header-action"
                      type="button"
                      disabled={isRollingBackAppId === item.id}
                      onClick={() => {
                        void rollbackToCart(item.id);
                      }}
                    >
                      {isRollingBackAppId === item.id ? "回退中..." : "回退到购物车"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !errorMessage && totalPages > 1 ? (
          <nav className="dashboard-pagination" aria-label="我的申请分页">
            <button
              className="dashboard-pagination__btn"
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} />
              上一页
            </button>
            <span className="dashboard-pagination__label">
              第 {page} / {totalPages} 页
            </span>
            <button
              className="dashboard-pagination__btn"
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              下一页
              <ChevronRight size={16} />
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
