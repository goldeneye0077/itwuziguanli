export const PERMISSION_KEYS = {
  rbacUpdate: "RBAC_ADMIN:UPDATE",
  inventoryRead: "INVENTORY:READ",
  inventoryWrite: "INVENTORY:WRITE",
  reportsRead: "REPORTS:READ",
  outboundRead: "OUTBOUND:READ",
} as const;

export interface RoutePermissionEntry {
  readonly routePath: string;
  readonly requiredPermissions: readonly string[];
}

export interface ActionPermissionEntry {
  readonly actionId: string;
  readonly requiredPermissions: readonly string[];
}

export const ROUTE_PERMISSION_ENTRIES: readonly RoutePermissionEntry[] = [
  { routePath: "/outbound", requiredPermissions: [PERMISSION_KEYS.outboundRead] },
  { routePath: "/inbound", requiredPermissions: [PERMISSION_KEYS.inventoryRead] },
  { routePath: "/inventory", requiredPermissions: [PERMISSION_KEYS.inventoryRead] },
  { routePath: "/materials", requiredPermissions: [PERMISSION_KEYS.inventoryRead] },
  { routePath: "/analytics", requiredPermissions: [PERMISSION_KEYS.reportsRead] },
  { routePath: "/copilot", requiredPermissions: [PERMISSION_KEYS.reportsRead] },
  { routePath: "/announcements/manage", requiredPermissions: [PERMISSION_KEYS.rbacUpdate] },
  { routePath: "/admin/rbac", requiredPermissions: [PERMISSION_KEYS.rbacUpdate] },
  { routePath: "/admin/crud", requiredPermissions: [PERMISSION_KEYS.rbacUpdate] },
] as const;

export const ACTION_PERMISSION_ENTRIES: readonly ActionPermissionEntry[] = [
  { actionId: "rbac.save-role-permissions", requiredPermissions: [PERMISSION_KEYS.rbacUpdate] },
  { actionId: "crud.save-record", requiredPermissions: [PERMISSION_KEYS.rbacUpdate] },
  { actionId: "outbound.fetch-records", requiredPermissions: [PERMISSION_KEYS.outboundRead] },
  { actionId: "outbound.export-records", requiredPermissions: [PERMISSION_KEYS.outboundRead] },
  { actionId: "inbound.confirm-inbound", requiredPermissions: [PERMISSION_KEYS.inventoryWrite] },
  { actionId: "inbound.print-tag", requiredPermissions: [PERMISSION_KEYS.inventoryRead] },
  { actionId: "inventory.fetch-skus", requiredPermissions: [PERMISSION_KEYS.inventoryRead] },
  { actionId: "inventory.fetch-assets", requiredPermissions: [PERMISSION_KEYS.inventoryRead] },
  { actionId: "materials.manage-categories", requiredPermissions: [PERMISSION_KEYS.inventoryWrite] },
  { actionId: "materials.manage-skus", requiredPermissions: [PERMISSION_KEYS.inventoryWrite] },
  { actionId: "analytics.apply-filter", requiredPermissions: [PERMISSION_KEYS.reportsRead] },
  { actionId: "analytics.export-report", requiredPermissions: [PERMISSION_KEYS.reportsRead] },
  { actionId: "analytics.run-copilot", requiredPermissions: [PERMISSION_KEYS.reportsRead] },
  { actionId: "announcements.manage", requiredPermissions: [PERMISSION_KEYS.rbacUpdate] },
] as const;

const ROUTE_PERMISSION_MAP = Object.fromEntries(
  ROUTE_PERMISSION_ENTRIES.map((item) => [item.routePath, item.requiredPermissions]),
) as Record<string, readonly string[]>;

const ACTION_PERMISSION_MAP = Object.fromEntries(
  ACTION_PERMISSION_ENTRIES.map((item) => [item.actionId, item.requiredPermissions]),
) as Record<string, readonly string[]>;

