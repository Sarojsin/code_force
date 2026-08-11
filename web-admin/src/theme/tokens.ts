/**
 * Design tokens — semantic names only (frontend_rules §2.3).
 * Dark mode is supported via CSS custom properties defined in `global.css`;
 * this file is the single source of truth for the palette + scale.
 */

export const palette = {
  primary: '#7C5CBF',
  primaryStrong: '#6A4BB0',
  primarySoft: '#EFEAFB',
  secondary: '#E8688A',
  accent: '#4FB0A6',

  danger: '#D9534F',
  dangerSoft: '#FBE9E8',
  success: '#2E9E6B',
  successSoft: '#E5F5ED',
  warning: '#E8A23D',
  warningSoft: '#FCF2E1',
  info: '#3D7FD9',
  infoSoft: '#E7F0FB',

  bg: '#F7F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EFF6',
  border: '#E3E0EC',
  text: '#221F2E',
  textMuted: '#6B6779',
  overlay: 'rgba(34, 31, 46, 0.45)',
} as const;

/** 4px grid (frontend_rules §2.3). */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  hero: 28,
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(34,31,46,0.06)',
  md: '0 4px 12px rgba(34,31,46,0.08)',
  lg: '0 12px 32px rgba(34,31,46,0.12)',
} as const;

export const motion = {
  fast: '120ms ease',
  base: '200ms ease',
  slow: '320ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const layout = {
  sidebarWidth: 232,
  topbarHeight: 64,
  contentMaxWidth: 1200,
} as const;
