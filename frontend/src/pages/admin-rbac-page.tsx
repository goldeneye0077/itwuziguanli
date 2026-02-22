import { useCallback, useEffect, useMemo, useState } from "react";

import {
  bindAdminRbacRolePermissions,
  createAdminRbacRole,
  fetchAdminCrudResource,
  fetchAdminRbacPermissions,
  fetchAdminRbacRoles,
  fetchAdminUserRoles,
  fetchRbacUiGuards,
  replaceAdminRbacUiGuards,
  replaceAdminUserRoles,
  type AdminRbacPermission,
  type AdminRbacRole,
} from "../api";
import { applyPermissionMappingConfig, hasActionPermission } from "../permissions";
import { BLUEPRINT_ROUTE_META } from "../routes/blueprint-routes";
import { useAuthSession } from "../stores";
import { toErrorMessage, toRoleListLabel } from "./page-helpers";

interface UiGuardEditorRow {
  readonly key: string;
  readonly requiredPermissionsText: string;
}

interface RbacUserOption {
  readonly id: number;
  readonly employeeNo: string;
  readonly name: string;
  readonly departmentName: string;
}

interface PermissionUsageRow {
  readonly key: string;
  readonly label: string;
  readonly permissionCode: string;
  readonly permissionName: string;
}

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "工作台",
  "/store": "领用商城",
  "/store/cart": "领用购物车",
  "/applications": "我的申请",
  "/assets": "我的资产",
  "/inbound": "物料入库",
  "/inventory": "库存管理",
  "/materials": "物料管理",
  "/analytics": "分析报表",
  "/copilot": "智能问答",
  "/admin/rbac": "权限治理",
  "/admin/crud": "数据面板",
};

const ACTION_LABELS: Record<string, string> = {
  "rbac.save-role-permissions": "保存角色权限绑定",
  "crud.save-record": "保存数据记录",
  "outbound.fetch-records": "查询出库记录",
  "outbound.export-records": "导出出库记录",
  "inbound.confirm-inbound": "确认物料入库",
  "inbound.print-tag": "打印标签",
  "inventory.fetch-skus": "查询物料",
  "inventory.fetch-assets": "查询资产",
  "materials.manage-categories": "维护分类",
  "materials.manage-skus": "维护物料",
  "analytics.apply-filter": "应用筛选",
  "analytics.export-report": "导出报表",
  "analytics.run-copilot": "执行智能问答",
};

const ROUTE_CANDIDATE_KEYS = Array.from(
  new Set(BLUEPRINT_ROUTE_META.map((item) => item.route)),
).sort((left, right) => left.localeCompare(right));

const ACTION_CANDIDATE_KEYS = Array.from(
  new Set(BLUEPRINT_ROUTE_META.flatMap((item) => item.primaryActionIds)),
).sort((left, right) => left.localeCompare(right));

function normalizePermissionInput(value: string): string[] {
  const set = new Set(
    value
      .split(/[\n,\s]+/)
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0),
  );
  return Array.from(set).sort((left, right) => left.localeCompare(right));
}

function formatPermissionInput(value: readonly string[]): string {
  return value.join(", ");
}

function sortGuardRows(rows: readonly UiGuardEditorRow[]): UiGuardEditorRow[] {
  return [...rows].sort((left, right) => left.key.localeCompare(right.key));
}

function toGuardRows(
  items: ReadonlyArray<{ readonly key: string; readonly requiredPermissions: readonly string[] }>,
): UiGuardEditorRow[] {
  return sortGuardRows(
    items.map((item) => ({
      key: item.key,
      requiredPermissionsText: formatPermissionInput(item.requiredPermissions),
    })),
  );
}

function ensureValidGuardRows(
  rows: readonly UiGuardEditorRow[],
  kindLabel: string,
): UiGuardEditorRow[] {
  const seen = new Set<string>();
  const normalized: UiGuardEditorRow[] = [];
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) {
      throw new Error(`${kindLabel}映射存在空 key，请先补全。`);
    }
    if (seen.has(key)) {
      throw new Error(`${kindLabel}映射存在重复 key：${key}`);
    }
    seen.add(key);
    normalized.push({ key, requiredPermissionsText: row.requiredPermissionsText.trim() });
  }
  return sortGuardRows(normalized);
}

function permissionCode(resource: string, action: string): string {
  return `${resource}:${action}`.toUpperCase();
}

function roleToPermissionCodes(role: AdminRbacRole | null): string[] {
  if (!role) {
    return [];
  }
  const set = new Set<string>();
  for (const permission of role.permissions) {
    set.add(permissionCode(permission.resource, permission.action));
  }
  return Array.from(set).sort((left, right) => left.localeCompare(right));
}

