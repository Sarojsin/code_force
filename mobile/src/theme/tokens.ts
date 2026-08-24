/**
 * Design tokens — single source of truth for colors, spacing, typography.
 * Rule §3.2 / §3.5: semantic naming, no hardcoded values in components.
 */

export const palette = {
  // Brand — SheCare_Mobile_App_Design spec
  primary50: '#FFF8F0',   // warm cream bg
  primary100: '#FFE8EF',  // mood bg
  primary300: '#FFB3C6',  // blushLight — soft bg / hover
  primary500: '#FF6B8A',  // blush — primary pink (design spec)
  primary700: '#D4507A',  // gradient mid point
  primary900: '#A83060',  // hero gradient deep end
  // Accent / secondary
  accent50: '#F5F0FF',
  accent100: '#EDE9FE',
  accent300: '#C4B5FD',
  accent500: '#9B7BFF', // soft purple (UI_UX spec)
  accent700: '#7E5BEF',
  wellness500: '#4FB7B3', // teal for emotional wellness
  // Design-specific accent palette
  roseQuartz: '#F7C5CC', // subtle borders, card accents
  mauve:      '#D4A5B5', // secondary accent, decorative
  lavender:   '#E8D5F5', // phase cards, wellness
  mint:       '#D4F0E0', // success / wellness bg
  warmCream:  '#FFF8F0', // page background
  blushLight: '#FFB3C6', // soft bg / chip active
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
  success500: '#4CAF50',
  warning500: '#F4A93C',
  danger500: '#EF4444',  // design's `red`
  danger700: '#DC2626',  // design's `redD` — SOS active
  info500: '#3B82F6',
  // Phase colors — design spec exact values
  menstrual: '#FF6B8A',
  follicular: '#FFB3C6', // changed from #FFDAB9 to design spec
  ovulation: '#D4F0E0',
  luteal: '#E8D5F5',
} as const;

export const colors = {
  // Semantic colors used by components — SheCare_Mobile_App_Design spec
  background: palette.warmCream, // #FFF8F0 — design's `cream`
  surface: palette.white,
  textPrimary: palette.gray900,
  textSecondary: palette.gray700,
  textMuted: palette.gray500,
  textInverse: palette.white,
  border: palette.gray100,
  primary: palette.primary500,      // #FF6B8A — design's `blush`
  primaryMuted: palette.primary100, // #FFE8EF
  primaryLight: palette.blushLight, // #FFB3C6 — design's `blushL`
  accent: palette.accent500,        // #9B7BFF
  accentMuted: palette.accent100,   // #EDE9FE
  accentLight: palette.lavender,    // #E8D5F5 — design's `lavender`
  roseQuartz: palette.roseQuartz,   // #F7C5CC — design's `rose`
  mauve: palette.mauve,             // #D4A5B5 — design's `mauve`
  mint: palette.mint,               // #D4F0E0 — design's `mint`
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,        // #EF4444 — design's `red`
  dangerDark: palette.danger700,    // #DC2626 — design's `redD`
  info: palette.info500,
  // Design-specific text colors (warmer tone) — darkened for WCAG AA (≥4.5:1) on cream #FFF8F0
  textDark: '#2D1B26',    // headings — design's `dark`
  textMid: '#5A3A47',     // secondary body — design's `mid`
  textSoft: '#7C4E5A',    // captions / muted — design's `soft`
  textLighter: '#96677A', // inactive / subtle dividers — design's `lighter`
  // DayDetailSheet additive tokens (DayDetailShee_plan.md §5)
  primaryDeep: '#FF4D8D',
  lightPink: '#FFE6EF',
  sheetBg: '#FFF8FA',
  card: palette.white,
  borderSubtle: '#EFEFEF',
  textStrong: '#1C1C1E',
  accentGreen: '#53C46A',
  accentPurple: '#8A5CF6',
  accentBlue: '#4DA8FF',
  accentOrange: '#FFA640',
} as const;

