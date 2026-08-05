export interface Point {
  x: number;
  y: number;
}

export function safeStep(plotW: number, len: number): number {
  return len > 1 ? plotW / (len - 1) : 0;
}

export function sanitizePoint(p: Point): Point | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    return null;
  }
  return p;
}

export function buildLinePath(points: Point[]): string {
  const valid = points
    .map(sanitizePoint)
    .filter((p): p is Point => p !== null);
  if (valid.length < 1) return '';
  return valid
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');
}

export function buildAreaPath(
  linePath: string,
  last: number,
  first: number,
  baselineH: number,
): string {
  if (!linePath) return '';
  return `${linePath} L${last},${baselineH} L${first},${baselineH} Z`;
}

export function buildSmoothPath(points: Point[]): string {
  const valid = points
    .map(sanitizePoint)
    .filter((p): p is Point => p !== null);
  if (valid.length < 2) return '';
  let d = `M ${valid[0].x} ${valid[0].y}`;
  for (let i = 1; i < valid.length - 1; i++) {
    const xc = (valid[i].x + valid[i + 1].x) / 2;
    const yc = (valid[i].y + valid[i + 1].y) / 2;
    d += ` Q ${valid[i].x} ${valid[i].y} ${xc} ${yc}`;
  }
  d += ` T ${valid[valid.length - 1].x} ${valid[valid.length - 1].y}`;
  return d;
}