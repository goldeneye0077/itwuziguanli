import { useState, type FormEvent } from "react";

import {
  BLUEPRINT_INTERACTION_GUARDRAILS,
  type AppRole,
  type BlueprintPageType,
  type BlueprintInteractionGuardrails,
  type BlueprintRouteMeta,
} from "../routes/blueprint-routes";
import type { LoginInput } from "../stores";
import { toRoleLabel } from "./page-helpers";

const PAGE_TYPE_COPY: Record<
  BlueprintPageType,
  { readonly title: string; readonly description: string }
> = {
  "public-auth": {
    title: "登录鉴权入口",
    description: "系统统一登录入口。",
  },
  redirect: {
    title: "首页跳转路由",
    description: "根据会话状态自动跳转至默认页面。",
  },
  dashboard: {
    title: "工作台总览",
    description: "展示运营看板、公告信息和快捷入口。",
  },
  store: {
    title: "领用商城",
    description: "用于目录浏览、购物车结算和领用申请发起。",
  },
  approval: {
    title: "审批工作台",
    description: "支持领导与管理员审批流并保留审计轨迹。",
  },
  outbound: {
    title: "出库控制台",
    description: "用于领用核验与物流发货处理。",
  },
  inbound: {
    title: "入库控制台",
    description: "支持单据识别辅助入库与库存管理。",
  },
  analytics: {
    title: "数据分析中心",
    description: "用于趋势分析与智能问答。",
  },
  "admin-rbac": {
    title: "角色权限治理",
    description: "为高权限管理员提供角色与权限治理能力。",
  },
  "admin-crud": {
    title: "后台数据管理",
    description: "提供高密度运营数据查询与管理能力。",
  },
  "asset-lifecycle": {
    title: "资产生命周期管理",
    description: "支持归还、报修、调拨、报废等生命周期操作。",
  },
};

const PAGE_TYPE_LABELS: Record<BlueprintPageType, string> = {
  "public-auth": "登录鉴权",
  redirect: "跳转",
  dashboard: "工作台",
  store: "领用商城",
  approval: "审批",
  outbound: "出库",
  inbound: "入库",
  analytics: "分析报表",
  "admin-rbac": "权限治理",
  "admin-crud": "数据面板",
  "asset-lifecycle": "资产生命周期",
};

const PERMISSION_GUARD_RULE_LABELS: Record<
  BlueprintInteractionGuardrails["permissionDeniedRule"],
  string
> = {
  show_required_role: "显示所需角色",
};

function toRoleList(roles: readonly AppRole[]): string {
  if (!roles.length) {
    return "无";
  }

  return roles.map(toRoleLabel).join(" / ");
}

interface LoginPageProps {
  readonly onSubmit: (input: LoginInput) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
}

