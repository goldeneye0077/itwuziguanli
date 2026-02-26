import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingBag,
  Wrench,
  RotateCcw,
  Box,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

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

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>正在加载工作台数据...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="dashboard-error">
        <p>{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Hero Banner */}
      <section className="dashboard-hero" aria-label="首页横幅">
        <div className="page-panel-head">
          {hero ? (
            <>
              <h2 className="app-shell__panel-title">{hero.title}</h2>
              <p className="app-shell__panel-copy">{hero.subtitle || "暂无副标题。"}</p>
            </>
          ) : null}
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          {/* Announcements */}
          <section className="dashboard-card" aria-label="公告栏">
            <div className="dashboard-card__header">
              <span className="app-shell__section-label">公告栏</span>
              <h3 className="app-shell__card-title">最新公告</h3>
            </div>
            <div className="dashboard-card__content">
              {!announcements || announcements.items.length === 0 ? (
                <p className="app-shell__card-copy">当前暂无公告。</p>
              ) : (
                <>
                  <ul className="dashboard-list">
                    {announcements.items.map((item) => (
                      <li key={item.id} className="dashboard-list__item">
                        <div className="dashboard-list__main">
                          <p className="dashboard-list__title">{item.title}</p>
                        </div>
                        <span className="dashboard-list__meta">{toDateLabel(item.publishedAt)}</span>
                      </li>
                    ))}
                  </ul>
                  <nav className="dashboard-pagination" aria-label="公告分页">
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
                </>
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="dashboard-card" aria-label="快捷操作">
            <div className="dashboard-card__header">
              <span className="app-shell__section-label">快捷操作</span>
              <h3 className="app-shell__card-title">快速发起流程</h3>
            </div>
            <div className="dashboard-card__content dashboard-actions-grid">
              <Link to="/store" className="dashboard-action-card action-blue">
                <div className="dashboard-action-icon">
                  <ShoppingBag size={24} />
                </div>
                <div className="dashboard-action-info">
                  <h4>我要领用</h4>
                  <p>申请新资产</p>
                </div>
              </Link>
              <Link to="/applications" className="dashboard-action-card action-purple">
                <div className="dashboard-action-icon">
                  <ClipboardList size={24} />
                </div>
                <div className="dashboard-action-info">
                  <h4>我的申请</h4>
                  <p>查看申请进度</p>
                </div>
              </Link>
              <Link to="/assets/repair" className="dashboard-action-card action-red">
                <div className="dashboard-action-icon">
                  <Wrench size={24} />
                </div>
                <div className="dashboard-action-info">
                  <h4>故障报修</h4>
                  <p>设备维修申请</p>
                </div>
              </Link>
              <Link to="/assets/return" className="dashboard-action-card action-green">
                <div className="dashboard-action-icon">
                  <RotateCcw size={24} />
                </div>
                <div className="dashboard-action-info">
                  <h4>资产归还</h4>
                  <p>退还闲置资产</p>
                </div>
              </Link>
            </div>
          </section>
        </div>

        <div className="dashboard-grid__side">
          {/* My Assets */}
          <section className="dashboard-card dashboard-assets-card" aria-label="我的资产">
            <div className="dashboard-card__header">
              <span className="app-shell__section-label">我的资产</span>
              <h3 className="app-shell__card-title">在用资产</h3>
            </div>
            <div className="dashboard-card__content dashboard-assets-content">
              {!assets || assets.length === 0 ? (
                <div className="dashboard-empty-state">
                  <div className="dashboard-empty-icon">
                    <Box size={32} />
                    <span className="dashboard-empty-badge">0</span>
                  </div>
                  <h4>当前没有分配中的资产</h4>
                  <p>您当前名下没有任何在用资产。<br />如需申请，请点击“我要领用”。</p>
                  <Link to="/store" className="dashboard-btn-primary">
                    去领用
                  </Link>
                </div>
              ) : (
                <ul className="dashboard-list">
                  {assets.map((item) => (
                    <li key={item.id} className="dashboard-list__item">
                      <div className="dashboard-list__main">
                        <p className="dashboard-list__title">{item.assetTag}</p>
                        <p className="dashboard-list__subtitle">SN: {item.sn}</p>
                      </div>
                      <span className="dashboard-list__status">{toAssetStatusLabel(item.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
