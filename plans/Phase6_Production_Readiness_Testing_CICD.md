# Phase 6: Production Readiness, Testing & CI/CD

## Objective

Production-harden the entire stack: 80%+ test coverage, CI/CD pipelines, structured logging, Sentry error tracking, rate limiting, and a staging environment that mirrors production.

## 6.1 Test Coverage Targets

| Layer | Tool | Target | Location |
|-------|------|--------|----------|
| Backend unit | `pytest + httpx.AsyncClient` | 85% | `tests/modules/<feature>/test_*.py` |
| Backend integration | `pytest + test DB` | 85% | `tests/modules/<feature>/test_*.py` |
| Mobile unit | Jest | 80% | `src/**/__tests__/*.test.ts(x)` |
| Mobile component | RNTL | 70% | `src/components/**/__tests__/*.test.tsx` |
| E2E (critical paths) | Detox/Maestro | 3 flows | `e2e/` |

### Backend: Fill Coverage Gaps

Critical paths that must be tested (check existing `tests/modules/<feature>/`):

| Module | Must-Test Paths |
|--------|----------------|
| **auth** | Register → login → refresh → logout → password change (invalidates tokens) |
| **auth** | MFA enable → verify → login with MFA |
| **auth** | Token with rotated `user_secret_key` → 401 |
| **cycle** | Create entry → calendar returns correct day types |
| **cycle** | Heuristic → median → linear regression → RF fallback chain |
| **cycle** | Dirty flag set → retrain task picks it up |
| **cycle** | Irregular user (std_dev > 3.5) → prediction_window_days set |
| **cycle** | Global model: train → export JSON → download endpoint |
| **onboarding** | Create → backfill → 4 cycle_entries created |
| **onboarding** | Onboarding_completed event emitted |
| **onboarding** | Past cycle data correctly inserted |
| **safety** | SOS trigger → idempotency check → FCM sent |
| **safety** | SOS resolve → status changed |
| **safety** | Emergency contact CRUD |
| **safety** | 15-min checkin task |
| **journal** | Create → local analysis → structured data sync |
| **journal** | LLM/heuristic fallback analysis |

### Mobile: Jest + RNTL Tests

```
src/
  services/
    api/
      __tests__/
        auth.test.ts
        cycle.test.ts
        safety.test.ts
    sync/
      __tests__/
        syncEngine.test.ts
  stores/
    __tests__/
      authStore.test.ts
      offlineStore.test.ts
  validation/
    __tests__/
      onboarding.test.ts
      auth.test.ts
  components/
    ui/
      __tests__/
        PeriodCalendar.test.tsx
        SOSButton.test.tsx
```

### E2E Test Flows (Detox)

```javascript
// e2e/login-onboarding-cycle.test.js
describe('Critical Paths', () => {
  it('Flow 1: Register → Onboard → See Calendar', async () => {
    // Register with email/password
    // Complete 6-step onboarding
    // Verify calendar renders with backfilled data
  });

  it('Flow 2: Log Period → See Prediction → Correct It', async () => {
    // Log a period entry
    // Verify prediction appears
    // Log correction
    // Verify prediction_error_days updated
  });

  it('Flow 3: SOS Trigger → Resolve', async () => {
    // Navigate to Safety screen
    // Trigger SOS (with mock FCM)
    // Verify SOS active
    // Resolve SOS
    // Verify SOS resolved
  });
});
```

## 6.2 CI/CD Pipeline

### GitHub Actions: `backend-ci.yml`

```yaml
name: Backend CI

on:
  push:
    branches: [main, develop]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install poetry
      - run: poetry install
      - run: ruff check .
      - run: mypy --strict app/
      - run: isort --check-only .
      - run: black --check .

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env: { POSTGRES_DB: shecare_test, POSTGRES_PASSWORD: testpass }
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - run: pip install poetry
      - run: poetry install
      - run: alembic upgrade head
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:testpass@localhost/shecare_test
      - run: pytest --cov=app --cov-fail-under=80 --cov-report=term-missing
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:testpass@localhost/shecare_test
          REDIS_URL: redis://localhost:6379/0

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with: { scan-type: 'fs', scan-ref: 'backend/' }
      - name: Scan Python dependencies for vulnerabilities
        run: |
          pip install safety
          safety check -r requirements.txt
        working-directory: backend/
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@v3
        with: { path: ./backend/ }
```

### GitHub Actions: `mobile-ci.yml`

