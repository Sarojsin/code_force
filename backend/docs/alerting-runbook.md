# Alerting Runbook

## Health endpoint checks

| Endpoint | What it validates | Expected |
|----------|------------------|----------|
| `GET /health/live` | App responds (liveness) | `200 OK` |
| `GET /health/ready` | DB + Redis reachable | `200 OK` with `{"database": "ok", "redis": "ok"}` |

Configure Azure Monitor availability tests to hit these every 5 minutes.

## Key metrics to monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| p99 response time | > 3000 ms | Scale up App Service Plan or profile slow endpoint |
| 5xx error rate | > 1 % over 5 min | Check health probes, DB connectivity, app logs |
| Health probe failures | 2 consecutive | Restart App Service, inspect startup |
| DB connection pool | > 80 % | Increase pool size, check for leaked connections |
| Celery queue depth | > 1000 | Scale workers, inspect stuck tasks |
| CPU (App Service) | > 80 % for 10 min | Scale up, check for infinite loops |

## Alert types — step-by-step

### 1. App Service down (liveness probe fails)

1. Confirm via `curl -f https://staging.shecare.app/health/live`
2. Check `az webapp log tail --name shecare-api-staging --slot staging`
3. Restart App Service: `az webapp restart --name shecare-api-staging`
4. If failed again, check deployment slot health and swap back
5. Escalate to backend team if restart does not resolve

### 2. 5xx spike

1. Check Application Insights failed requests
2. Check recent deployments — rollback if symptom matches
3. Check PostgreSQL connectivity (`SELECT 1`)
4. Check Redis connectivity (`PING`)
5. If DB connection pool exhausted, restart workers to release connections
6. If specific endpoint, check its code in recent commits

### 3. p99 latency above threshold

1. Identify slow endpoint from App Insights Performance blade
2. Check if DB query is missing an index
3. Check for N+1 queries in the endpoint service
4. Consider adding caching (Redis) if read-heavy
5. Consider Celery for offloading synchronous work

### 4. Celery queue backup

1. Check worker count: `az webapp list-instances`
2. Inspect dead-letter queue
3. Check for poisoned messages (logs)
4. Restart worker: scale to 0 then back to 1
5. Purge queue if stuck: `celery -A app.core.celery_app purge`

### 5. Health endpoint for readiness fails

1. Check PostgreSQL: `pg_isready`
2. Check Redis: `redis-cli ping`
3. Check if migration is pending: `alembic current`
4. Inspect App Service logs for startup errors

## Runbook for common incidents

### Incident A: Migration failed on deploy

**Symptoms**: readiness probe fails, DB schema mismatch

**Steps**:
1. Hold the deploy — do not swap slot
2. Run `alembic history` to see pending migrations
3. Manually run `alembic upgrade head` via SSH or az CLI
4. If migration is destructive and cannot proceed, reverse with `alembic downgrade -1`
5. Re-run deploy pipeline

### Incident B: High memory / OOM kills

**Symptoms**: App Service restarts, 503 errors

**Steps**:
1. Scale up to B2 or higher temporarily
2. Check Celery worker concurrency setting
3. Check for large JSONB payloads in responses
4. Reduce worker `--concurrency` to 1
5. Profile with Application Insights memory dumps

### Incident C: Celery task stuck

**Symptoms**: queue grows, workers unresponsive

**Steps**:
1. Identify task name from logs
2. Terminate the task: `celery -A app.core.celery_app inspect active`
3. Revoke: `celery -A app.core.celery_app control revoke <task_id> --terminate`
4. Check if task is missing a timeout (add `soft_time_limit` / `time_limit`)
5. Restart Celery worker

### Incident D: Secret rotation needed

**Symptoms**: auth failures, encryption errors

**Steps**:
1. Update secrets in Key Vault
2. Update App Service configuration (without restart)
3. Restart App Service to pick up new values
4. Verify JWT token generation + verification
5. Verify encryption / decryption cycle in tests

## On-call rotation recommendation

### Tool

PagerDuty or Opsgenie with a single rotation schedule.

### Rotation

| Role | Coverage | Response time |
|------|----------|--------------|
| Primary on-call | 24/7 (follow-the-sun) | 15 min (critical), 1 hr (non-critical) |
| Secondary | Same schedule | 30 min (backup) |
| Escalation | Engineering manager | 1 hr |

### Schedule

- 1-week rotation
- Handover on Monday 09:00 UTC
- Primary + secondary from different time zones where possible

### On-call responsibilities

- Acknowledge within 5 min of alert
- Investigate within 15 min
- Provide status update every 30 min until resolved
- File a postmortem for any incident > 1 hr

### Postmortem template

Include: summary, timeline, root cause, action items, prevention.
