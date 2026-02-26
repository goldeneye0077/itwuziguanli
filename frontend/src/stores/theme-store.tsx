import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { applyPrecisionGraphiteTheme, type ThemeMode } from "../styles/tokens";

const THEME_STORAGE_KEY = "pgc-theme-mode";

interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly toggleTheme: () => void;
  readonly setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  // 默认使用系统偏好，如果没有偏好则默认为 dark
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function ThemeProvider({
  children,
}: { readonly children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(getInitialTheme);

  const applyTheme = useCallback((newMode: ThemeMode) => {
    applyPrecisionGraphiteTheme(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
    setModeState(newMode);
  }, []);

  // 初始化应用主题
  useEffect(() => {
    applyPrecisionGraphiteTheme(mode);
  }, []); // 仅在组件挂载时执行一次，或者我们可以依赖 mode，但 setModeState 已经更新了

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有当用户没有明确设置过偏好时，才跟随系统
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    applyTheme(mode === "dark" ? "light" : "dark");
  }, [mode, applyTheme]);

  const setTheme = useCallback((newMode: ThemeMode) => {
    applyTheme(newMode);
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
