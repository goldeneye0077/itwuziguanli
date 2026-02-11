import {
  Navigate,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  BarChart2,
  Bot,
  Boxes,
  CheckSquare,
  ClipboardCheck,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PieChart,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  AdminCrudPage,
  AdminRbacPage,
  AnalyticsPage,
  AssetDetailPage,
  AssetLifecyclePage,
  AssetsPage,
  ApplicationDetailPage,
  ApprovalsPage,
  ApplicationsPage,
  BlueprintPlaceholderPage,
  DashboardPage,
  ForbiddenRouteState,
  InboundPage,
  InventoryPage,
  MaterialsPage,
  LoginPage,
  OutboundPage,
  PickupTicketPage,
  SessionBootState,
  StorePage,
  StoreCartPage,
  UnknownRouteState,
} from "../pages";
import { useAuthSession, type LoginInput } from "../stores";
import {
  BLUEPRINT_ROUTE_META,
  BLUEPRINT_ROUTE_META_BY_PATH,
  type AppRole,
  type BlueprintRouteMeta,
} from "./blueprint-routes";

const LOGIN_ROUTE_META = BLUEPRINT_ROUTE_META_BY_PATH["/login"];
const ROOT_ROUTE_META = BLUEPRINT_ROUTE_META_BY_PATH["/"];
const DASHBOARD_PATH = BLUEPRINT_ROUTE_META_BY_PATH["/dashboard"]?.route ?? "/dashboard";
const AUTH_UNAUTHORIZED_EVENT = "pgc-auth-unauthorized";

const PROTECTED_ROUTE_META = BLUEPRINT_ROUTE_META.filter(
  (item) => item.route !== LOGIN_ROUTE_META.route && item.route !== ROOT_ROUTE_META.route,
);

const NAV_ROUTE_META = PROTECTED_ROUTE_META.filter(
  (item) => !item.route.includes(":") && item.pageType !== "redirect",
);

const NAV_ROUTE_PATHS = NAV_ROUTE_META.map((item) => item.route);

const ROLE_LABELS: Record<AppRole, string> = {
  PUBLIC: "访客",
  USER: "普通用户",
  LEADER: "部门负责人",
  ADMIN: "管理员",
  SUPER_ADMIN: "超级管理员",
};

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "工作台",
  "/store": "领用商城",
  "/store/cart": "领用购物车",
  "/applications": "我的申请",
  "/approvals/leader": "领导审批",
  "/approvals/admin": "管理员审批",
  "/outbound": "出库执行",
  "/inbound": "物料入库",
  "/inventory": "库存管理",
  "/materials": "物料管理",
  "/assets": "我的资产",
  "/assets/return": "资产归还",
  "/assets/repair": "资产报修",
  "/assets/transfer": "资产调拨",
  "/admin/assets/scrap": "资产报废",
  "/analytics": "分析报表",
  "/copilot": "智能问答",
  "/admin/rbac": "权限治理",
  "/admin/crud": "数据面板",
};

const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/store": ShoppingBag,
  "/store/cart": ShoppingCart,
  "/applications": FileText,
  "/assets": PieChart,
  "/assets/return": RotateCcw,
  "/assets/repair": Wrench,
  "/approvals/leader": CheckSquare,
  "/approvals/admin": ClipboardCheck,
  "/outbound": LogOut,
  "/inbound": Warehouse,
  "/inventory": Boxes,
  "/materials": Package,
  "/assets/transfer": ArrowRightLeft,
  "/admin/assets/scrap": Trash2,
  "/analytics": BarChart2,
  "/copilot": Bot,
  "/admin/rbac": Shield,
  "/admin/crud": Database,
};

function getRequiredRoles(meta: BlueprintRouteMeta): AppRole[] {
  return meta.roles.filter((role) => role !== "PUBLIC");
}

function hasAnyRequiredRole(
  currentRoles: readonly AppRole[],
  requiredRoles: readonly AppRole[],
): boolean {
  if (!requiredRoles.length) {
    return true;
  }

  const roleSet = new Set(currentRoles);
  return requiredRoles.some((role) => roleSet.has(role));
}