function permissionCodesToBindingGroups(
  codes: readonly string[],
): Array<{ resource: string; actions: string[] }> {
  const grouped = new Map<string, Set<string>>();
  for (const code of codes) {
    const normalized = code.trim().toUpperCase();
    const separatorIndex = normalized.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
      continue;
    }
    const resource = normalized.slice(0, separatorIndex);
    const action = normalized.slice(separatorIndex + 1);
    if (!grouped.has(resource)) {
      grouped.set(resource, new Set<string>());
    }
    grouped.get(resource)?.add(action);
  }
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions).sort((left, right) => left.localeCompare(right)),
    }));
}

function formatRoleBindingsFromGroups(
  groups: Array<{ resource: string; actions: string[] }>,
): string {
  if (!groups.length) {
    return "";
  }
  return groups.map((item) => `${item.resource}=${item.actions.join(",")}`).join("\n");
}

function formatRoleBindings(role: AdminRbacRole | null): string {
  if (!role || !role.permissions.length) {
    return "";
  }

  const grouped = new Map<string, Set<string>>();
  for (const permission of role.permissions) {
    if (!grouped.has(permission.resource)) {
      grouped.set(permission.resource, new Set<string>());
    }
    grouped.get(permission.resource)?.add(permission.action);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, actions]) => `${resource}=${Array.from(actions).sort().join(",")}`)
    .join("\n");
}

function parseRoleBindingsEditor(
  source: string,
): Array<{ resource: string; actions: string[] }> {
  const lines = source
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (!lines.length) {
    return [];
  }

  const grouped = new Map<string, Set<string>>();
  for (const line of lines) {
    const separatorIndex = line.includes("=") ? line.indexOf("=") : line.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex >= line.length - 1) {
      throw new Error(`绑定行格式不正确：${line}`);
    }

    const rawResource = line.slice(0, separatorIndex).trim().toUpperCase();
    const rawActions = line.slice(separatorIndex + 1).trim();
    const actions = rawActions
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0);

    if (!rawResource || !actions.length) {
      throw new Error(`绑定行格式不正确：${line}`);
    }

    if (!grouped.has(rawResource)) {
      grouped.set(rawResource, new Set<string>());
    }
    const actionSet = grouped.get(rawResource);
    for (const action of actions) {
      actionSet?.add(action);
    }
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions).sort((left, right) => left.localeCompare(right)),
    }));
}

function normalizeRoleKeys(values: readonly string[]): string[] {
  const roleSet = new Set(
    values
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0),
  );
  return Array.from(roleSet).sort((left, right) => left.localeCompare(right));
}

function mapCrudUserToOption(item: Record<string, unknown>): RbacUserOption | null {
  const rawId = item.id;
  const id = typeof rawId === "number" ? rawId : Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  const employeeNo = String(item.employee_no ?? "").trim();
  const name = String(item.name ?? "").trim();
  const departmentName = String(item.department_name ?? "").trim();
  if (!employeeNo || !name) {
    return null;
  }
  return {
    id,
    employeeNo,
    name,
    departmentName,
  };
}

function toUserOptionLabel(user: RbacUserOption): string {
  const department = user.departmentName || "未设置部门";
  return `${user.employeeNo} - ${user.name}（${department}）`;
}

function toRouteGuardLabel(key: string): string {
  const label = ROUTE_LABELS[key];
  return label ? `${label}（${key}）` : key;
}

function toActionGuardLabel(key: string): string {
  const label = ACTION_LABELS[key];
  return label ? `${label}（${key}）` : key;
}