```yaml
name: Mobile CI

on:
  push:
    branches: [main, develop]
    paths: ['mobile/**']
  pull_request:
    branches: [main]
    paths: ['mobile/**']

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: mobile/
      - run: npx tsc --noEmit
        working-directory: mobile/
      - run: npx eslint src/
        working-directory: mobile/

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: mobile/
      - run: npx jest --coverage --coverageThreshold='{"global":{"branches":75,"functions":80,"lines":80,"statements":80}}'
        working-directory: mobile/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: mobile/
      - name: Scan npm dependencies for vulnerabilities
        run: npm audit --production --audit-level=high
        working-directory: mobile/
```

### GitHub Actions: `deploy-staging.yml` (Manual Trigger)

```yaml
name: Deploy Staging

on:
  workflow_dispatch:

jobs:
  pre-migration-backup:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with: { creds: ${{ secrets.AZURE_CREDENTIALS }} }
      - name: pg_dump pre-migration backup
        run: |
          pg_dump --format=custom \
            --file=pre_migration_$(date +%Y%m%d_%H%M%S).dump \
            --dbname="${{ secrets.STAGING_DATABASE_URL }}" \
            --no-owner --no-acl
          echo "Backup file size: $(ls -lh pre_migration_*.dump | awk '{print $5}')"
      - name: Upload backup to artifact store
        uses: actions/upload-artifact@v4
        with:
          name: pre-migration-backup
          path: pre_migration_*.dump
          retention-days: 7

  deploy:
    needs: pre-migration-backup
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with: { creds: ${{ secrets.AZURE_CREDENTIALS }} }
      - run: azd up --environment staging
        env:
          AZURE_ENV_NAME: staging
          AZURE_LOCATION: eastus
```

## 6.3 Structured Logging (Backend)

### `app/core/logging.py` (with structlog)

```python
import structlog
from structlog.processors import JSONRenderer, TimeStamper, add_log_level
from structlog.stdlib import LoggerFactory

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        add_log_level,
        TimeStamper(fmt="iso"),
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=LoggerFactory(),
    cache_logger_on_first_use=True,
)

# Per-module logger
log = structlog.get_logger("app.modules.cycle")

# Usage:
log.info("prediction_computed",
         user_id=str(user_id),
         model_used=result.model_used,
         confidence=result.confidence,
         data_points=result.data_points)
```

### Request ID Middleware

```python
# Already in FastAPI via middleware
# Each request gets X-Request-ID (generated if not provided by client)
# Logged in every structlog entry via contextvars

import structlog
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id")

class RequestIDMiddleware:
    async def __call__(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_var.set(rid)
        with structlog.contextvars.bind_contextvars(request_id=rid):
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
```

### Log Levels Guide

| Level | When |
|-------|------|
| INFO | Request start/end (summary only, no body), user registration, cycle prediction computed, SOS triggered, Celery task start/end |
| DEBUG | SQL queries, external API request/response bodies (with PII redacted), model inference details |
| WARNING | Rate limit hit, slow query (>200ms), retryable external failure, stale cache used |
| ERROR | Unhandled exception, permanent external failure, Celery task exhausted retries, model training failure |
| CRITICAL | Data corruption detected, auth system compromised, persistent database connection failure |

## 6.4 Sentry Error Tracking

### Backend

```python
# app/core/sentry.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

def init_sentry(config: Settings):
    sentry_sdk.init(
        dsn=config.sentry.backend_dsn,
        environment=config.environment,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            CeleryIntegration(),
        ],
        traces_sample_rate=0.1,      # 10% in production
        # Tag every event with request_id and user_id
        before_send=lambda event, hint: _tag_event(event, hint),
    )

def _tag_event(event, hint):
    from structlog.contextvars import get_merged_contextvars
    ctx = get_merged_contextvars()
    if "request_id" in ctx:
        event["tags"]["request_id"] = ctx["request_id"]
    if "user_id" in ctx:
        event["tags"]["user_id"] = ctx["user_id"]
    # Ensure no PII in event message or extra data
    return event
```

### Mobile

```typescript
// src/services/sentry.ts
import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@env';

export function initSentry() {
  // Wait for user consent before initializing
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    // Auto-instrument React Navigation, network calls
    integrations: [new Sentry.ReactNativeTracing()],
    beforeSend(event) {
      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter(b => {
          const msg = b.message || '';
          return !msg.includes('journal') && !msg.includes('password');
        });
      }
      return event;
    },
  });
}

// User consent dialog (shown at onboarding or first error)
export async function requestSentryConsent(): Promise<boolean> {
  // Show dialog "Help us improve? Send anonymous error reports?"
  // Return user choice
}
```

