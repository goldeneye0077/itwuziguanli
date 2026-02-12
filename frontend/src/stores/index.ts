import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AuthApiError,
  fetchRbacUiGuards,
  loginWithPassword,
  logoutWithToken,
  type LoginResult,
  type SessionUser,
} from "../api";
import {
  applyPermissionMappingConfig,
  resetPermissionMappingConfig,
  hasAnyPermission as hasAnyPermissionByList,
  isSuperAdminRole,
} from "../permissions";
import type { AppRole } from "../routes/blueprint-routes";

const SESSION_STORAGE_KEY = "pgc-auth-session-v1";

interface StoredSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly user: SessionUser;
}

export interface LoginInput {
  readonly employeeNo: string;
  readonly password: string;
}

interface AuthSessionState {
  readonly initialized: boolean;
  readonly isAuthenticating: boolean;
  readonly accessToken: string | null;
  readonly expiresIn: number | null;
  readonly user: SessionUser | null;
  readonly errorMessage: string | null;
}

interface AuthSessionContextValue {
  readonly state: AuthSessionState;
  readonly isAuthenticated: boolean;
  readonly userRoles: readonly AppRole[];
  readonly userPermissions: readonly string[];
  readonly hasPermission: (...permissions: string[]) => boolean;
  readonly hasAnyPermission: (permissions: readonly string[]) => boolean;
  readonly login: (input: LoginInput) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly clearError: () => void;
}

const AUTH_STATE_ANONYMOUS: AuthSessionState = {
  initialized: false,
  isAuthenticating: false,
  accessToken: null,
  expiresIn: null,
  user: null,
  errorMessage: null,
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(
  undefined,
);

function isRole(value: unknown): value is AppRole {
  return (
    value === "PUBLIC" ||
    value === "USER" ||
    value === "LEADER" ||
    value === "ADMIN" ||
    value === "SUPER_ADMIN"
  );
}

function isStringArray(values: unknown): values is string[] {
  return Array.isArray(values) && values.every((item) => typeof item === "string");
}

function normalizeStoredSession(candidate: unknown): StoredSession | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const source = candidate as {
    accessToken?: unknown;
    expiresIn?: unknown;
    user?: {
      id?: unknown;
      employeeNo?: unknown;
      name?: unknown;
      departmentName?: unknown;
      sectionName?: unknown;
      mobilePhone?: unknown;
      jobTitle?: unknown;
      roles?: unknown;
      permissions?: unknown;
    };
  };

  if (typeof source.accessToken !== "string") {
    return null;
  }

  if (typeof source.expiresIn !== "number") {
    return null;
  }

  if (!source.user || typeof source.user !== "object") {
    return null;
  }

  const roles = Array.isArray(source.user.roles)
    ? source.user.roles.filter(isRole)
    : [];
  const permissions = isStringArray(source.user.permissions)
    ? source.user.permissions
    : [];

  if (
    typeof source.user.id !== "number" ||
    typeof source.user.employeeNo !== "string" ||
    typeof source.user.name !== "string"
  ) {
    return null;
  }

  return {
    accessToken: source.accessToken,
    expiresIn: source.expiresIn,
    user: {
      id: source.user.id,
      employeeNo: source.user.employeeNo,
      name: source.user.name,
      departmentName:
        typeof source.user.departmentName === "string"
          ? source.user.departmentName
          : null,
      sectionName:
        typeof source.user.sectionName === "string" ? source.user.sectionName : null,
      mobilePhone:
        typeof source.user.mobilePhone === "string" ? source.user.mobilePhone : null,
      jobTitle: typeof source.user.jobTitle === "string" ? source.user.jobTitle : null,
      roles,
      permissions,
    },
  };
}

function readSessionFromStorage(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return normalizeStoredSession(JSON.parse(stored));
  } catch {
    return null;
  }
}

