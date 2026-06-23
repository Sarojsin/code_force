# Implementation Plan 19: Monitoring and Alerting

## Objective
Set up observability for API, workers, and external integrations.

## Steps

### 19.1 Sentry
- Capture API and worker exceptions.
- Tag errors with environment, user_id, and request_id.

### 19.2 Prometheus
- Expose /metrics endpoint with request counters and latency histograms.
- Track Celery queue length and task durations.

### 19.3 Grafana dashboards
- Daily active users, SOS count, sentiment distribution.
- Queue backlog and worker utilization.

### 19.4 Alerting
- PagerDuty for >5% error rate or >30s queue backlog.
- Alert on SOS manual_intervention_needed.

## Validation Criteria
- Metrics visible in Prometheus.
- Grafana dashboard renders expected panels.
- Alerts fire on simulated conditions.