function toRouteLabel(routePath: string): string {
  const mapped = ROUTE_LABELS[routePath];
  if (mapped) {
    return mapped;
  }

  const cleaned = routePath.replace(/^\//, "").replace(/:/g, "").replace(/-/g, " ");
  if (!cleaned) {
    return "首页";
  }

  return cleaned;
}

function toRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role;
}

function toRoleListLabel(roles: readonly AppRole[]): string {
  if (!roles.length) {
    return toRoleLabel("PUBLIC");
  }
  return roles.map(toRoleLabel).join(" / ");
}

function pathIsWithin(basePath: string, pathname: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isNavItemActive(routePath: string, pathname: string): boolean {
  if (!pathIsWithin(routePath, pathname)) {
    return false;
  }

  // Only highlight the most specific matching nav route.
  const matched = NAV_ROUTE_PATHS.filter((candidate) => pathIsWithin(candidate, pathname));
  if (matched.length === 0) {
    return false;
  }

  const longestMatch = matched.reduce((best, current) =>
    current.length > best.length ? current : best,
  );
  return routePath === longestMatch;
}

function HeaderClock(): JSX.Element {
  const [now, setNow] = useState<Date>(() => new Date());

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }),
    [],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    [],
  );

  useEffect(() => {
    function tick(): void {
      setNow(new Date());
    }

    // Keep the parent AppShellLayout stable: only this component re-renders.
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="app-shell__clock" aria-label="当前时间">
      <span className="app-shell__clock-date">{dateFormatter.format(now)}</span>
      <span className="app-shell__clock-sep" aria-hidden="true">
        ·
      </span>
      <span className="app-shell__clock-time">{timeFormatter.format(now)}</span>
    </div>
  );
}

function resolvePostLoginPath(location: ReturnType<typeof useLocation>): string {
  const state = location.state as { from?: { pathname?: string } } | null;
  const fromPath = state?.from?.pathname;
  if (!fromPath || fromPath === LOGIN_ROUTE_META.route) {
    return DASHBOARD_PATH;
  }

  return fromPath;
}

function AuthInvalidationListener(): null {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isAuthenticated, logout } = useAuthSession();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleUnauthorized(): void {
      if (!state.initialized) {
        return;
      }

      if (location.pathname === LOGIN_ROUTE_META.route) {
        return;
      }

      if (isAuthenticated) {
        void logout();
      }

      navigate(LOGIN_ROUTE_META.route, {
        replace: true,
        state: { from: { pathname: location.pathname } },
      });
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [isAuthenticated, location.pathname, logout, navigate, state.initialized]);

  return null;
}

