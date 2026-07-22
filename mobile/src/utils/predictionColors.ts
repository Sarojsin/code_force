import { palette } from 'src/theme/tokens';

export function getRowColor(delta: number): string {
  const abs = Math.abs(delta);
  if (abs <= 1) return palette.ovulation;
  if (abs === 2) return palette.follicular;
  return '#FFB3C6';
}
