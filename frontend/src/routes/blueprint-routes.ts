export type AppRole =
  | "PUBLIC"
  | "USER"
  | "LEADER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type BlueprintPageType =
  | "public-auth"
  | "redirect"
  | "dashboard"
  | "store"
  | "approval"
  | "outbound"
  | "inbound"
  | "analytics"
  | "admin-rbac"
  | "admin-crud"
  | "asset-lifecycle";

export interface BlueprintRouteMeta {
  readonly route: string;
  readonly roles: readonly AppRole[];
  readonly pageType: BlueprintPageType;
  readonly primaryActionIds: readonly string[];
}

export interface BlueprintInteractionGuardrails {
  readonly noHiddenCriticalActions: true;
  readonly destructiveActionRule: "confirm_and_reason";
  readonly permissionDeniedRule: "show_required_role";
}

export const BLUEPRINT_INTERACTION_GUARDRAILS = {
  noHiddenCriticalActions: true,
  destructiveActionRule: "confirm_and_reason",
  permissionDeniedRule: "show_required_role",
} as const satisfies BlueprintInteractionGuardrails;

export const BLUEPRINT_ROUTE_META = [
  {
    route: "/login",
    roles: ["PUBLIC"],
    pageType: "public-auth",
    primaryActionIds: ["auth.login-submit"],
  },
  {
    route: "/",
    roles: ["PUBLIC"],
    pageType: "redirect",
    primaryActionIds: ["app.redirect-dashboard"],
  },
  {
    route: "/dashboard",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "dashboard",
    primaryActionIds: ["dashboard.quick-apply"],
  },
  {
    route: "/store",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "store",
    primaryActionIds: ["store.add-sku", "store.open-checkout"],
  },
  {
    route: "/store/cart",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "store",
    primaryActionIds: ["store.submit-application"],
  },
  {
    route: "/applications",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "store",
    primaryActionIds: ["store.open-application-detail"],
  },
  {
    route: "/applications/:id",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "approval",
    primaryActionIds: ["approval.open-item"],
  },
  {
    route: "/assets",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "asset-lifecycle",
    primaryActionIds: ["asset.open-detail"],
  },
  {
    route: "/assets/:id",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "asset-lifecycle",
    primaryActionIds: ["asset.choose-lifecycle-action"],
  },
  {
    route: "/assets/return",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "asset-lifecycle",
    primaryActionIds: ["asset.submit-return"],
  },
  {
    route: "/assets/repair",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "asset-lifecycle",
    primaryActionIds: ["asset.submit-repair"],
  },
  {
    route: "/pickup-ticket/:applicationId",
    roles: ["USER", "LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "outbound",
    primaryActionIds: ["outbound.verify-ticket"],
  },
  {
    route: "/approvals/leader",
    roles: ["LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "approval",
    primaryActionIds: ["approval.leader-approve", "approval.leader-reject"],
  },
  {
    route: "/approvals/admin",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "approval",
    primaryActionIds: ["approval.admin-approve", "approval.admin-reject"],
  },
  {
    route: "/outbound",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "outbound",
    primaryActionIds: ["outbound.confirm-delivery", "outbound.ship-express"],
  },
  {
    route: "/inbound",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "inbound",
    primaryActionIds: ["inbound.confirm-inbound", "inbound.print-tag"],
  },
  {
    route: "/inventory",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "inbound",
    primaryActionIds: ["inventory.fetch-skus", "inventory.fetch-assets"],
  },
  {
    route: "/materials",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "inbound",
    primaryActionIds: ["materials.manage-categories", "materials.manage-skus"],
  },
  {
    route: "/assets/transfer",
    roles: ["LEADER", "ADMIN", "SUPER_ADMIN"],
    pageType: "asset-lifecycle",
    primaryActionIds: ["asset.submit-transfer"],
  },
  {
    route: "/admin/assets/scrap",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "asset-lifecycle",
    primaryActionIds: ["asset.submit-scrap"],
  },
  {
    route: "/analytics",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "analytics",
    primaryActionIds: ["analytics.apply-filter", "analytics.export-report"],
  },
  {
    route: "/copilot",
    roles: ["ADMIN", "SUPER_ADMIN"],
    pageType: "analytics",
    primaryActionIds: ["analytics.run-copilot"],
  },
  {
    route: "/announcements/manage",
    roles: ["SUPER_ADMIN"],
    pageType: "admin-crud",
    primaryActionIds: ["announcements.manage"],
  },
  {
    route: "/admin/rbac",
    roles: ["SUPER_ADMIN"],
    pageType: "admin-rbac",
    primaryActionIds: ["rbac.save-role-permissions"],
  },
  {
    route: "/admin/crud",
    roles: ["SUPER_ADMIN"],
    pageType: "admin-crud",
    primaryActionIds: ["crud.save-record"],
  },
] as const satisfies readonly BlueprintRouteMeta[];

export const BLUEPRINT_ROUTE_META_BY_PATH: Record<string, BlueprintRouteMeta> =
  Object.fromEntries(BLUEPRINT_ROUTE_META.map((item) => [item.route, item]));