## 6.5 Rate Limiting

### Backend Decorator (`app/core/rate_limiter.py`)

```python
from fastapi import Request, HTTPException
import aioredis
import functools

class RateLimiter:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis

    def __call__(self, limit: int = 100, window: int = 60,
                 key_prefix: str = "rate_limit"):
        def decorator(func):
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                request = kwargs.get("request")
                if not request:
                    return await func(*args, **kwargs)

                # User-based key if authenticated, else IP-based
                user = getattr(request.state, "user", None)
                key = f"{key_prefix}:{user.id if user else request.client.host}"

                current = await self.redis.incr(key)
                if current == 1:
                    await self.redis.expire(key, window)

                if current > limit:
                    retry_after = await self.redis.ttl(key)
                    raise HTTPException(
                        status_code=429,
                        headers={"Retry-After": str(retry_after)},
                        detail={"code": "RATE_LIMIT_EXCEEDED",
                                "retry_after": retry_after}
                    )

                return await func(*args, **kwargs)
            return wrapper
        return decorator
```

### Per-Endpoint Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Auth (login, register, refresh) | 10 | 60 s |
| Auth (MFA, password change) | 5 | 300 s |
| Cycle (create entry, predictions) | 100 | 60 s |
| SOS | 3 | 300 s |
| Journal | 60 | 60 s |
| Onboarding | 5 | 300 s |
| Model download | 3 | 3600 s |

## 6.6 Staging Environment

### Resources
```
Azure App Service (B2) for API
Azure Cache for Redis (Basic C0)
PostgreSQL Flexible Server (B1ms) — 1 vCPU, 2 GB
Azure Blob Storage (LRS, Hot) for model files
```

### Configuration
```bash
# .env.staging
ENVIRONMENT=staging
DATABASE_URL=postgresql+asyncpg://...  # Azure Flexible Server
REDIS_URL=redis://...                   # Azure Redis
SENTRY_BACKEND_DSN=...                  # Staging Sentry project
SENTRY_MOBILE_DSN=...                   # Staging Sentry project
RATE_LIMIT_ENABLED=true
```

## 6.7 Database Migration Strategy

```
Step 1 (before deployment):
  alembic upgrade head   # Run migrations while old code still runs

Step 2 (zero-downtime):
  Deploy new code (handles both old and new schema)

Step 3 (< 1 hour later):
  Remove backward-compatibility shims from code
  Create new migration dropping deprecated columns
```

## 6.8 Backup & Disaster Recovery

### Automated Daily Backups

Azure PostgreSQL Flexible Server provides automated daily backups with 7-day retention. Point-in-time restore (PITR) enables rollback to any minute within the retention window.

```bash
# Verify backup configuration via Azure CLI
az postgres flexible-server show \
  --resource-group shecare-staging \
  --name shecare-db-staging \
  --query '{backup_retention_days:backupRetentionDays, geo_redundant_backup:geoRedundantBackup}'
# Expected: backup_retention_days=7, geo_redundant_backup=Enabled
```

### Pre-Migration Backup

Every production migration must be preceded by a manual snapshot:

```bash
# Before: alembic upgrade head
pg_dump --format=custom --file=pre_migration_$(date +%Y%m%d_%H%M%S).dump \
  --dbname=$DATABASE_URL --no-owner --no-acl

# After migration, keep the dump for 7 days
```

### Model File Backups

```
Source: /storage/models/prod/ on App Service
Destination: Azure Blob Storage container shecare-models-backup
Schedule: Daily at 02:00 UTC via cron or Logic App
Retention: 30 days
```

### Backup Verification

```bash
# Monthly restore test to staging environment
# 1. Create a new PostgreSQL server from latest backup
az postgres flexible-server restore \
  --restore-time "$(date -d 'yesterday' +%Y-%m-%dT%H:%M:%S)" \
  --source-server shecare-db-prod \
  --name shecare-db-restore-test

# 2. Run health checks against restored instance
# 3. Verify data integrity (row counts, latest records)
# 4. Tear down test server
```

### Disaster Recovery Runbook

| Scenario | RTO | RPO | Action |
|----------|-----|-----|--------|
| Single node failure | < 1 min | 0 | Azure HA auto-failover (if zone-redundant) |
| Region outage | < 1 hr | < 1 hr | Geo-restore from geo-redundant backup to paired region |
| Accidental data delete | < 30 min | < 5 min | PITR to timestamp before delete |
| Database corruption | < 2 hr | < 24 hr | Restore latest clean backup, replay WAL |
| Full region loss | < 4 hr | < 1 hr | Deploy infra via Bicep + geo-restore DB |

