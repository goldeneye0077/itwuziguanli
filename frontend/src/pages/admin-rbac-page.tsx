import { useCallback, useEffect, useMemo, useState } from "react";

import {
  bindAdminRbacRolePermissions,
  createAdminRbacRole,
  fetchAdminRbacPermissions,
  fetchAdminRbacRoles,
  replaceAdminUserRoles,
  type AdminRbacRole,
} from "../api";
import { useAuthSession } from "../stores";
import { parsePositiveInteger, toErrorMessage, toRoleListLabel } from "./page-helpers";

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

function parseRoleList(value: string): string[] {
  const roleSet = new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0),
  );
  return Array.from(roleSet).sort((left, right) => left.localeCompare(right));
}

export function AdminRbacPage(): JSX.Element {
  const { state, userRoles } = useAuthSession();
  const accessToken = state.accessToken;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [roles, setRoles] = useState<AdminRbacRole[]>([]);
  const [permissions, setPermissions] = useState<
    Array<{ id: number; resource: string; action: string; name: string; description: string | null }>
  >([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [isSavingBindings, setIsSavingBindings] = useState(false);
  const [isReplacingUserRoles, setIsReplacingUserRoles] = useState(false);

  const [selectedRoleKey, setSelectedRoleKey] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  const [bindingsEditor, setBindingsEditor] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRolesEditor, setTargetRolesEditor] = useState("USER");

  const selectedRole = useMemo(
    () => roles.find((item) => item.key === selectedRoleKey) ?? null,
    [roles, selectedRoleKey],
  );

  const token = accessToken ?? "";

  const loadRbacData = useCallback(async (nextSelectedRoleKey?: string): Promise<void> => {
    if (!accessToken) {
      return;
    }
    setIsLoadingData(true);
    setErrorMessage(null);
    try {
      const [nextRoles, nextPermissions] = await Promise.all([
        fetchAdminRbacRoles(accessToken),
        fetchAdminRbacPermissions(accessToken),
      ]);

      setRoles(nextRoles);
      setPermissions(nextPermissions);

      const preservedRoleKey =
        nextSelectedRoleKey && nextRoles.some((item) => item.key === nextSelectedRoleKey)
          ? nextSelectedRoleKey
          : selectedRoleKey && nextRoles.some((item) => item.key === selectedRoleKey)
            ? selectedRoleKey
            : nextRoles[0]?.key ?? "";

      setSelectedRoleKey(preservedRoleKey);
      const role = nextRoles.find((item) => item.key === preservedRoleKey) ?? null;
      setBindingsEditor(formatRoleBindings(role));
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "加载角色权限数据失败。"));
    } finally {
      setIsLoadingData(false);
    }
  }, [accessToken, selectedRoleKey]);

  useEffect(() => {
    void loadRbacData();
  }, [loadRbacData]);

  if (!accessToken) {
    return (
      <section className="forbidden-state" role="alert">
        <p className="app-shell__section-label">M08 角色权限治理</p>
        <h2 className="forbidden-state__title">会话令牌缺失，请重新登录。</h2>
      </section>
    );
  }

  function handleSelectRole(roleKey: string): void {
    setSelectedRoleKey(roleKey);
    const role = roles.find((item) => item.key === roleKey) ?? null;
    setBindingsEditor(formatRoleBindings(role));
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

  async function handleReplaceUserRoles(): Promise<void> {
    const parsedUserId = parsePositiveInteger(targetUserId);
    if (!parsedUserId) {
      setErrorMessage("目标用户编号必须为正整数。");
      return;
    }

    const rolesToApply = parseRoleList(targetRolesEditor);
    setIsReplacingUserRoles(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await replaceAdminUserRoles(token, parsedUserId, rolesToApply);
      const roleLabel = result.roles.length ? result.roles.join(", ") : "（无）";
      setSuccessMessage(
        `用户 #${result.userId} 角色已替换为：${roleLabel}。`,
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
          <p className="app-shell__section-label">M08 角色权限治理</p>
          <h2 className="app-shell__panel-title">角色与权限治理控制台</h2>
          <p className="app-shell__panel-copy">
            所需角色：<strong>{toRoleListLabel(["SUPER_ADMIN"])}</strong>。当前角色：<strong>{toRoleListLabel(userRoles)}</strong>。
          </p>
        </div>
      </section>

      {errorMessage || successMessage ? (
        <div className="page-stack__messages">
          {errorMessage ? (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? <p className="store-success" aria-live="polite">{successMessage}</p> : null}
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
            <h3 className="app-shell__card-title">已有权限项</h3>
          </div>
          {isLoadingData ? (
            <p className="app-shell__card-copy">正在加载权限目录...</p>
          ) : !permissions.length ? (
            <p className="app-shell__card-copy">当前暂无权限项。</p>
          ) : (
            <ul className="admin-permission-list">
              {permissions.map((permission) => (
                <li key={permission.id}>
                  <code className="admin-permission-chip">
                    {permission.resource}:{permission.action}
                  </code>
                </li>
              ))}
            </ul>
          )}
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
              disabled={isCreatingRole}
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
            <p className="app-shell__section-label">角色绑定</p>
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
              格式：<code>RESOURCE=ACTION1,ACTION2</code>。编辑器为空将清空所选角色的全部绑定。
            </p>
            <button
              className="auth-submit"
              type="button"
              disabled={isSavingBindings || !selectedRoleKey}
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
            <p className="app-shell__section-label">用户角色设置</p>
            <h3 className="app-shell__card-title">替换用户-角色分配</h3>
          </div>
          <div className="admin-form-grid page-form-grid">
            <label className="store-field">
              用户编号
              <input
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="例如：3"
              />
            </label>
            <label className="store-field admin-field-wide">
              角色列表（逗号/换行分隔）
              <textarea
                rows={3}
                value={targetRolesEditor}
                onChange={(event) => setTargetRolesEditor(event.target.value)}
                placeholder="例如：USER,AUDITOR"
              />
            </label>
            <button
              className="auth-submit"
              type="button"
              disabled={isReplacingUserRoles}
              onClick={() => {
                void handleReplaceUserRoles();
              }}
            >
              {isReplacingUserRoles ? "保存中..." : "替换用户角色"}
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