function AppShellLayout({ children }: { readonly children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, userRoles, logout } = useAuthSession();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate(LOGIN_ROUTE_META.route, { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <img
            className="app-shell__brand-logo"
            src="/cmcc.png"
            alt="IT资产全生命周期系统"
          />
          <h1 className="app-shell__title">IT资产全生命周期系统</h1>
        </div>

        <div className="app-shell__header-meta">
          <HeaderClock />
          <span className="app-shell__status">
            {state.user?.name ?? "未知用户"} | {toRoleListLabel(userRoles)}
          </span>
          <button className="app-shell__header-action" type="button" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="app-shell__main">
        <aside className="app-shell__nav" aria-label="主导航">
          <p className="app-shell__section-label">导航</p>
          <ul className="app-shell__nav-list">
            {NAV_ROUTE_META.map((item) => {
              const isActive = isNavItemActive(item.route, location.pathname);
              const Icon = ROUTE_ICONS[item.route];
              return (
                <li key={item.route}>
                  <Link
                    to={item.route}
                    className={
                      isActive ? "app-shell__nav-item is-active" : "app-shell__nav-item"
                    }
                    aria-current={isActive ? "page" : undefined}
                  >
                    {Icon ? <Icon className="app-shell__nav-icon" aria-hidden="true" /> : null}
                    <span className="app-shell__nav-label">{toRouteLabel(item.route)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="app-shell__content" aria-label="页面内容">
          {children}
        </main>
      </div>
    </div>
  );
}

function RootRedirectRoute(): JSX.Element {
  const { state, isAuthenticated } = useAuthSession();

  if (!state.initialized) {
    return <SessionBootState />;
  }

  return (
    <Navigate
      to={isAuthenticated ? DASHBOARD_PATH : LOGIN_ROUTE_META.route}
      replace
    />
  );
}

function LoginRoute(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isAuthenticated, login, clearError } = useAuthSession();

  if (!state.initialized) {
    return <SessionBootState />;
  }

  if (isAuthenticated) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  async function handleSubmit(input: LoginInput): Promise<void> {
    clearError();
    try {
      await login(input);
      navigate(resolvePostLoginPath(location), { replace: true });
    } catch {
      // login error is stored in AuthSession state
    }
  }

  return (
    <LoginPage
      onSubmit={handleSubmit}
      isSubmitting={state.isAuthenticating}
      errorMessage={state.errorMessage}
    />
  );
}

function resolveProtectedPage(
  meta: BlueprintRouteMeta,
  currentRoles: readonly AppRole[],
): JSX.Element {
  switch (meta.route) {
    case "/dashboard":
      return <DashboardPage />;
    case "/store":
      return <StorePage />;
    case "/store/cart":
      return <StoreCartPage />;
    case "/applications":
      return <ApplicationsPage />;
    case "/applications/:id":
      return <ApplicationDetailPage />;
    case "/pickup-ticket/:applicationId":
      return <PickupTicketPage />;
    case "/approvals/leader":
      return <ApprovalsPage node="LEADER" />;
    case "/approvals/admin":
      return <ApprovalsPage node="ADMIN" />;
    case "/outbound":
      return <OutboundPage />;
    case "/inbound":
      return <InboundPage />;
    case "/inventory":
      return <InventoryPage />;
    case "/materials":
      return <MaterialsPage />;
    case "/assets":
      return <AssetsPage />;
    case "/assets/:id":
      return <AssetDetailPage />;
    case "/analytics":
    case "/copilot":
      return <AnalyticsPage routePath={meta.route} />;
    case "/admin/rbac":
      return <AdminRbacPage />;
    case "/admin/crud":
      return <AdminCrudPage />;
    case "/assets/return":
    case "/assets/repair":
    case "/assets/transfer":
    case "/admin/assets/scrap":
      return <AssetLifecyclePage routePath={meta.route} />;
    default:
      return <BlueprintPlaceholderPage meta={meta} currentRoles={currentRoles} />;
  }
}

function ProtectedRoute({ meta }: { readonly meta: BlueprintRouteMeta }): JSX.Element {
  const location = useLocation();
  const { state, isAuthenticated, userRoles } = useAuthSession();
  const requiredRoles = getRequiredRoles(meta);

  if (!state.initialized) {
    return <SessionBootState />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={LOGIN_ROUTE_META.route}
        replace
        state={{ from: { pathname: location.pathname } }}
      />
    );
  }

  if (!hasAnyRequiredRole(userRoles, requiredRoles)) {
    return (
      <AppShellLayout>
        <ForbiddenRouteState
          routePath={meta.route}
          currentRoles={userRoles}
          requiredRoles={requiredRoles}
        />
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      {resolveProtectedPage(meta, userRoles)}
    </AppShellLayout>
  );
}

function UnknownRoute(): JSX.Element {
  const { state, isAuthenticated } = useAuthSession();

  if (!state.initialized) {
    return <SessionBootState />;
  }

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_ROUTE_META.route} replace />;
  }

  return (
    <AppShellLayout>
      <UnknownRouteState />
    </AppShellLayout>
  );
}

export function AppRoutes(): JSX.Element {
  return (
    <>
      <AuthInvalidationListener />
      <Routes>
        <Route path={ROOT_ROUTE_META.route} element={<RootRedirectRoute />} />
        <Route path={LOGIN_ROUTE_META.route} element={<LoginRoute />} />
        {PROTECTED_ROUTE_META.map((meta) => (
          <Route key={meta.route} path={meta.route} element={<ProtectedRoute meta={meta} />} />
        ))}
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </>
  );
}