export function LoginPage({
  onSubmit,
  isSubmitting,
  errorMessage,
}: LoginPageProps): JSX.Element {
  const [employeeNo, setEmployeeNo] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedEmployeeNo = employeeNo.trim();
    if (!normalizedEmployeeNo || !password) {
      setValidationError("请输入工号和密码。");
      return;
    }

    setValidationError(null);
    await onSubmit({
      employeeNo: normalizedEmployeeNo,
      password,
    });
  }

  return (
    <main className="auth-view" aria-label="登录工作区">
      <section className="auth-card">
        <h1 className="auth-title">登录 IT 资产全生命周期系统</h1>
        <p className="auth-copy">
          当前已启用会话安全校验，登录后可访问对应角色权限页面。
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field" htmlFor="employee-no">
            工号
          </label>
          <input
            id="employee-no"
            className="auth-input"
            value={employeeNo}
            autoComplete="username"
            onChange={(event) => setEmployeeNo(event.target.value)}
            disabled={isSubmitting}
          />

          <label className="auth-field" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            className="auth-input"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />

          {(validationError || errorMessage) && (
            <p className="auth-error" role="alert">
              {validationError ?? errorMessage}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}

interface BlueprintPlaceholderPageProps {
  readonly meta: BlueprintRouteMeta;
  readonly currentRoles: readonly AppRole[];
}

export function BlueprintPlaceholderPage({
  meta,
  currentRoles,
}: BlueprintPlaceholderPageProps): JSX.Element {
  const copy = PAGE_TYPE_COPY[meta.pageType];

  return (
    <>
      <section className="app-shell__panel" aria-label="页面蓝图占位">
        <p className="app-shell__section-label">{PAGE_TYPE_LABELS[meta.pageType] ?? meta.pageType}</p>
        <h2 className="app-shell__panel-title">{copy.title}</h2>
        <p className="app-shell__panel-copy">{copy.description}</p>
      </section>

      <section className="app-shell__grid" aria-label="路由契约详情">
        <article className="app-shell__card">
          <p className="app-shell__section-label">路由契约</p>
          <h3 className="app-shell__card-title">{meta.route}</h3>
          <p className="app-shell__card-copy">
            所需角色：{toRoleList(meta.roles.filter((role) => role !== "PUBLIC"))}
          </p>
          <p className="app-shell__card-copy">当前角色：{toRoleList(currentRoles)}</p>
        </article>

        <article className="app-shell__card">
          <p className="app-shell__section-label">主操作标识</p>
          <h3 className="app-shell__card-title">交互锚点</h3>
          <ul className="meta-list" aria-label="主操作标识列表">
            {meta.primaryActionIds.map((actionId) => (
              <li key={actionId} className="meta-list__item">
                <code>{actionId}</code>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  );
}

interface ForbiddenRouteStateProps {
  readonly routePath: string;
  readonly currentRoles: readonly AppRole[];
  readonly requiredRoles: readonly AppRole[];
  readonly currentPermissions?: readonly string[];
  readonly requiredPermissions?: readonly string[];
}

export function ForbiddenRouteState({
  routePath,
  currentRoles,
  requiredRoles,
  currentPermissions = [],
  requiredPermissions = [],
}: ForbiddenRouteStateProps): JSX.Element {
  const currentPermissionLabel = currentPermissions.length
    ? currentPermissions.join(" / ")
    : "无";
  const requiredPermissionLabel = requiredPermissions.length
    ? requiredPermissions.join(" / ")
    : "无";

  return (
    <section className="forbidden-state" role="alert" aria-live="polite">
      <p className="app-shell__section-label">访问受限</p>
      <h2 className="forbidden-state__title">你没有访问 {routePath} 的权限。</h2>
      <p className="forbidden-state__copy">
        当前角色：<strong>{toRoleList(currentRoles)}</strong>
      </p>
      <p className="forbidden-state__copy">
        所需角色：<strong>{toRoleList(requiredRoles)}</strong>
      </p>
      <p className="forbidden-state__copy">
        当前权限：<strong>{currentPermissionLabel}</strong>
      </p>
      <p className="forbidden-state__copy">
        所需权限：<strong>{requiredPermissionLabel}</strong>
      </p>
      <p className="forbidden-state__copy">
        权限守卫规则：
        <code>{PERMISSION_GUARD_RULE_LABELS[BLUEPRINT_INTERACTION_GUARDRAILS.permissionDeniedRule]}</code>
      </p>
      <p className="forbidden-state__copy">
        如需开通权限，请联系平台管理员处理角色分配。
      </p>
    </section>
  );
}

export function SessionBootState(): JSX.Element {
  return (
    <main className="auth-view" aria-label="会话恢复中">
      <section className="auth-card">
        <h1 className="auth-title">正在恢复会话上下文...</h1>
        <p className="auth-copy">正在校验本地会话状态，请稍候。</p>
      </section>
    </main>
  );
}

export function UnknownRouteState(): JSX.Element {
  return (
    <section className="forbidden-state">
      <p className="app-shell__section-label">路由不存在</p>
      <h2 className="forbidden-state__title">当前路径未在路由配置中注册。</h2>
      <p className="forbidden-state__copy">
        请从左侧导航返回已配置页面。
      </p>
    </section>
  );
}
