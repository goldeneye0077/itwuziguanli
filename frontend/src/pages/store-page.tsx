import { useEffect, useMemo, useState } from "react";

import {
  AuthApiError,
  fetchCategoryTree,
  fetchSkus,
  type CategoryTreeNode,
  type SkuList,
} from "../api";
import { useAuthSession } from "../stores";
import { useM02Cart } from "./m02-cart";
import { StoreCheckoutSidebar } from "./store-checkout-sidebar";

const EMPTY_SKU_LIST: SkuList = {
  items: [],
  meta: {
    page: 1,
    pageSize: 9,
    total: 0,
  },
};

function flattenCategoryTree(tree: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  const walk = (nodes: CategoryTreeNode[]) => {
    nodes.forEach((node) => {
      result.push(node);
      walk(node.children);
    });
  };
  walk(tree);
  return result;
}

export function StorePage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;
  const currentUserId = state.user?.id ?? null;

  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [skuList, setSkuList] = useState<SkuList>(EMPTY_SKU_LIST);
  const [isLoading, setIsLoading] = useState(true);
  const [isSkuLoading, setIsSkuLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { cartItems, cartTotalQuantity, addSkuToCart, setCartQuantity, clearCart } =
    useM02Cart(currentUserId);
  const allCategories = useMemo(() => flattenCategoryTree(categories), [categories]);

  useEffect(() => {
    let cancelled = false;

    async function loadBaseData(): Promise<void> {
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
        const categoryResult = await fetchCategoryTree(accessToken);
        if (cancelled) {
          return;
        }
        setCategories(categoryResult);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setErrorMessage(
          error instanceof AuthApiError ? error.message : "加载商城基础数据失败。",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBaseData();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadSkus(): Promise<void> {
      if (!accessToken) {
        return;
      }
      setIsSkuLoading(true);
      try {
        const result = await fetchSkus(accessToken, {
          categoryId: selectedCategoryId,
          keyword,
          page,
          pageSize: 9,
        });
        if (!cancelled) {
          setSkuList(result);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof AuthApiError ? error.message : "加载物料列表失败。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsSkuLoading(false);
        }
      }
    }

    void loadSkus();

    return () => {
      cancelled = true;
    };
  }, [accessToken, keyword, page, selectedCategoryId]);

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="商城筛选区">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">物资领用商城</h2>
          <p className="app-shell__panel-copy">
            按分类浏览物料，加入购物车后可在右侧结算区进行智能预检与提交申请。
          </p>
        </div>
        <div className="store-filters page-toolbar">
          <label className="store-field">
            分类
            <select
              value={selectedCategoryId ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                setSelectedCategoryId(raw ? Number(raw) : undefined);
                setPage(1);
              }}
            >
              <option value="">全部</option>
              {allCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="store-field">
            关键词
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="品牌 / 型号 / 规格"
            />
          </label>

          <button
            className="app-shell__header-action"
            type="button"
            onClick={() => {
              setKeyword(keywordInput.trim() || undefined);
              setPage(1);
            }}
          >
            搜索
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="page-stack__messages">
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <section className="store-shell" aria-label="商城内容区">
        <div className="store-shell__catalog">
          <div className="store-shell__catalog-head">
            <div className="store-breadcrumb" aria-label="目录位置">
              <span className="store-breadcrumb__label">物料目录</span>
              <span className="store-breadcrumb__sep" aria-hidden="true">
                ·
              </span>
              <span className="store-breadcrumb__current">可领用物料</span>
            </div>
          </div>

          {isLoading || isSkuLoading ? (
            <ul className="store-card-grid" aria-label="加载中">
              {Array.from({ length: 6 }).map((_, index) => (
                <li key={index} className="store-item-card is-skeleton" aria-hidden="true">
                  <div className="store-item-media" />
                  <div className="store-item-body">
                    <div className="store-item-skeleton-line is-wide" />
                    <div className="store-item-skeleton-line" />
                    <div className="store-item-skeleton-pill" />
                  </div>
                  <div className="store-item-footer">
                    <div className="store-item-skeleton-button" />
                  </div>
                </li>
              ))}
            </ul>
          ) : skuList.items.length === 0 ? (
            <p className="app-shell__panel-copy">当前筛选条件下未找到物料。</p>
          ) : (
            <ul className="store-card-grid" aria-label="可领用物料列表">
              {skuList.items.map((item) => (
                <li key={item.id} className="store-item-card">
                  <div className="store-item-media">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={`${item.brand} ${item.model}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="store-item-placeholder" aria-hidden="true" />
                    )}
                  </div>
                  <div className="store-item-body">
                    <h4 className="store-item-title">
                      {item.brand} {item.model}
                    </h4>
                    <p className="store-item-meta">规格：{item.spec}</p>
                    <p
                      className={
                        item.availableStock > 0
                          ? "store-item-badge is-instock"
                          : "store-item-badge is-out"
                      }
                    >
                      {item.availableStock > 0
                        ? `可用库存：${item.availableStock}`
                        : "无库存"}
                    </p>
                  </div>
                  <div className="store-item-footer">
                    <button
                      className="auth-submit store-item-action"
                      type="button"
                      disabled={item.availableStock <= 0}
                      onClick={() => addSkuToCart(item)}
                    >
                      加入购物车
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="dashboard-pagination store-pagination">
            <button
              className="app-shell__header-action"
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              上一页
            </button>
            <span className="dashboard-pagination__label">
              第 {page} / {Math.max(1, Math.ceil(skuList.meta.total / skuList.meta.pageSize))} 页
            </span>
            <button
              className="app-shell__header-action"
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    Math.max(1, Math.ceil(skuList.meta.total / skuList.meta.pageSize)),
                    current + 1,
                  ),
                )
              }
              disabled={page >= Math.max(1, Math.ceil(skuList.meta.total / skuList.meta.pageSize))}
            >
              下一页
            </button>
          </div>
        </div>

        <aside className="store-shell__sidebar" aria-label="结算侧栏">
          <StoreCheckoutSidebar
            accessToken={accessToken ?? null}
            cartItems={cartItems}
            cartTotalQuantity={cartTotalQuantity}
            setCartQuantity={setCartQuantity}
            clearCart={clearCart}
          />
        </aside>
      </section>
    </div>
  );
}