function persistSessionToStorage(session: StoredSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSessionFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function loginResultToState(result: LoginResult): AuthSessionState {
  return {
    initialized: true,
    isAuthenticating: false,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: result.user,
    errorMessage: null,
  };
}

export function AuthSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthSessionState>(AUTH_STATE_ANONYMOUS);

  useEffect(() => {
    const storedSession = readSessionFromStorage();
    if (!storedSession) {
      resetPermissionMappingConfig();
      clearSessionFromStorage();
      setState({
        ...AUTH_STATE_ANONYMOUS,
        initialized: true,
      });
      return;
    }

    setState({
      initialized: true,
      isAuthenticating: false,
      accessToken: storedSession.accessToken,
      expiresIn: storedSession.expiresIn,
      user: storedSession.user,
      errorMessage: null,
    });
  }, []);

  useEffect(() => {
    if (!state.initialized) {
      return;
    }

    const token = state.accessToken;
    if (!token) {
      resetPermissionMappingConfig();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const guardConfig = await fetchRbacUiGuards(token);
        if (cancelled) {
          return;
        }

        applyPermissionMappingConfig({
          routes: guardConfig.routes.map((item) => ({
            routePath: item.key,
            requiredPermissions: item.requiredPermissions,
          })),
          actions: guardConfig.actions.map((item) => ({
            actionId: item.key,
            requiredPermissions: item.requiredPermissions,
          })),
        });
        setState((previous) => ({ ...previous }));
      } catch {
        if (!cancelled) {
          resetPermissionMappingConfig();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.accessToken, state.initialized]);

  const login = useCallback(async (input: LoginInput) => {
    setState((previous) => ({
      ...previous,
      initialized: true,
      isAuthenticating: true,
      errorMessage: null,
    }));

    try {
      const result = await loginWithPassword(input.employeeNo, input.password);
      const nextState = loginResultToState(result);
      persistSessionToStorage({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      });
      setState(nextState);
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : "账号或密码不正确，无法登录。";

      resetPermissionMappingConfig();
      clearSessionFromStorage();
      setState({
        initialized: true,
        isAuthenticating: false,
        accessToken: null,
        expiresIn: null,
        user: null,
        errorMessage: message,
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    const token = state.accessToken;
    resetPermissionMappingConfig();
    clearSessionFromStorage();

    setState({
      initialized: true,
      isAuthenticating: false,
      accessToken: null,
      expiresIn: null,
      user: null,
      errorMessage: null,
    });

    if (token) {
      try {
        await logoutWithToken(token);
      } catch {
        // best-effort backend logout; local state remains cleared
      }
    }
  }, [state.accessToken]);

  const clearError = useCallback(() => {
    setState((previous) => ({
      ...previous,
      errorMessage: null,
    }));
  }, []);

  const userRoles = state.user?.roles ?? [];
  const userPermissions = state.user?.permissions ?? [];
  const isAuthenticated = state.initialized && Boolean(state.accessToken && state.user);
  const hasAnyPermission = useCallback(
    (permissions: readonly string[]): boolean => {
      if (!permissions.length) {
        return true;
      }
      if (isSuperAdminRole(userRoles)) {
        return true;
      }
      return hasAnyPermissionByList(userPermissions, permissions);
    },
    [userPermissions, userRoles],
  );
  const hasPermission = useCallback(
    (...permissions: string[]): boolean => hasAnyPermission(permissions),
    [hasAnyPermission],
  );

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      state,
      isAuthenticated,
      userRoles,
      userPermissions,
      hasPermission,
      hasAnyPermission,
      login,
      logout,
      clearError,
    }),
    [
      clearError,
      hasAnyPermission,
      hasPermission,
      isAuthenticated,
      login,
      logout,
      state,
      userPermissions,
      userRoles,
    ],
  );

  return createElement(AuthSessionContext.Provider, { value }, children);
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession 必须在 AuthSessionProvider 内使用");
  }

  return context;
}
