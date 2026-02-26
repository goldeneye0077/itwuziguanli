export const precisionGraphiteTokensDark = {
  color: {
    bgCanvas: "#0B0E14",
    bgSurface: "#11141D",
    bgSubtle: "#1D2331",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    borderDefault: "#2D3748",
    borderStrong: "#475569",
    accentPrimary: "#3B82F6",
    accentHover: "#2563EB",
    accentActive: "#1D4ED8",
    accentMuted: "rgba(59, 130, 246, 0.15)",
    statusSuccess: "#10B981",
    statusWarning: "#F59E0B",
    statusDanger: "#EF4444",
    focusRing: "#60A5FA",
  },
  typography: {
    fontFamilyBase: '"IBM Plex Sans", "Segoe UI", Tahoma, sans-serif',
    fontFamilyMono:
      '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
    fontSizeXs: "12px",
    fontSizeSm: "14px",
    fontSizeMd: "16px",
    fontSizeLg: "18px",
    fontSizeXl: "20px",
    lineHeightTight: "1.25",
    lineHeightNormal: "1.5",
    lineHeightRelaxed: "1.7",
    fontWeightRegular: "400",
    fontWeightMedium: "500",
    fontWeightSemibold: "600",
    fontWeightBold: "700",
  },
  spacing: {
    xxs: "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    x2l: "32px",
    x3l: "40px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    pill: "999px",
  },
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
    md: "0 8px 20px rgba(0, 0, 0, 0.4)",
    lg: "0 18px 42px rgba(0, 0, 0, 0.5)",
  },
  motion: {
    durationFast: "120ms",
    durationBase: "180ms",
    durationSlow: "240ms",
    easingStandard: "cubic-bezier(0.2, 0, 0, 1)",
  },
} as const;

export const precisionGraphiteTokensLight = {
  ...precisionGraphiteTokensDark,
  color: {
    bgCanvas: "#F3F4F6", // Gray 100
    bgSurface: "#FFFFFF", // White
    bgSubtle: "#E5E7EB", // Gray 200
    textPrimary: "#111827", // Gray 900
    textSecondary: "#4B5563", // Gray 600
    textMuted: "#9CA3AF", // Gray 400
    borderDefault: "#E5E7EB", // Gray 200
    borderStrong: "#D1D5DB", // Gray 300
    accentPrimary: "#3B82F6",
    accentHover: "#2563EB",
    accentActive: "#1D4ED8",
    accentMuted: "rgba(59, 130, 246, 0.1)",
    statusSuccess: "#10B981",
    statusWarning: "#F59E0B",
    statusDanger: "#EF4444",
    focusRing: "#60A5FA",
  },
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },
} as const;

// 默认导出 Dark，保持兼容性
export const precisionGraphiteTokens = precisionGraphiteTokensDark;

export type ThemeMode = "light" | "dark";

export function getCssVariables(mode: ThemeMode): Record<string, string> {
  const tokens = mode === "dark" ? precisionGraphiteTokensDark : precisionGraphiteTokensLight;
  return {
    "--pgc-color-bg-canvas": tokens.color.bgCanvas,
    "--pgc-color-bg-surface": tokens.color.bgSurface,
    "--pgc-color-bg-subtle": tokens.color.bgSubtle,
    "--pgc-color-text-primary": tokens.color.textPrimary,
    "--pgc-color-text-secondary": tokens.color.textSecondary,
    "--pgc-color-text-muted": tokens.color.textMuted,
    "--pgc-color-border-default": tokens.color.borderDefault,
    "--pgc-color-border-strong": tokens.color.borderStrong,
    "--pgc-color-accent-primary": tokens.color.accentPrimary,
    "--pgc-color-accent-hover": tokens.color.accentHover,
    "--pgc-color-accent-active": tokens.color.accentActive,
    "--pgc-color-accent-muted": tokens.color.accentMuted,
    "--pgc-color-status-success": tokens.color.statusSuccess,
    "--pgc-color-status-warning": tokens.color.statusWarning,
    "--pgc-color-status-danger": tokens.color.statusDanger,
    "--pgc-color-focus-ring": tokens.color.focusRing,
    "--pgc-font-family-base": tokens.typography.fontFamilyBase,
    "--pgc-font-family-mono": tokens.typography.fontFamilyMono,
    "--pgc-font-size-xs": tokens.typography.fontSizeXs,
    "--pgc-font-size-sm": tokens.typography.fontSizeSm,
    "--pgc-font-size-md": tokens.typography.fontSizeMd,
    "--pgc-font-size-lg": tokens.typography.fontSizeLg,
    "--pgc-font-size-xl": tokens.typography.fontSizeXl,
    "--pgc-line-height-tight": tokens.typography.lineHeightTight,
    "--pgc-line-height-normal": tokens.typography.lineHeightNormal,
    "--pgc-line-height-relaxed": tokens.typography.lineHeightRelaxed,
    "--pgc-font-weight-regular": tokens.typography.fontWeightRegular,
    "--pgc-font-weight-medium": tokens.typography.fontWeightMedium,
    "--pgc-font-weight-semibold": tokens.typography.fontWeightSemibold,
    "--pgc-font-weight-bold": tokens.typography.fontWeightBold,
    "--pgc-space-xxs": tokens.spacing.xxs,
    "--pgc-space-xs": tokens.spacing.xs,
    "--pgc-space-sm": tokens.spacing.sm,
    "--pgc-space-md": tokens.spacing.md,
    "--pgc-space-lg": tokens.spacing.lg,
    "--pgc-space-xl": tokens.spacing.xl,
    "--pgc-space-2xl": tokens.spacing.x2l,
    "--pgc-space-3xl": tokens.spacing.x3l,
    "--pgc-radius-sm": tokens.radius.sm,
    "--pgc-radius-md": tokens.radius.md,
    "--pgc-radius-lg": tokens.radius.lg,
    "--pgc-radius-pill": tokens.radius.pill,
    "--pgc-shadow-sm": tokens.shadow.sm,
    "--pgc-shadow-md": tokens.shadow.md,
    "--pgc-shadow-lg": tokens.shadow.lg,
    "--pgc-motion-duration-fast": tokens.motion.durationFast,
    "--pgc-motion-duration-base": tokens.motion.durationBase,
    "--pgc-motion-duration-slow": tokens.motion.durationSlow,
    "--pgc-motion-easing-standard": tokens.motion.easingStandard,
  };
}

// 保持对旧导出的兼容
export const precisionGraphiteCssVariables = getCssVariables("dark");

export function applyPrecisionGraphiteTheme(
  mode: ThemeMode = "dark",
  root: HTMLElement = document.documentElement,
): void {
  const variables = getCssVariables(mode);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
  // 设置 data-theme 属性，便于 CSS 针对特定主题做样式
  root.setAttribute("data-theme", mode);
}
