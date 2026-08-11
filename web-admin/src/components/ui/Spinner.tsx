import type { ReactNode } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'lg';
  label?: string;
}

export function Spinner({ size = 'sm', label }: SpinnerProps) {
  return (
    <span className="spinner" style={{ width: size === 'lg' ? 34 : 18, height: size === 'lg' ? 34 : 18 }} role="status" aria-label={label ?? 'Loading'} />
  );
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-screen">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, detail }: { icon?: ReactNode; title: string; detail?: string }) {
  return (
    <div className="empty-state">
      {icon}
      <div style={{ fontWeight: 600 }}>{title}</div>
      {detail && <div>{detail}</div>}
    </div>
  );
}
