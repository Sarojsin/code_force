import type { ReactNode } from 'react';
import { FiCpu, FiArchive, FiCheckSquare, FiActivity } from 'react-icons/fi';

import { PageHeader } from 'src/components/ui/PageHeader';
import { EmptyState } from 'src/components/ui/Spinner';

interface StubProps {
  title: string;
  subtitle: string;
  phase: string;
  icon: ReactNode;
}

function StubPage({ title, subtitle, phase, icon }: StubProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card">
        <EmptyState icon={icon} title={`${title} is coming in ${phase}`} detail="This screen depends on the Phase 2 Model Ops backend APIs." />
      </div>
    </div>
  );
}

export function TrainingRuns() {
  return (
    <StubPage
      title="Training Runs"
      subtitle="Retraining jobs, durations and failures"
      phase="Phase 2"
      icon={<FiCpu size={28} />}
    />
  );
}

export function ModelRegistry() {
  return (
    <StubPage
      title="Model Registry"
      subtitle="Model versions, metrics and promotion"
      phase="Phase 2"
      icon={<FiArchive size={28} />}
    />
  );
}

export function Evaluation() {
  return (
    <StubPage
      title="Evaluation"
      subtitle="RMSE / MAE per model version"
      phase="Phase 2"
      icon={<FiCheckSquare size={28} />}
    />
  );
}

export function AuditLogs() {
  return (
    <StubPage
      title="Audit Logs"
      subtitle="Actor + payload trail for admin actions"
      phase="Phase 3 (A3)"
      icon={<FiActivity size={28} />}
    />
  );
}
