import type { ReactNode } from 'react';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  approved: 'success',
  published: 'success',
  draft: 'muted',
  pending: 'warning',
  rejected: 'danger',
  unpublished: 'info',
  active: 'success',
  inactive: 'muted',
  user: 'muted',
  nurse: 'info',
  admin: 'primary',
};

export function Badge({ tone, children }: BadgeProps) {
  const resolved = tone ?? STATUS_TONE[String(children).toLowerCase()] ?? 'muted';
  return <span className={`badge badge-${resolved}`}>{children}</span>;
}
