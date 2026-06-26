# Gap Plan 7: Azure Monitor Alerts + On-Call Rotation

> **Target:** Configured monitoring alerts + on-call rotation defined in PagerDuty
> **Current:** 0 — no alerts configured (only `docs/alerting-runbook.md`)
> **Priority:** MEDIUM — blocked by Azure provisioning (Gap Plan 6)

---

## 7.1 Alert Thresholds (from Phase 6 plan)

| Alert Name | Condition | Severity | Channel | Action |
|------------|-----------|----------|---------|--------|
| **API Down** | Health check fails > 5 min | Critical | PagerDuty + Slack | Wake on-call engineer |
| **High Error Rate** | > 5% 5xx in 5-min window | Critical | Slack critical | Investigate, rollback |
| **P95 Latency Spike** | > 2s for 5 consecutive min | High | Slack high | Check DB/Redis/external deps |
| **Rate Limiter Pressure** | > 50% requests hit 429 in 5-min window | Warning | Slack warning | Check for abuse |
| **Model Download Failure** | > 10 failures in 1 hour | Warning | Slack warning | Check Blob Storage |
| **Backup Failure** | pg_dump or Azure backup fails | Critical | Slack critical | Manual backup |
| **Migration Error** | alembic upgrade fails in CI/CD | Critical | Slack critical | Block deploy |
| **DB Connection Pool Exhausted** | > 80% connections used | High | Slack high | Scale or fix leak |
| **Redis Memory Usage** | > 80% of maxmemory | Warning | Slack warning | Scale or evict |
| **App Service CPU** | > 80% for 10 min | Warning | Slack warning | Scale up/investigate |

---

## 7.2 Azure Monitor Metric Alerts

### Create Action Group (triggers Slack + PagerDuty)

```bash
# Create action group
az monitor action-group create \
  --resource-group shecare-staging \
  --name "shecare-oncall" \
  --short-name "shecare-oncall" \
  --action email oncall-email "oncall@shecare.app" \
  --action webhook slack-webhook "https://hooks.slack.com/services/T00/B00/XXXXX" \
  --action itsm pagerduty "pagerduty-integration-id"
```

### Set up 5 metric alerts

```bash
# 1. API Down - Health check failure
az monitor metrics alert create \
  --resource-group shecare-staging \
  --name "API-Down" \
  --description "Health check fails for >5 min" \
  --severity 0 \
  --condition "count Http5xx > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-groups "/subscriptions/.../actionGroups/shecare-oncall"

# 2. High Error Rate - >5% 5xx
az monitor metrics alert create \
  --name "High-Error-Rate" \
  --resource-group shecare-staging \
  --description ">5% of requests return 5xx in 5 min" \
  --severity 1 \
  --condition "percentage Http5xx > 5" \
  --window-size 5m \
  --action-groups "/subscriptions/.../actionGroups/shecare-oncall"

# 3. P95 Latency Spike - >2s
# Note: Requires Application Insights
az monitor metrics alert create \
  --name "P95-Latency-Spike" \
  --resource-group shecare-staging \
  --description "P95 response time >2s for 5 consecutive min" \
  --severity 2 \
  --condition "avg Duration > 2000" \
  --window-size 5m \
  --action-groups "/subscriptions/.../actionGroups/shecare-oncall"

# 4. App Service CPU >80%
az monitor metrics alert create \
  --name "High-CPU" \
  --resource-group shecare-staging \
  --description "CPU >80% for 10 min" \
  --severity 3 \
  --condition "avg CpuPercentage > 80" \
  --window-size 10m \
  --action-groups "/subscriptions/.../actionGroups/shecare-oncall"

# 5. DB Connection Pool
az monitor metrics alert create \
  --name "DB-Connection-Pool-Exhausted" \
  --resource-group shecare-staging \
  --description ">80% connections used" \
  --severity 2 \
  --condition "avg connections > 80" \
  --window-size 5m \
  --action-groups "/subscriptions/.../actionGroups/shecare-oncall"
```

---

## 7.3 Application Insights Smart Detection

Enable via Azure Portal or CLI:

```bash
# Enable Smart Detection rules
az monitor app-insights component update \
  --resource-group shecare-staging \
  --app shecare-ai-staging \
  --smart-detection-enabled true
```

Smart Detection automatically catches:
- Degradation in server response time
- Dependency duration degradation
- Trace severity ratio degradation
- Abnormal rise in exception volume
- Potential memory leak
- Potential security issue

---

## 7.4 Log Analytics Queries (KQL)

### 5xx Error Rate
```kusto
requests
| where timestamp > ago(5m)
| where success == false
| summarize ErrorCount = count() by bin(timestamp, 1m)
| where ErrorCount > 5
```

### P95 Latency
```kusto
requests
| where timestamp > ago(5m)
| summarize percentiles(duration, 95) by bin(timestamp, 1m)
| where percentile_duration_95 > 2000
```

### Rate Limiter Pressure
```kusto
requests
| where timestamp > ago(5m)
| where responseCode == 429
| summarize RateLimitedCount = count() by bin(timestamp, 1m)
| where RateLimitedCount > 0
```

---

## 7.5 PagerDuty Integration

### If using PagerDuty:

```bash
# Create PagerDuty service
# Go to PagerDuty → Services → New Service → "SheCare Staging"
# Integration Type: Azure Monitor
# Copy integration key

# Create Azure action group pointing to PagerDuty
az monitor action-group create \
  --resource-group shecare-staging \
  --name "shecare-pagerduty" \
  --action itsm pagerduty "PD_INTEGRATION_KEY"
```

### On-Call Rotation (from Phase 6 plan)

| Role | Schedule | Response SLA |
|------|----------|-------------|
| Primary on-call | Week 1-2 | Critical: 15 min acknowledge, 1 hr mitigate |
| Secondary on-call | Week 3-4 | Warning: 1 hr acknowledge, 4 hr fix |
| Escalation | Team lead | Info: Next business day |

### If not using PagerDuty (fallback):

```bash
# Use Slack webhook + manual rotation tracking
az monitor action-group create \
  --resource-group shecare-staging \
  --name "shecare-slack-only" \
  --action webhook slack-alerts "https://hooks.slack.com/services/..."
```

---

## 7.6 Runbooks

Create these as quick-reference files:

| File | Contents |
|------|----------|
| `docs/runbooks/api-down.md` | 1. Check App Service status. 2. Restart. 3. Rollback if stuck. |
| `docs/runbooks/high-5xx.md` | 1. Check recent deploy. 2. Check DB connectivity. 3. Check Redis. 4. Rollback. |
| `docs/runbooks/latency-spike.md` | 1. Check slow queries. 2. Check Redis hit rate. 3. Check external deps. |
| `docs/runbooks/backup-failure.md` | 1. Manual `pg_dump`. 2. Check storage. 3. Disable failing backup. |

Already documented in `docs/alerting-runbook.md` — ensure it's linked from the repo root.

---

## 7.7 Validation

```bash
# Verify alerts exist
az monitor metrics alert list --resource-group shecare-staging --output table

# Test health check failure alert (staging only)
# Temporarily stop the App Service, verify PagerDuty/Slack notification

# Test error rate alert
# Send 100 requests, 6 with invalid auth → verify alert fires

# Verify Slack webhook delivery
# Check #alerts channel for test message

# Simulate on-call handoff
# Update PagerDuty schedule, verify escalation
```
