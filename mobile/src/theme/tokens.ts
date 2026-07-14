/**
 * Design tokens — single source of truth for colors, spacing, typography.
 * Rule §3.2 / §3.5: semantic naming, no hardcoded values in components.
 */

export const palette = {
  // Brand — UI_UX Global_Design_Prompt spec
  primary50: '#FFF1F4',
  primary100: '#FFD9E1',
  primary300: '#FF8FA8',
  primary500: '#FF5C8A', // shecare primary pink (UI_UX spec)
  primary700: '#D6336B',
  // Accent / secondary
  accent50: '#F5F0FF',
  accent100: '#EDE9FE',
  accent300: '#C4B5FD',
  accent500: '#9B7BFF', // soft purple (UI_UX spec)
  accent700: '#7E5BEF',
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
  success500: '#4CAF50', // UI_UX spec
  warning500: '#F4A93C',
  danger500: '#D63B3B',
  info500: '#3B82F6',
  // Phase colors — soft pastel palette per UI_UX spec
  menstrual: '#FF6B8A',
  follicular: '#FFDAB9',
  ovulation: '#D4F0E0',
  luteal: '#E8D5F5',
} as const;

export const colors = {
  // Semantic colors used by components — UI_UX Global_Design_Prompt spec
  background: '#FFF8FB', // UI_UX spec background
  surface: palette.white,
  textPrimary: palette.gray900,
  textSecondary: palette.gray700,
  textMuted: palette.gray500,
  textInverse: palette.white,
  border: palette.gray100,
  primary: palette.primary500,
  primaryMuted: palette.primary100,
  accent: palette.accent500,
  accentMuted: palette.accent100,
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,
  info: palette.info500,
} as const;

export const darkColors = {
  background: '#1A1D26',
  surface: '#2A2D38',
  textPrimary: palette.white,
  textSecondary: palette.gray100,
  textMuted: palette.gray300,
  textInverse: palette.gray900,
  border: '#3A3D48',
  primary: palette.primary300,
  primaryMuted: palette.primary700,
  accent: palette.accent300,
  accentMuted: palette.accent700,
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
  sm: 8,    // inputs, small elements (UI_UX spec: 8px)
  md: 12,   // buttons, chips
  lg: 16,   // standard cards
  xl: 24,   // feature cards, modals, bottom sheets (UI_UX spec: 20-28px)
  pill: 999, // avatars, badges, toggle handles
} as const;

// Font families — load Playfair Display via expo-font in ThemeProvider
export const fonts = {
  heading: 'Playfair Display',
  body: 'Inter',
  mono: 'SF Mono',
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38, fontFamily: fonts.heading },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30, fontFamily: fonts.heading },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26, fontFamily: fonts.body },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, fontFamily: fonts.body },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22, fontFamily: fonts.body },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily: fonts.body },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, fontFamily: fonts.body },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20, fontFamily: fonts.body },
  // Extra variants per UI_UX spec
  displayLogo: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, fontFamily: fonts.heading },
  displayCountdown: { fontSize: 48, fontWeight: '700' as const, lineHeight: 52, fontFamily: fonts.heading },
  tab: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14, fontFamily: fonts.body },
} as const;

export const shadow = {
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
  // Semantic shadows per UI_UX spec
  soft: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  primary: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  sos: {
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Min touch target size (rule §10.4)
export const minTouchTarget = 44;

export type ThemeColors = { [K in keyof typeof colors]: string };
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Typography = typeof typography;
