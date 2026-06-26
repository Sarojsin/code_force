# Rollback Strategy

## Scope

This document covers rollback procedures for the SheCare backend API,
database migrations, and configuration changes.

---

## 1. Principles

1. **Migrations are reversible.** Every Alembic migration MUST have a
   `downgrade()` unless the change is destructive (e.g. removing a column
   that cannot be restored). Destructive migrations must document why
   downgrade is impossible and what manual recovery steps exist.

2. **Code and schema are deployed together.** The deploy job runs migrations
   BEFORE swapping the deployment slot. If the migration succeeds but the
   new code fails, only the code is reverted — the schema stays at the new
   version (forward-only schema changes are acceptable because old code
   tolerates extra columns).

3. **Canary before full rollout.** In staging, a single instance receives
   traffic first. If health checks pass for 5 minutes, traffic is shifted.

4. **Backup before every migration.** Pre-deployment creates a `pg_dump`
   that can restore the database to the pre-migration state. See
   `.github/workflows/deploy-staging.yml`.

---

## 2. Rollback triggers

| Signal | Action |
|--------|--------|
| `/health/ready` returns `degraded` after deploy | Automatic rollback via deployment slot swap |
| Error rate > 1% in Sentry (last 5 min) | Manual rollback triggered by on-call |
| PagerDuty alert for `SheCare-Production-Critical` | Manual rollback within 15 min |
| Migration fails in CI | Deploy is aborted. No rollback needed. |

---

## 3. Quick rollback (code only)

Revert the deployment slot:

```bash
# Azure CLI — swap staging back to production
az webapp deployment slot swap \
  --resource-group shecare-rg \
  --name shecare-api \
  --slot staging \
  --target-slot production
```

If the previous slot image is still available:

```bash
# Re-deploy previous Docker image
az webapp config container set \
  --resource-group shecare-rg \
  --name shecare-api \
  --docker-custom-image-name shecare.azurecr.io/api:previous-stable-tag
```

---

## 4. Database rollback

### 4.1 Revert last migration

```bash
alembic downgrade -1
```

### 4.2 Restore from backup (disaster recovery)

```bash
# 1. Stop the app to prevent writes
az webapp stop --resource-group shecare-rg --name shecare-api

# 2. Drop and recreate the database
dropdb shecare
createdb shecare

# 3. Restore from pre-migration dump
pgdump_file="backups/shecare_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
psql shecare < "$pgdump_file"

# 4. Start the app
az webapp start --resource-group shecare-rg --name shecare-api
```

### 4.3 Point-in-time recovery (Azure Database for PostgreSQL)

```bash
az postgres flexible-server restore \
  --resource-group shecare-rg \
  --name shecare-api \
  --source-server shecare-api \
  --restore-time "2026-06-24T14:00:00Z" \
  --yes
```

---

## 5. Configuration rollback

Environment variables and feature flags are stored in:

- **App Service application settings** — revert via Azure Portal → App Service
  → Settings → Configuration → click "Discard" or restore from previous slot.
- **Redis feature flags** — the feature flag endpoint (`/api/v1/features`)
  returns JSON from a config file. Revert by re-deploying the previous version
  of the file.

---

## 6. Rollback communication

1. **Notify #on-call channel** with the reason and scope.
2. **Tag Sentry events** with `rollback` tag.
3. **Create a postmortem issue** if the rollback was caused by a bug.

---

## 7. Testing rollback

Every staging deployment exercises the migration rollback:

```bash
# After deploying to staging
alembic downgrade -1   # Must succeed
alembic upgrade head   # Must re-apply cleanly
```

This is verified in CI during the `db-backup-check` job.
