import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  AuthApiError,
  fetchAnnouncements,
  fetchDashboardHero,
  fetchMyAssets,
  type AnnouncementList,
  type DashboardHero,
  type MyAssetItem,
} from "../api";
import { useAuthSession } from "../stores";
import { toAssetStatusLabel, toDateLabel } from "./page-helpers";

const ANNOUNCEMENT_PAGE_SIZE = 5;

export function DashboardPage(): JSX.Element {
  const { state } = useAuthSession();
  const accessToken = state.accessToken;

  const [hero, setHero] = useState<DashboardHero | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementList | null>(null);
  const [assets, setAssets] = useState<MyAssetItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboard(): Promise<void> {
      if (!accessToken) {
        if (!isCancelled) {
          setErrorMessage("会话令牌缺失，请重新登录。");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [heroResult, announcementResult, assetResult] = await Promise.all([
          fetchDashboardHero(accessToken),
          fetchAnnouncements(accessToken, page, ANNOUNCEMENT_PAGE_SIZE),
          fetchMyAssets(accessToken),
        ]);

        if (isCancelled) {
          return;
        }

        setHero(heroResult);
        setAnnouncements(announcementResult);
        setAssets(assetResult);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof AuthApiError
            ? error.message
            : "加载工作台数据失败。";
        setErrorMessage(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      isCancelled = true;
    };
  }, [accessToken, page]);

  const totalPages = useMemo(() => {
    if (!announcements) {
      return 1;
    }
    return Math.max(1, Math.ceil(announcements.meta.total / announcements.meta.pageSize));
  }, [announcements]);

  return (
    <div className="page-stack">
      <section className="dashboard-hero app-shell__panel" aria-label="首页横幅">
        <div className="page-panel-head">
          <p className="app-shell__section-label">首页横幅</p>
          {!isLoading && !errorMessage && hero ? (
            <>
              <h2 className="app-shell__panel-title">{hero.title}</h2>
              <p className="app-shell__panel-copy">{hero.subtitle || "暂无副标题。"}</p>
            </>
          ) : null}
        </div>
        {isLoading ? (
          <p className="app-shell__panel-copy">正在加载首页横幅...</p>
        ) : errorMessage ? (
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        ) : hero ? (
          <>
            <div className="dashboard-hero__actions">
              {hero.linkUrl ? (
                <Link className="dashboard-link" to={hero.linkUrl}>
                  查看活动
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <p className="app-shell__panel-copy">暂无横幅内容。</p>
        )}
      </section>

      <section className="app-shell__grid" aria-label="工作台区块">
        <article className="app-shell__card" aria-label="公告栏">
          <div className="page-card-head">
            <p className="app-shell__section-label">公告栏</p>
            <h3 className="app-shell__card-title">最新公告</h3>
          </div>
          {isLoading ? (
            <p className="app-shell__card-copy">正在加载公告...</p>
          ) : errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : !announcements || announcements.items.length === 0 ? (
            <p className="app-shell__card-copy">当前暂无公告。</p>
          ) : (
            <>
              <ul className="dashboard-list">
                {announcements.items.map((item) => (
                  <li key={item.id} className="dashboard-list__item">
                    <p className="dashboard-list__title">{item.title}</p>
                    <p className="dashboard-list__meta">{toDateLabel(item.publishedAt)}</p>
                    <p className="dashboard-list__content">{item.content}</p>
                  </li>
                ))}
              </ul>
              <nav className="dashboard-pagination" aria-label="公告分页">
                <button
                  className="app-shell__header-action"
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  上一页
                </button>
                <span className="dashboard-pagination__label">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  className="app-shell__header-action"
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                >
                  下一页
                </button>
              </nav>
            </>
          )}
        </article>

        <article className="app-shell__card" aria-label="我的资产">
          <div className="page-card-head">
            <p className="app-shell__section-label">我的资产</p>
            <h3 className="app-shell__card-title">在用资产</h3>
          </div>
          {isLoading ? (
            <p className="app-shell__card-copy">正在加载资产...</p>
          ) : errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : !assets || assets.length === 0 ? (
            <p className="app-shell__card-copy">当前没有分配中的资产。</p>
          ) : (
            <ul className="dashboard-list">
              {assets.map((item) => (
                <li key={item.id} className="dashboard-list__item">
                  <p className="dashboard-list__title">{item.assetTag}</p>
                  <p className="dashboard-list__meta">序列号：{item.sn}</p>
                  <p className="dashboard-list__content">状态：{toAssetStatusLabel(item.status)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="app-shell__card" aria-label="快捷操作">
          <div className="page-card-head">
            <p className="app-shell__section-label">快捷操作</p>
            <h3 className="app-shell__card-title">快速发起流程</h3>
          </div>
          <div className="dashboard-actions">
            <Link className="dashboard-link" to="/store">
              我要领用
            </Link>
            <Link className="dashboard-link" to="/assets/repair">
              故障报修
            </Link>
            <Link className="dashboard-link" to="/assets/return">
              资产归还
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