let routePermissionMap: Record<string, readonly string[]> = { ...ROUTE_PERMISSION_MAP };
let actionPermissionMap: Record<string, readonly string[]> = { ...ACTION_PERMISSION_MAP };

function normalizePermission(value: string): string {
  return value.trim().toUpperCase();
}

function normalizePermissionSet(permissions: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const item of permissions) {
    const normalized = normalizePermission(item);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

function normalizePermissionList(values: readonly string[]): string[] {
  return Array.from(normalizePermissionSet(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeRouteEntries(
  entries: readonly RoutePermissionEntry[],
): Record<string, readonly string[]> {
  const map: Record<string, readonly string[]> = {};
  for (const entry of entries) {
    const routePath = entry.routePath.trim();
    if (!routePath) {
      continue;
    }
    map[routePath] = normalizePermissionList(entry.requiredPermissions);
  }
  return map;
}

function normalizeActionEntries(
  entries: readonly ActionPermissionEntry[],
): Record<string, readonly string[]> {
  const map: Record<string, readonly string[]> = {};
  for (const entry of entries) {
    const actionId = entry.actionId.trim();
    if (!actionId) {
      continue;
    }
    map[actionId] = normalizePermissionList(entry.requiredPermissions);
  }
  return map;
}

export function applyPermissionMappingConfig(config: {
  readonly routes: readonly RoutePermissionEntry[];
  readonly actions: readonly ActionPermissionEntry[];
}): void {
  const nextRouteMap = normalizeRouteEntries(config.routes);
  const nextActionMap = normalizeActionEntries(config.actions);
  routePermissionMap =
    Object.keys(nextRouteMap).length > 0 ? nextRouteMap : { ...ROUTE_PERMISSION_MAP };
  actionPermissionMap =
    Object.keys(nextActionMap).length > 0 ? nextActionMap : { ...ACTION_PERMISSION_MAP };
}

export function resetPermissionMappingConfig(): void {
  routePermissionMap = { ...ROUTE_PERMISSION_MAP };
  actionPermissionMap = { ...ACTION_PERMISSION_MAP };
}

export function getRoutePermissionEntries(): RoutePermissionEntry[] {
  return Object.entries(routePermissionMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([routePath, requiredPermissions]) => ({
      routePath,
      requiredPermissions: [...requiredPermissions],
    }));
}

export function getActionPermissionEntries(): ActionPermissionEntry[] {
  return Object.entries(actionPermissionMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([actionId, requiredPermissions]) => ({
      actionId,
      requiredPermissions: [...requiredPermissions],
    }));
}

export function isSuperAdminRole(roles: readonly string[]): boolean {
  return roles.includes("SUPER_ADMIN");
}

export function hasAnyPermission(
  userPermissions: readonly string[],
  requiredPermissions: readonly string[],
): boolean {
  if (!requiredPermissions.length) {
    return true;
  }
  const granted = normalizePermissionSet(userPermissions);
  return requiredPermissions.some((permission) =>
    granted.has(normalizePermission(permission)),
  );
}

export function hasRoutePermission(
  routePath: string,
  roles: readonly string[],
  userPermissions: readonly string[],
): boolean {
  const required = routePermissionMap[routePath] ?? [];
  if (!required.length) {
    return true;
  }
  if (isSuperAdminRole(roles)) {
    return true;
  }
  return hasAnyPermission(userPermissions, required);
}

export function hasActionPermission(
  actionId: string,
  roles: readonly string[],
  userPermissions: readonly string[],
): boolean {
  const required = actionPermissionMap[actionId] ?? [];
  if (!required.length) {
    return true;
  }
  if (isSuperAdminRole(roles)) {
    return true;
  }
  return hasAnyPermission(userPermissions, required);
}

export function resolveRoutePermissions(routePath: string): readonly string[] {
  return routePermissionMap[routePath] ?? [];
}

export function resolveActionPermissions(actionId: string): readonly string[] {
  return actionPermissionMap[actionId] ?? [];
}