export function AdminRbacPage(): JSX.Element {
  const { state, userRoles, userPermissions } = useAuthSession();
  const accessToken = state.accessToken;
  const canManageRbac = hasActionPermission(
    "rbac.save-role-permissions",
    userRoles,
    userPermissions,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [roles, setRoles] = useState<AdminRbacRole[]>([]);
  const [permissions, setPermissions] = useState<AdminRbacPermission[]>([]);
  const [routeGuardRows, setRouteGuardRows] = useState<UiGuardEditorRow[]>([]);
  const [actionGuardRows, setActionGuardRows] = useState<UiGuardEditorRow[]>([]);
  const [userOptions, setUserOptions] = useState<RbacUserOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [isSavingBindings, setIsSavingBindings] = useState(false);
  const [isSavingUiGuards, setIsSavingUiGuards] = useState(false);
  const [isReplacingUserRoles, setIsReplacingUserRoles] = useState(false);
  const [isLoadingUserRoles, setIsLoadingUserRoles] = useState(false);

  const [selectedRoleKey, setSelectedRoleKey] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  const [bindingsEditor, setBindingsEditor] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserRoleKeys, setSelectedUserRoleKeys] = useState<string[]>([]);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);

  const [newRouteKey, setNewRouteKey] = useState("");
  const [newRoutePermissionsText, setNewRoutePermissionsText] = useState("");
  const [newActionKey, setNewActionKey] = useState("");
  const [newActionPermissionsText, setNewActionPermissionsText] = useState("");

  const selectedRole = useMemo(
    () => roles.find((item) => item.key === selectedRoleKey) ?? null,
    [roles, selectedRoleKey],
  );

  const permissionsByResource = useMemo(() => {
    const grouped = new Map<string, AdminRbacPermission[]>();
    for (const permission of permissions) {
      if (!grouped.has(permission.resource)) {
        grouped.set(permission.resource, []);
      }
      grouped.get(permission.resource)?.push(permission);
    }
    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resource, items]) => ({
        resource,
        items: [...items].sort((left, right) => left.action.localeCompare(right.action)),
      }));
  }, [permissions]);

  const routePermissionUsageRows = useMemo(() => {
    const rows: PermissionUsageRow[] = [];
    for (const permission of permissions) {
      for (const routePath of permission.routeRefs) {
        rows.push({
          key: `${routePath}:${permission.code}`,
          label: toRouteGuardLabel(routePath),
          permissionCode: permission.code,
          permissionName: permission.zhName,
        });
      }
    }
    return rows.sort((left, right) => left.key.localeCompare(right.key));
  }, [permissions]);

  const actionPermissionUsageRows = useMemo(() => {
    const rows: PermissionUsageRow[] = [];
    for (const permission of permissions) {
      for (const actionId of permission.actionRefs) {
        rows.push({
          key: `${actionId}:${permission.code}`,
          label: toActionGuardLabel(actionId),
          permissionCode: permission.code,
          permissionName: permission.zhName,
        });
      }
    }
    return rows.sort((left, right) => left.key.localeCompare(right.key));
  }, [permissions]);

  const token = accessToken ?? "";

  const loadRbacData = useCallback(async (nextSelectedRoleKey?: string): Promise<void> => {
    if (!accessToken) {
      return;
    }
    setIsLoadingData(true);
    setErrorMessage(null);
    try {
      const [nextRoles, nextPermissions, nextUiGuards, usersResult] = await Promise.all([
        fetchAdminRbacRoles(accessToken),
        fetchAdminRbacPermissions(accessToken),
        fetchRbacUiGuards(accessToken),
        fetchAdminCrudResource(accessToken, "users", {
          page: 1,
          pageSize: 100,
        }),
      ]);

      setRoles(nextRoles);
      setPermissions(nextPermissions);
      setRouteGuardRows(toGuardRows(nextUiGuards.routes));
      setActionGuardRows(toGuardRows(nextUiGuards.actions));
      const nextUserOptions = usersResult.items
        .map(mapCrudUserToOption)
        .filter((item): item is RbacUserOption => item !== null)
        .sort((left, right) => left.employeeNo.localeCompare(right.employeeNo));
      setUserOptions(nextUserOptions);
      applyPermissionMappingConfig({
        routes: nextUiGuards.routes.map((item) => ({
          routePath: item.key,
          requiredPermissions: item.requiredPermissions,
        })),
        actions: nextUiGuards.actions.map((item) => ({
          actionId: item.key,
          requiredPermissions: item.requiredPermissions,
        })),
      });

      const preservedRoleKey =
        nextSelectedRoleKey && nextRoles.some((item) => item.key === nextSelectedRoleKey)
          ? nextSelectedRoleKey
          : selectedRoleKey && nextRoles.some((item) => item.key === selectedRoleKey)
            ? selectedRoleKey
            : nextRoles[0]?.key ?? "";

      setSelectedRoleKey(preservedRoleKey);
      const role = nextRoles.find((item) => item.key === preservedRoleKey) ?? null;
      setBindingsEditor(formatRoleBindings(role));
      setSelectedPermissionCodes(roleToPermissionCodes(role));

      const preservedUserId =
        selectedUserId && nextUserOptions.some((item) => String(item.id) === selectedUserId)
          ? selectedUserId
          : nextUserOptions.length
            ? String(nextUserOptions[0].id)
            : "";
      setSelectedUserId(preservedUserId);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载角色权限数据失败。"));
    } finally {
      setIsLoadingData(false);
    }
  }, [accessToken, selectedRoleKey, selectedUserId]);

  useEffect(() => {
    void loadRbacData();
  }, [loadRbacData]);

  useEffect(() => {
    if (!accessToken || !selectedUserId) {
      setSelectedUserRoleKeys([]);
      return;
    }

    let canceled = false;
    const userId = Number(selectedUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      setSelectedUserRoleKeys([]);
      return;
    }

    setIsLoadingUserRoles(true);
    setErrorMessage(null);
    void fetchAdminUserRoles(accessToken, userId)
      .then((result) => {
        if (canceled) {
          return;
        }
        setSelectedUserRoleKeys(normalizeRoleKeys(result.roles));
      })
      .catch((error: unknown) => {
        if (canceled) {
          return;
        }
        setErrorMessage(toErrorMessage(error, "加载用户角色失败。"));
      })
      .finally(() => {
        if (!canceled) {
          setIsLoadingUserRoles(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [accessToken, selectedUserId]);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  function handleSelectRole(roleKey: string): void {
    setSelectedRoleKey(roleKey);
    const role = roles.find((item) => item.key === roleKey) ?? null;
    setBindingsEditor(formatRoleBindings(role));
    setSelectedPermissionCodes(roleToPermissionCodes(role));
  }

  function togglePermissionCode(code: string): void {
    setSelectedPermissionCodes((previous) => {
      const set = new Set(previous);
      if (set.has(code)) {
        set.delete(code);
      } else {
        set.add(code);
      }
      return Array.from(set).sort((left, right) => left.localeCompare(right));
    });
  }

  function toggleSelectedUserRole(roleKey: string): void {
    setSelectedUserRoleKeys((previous) => {
      const set = new Set(previous);
      if (set.has(roleKey)) {
        set.delete(roleKey);
      } else {
        set.add(roleKey);
      }
      return normalizeRoleKeys(Array.from(set));
    });
    setSuccessMessage(null);
  }

  async function handleCreateRole(): Promise<void> {
    const normalizedKey = newRoleKey.trim().toUpperCase();
    const normalizedName = newRoleName.trim();
    if (!normalizedKey || !normalizedName) {
      setErrorMessage("角色标识与角色名称不能为空。");
      return;
    }

    setIsCreatingRole(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const createdRole = await createAdminRbacRole(token, {
        key: normalizedKey,
        name: normalizedName,
        description: newRoleDescription.trim() || undefined,
      });

      const nextRoles = [...roles, createdRole].sort((left, right) => left.id - right.id);
      setRoles(nextRoles);
      setSelectedRoleKey(createdRole.key);
      setBindingsEditor("");
      setSelectedPermissionCodes([]);
      setNewRoleKey("");
      setNewRoleName("");
      setNewRoleDescription("");
      setSuccessMessage(`角色 ${createdRole.key} 创建成功。`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "创建角色失败。"));
    } finally {
      setIsCreatingRole(false);
    }
  }

  async function handleSaveRoleBindings(): Promise<void> {
    if (!selectedRoleKey) {
      setErrorMessage("请先选择目标角色，再保存角色绑定。");
      return;
    }

    let parsedBindings: Array<{ resource: string; actions: string[] }> = [];
    try {
      parsedBindings = parseRoleBindingsEditor(bindingsEditor);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "角色绑定格式不正确。");
      return;
    }

    setIsSavingBindings(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await bindAdminRbacRolePermissions(token, {
        roleKey: selectedRoleKey,
        permissions: parsedBindings,
      });
      setSelectedPermissionCodes(
        result.permissions
          .map((item) => permissionCode(item.resource, item.action))
          .sort((left, right) => left.localeCompare(right)),
      );
      setSuccessMessage(
        `角色 ${result.roleKey} 绑定已保存（${result.permissionCount} 条权限项）。`,
      );
      await loadRbacData(selectedRoleKey);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "保存角色绑定失败。"));
    } finally {
      setIsSavingBindings(false);
    }
  }

  async function handleSaveRoleBindingsFromChecklist(): Promise<void> {
    if (!selectedRoleKey) {
      setErrorMessage("请先选择目标角色，再保存角色绑定。");
      return;
    }

    const groupedBindings = permissionCodesToBindingGroups(selectedPermissionCodes);
    setIsSavingBindings(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await bindAdminRbacRolePermissions(token, {
        roleKey: selectedRoleKey,
        permissions: groupedBindings,
      });
      setBindingsEditor(formatRoleBindingsFromGroups(groupedBindings));
      setSuccessMessage(
        `角色 ${result.roleKey} 绑定已保存（${result.permissionCount} 条权限项）。`,
      );
      await loadRbacData(selectedRoleKey);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "保存角色绑定失败。"));
    } finally {
      setIsSavingBindings(false);
    }
  }

  async function handleSaveUiGuards(): Promise<void> {
    let normalizedRouteRows: UiGuardEditorRow[] = [];
    let normalizedActionRows: UiGuardEditorRow[] = [];
    try {
      normalizedRouteRows = ensureValidGuardRows(routeGuardRows, "页面");
      normalizedActionRows = ensureValidGuardRows(actionGuardRows, "按钮");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "UI 权限映射校验失败。");
      return;
    }

    setIsSavingUiGuards(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const saved = await replaceAdminRbacUiGuards(token, {
        routes: normalizedRouteRows.map((row) => ({
          key: row.key,
          requiredPermissions: normalizePermissionInput(row.requiredPermissionsText),
        })),
        actions: normalizedActionRows.map((row) => ({
          key: row.key,
          requiredPermissions: normalizePermissionInput(row.requiredPermissionsText),
        })),
      });
      const nextRouteRows = toGuardRows(saved.routes);
      const nextActionRows = toGuardRows(saved.actions);
      setRouteGuardRows(nextRouteRows);
      setActionGuardRows(nextActionRows);
      applyPermissionMappingConfig({
        routes: saved.routes.map((item) => ({
          routePath: item.key,
          requiredPermissions: item.requiredPermissions,
        })),
        actions: saved.actions.map((item) => ({
          actionId: item.key,
          requiredPermissions: item.requiredPermissions,
        })),
      });
      setSuccessMessage("页面/按钮到权限码映射已保存并立即生效。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "保存页面/按钮权限映射失败。"));
    } finally {
      setIsSavingUiGuards(false);
    }
  }

  function handleAddRouteGuardRow(): void {
    const key = newRouteKey.trim();
    if (!key) {
      setErrorMessage("页面映射 key 不能为空。");
      return;
    }
    if (routeGuardRows.some((row) => row.key === key)) {
      setErrorMessage(`页面映射 key 已存在：${key}`);
      return;
    }

    setRouteGuardRows((previous) =>
      sortGuardRows([
        ...previous,
        { key, requiredPermissionsText: newRoutePermissionsText.trim() },
      ]),
    );
    setNewRouteKey("");
    setNewRoutePermissionsText("");
    setErrorMessage(null);
  }

  function handleAddActionGuardRow(): void {
    const key = newActionKey.trim();
    if (!key) {
      setErrorMessage("按钮映射 key 不能为空。");
      return;
    }
    if (actionGuardRows.some((row) => row.key === key)) {
      setErrorMessage(`按钮映射 key 已存在：${key}`);
      return;
    }

    setActionGuardRows((previous) =>
      sortGuardRows([
        ...previous,
        { key, requiredPermissionsText: newActionPermissionsText.trim() },
      ]),
    );
    setNewActionKey("");
    setNewActionPermissionsText("");
    setErrorMessage(null);
  }

  async function handleReplaceUserRoles(): Promise<void> {
    const parsedUserId = Number(selectedUserId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      setErrorMessage("请先选择目标用户账号。");
      return;
    }

    const rolesToApply = normalizeRoleKeys(selectedUserRoleKeys);
    setIsReplacingUserRoles(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await replaceAdminUserRoles(token, parsedUserId, rolesToApply);
      const roleLabel = result.roles.length ? result.roles.join(", ") : "（无）";
      setSelectedUserRoleKeys(result.roles);
      setSuccessMessage(
        `用户角色覆盖完成：${roleLabel}。`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "替换用户角色失败。"));
    } finally {
      setIsReplacingUserRoles(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="app-shell__panel" aria-label="角色权限治理说明">
        <div className="page-panel-head">
          <h2 className="app-shell__panel-title">角色与权限治理控制台</h2>
          <p className="app-shell__panel-copy">
            所需角色：<strong>{toRoleListLabel(["SUPER_ADMIN"])}</strong>。当前角色：
            <strong>{toRoleListLabel(userRoles)}</strong>。
          </p>
          {!canManageRbac ? (
            <p className="auth-error">当前账号缺少 RBAC 管理权限，页面将以只读方式展示。</p>
          ) : null}
        </div>
      </section>

      {errorMessage || successMessage ? (
        <div className="page-stack__messages">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="store-success" aria-live="polite">
              {successMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="app-shell__grid admin-rbac-grid" aria-label="角色权限操作面板">
        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">角色目录</p>
            <h3 className="app-shell__card-title">角色与当前绑定</h3>
          </div>
          <div className="admin-rbac-toolbar page-toolbar">
            <button
              className="app-shell__header-action"
              type="button"
              disabled={isLoadingData}
              onClick={() => {
                void loadRbacData(selectedRoleKey);
              }}
            >
              {isLoadingData ? "加载中..." : "重新加载角色权限数据"}
            </button>
            <p className="app-shell__card-copy">已加载角色数：{roles.length}</p>
          </div>

          {isLoadingData ? (
            <p className="app-shell__card-copy">正在加载角色与权限...</p>
          ) : !roles.length ? (
            <p className="app-shell__card-copy">当前没有角色，请先创建角色再绑定权限。</p>
          ) : (
            <div className="page-table-wrap">
              <table className="analytics-table">
                <caption className="visually-hidden">
                  角色目录表，包含角色标识、名称、系统内置标记与权限数量
                </caption>
                <thead>
                  <tr>
                    <th scope="col">标识</th>
                    <th scope="col">名称</th>
                    <th scope="col">系统内置</th>
                    <th scope="col">权限数</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.key}</td>
                      <td>{role.name}</td>
                      <td>{role.isSystem ? "是" : "否"}</td>
                      <td>{role.permissions.length}</td>
                      <td>
                        <button
                          className="app-shell__header-action"
                          type="button"
                          onClick={() => handleSelectRole(role.key)}
                        >
                          {role.key === selectedRoleKey ? "已选中" : "选择"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">权限目录</p>
            <h3 className="app-shell__card-title">系统权限字典（含中文说明）</h3>
          </div>
          {isLoadingData ? (
            <p className="app-shell__card-copy">正在加载权限目录...</p>
          ) : !permissions.length ? (
            <p className="app-shell__card-copy">当前暂无权限项。</p>
          ) : (
            <div className="admin-form-grid page-form-grid">
              <div className="page-table-wrap admin-field-wide">
                <table className="analytics-table">
                  <caption className="visually-hidden">
                    权限目录表，包含权限码、中文说明与映射引用统计
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">权限码</th>
                      <th scope="col">中文名称</th>
                      <th scope="col">中文说明</th>
                      <th scope="col">资源</th>
                      <th scope="col">动作</th>
                      <th scope="col">页面引用数</th>
                      <th scope="col">按钮引用数</th>
                      <th scope="col">是否内置</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((permission) => (
                      <tr key={permission.id}>
                        <td>
                          <code className="admin-permission-chip">{permission.code}</code>
                        </td>
                        <td>{permission.zhName}</td>
                        <td>{permission.zhDescription}</td>
                        <td>{permission.resource}</td>
                        <td>{permission.action}</td>
                        <td>{permission.routeRefs.length}</td>
                        <td>{permission.actionRefs.length}</td>
                        <td>{permission.isBuiltin ? "是" : "否"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-permission-usage-grid admin-field-wide">
                <section className="admin-permission-usage-panel">
                  <h4 className="app-shell__card-title">页面权限使用明细</h4>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        页面到权限码使用明细
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">页面</th>
                          <th scope="col">权限码</th>
                          <th scope="col">中文名称</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routePermissionUsageRows.length ? (
                          routePermissionUsageRows.map((row) => (
                            <tr key={row.key}>
                              <td>{row.label}</td>
                              <td>
                                <code className="admin-permission-chip">{row.permissionCode}</code>
                              </td>
                              <td>{row.permissionName}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>暂无页面权限映射引用。</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="admin-permission-usage-panel">
                  <h4 className="app-shell__card-title">按钮权限使用明细</h4>
                  <div className="page-table-wrap">
                    <table className="analytics-table">
                      <caption className="visually-hidden">
                        按钮到权限码使用明细
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">按钮</th>
                          <th scope="col">权限码</th>
                          <th scope="col">中文名称</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionPermissionUsageRows.length ? (
                          actionPermissionUsageRows.map((row) => (
                            <tr key={row.key}>
                              <td>{row.label}</td>
                              <td>
                                <code className="admin-permission-chip">{row.permissionCode}</code>
                              </td>
                              <td>{row.permissionName}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>暂无按钮权限映射引用。</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">角色赋权（可视化）</p>
            <h3 className="app-shell__card-title">勾选权限并保存角色绑定</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <label className="store-field">
              目标角色
              <select
                value={selectedRoleKey}
                onChange={(event) => {
                  handleSelectRole(event.target.value);
                }}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.key}>
                    {role.key}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-rbac-toolbar">
              <p className="app-shell__card-copy">
                当前角色：{selectedRole?.key ?? "未选择"}，已勾选权限：
                <strong>{selectedPermissionCodes.length}</strong>
              </p>
              <div className="page-toolbar">
                <button
                  className="app-shell__header-action"
                  type="button"
                  disabled={!canManageRbac || !permissions.length}
                  onClick={() => {
                    setSelectedPermissionCodes(
                      permissions
                        .map((item) => permissionCode(item.resource, item.action))
                        .sort((left, right) => left.localeCompare(right)),
                    );
                  }}
                >
                  全选
                </button>
                <button
                  className="app-shell__header-action"
                  type="button"
                  disabled={!canManageRbac}
                  onClick={() => {
                    setSelectedPermissionCodes([]);
                  }}
                >
                  清空
                </button>
              </div>
            </div>

            <div className="admin-guard-table-wrap admin-field-wide">
              <table className="analytics-table">
                <caption className="visually-hidden">
                  角色赋权表，按资源分组展示并支持勾选权限
                </caption>
                <thead>
                  <tr>
                    <th scope="col">资源</th>
                    <th scope="col">动作</th>
                    <th scope="col">权限码</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionsByResource.flatMap((group) =>
                    group.items.map((permission, index) => {
                      const code = permissionCode(permission.resource, permission.action);
                      return (
                        <tr key={permission.id}>
                          <td>{index === 0 ? group.resource : ""}</td>
                          <td>{permission.action}</td>
                          <td>
                            <code className="admin-permission-chip">{code}</code>
                          </td>
                          <td>
                            <label>
                              <input
                                type="checkbox"
                                checked={selectedPermissionCodes.includes(code)}
                                disabled={!canManageRbac}
                                onChange={() => togglePermissionCode(code)}
                              />{" "}
                              赋权
                            </label>
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="auth-submit"
              type="button"
              disabled={isSavingBindings || !selectedRoleKey || !canManageRbac}
              onClick={() => {
                void handleSaveRoleBindingsFromChecklist();
              }}
            >
              {isSavingBindings ? "保存中..." : "保存可视化赋权"}
            </button>
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">角色绑定（高级文本模式）</p>
            <h3 className="app-shell__card-title">以确定性方式替换角色-权限绑定</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <label className="store-field">
              目标角色
              <select
                value={selectedRoleKey}
                onChange={(event) => {
                  handleSelectRole(event.target.value);
                }}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.key}>
                    {role.key}
                  </option>
                ))}
              </select>
            </label>

            <label className="store-field admin-field-wide">
              权限绑定编辑器
              <textarea
                rows={7}
                value={bindingsEditor}
                onChange={(event) => setBindingsEditor(event.target.value)}
                placeholder="每行一个资源：RESOURCE=ACTION1,ACTION2"
              />
            </label>

            <p className="app-shell__card-copy">
              建议优先使用上方“角色赋权（可视化）”，仅在批量粘贴权限码时使用本模式。
            </p>
            <p className="app-shell__card-copy">
              格式：<code>RESOURCE=ACTION1,ACTION2</code>。编辑器为空将清空所选角色的全部绑定。
            </p>
            <button
              className="auth-submit"
              type="button"
              disabled={isSavingBindings || !selectedRoleKey || !canManageRbac}
              onClick={() => {
                void handleSaveRoleBindings();
              }}
            >
              {isSavingBindings ? "保存中..." : "保存角色绑定"}
            </button>
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">页面权限配置</p>
            <h3 className="app-shell__card-title">页面路径到权限码映射</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <div className="admin-guard-create-grid admin-field-wide">
              <label className="store-field">
                页面路径
                <input
                  list="rbac-route-key-options"
                  value={newRouteKey}
                  onChange={(event) => setNewRouteKey(event.target.value)}
                  placeholder="例如：/inventory"
                />
                <datalist id="rbac-route-key-options">
                  {ROUTE_CANDIDATE_KEYS.map((item) => (
                    <option key={item} value={item}>
                      {toRouteGuardLabel(item)}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="store-field">
                权限码（逗号分隔）
                <input
                  value={newRoutePermissionsText}
                  onChange={(event) => setNewRoutePermissionsText(event.target.value)}
                  placeholder="例如：INVENTORY:READ"
                />
              </label>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={!canManageRbac}
                onClick={handleAddRouteGuardRow}
              >
                新增映射
              </button>
            </div>

            <div className="admin-guard-table-wrap admin-field-wide">
              <table className="analytics-table">
                <caption className="visually-hidden">页面权限映射表</caption>
                <thead>
                  <tr>
                    <th scope="col">页面路径</th>
                    <th scope="col">页面说明</th>
                    <th scope="col">权限码</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {routeGuardRows.length ? (
                    routeGuardRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <code>{row.key}</code>
                        </td>
                        <td>{toRouteGuardLabel(row.key)}</td>
                        <td>
                          <input
                            className="admin-guard-input"
                            value={row.requiredPermissionsText}
                            onChange={(event) => {
                              const nextText = event.target.value;
                              setRouteGuardRows((previous) =>
                                previous.map((item) =>
                                  item.key === row.key
                                    ? { ...item, requiredPermissionsText: nextText }
                                    : item,
                                ),
                              );
                            }}
                            placeholder="例如：INVENTORY:READ,INVENTORY:WRITE"
                            disabled={!canManageRbac}
                          />
                        </td>
                        <td className="admin-guard-row-actions">
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={!canManageRbac}
                            onClick={() => {
                              setRouteGuardRows((previous) =>
                                previous.filter((item) => item.key !== row.key),
                              );
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>暂无页面映射配置。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">按钮权限配置</p>
            <h3 className="app-shell__card-title">按钮 actionId 到权限码映射</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <div className="admin-guard-create-grid admin-field-wide">
              <label className="store-field">
                actionId
                <input
                  list="rbac-action-key-options"
                  value={newActionKey}
                  onChange={(event) => setNewActionKey(event.target.value)}
                  placeholder="例如：inventory.fetch-skus"
                />
                <datalist id="rbac-action-key-options">
                  {ACTION_CANDIDATE_KEYS.map((item) => (
                    <option key={item} value={item}>
                      {toActionGuardLabel(item)}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="store-field">
                权限码（逗号分隔）
                <input
                  value={newActionPermissionsText}
                  onChange={(event) => setNewActionPermissionsText(event.target.value)}
                  placeholder="例如：RBAC_ADMIN:UPDATE"
                />
              </label>
              <button
                className="app-shell__header-action"
                type="button"
                disabled={!canManageRbac}
                onClick={handleAddActionGuardRow}
              >
                新增映射
              </button>
            </div>

            <div className="admin-guard-table-wrap admin-field-wide">
              <table className="analytics-table">
                <caption className="visually-hidden">按钮权限映射表</caption>
                <thead>
                  <tr>
                    <th scope="col">actionId</th>
                    <th scope="col">按钮说明</th>
                    <th scope="col">权限码</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {actionGuardRows.length ? (
                    actionGuardRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <code>{row.key}</code>
                        </td>
                        <td>{toActionGuardLabel(row.key)}</td>
                        <td>
                          <input
                            className="admin-guard-input"
                            value={row.requiredPermissionsText}
                            onChange={(event) => {
                              const nextText = event.target.value;
                              setActionGuardRows((previous) =>
                                previous.map((item) =>
                                  item.key === row.key
                                    ? { ...item, requiredPermissionsText: nextText }
                                    : item,
                                ),
                              );
                            }}
                            placeholder="例如：RBAC_ADMIN:UPDATE"
                            disabled={!canManageRbac}
                          />
                        </td>
                        <td className="admin-guard-row-actions">
                          <button
                            className="app-shell__header-action"
                            type="button"
                            disabled={!canManageRbac}
                            onClick={() => {
                              setActionGuardRows((previous) =>
                                previous.filter((item) => item.key !== row.key),
                              );
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>暂无按钮映射配置。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="auth-submit"
              type="button"
              disabled={isSavingUiGuards || !canManageRbac}
              onClick={() => {
                void handleSaveUiGuards();
              }}
            >
              {isSavingUiGuards ? "保存中..." : "保存页面/按钮权限映射"}
            </button>
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">创建角色</p>
            <h3 className="app-shell__card-title">创建自定义角色</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <label className="store-field">
              角色标识
              <input
                value={newRoleKey}
                onChange={(event) => setNewRoleKey(event.target.value)}
                placeholder="例如：AUDITOR"
              />
            </label>
            <label className="store-field">
              角色名称
              <input
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="例如：审计员"
              />
            </label>
            <label className="store-field admin-field-wide">
              描述（可选）
              <textarea
                rows={2}
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value)}
                placeholder="角色描述"
              />
            </label>
            <button
              className="auth-submit"
              type="button"
              disabled={isCreatingRole || !canManageRbac}
              onClick={() => {
                void handleCreateRole();
              }}
            >
              {isCreatingRole ? "创建中..." : "创建角色"}
            </button>
          </div>
        </article>

        <article className="app-shell__card">
          <div className="page-card-head">
            <p className="app-shell__section-label">用户角色设置</p>
            <h3 className="app-shell__card-title">可视化替换用户-角色分配</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <label className="store-field">
              用户账号
              <select
                value={selectedUserId}
                disabled={isLoadingData || !userOptions.length}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setSuccessMessage(null);
                }}
              >
                {!userOptions.length ? <option value="">暂无可选用户</option> : null}
                {userOptions.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {toUserOptionLabel(user)}
                  </option>
                ))}
              </select>
            </label>
            <label className="store-field admin-field-wide">
              角色列表（多选）
              <div className="admin-role-checkbox-grid" role="group" aria-label="角色多选列表">
                {roles.length ? (
                  roles.map((role) => {
                    const checked = selectedUserRoleKeys.includes(role.key);
                    return (
                      <label key={role.id} className="admin-role-checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canManageRbac || isLoadingUserRoles}
                          onChange={() => toggleSelectedUserRole(role.key)}
                        />
                        <span>{role.key} - {role.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="app-shell__card-copy">暂无可选角色。</p>
                )}
              </div>
            </label>
            <p className="app-shell__card-copy admin-field-wide">
              说明：保存将覆盖该用户当前全部角色。当前加载状态：
              {isLoadingUserRoles ? "正在读取该用户角色..." : "已完成"}
            </p>
            <p className="app-shell__card-copy admin-field-wide">
              建议先选择用户账号，再勾选目标角色后保存。
            </p>
            <button
              className="auth-submit"
              type="button"
              disabled={isReplacingUserRoles || !canManageRbac || !selectedUserId}
              onClick={() => {
                void handleReplaceUserRoles();
              }}
            >
              {isReplacingUserRoles ? "保存中..." : "保存用户角色覆盖"}
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}