export const darkColors = {
  background: '#1A1D26',
  surface: '#2A2D38',
  textPrimary: palette.white,
  textSecondary: palette.gray100,
  textMuted: palette.gray300,
  textInverse: palette.gray900,
  border: '#3A3D48',
  primary: palette.primary300,      // #FFB3C6 — lighter for dark bg
  primaryMuted: palette.primary700, // #D4507A
  primaryLight: '#7A3D55',
  accent: palette.accent300,        // #C4B5FD
  accentMuted: palette.accent700,   // #7E5BEF
  accentLight: '#4A3055',
  roseQuartz: palette.gray300,      // #C7CCD6
  mauve: '#8A6A7A',
  mint: '#2D4A3A',
  success: palette.success500,
  warning: palette.warning500,
  danger: '#FF6B6B',
  dangerDark: '#FF4444',
  info: palette.info500,
  textDark: palette.white,
  textMid: palette.gray100,
  textSoft: palette.gray300,
  textLighter: palette.gray500,
  // DayDetailSheet additive tokens (dark)
  primaryDeep: '#FF6B9A',
  lightPink: '#4A2030',
  sheetBg: '#2A2D38',
  card: '#2A2D38',
  borderSubtle: '#3A3D48',
  textStrong: palette.white,
  accentGreen: '#6DD87A',
  accentPurple: '#A87AFF',
  accentBlue: '#6BB8FF',
  accentOrange: '#FFB866',
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
  sheet: 28, // DayDetailSheet radius
  cardLg: 20, // large cards
  chip: 14, // symptom/medication chips
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
  title: { fontSize: 21, fontWeight: '700' as const, lineHeight: 26, fontFamily: fonts.body },
  detail: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, fontFamily: fonts.body },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22, fontFamily: fonts.body },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily: fonts.body },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, fontFamily: fonts.body },
  annotation: { fontSize: 9, fontWeight: '600' as const, lineHeight: 12, letterSpacing: 0.4, fontFamily: fonts.body },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20, fontFamily: fonts.body },
  // Extra variants per UI_UX spec
  displayLogo: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, fontFamily: fonts.heading },
  displayCountdown: { fontSize: 48, fontWeight: '700' as const, lineHeight: 52, fontFamily: fonts.heading },
  tab: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14, fontFamily: fonts.body },
  // Design-specific variants — SheCare_Mobile_App_Design
  h1Large: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34, fontFamily: fonts.heading },
  // "Good morning, Sofia ✨", "Today's Entry"
  label: { fontSize: 10, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.9, fontFamily: fonts.body },
  // "STEP 1 OF 6", "NEXT PERIOD", "ENERGY LEVEL"
  heroValue: { fontSize: 36, fontWeight: '800' as const, lineHeight: 40, fontFamily: fonts.heading },
  // large countdown numbers like "14" in "14 days"
  countdown: { fontSize: 54, fontWeight: '900' as const, lineHeight: 58, fontFamily: fonts.heading },
   // SOS countdown number
   chip: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, fontFamily: fonts.body },
   // symptom chips, phase pills
   greeting: { fontSize: 15, fontWeight: '500' as const, lineHeight: 20, fontFamily: fonts.body },
   // "Sunday, 27 July" date line
   // Emoji-only text — uses system font to avoid custom font stretching on Android
   emoji: { fontSize: 28, fontFamily: 'System' },
  // DayDetailSheet typography (DayDetailShee_plan.md §5)
  dayTitle: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38, fontFamily: fonts.body },
  sectionTitle: { fontSize: 19, fontWeight: '600' as const, lineHeight: 24, fontFamily: fonts.body },
  helper: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, fontFamily: fonts.body },
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
  // Semantic shadows per design spec
  soft: {
    shadowColor: '#D4A5B5',  // rose-tinted
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  primary: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },
  hero: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 16,
  },
  chip: {
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.27,
    shadowRadius: 12,
    elevation: 3,
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
