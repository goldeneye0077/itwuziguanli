import { precisionGraphiteTokens } from "../styles/tokens";

const pxToNumber = (value: string): number => Number.parseInt(value.replace("px", ""), 10);

export const precisionGraphiteAntdTheme = {
  token: {
    colorPrimary: precisionGraphiteTokens.color.accentPrimary,
    colorInfo: precisionGraphiteTokens.color.accentPrimary,
    colorSuccess: precisionGraphiteTokens.color.statusSuccess,
    colorWarning: precisionGraphiteTokens.color.statusWarning,
    colorError: precisionGraphiteTokens.color.statusDanger,
    colorText: precisionGraphiteTokens.color.textPrimary,
    colorTextSecondary: precisionGraphiteTokens.color.textSecondary,
    colorBorder: precisionGraphiteTokens.color.borderDefault,
    colorBgBase: precisionGraphiteTokens.color.bgSurface,
    colorBgContainer: precisionGraphiteTokens.color.bgSurface,
    colorFillSecondary: precisionGraphiteTokens.color.bgSubtle,
    fontFamily: precisionGraphiteTokens.typography.fontFamilyBase,
    fontSize: pxToNumber(precisionGraphiteTokens.typography.fontSizeMd),
    borderRadius: pxToNumber(precisionGraphiteTokens.radius.md),
    motionDurationFast: precisionGraphiteTokens.motion.durationFast,
    motionDurationMid: precisionGraphiteTokens.motion.durationBase,
    motionDurationSlow: precisionGraphiteTokens.motion.durationSlow,
  },
  components: {
    Layout: {
      bodyBg: precisionGraphiteTokens.color.bgCanvas,
      headerBg: precisionGraphiteTokens.color.bgSurface,
      siderBg: precisionGraphiteTokens.color.bgSurface,
      triggerBg: precisionGraphiteTokens.color.bgSurface,
      triggerColor: precisionGraphiteTokens.color.textSecondary,
    },
    Menu: {
      itemBg: "transparent",
      itemColor: precisionGraphiteTokens.color.textSecondary,
      itemHoverColor: precisionGraphiteTokens.color.textPrimary,
      itemHoverBg: precisionGraphiteTokens.color.accentMuted,
      itemSelectedBg: precisionGraphiteTokens.color.accentMuted,
      itemSelectedColor: precisionGraphiteTokens.color.accentPrimary,
      itemBorderRadius: pxToNumber(precisionGraphiteTokens.radius.sm),
    },
    Card: {
      colorBorderSecondary: precisionGraphiteTokens.color.borderDefault,
      borderRadiusLG: pxToNumber(precisionGraphiteTokens.radius.lg),
      boxShadowTertiary: precisionGraphiteTokens.shadow.sm,
    },
    Button: {
      borderRadius: pxToNumber(precisionGraphiteTokens.radius.md),
      colorPrimary: precisionGraphiteTokens.color.accentPrimary,
      colorPrimaryHover: precisionGraphiteTokens.color.accentHover,
      colorPrimaryActive: precisionGraphiteTokens.color.accentActive,
    },
  },
} as const;
