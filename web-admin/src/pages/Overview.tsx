import { useQuery } from '@tanstack/react-query';

import { adminApi } from 'src/api/admin';
import { Card } from 'src/components/ui/Card';
import { PageHeader, StatCard } from 'src/components/ui/PageHeader';
import { Badge } from 'src/components/ui/Badge';
import { EmptyState } from 'src/components/ui/Spinner';

export function Overview() {
  const analytics = useQuery({
    queryKey: ['analytics'],
    queryFn: adminApi.getAnalytics,
    retry: 1,
  });

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Platform health and activity at a glance"
      />

      {analytics.isLoading && <EmptyState title="Loading analytics…" />}
      {analytics.isError && <EmptyState title="Could not load analytics" detail="Check that the backend is reachable and your session is valid." />}

      {analytics.data && (
        <>
          <div className="stat-grid">
            <StatCard label="Total users" value={analytics.data.total_users} tone="primary" />
            <StatCard label="Active users" value={analytics.data.active_users} tone="success" />
            <StatCard label="SOS events" value={analytics.data.sos_count} tone="danger" />
            <StatCard label="Pregnancies" value={analytics.data.pregnancy_count} tone="info" />
            <StatCard label="Nurses" value={analytics.data.nurse_count} tone="warning" />
          </div>

          <Card title="Platform status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StatusRow label="API" value="Online" tone="success" />
              <StatusRow label="Model artifact" value="Legacy v1 (fallback)" tone="warning" />
              <StatusRow label="Broadcast" value="Queued only (Phase 3 A1)" tone="muted" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'muted' | 'danger' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
