import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AuthApiError, fetchMyApplications, type MyApplicationSummary } from "../api";
import { useAuthSession } from "../stores";
import { toApplicationStatusLabel, toDateLabel, toDeliveryTypeLabel } from "./page-helpers";

export function ApplicationsPage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const [items, setItems] = useState<MyApplicationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadApplications = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setIsLoading(false);
      setErrorMessage("会话令牌缺失，请重新登录。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchMyApplications(accessToken, { page: 1, pageSize: 50 });
      setItems(result.items);
    } catch (error) {
      setErrorMessage(error instanceof AuthApiError ? error.message : "加载我的申请失败。");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="我的申请说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M02 我的申请</p>
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
                <p className="dashboard-list__title">{item.title}</p>
                <p className="dashboard-list__meta">
                  {toDateLabel(item.createdAt)} - 状态：{toApplicationStatusLabel(item.status)} - 交付方式：
                  {toDeliveryTypeLabel(item.deliveryType)}
                </p>
                <p className="dashboard-list__content">
                  取件码：{item.pickupCode} - 物料：
                  {item.itemsSummary.map((entry) => `${entry.brand} ${entry.model} x${entry.quantity}`).join("、")}
                </p>
                <Link className="dashboard-link" to={`/applications/${item.id}`}>
                  查看详情
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