## 6.9 Security Scanning & Dependency Auditing

### Backend

| Tool | What it scans | Frequency | Fail condition |
|------|---------------|-----------|----------------|
| `ruff check .` | Python code quality (rules, patterns) | Every PR | Any violation |
| `mypy --strict` | Type safety | Every PR | Any type error |
| `safety check` | Python package CVEs (`requirements.txt`) | Every PR | High/critical CVE |
| `trivy` | Container image, filesystem CVEs | Every PR | High/critical CVE |
| `trufflehog` | Hardcoded secrets in code | Every PR | Any secret found |

```bash
# Local run: scan Python dependencies
cd backend/
pip install safety
safety check -r requirements.txt
```

### Mobile

| Tool | What it scans | Frequency | Fail condition |
|------|---------------|-----------|----------------|
| `npx tsc --noEmit` | TypeScript type safety | Every PR | Any type error |
| `npx eslint src/` | Code quality | Every PR | Any lint error |
| `npm audit --audit-level=high` | npm package CVEs | Every PR | High/critical CVE |

```bash
# Local run: scan npm dependencies
cd mobile/
npm audit --production --audit-level=high
```

## 6.10 Rollback Strategy

### Code Rollback (No Schema Change)

```
1. Identify the last known-good Docker image tag
2. Re-deploy: az webapp deploy --resource-group <rg> --name <app> --image-tag v1.2.3
3. Verify health endpoint returns 200
4. If the buggy code already wrote bad data, run a data repair script
```

### Schema Rollback (Backward-Compatible Change)

If the migration added a nullable column or a new table (no destructive DDL):

```
1. Roll back code first (previous Docker image)
2. Schema is already compatible — old code ignores the new column
3. Optionally roll back schema:
   alembic downgrade -1
```

### Schema Rollback (Destructive Change)

If the migration dropped or renamed a column (not recommended per §17 rule):

```
1. Stop traffic to the app (maintenance mode)
2. Restore DB from pre-migration pg_dump:
   pg_restore --dbname=$DATABASE_URL --clean pre_migration_*.dump
3. Roll back code to previous Docker image
4. Verify health endpoint
5. Resume traffic
```

### Rollback Runbook

| Situation | Action | Risk |
|-----------|--------|------|
| Bug in route handler (no DB change) | Revert Docker image, no migration needed | None |
| Bug in service layer (no DB change) | Revert Docker image, no migration needed | None |
| Migration added nullable column | Revert code first; optionally downgrade schema | Low |
| Migration added NOT NULL column | Rollback requires restore from backup | Medium — data loss window |
| Migration dropped column | Restore from pre-migration dump + revert code | High — requires maintenance window |

### Pre-Deployment Checklist

- [ ] `pg_dump` completed and verified (file size > 0)
- [ ] Migration tested on staging first
- [ ] Migration is backward-compatible (nullable columns, no drops)
- [ ] Rollback plan documented in the PR description

## 6.11 Alerting & On-Call

### Health Check Endpoint

The existing `GET /health/ready` returns DB + Redis status. A lightweight `GET /health/live` (no dependencies) is also available.

```python
# Already in app/main.py
@router.get("/health/live")
async def liveness():
    return {"status": "ok"}

@router.get("/health/ready")
async def readiness():
    checks = {"database": await check_db(), "redis": await check_redis()}
    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}
```

### Alert Thresholds

| Alert | Condition | Channel | Action |
|-------|-----------|---------|--------|
| API Down | Health check fails > 5 min | PagerDuty / Slack | Wake on-call engineer |
| High Error Rate | > 5% of requests return 5xx in 5-min window | Slack critical | Investigate, rollback if needed |
| P95 Latency Spike | > 2 s for 5 consecutive minutes | Slack high | Investigate DB queries, Redis, or external deps |
| Rate Limiter Pressure | > 50% of requests hit 429 in 5-min window | Slack warning | Check for abuse or misconfigured client |
| Model Download Failure | > 10 failures in 1 hour | Slack warning | Check Blob Storage or CDN |
| Backup Failure | pg_dump or Azure backup fails | Slack critical | Manual backup, investigate |
| Migration Error | alembic upgrade fails in CI/CD | Slack critical | Block deploy, fix migration |

### On-Call Rotation

