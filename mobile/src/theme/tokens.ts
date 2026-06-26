/**
 * Design tokens — single source of truth for colors, spacing, typography.
 * Rule §3.2 / §3.5: semantic naming, no hardcoded values in components.
 */

export const palette = {
  // Brand
  primary50: '#FFF1F4',
  primary100: '#FFD9E1',
  primary300: '#FF8FA8',
  primary500: '#E63462', // shecare primary pink
  primary700: '#A41B45',
  // Accent / secondary
  accent500: '#7E5BEF', // soft purple for pregnancy
  wellness500: '#4FB7B3', // teal for emotional wellness
  // Neutral
  white: '#FFFFFF',
  black: '#0E0E10',
  gray50: '#F7F7F9',
  gray100: '#EEF0F4',
  gray300: '#C7CCD6',
  gray500: '#7B8194',
  gray700: '#3B4151',
  gray900: '#1A1D26',
  // Status
  success500: '#2EB37B',
  warning500: '#F4A93C',
  danger500: '#D63B3B',
  info500: '#3B82F6',
} as const;

export const colors = {
  // Semantic colors used by components
  background: palette.gray50,
  surface: palette.white,
  textPrimary: palette.gray900,
  textSecondary: palette.gray700,
  textMuted: palette.gray500,
  textInverse: palette.white,
  border: palette.gray100,
  primary: palette.primary500,
  primaryMuted: palette.primary100,
  accent: palette.accent500,
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,
  info: palette.info500,
} as const;

export const darkColors = {
  background: palette.gray900,
  surface: palette.gray700,
  textPrimary: palette.white,
  textSecondary: palette.gray100,
  textMuted: palette.gray300,
  textInverse: palette.gray900,
  border: palette.gray700,
  primary: palette.primary300,
  primaryMuted: palette.primary700,
  accent: palette.accent500,
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,
  info: palette.info500,
} as const;

// 4-px grid (rule §3.2)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20 },
} as const;

export const shadow = {
  // iOS shadow + Android elevation combined
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// Min touch target size (rule §10.4)
export const minTouchTarget = 44;

export type ThemeColors = { [K in keyof typeof colors]: string };
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Typography = typeof typography;
