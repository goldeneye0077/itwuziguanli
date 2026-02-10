import { Link } from "react-router-dom";

import { readSubmittedApplications } from "./m02-storage";
import { toApplicationStatusLabel, toDateLabel, toDeliveryTypeLabel } from "./page-helpers";

export function ApplicationsPage(): JSX.Element {
  const applications = readSubmittedApplications();

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="我的申请说明">
        <div className="page-panel-head">
          <p className="app-shell__section-label">M02 我的申请</p>
          <h2 className="app-shell__panel-title">我的申请单</h2>
          <p className="app-shell__panel-copy">
            当前页面展示本会话提交的申请记录。
          </p>
        </div>
      </section>

      <section className="app-shell__card" aria-label="我的申请列表">
        <div className="page-card-head">
          <p className="app-shell__section-label">已提交</p>
          <h3 className="app-shell__card-title">最近申请</h3>
        </div>
        {applications.length === 0 ? (
          <p className="app-shell__card-copy">
            当前会话暂无申请，请先前往 <Link to="/store">领用商城</Link> 创建申请。
          </p>
        ) : (
          <ul className="dashboard-list">
            {applications.map((item) => (
              <li key={item.id} className="dashboard-list__item">
                <p className="dashboard-list__title">
                  申请单 #{item.id} · {toApplicationStatusLabel(item.status)}
                </p>
                <p className="dashboard-list__meta">
                  {toDateLabel(item.createdAt)} · 交付方式：{toDeliveryTypeLabel(item.deliveryType)}
                </p>
                <p className="dashboard-list__content">
                  取件码：{item.pickupCode} · 条目数：{item.items.length} · 锁定资产：
                  {item.lockedAssetIds.length}
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