```
Primary: Developer A (week 1-2)
Secondary: Developer B (week 3-4)
Escalation: Team lead

Response SLAs:
  Critical: 15 min to acknowledge, 1 hr to mitigate
  Warning:  1 hr to acknowledge, 4 hr to fix
  Info:     Next business day
```

### Azure Monitor Setup

```bash
# Enable Application Insights for the App Service
az webapp config appsettings set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=<key>

# Set up metric alerts
az monitor metrics alert create \
  --name "API-5xx-rate" \
  --resource-group shecare-staging \
  --condition "count Http5xx > 5" \
  --window-size 5m \
  --action <action-group-id>
```

## 6.12 Data Privacy & Compliance

### Right to Erasure

```
DELETE /api/v1/user/account
  1. Validates authentication + password confirmation
  2. Soft-deletes user (is_active = false)
  3. Anonymizes: display_name → "Deleted User", email → hash, phone → hash
  4. Clears: medical_notes, fcm_tokens, journal entries content
  5. Schedules hard-delete after 30 days (Celery task)
  6. Returns 202 Accepted with scheduled_deletion_date
```

### Data Export

```
GET /api/v1/user/export
  1. Validates authentication + password confirmation
  2. Collects: profile, cycle_entries, journal_entries, mood_logs, pregnancy_data, emergency_contacts
  3. Returns JSON envelope:
     {
       "exported_at": "2026-06-24T12:00:00Z",
       "user": { ... },
       "cycle_entries": [...],
       "journal_entries": [...],
       "mood_logs": [...],
       "pregnancy_data": { ... },
       "emergency_contacts": [...]
     }
  4. 200 OK with Content-Disposition: attachment
```

### Retention Policy

| Data Category | Active Retention | Post-Deletion | Archive |
|---------------|-----------------|---------------|---------|
| User profile | Until account deleted | 30 days (anonymized) | — |
| Journal content | Until account deleted | 30 days (content zeroed) | — |
| Emergency contacts | Until account deleted | 30 days (deleted) | — |
| Cycle logs | Until account deleted | 30 days (deleted) | — |
| Pregnancy data | Until account deleted | 30 days (deleted) | — |
| SOS alerts | 2 years from trigger | Anonymized (user_id zeroed) | Cold storage after 2 yr |
| Audit logs | 90 days | 30 days (anonymized) | Cold storage after 120 days |
| Structured logs | 30 days | Archived to Blob Storage | 1 year in cold storage |
| Sentry events | 90 days | — | — |

### Log Rotation

```bash
# Application logs (stdout/stderr from App Service)
# Azure App Service auto-rotates; retain 30 days via diagnostics settings

az webapp log config \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --application-logging filesystem \
  --retention-in-days 30

# Structured JSON logs shipped to Blob Storage for archival
# Archive policy: delete after 365 days
```

## Validation Criteria

### Backend

- [ ] `pytest --cov=app --cov-fail-under=80` passes
- [ ] `ruff check . && mypy --strict app/` passes
- [ ] `safety check` passes with no high/critical vulnerabilities
- [ ] structlog outputs valid JSON with request_id + user_id
- [ ] Sentry captures exceptions with request_id tag
- [ ] Rate limiter returns 429 with Retry-After header
- [ ] Rate limiter resets after window expiry
- [ ] `DELETE /api/v1/user/account` soft-deletes and anonymizes
- [ ] `GET /api/v1/user/export` returns all user data in JSON
- [ ] `GET /health` returns 200 with DB + Redis status

### Mobile

- [ ] `npx tsc --noEmit && npx jest --coverage` passes
- [ ] `npm audit --audit-level=high` passes
- [ ] Sentry strips PII from events before send

### CI/CD

- [ ] Backend lint + typecheck + test + security scan all pass
- [ ] Mobile lint + typecheck + test + security scan all pass
- [ ] E2E critical flow passes on staging
- [ ] E2E: Register → Onboard → See Calendar (Flow 1)
- [ ] E2E: Log Period → See Prediction → Correct It (Flow 2)
- [ ] E2E: SOS Trigger → Resolve (Flow 3)
- [ ] Deploy: staging environment provisioned and passing health checks

### Operations

- [ ] Automated daily backups enabled and verified
- [ ] Point-in-time restore enabled and tested
- [ ] Migration script includes `pg_dump` pre-migration
- [ ] Rollback procedure documented in `docs/rollback.md`
- [ ] Rollback tested in staging environment before production deployment
- [ ] Alerting rules configured (health check, error rate, latency, rate limit)
- [ ] On-call rotation defined
