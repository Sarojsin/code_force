# SheCare Backend - Master Implementation Plan Index

This is the master plan file that references all other implementation plan files.

## Canonical 25 Backend Plans (match `00-master-index.md` numbering)

- 01-project-setup.md - Project setup, Docker, CI/CD
- 02-database-migrations.md - Database schema and migrations
- 03-encryption-security.md - Encryption utilities and security headers
- 04-auth-module.md - OTP, JWT, MFA, sessions
- 05-user-profile.md - User profile CRUD, avatar, GDPR
- 06-external-services.md - Twilio, FCM, Stream Chat, S3, HuggingFace
- 07-cycle-tracking.md - Period tracking and predictions
- 08-wellness-journal.md - Journal entries, mood logs, breathing exercises
- 10-pregnancy-support.md - Pregnancy profiles, daily logs, milestones
- 11-safety-sos.md - SOS alerts, emergency contacts, retry logic
- 12-family-linking.md - Invite links, permissions, shared data
- 13-nurse-content.md - Nurse profiles and educational content
- 14-chat-integration.md - Stream Chat tokens and room management
- 15a-celery-ai-cycle.md - Celery tasks: sentiment analysis + cycle prediction
- 15b-celery-notifications.md - Celery tasks: push, SMS, cleanup, weekly insights
- 16-admin-module.md - Admin endpoints and broadcasts
- 17-middleware-logging.md - Rate limiting, audit logs, error format
- 18-testing.md - Unit, integration, load, security tests
- 19-deployment.md - Docker, ECS, scaling
- 20-monitoring.md - Sentry, Prometheus, Grafana, alerting
- 21-compliance-docs.md - GDPR, data retention, consent, ADRs, OpenAPI
- 22-voice-journal-stubs.md - Placeholder voice endpoints
- 23-pagination-query-optimization.md - Pagination, filtering, N+1 prevention, caching, query tuning
- 38-seeding-migrations.md - Seed data, backfill scripts, zero-downtime migrations

## Cross-Cutting Refinements (on-disk extensions 22-40)

These complement the 25 canonical plans; reference them when their topic intersects
the work in the canonical plans.

- 03b-encryption-utils.md - Refinement of plan 3 (PBKDF2 + Fernet envelope encryption)
- 24-rate-limiting.md - slowapi configuration, per-endpoint rate groups
- 25-health-checks.md - liveness / readiness / startup probes
- 26-background-scheduler.md - Celery Beat schedule
- 27-api-versioning.md - /api/v1/ versioning, deprecation headers
- 28-validation-serialization.md - Pydantic schema split (Create/Update/Response/InDB)
- 29-test-fixtures.md - factory_boy + Faker + pytest fixtures
- 30-mobile-api-contract.md - RN ↔ backend contract, idempotency, ETag
- 31-consent-privacy.md - Consent logging, GDPR export, opt-outs
- 32-caching.md - Redis cache layers, invalidation, fallback
- 33-webhooks.md - Stream Chat + Twilio webhooks, signature verification
- 34-bulk-operations.md - Admin bulk import/export
- 35-feature-flags.md - DB/Redis flags, percentage rollout
- 36-disaster-recovery.md - Backups, PITR, failover
- 37-load-testing.md - Locust, p95/p99 targets
- 39-localization.md - Accept-Language, locale-aware formatting
- 40-session-management.md - User sessions, device tracking, remote logout

## Companion Documents (project root)

- AGENTS.md - Operating instructions for AI agents; distills the key invariants
  from backend_rules.md and frontend_rules.md that must be enforced on every
  code change.
- backend_rules.md - Authoritative modular backend rules (20 sections, 253 lines).
- frontend_rules.md - Authoritative React Native frontend rules (19 sections, 273 lines).
- Celery_task_design,SOS_retry_logic,chat_integration.md - Deep design for the
  three most rule-heavy subsystems (Celery, SOS retry, Stream Chat).
- summery_plan.md - Original backend overview (15 sections, 558 lines) - useful
  as a context reference but the per-plan files are the source of truth.

## Numbering Notes

- The canonical 25 plans do not perfectly fit numeric 01-25. Sentiment analysis
  (master plan 9) is folded into 15a-celery-ai-cycle.md. Plan 9 was rolled into 15a
  to keep all Celery work in one place. Performance optimization (master plan 24)
  is split into 23-pagination-query-optimization.md and 32-caching.md. Data
  migrations and seeding (master plan 25) is implemented in 38-seeding-migrations.md.
- Cross-cutting plans 22-40 are NOT in the master 25 — they are extra refinements
  the team has produced. They supplement the canonical plans; they do not replace them.

## Plan Status (use to track work)

| # | Plan | Status |
|---|------|--------|
| 01 | project-setup | **complete** |
| 02 | database-migrations | **complete** |
| 03 | encryption-security | **complete** |
| 04 | auth-module | **complete** |
| 05 | user-profile | **complete** |
| 06 | external-services | **complete** |
| 07 | cycle-tracking | **complete** |
| 08 | wellness-journal | **complete** |
| 10 | pregnancy-support | **complete** |
| 11 | safety-sos | **complete** |
| 12 | family-linking | **complete** |
| 13 | nurse-content | **complete** |
| 14 | chat-integration | **complete** |
| 15a | celery-ai-cycle | **complete** (tasks in cycle + wellness) |
| 15b | celery-notifications | **complete** (tasks in auth + users + safety) |
| 16 | admin-module | **complete** |
| 17 | middleware-logging | **complete** ✓ |
| 18 | testing | **complete** ✓ |
| 19 | deployment | **complete** ✓ |
| 20 | monitoring | **complete** ✓ |
| 21 | compliance-docs | **complete** ✓ |
| 22 | voice-journal-stubs | **complete** ✓ |
| 23 | pagination-query-optimization | **complete** ✓ |
| 38 | seeding-migrations | **complete** ✓ |
| v1 | dashboard-ml | **planned** → `v1_dashboard_ml_plan.md` |

## V1 Feature Plan

| Plan | Status |
|------|--------|
| `v1_dashboard_ml_plan.md` | **planned** — User onboarding, enhanced cycle dashboard, ML predictions, sentiment keywords, wellness recommendations |

Update this table as work progresses.
