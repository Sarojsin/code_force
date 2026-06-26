# Gap Plan 9: Rollback + Backup Verification in Staging

> **Target:** Rollback procedure tested end-to-end in staging + backup verified restorable
> **Current:** `docs/rollback.md` exists but never tested
> **Priority:** MEDIUM — depends on staging environment (Gap Plan 6)

---

## 9.1 Pre-requisites

- [ ] Staging environment provisioned (Gap Plan 6)
- [ ] `docs/rollback.md` existing with rollback procedures
- [ ] Pre-migration backup script tested

---

## 9.2 Test: Code-Only Rollback (No Schema Change)

### Scenario
Deploy code with a deliberate bug → detect → rollback to previous image.

### Steps

```bash
# 1. Tag current (good) version
git tag v1.0.0-staging
git push origin v1.0.0-staging

# 2. Deploy buggy version (e.g., route always returns 500)
git checkout -b test/rollback-code
# Intentionally break a route
git commit -am "test: intentional 500 for rollback testing"
git push origin test/rollback-code
# Trigger deploy-staging.yml manually with this branch

# 3. Verify health check fails
curl -s https://shecare-api-staging.azurewebsites.net/health/live
# Expected: 500 or timeout

# 4. Rollback to v1.0.0-staging
az webapp config container set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --docker-custom-image-name shecare-api:v1.0.0-staging

# 5. Verify health restores
curl -s https://shecare-api-staging.azurewebsites.net/health/live
# Expected: {"status": "ok"}

# 6. Clean up branch
git branch -D test/rollback-code
git push origin --delete test/rollback-code
```

### Validation Criteria
- [ ] Health check fails after buggy deploy
- [ ] Rollback restores health within 2 min
- [ ] No data loss (DB unchanged)
- [ ] Downtime < 5 min (with communication)

---

## 9.3 Test: Backward-Compatible Schema Rollback

### Scenario
Deploy migration that adds a nullable column → rollback code + revert schema.

### Steps

```bash
# 1. Create test migration
cd backend/
alembic revision --autogenerate -m "test_add_nullable_col_for_rollback"
# Edit to add nullable column, e.g., ALTER TABLE users ADD COLUMN test_rollback VARCHAR

# 2. Run pre-migration backup
pg_dump --format=custom --file=pre_migration_test.dump \
  --dbname=$STAGING_DATABASE_URL --no-owner --no-acl

# 3. Apply migration
alembic upgrade head

# 4. Verify column exists
psql $STAGING_DATABASE_URL -c "\d users" | grep test_rollback

# 5. Rollback schema
alembic downgrade -1

# 6. Verify column removed
psql $STAGING_DATABASE_URL -c "\d users" | grep test_rollback
# Expected: no output (column gone)

# 7. Clean up migration file (do NOT commit)
rm backend/alembic/versions/*test_add_nullable_col_for_rollback*
```

### Validation Criteria
- [ ] Pre-migration backup complete (file size > 0)
- [ ] Migration applies successfully
- [ ] `alembic downgrade -1` reverses migration
- [ ] Schema returns to original state
- [ ] Backup file available in artifact store or blob storage

---

## 9.4 Test: Destructive Schema Rollback (from Backup)

### Scenario
Simulate accidental destructive migration (column drop) → restore from pre-migration dump.

### Steps

```bash
# 1. Create destructive migration (for testing only in staging)
alembic revision -m "test_destructive_for_rollback"
# Edit to: op.drop_column('users', 'display_name')

# 2. Pre-migration backup
pg_dump --format=custom --file=pre_migration_destructive.dump \
  --dbname=$STAGING_DATABASE_URL --no-owner --no-acl

# 3. Apply destructive migration (DO NOT run in production)
alembic upgrade head

# 4. Verify column is gone
psql $STAGING_DATABASE_URL -c "\d users" | grep display_name
# Expected: no output

# 5. Stop app traffic (maintenance mode simulation)
az webapp config appsettings set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --settings MAINTENANCE_MODE=true

# 6. Restore from backup
pg_restore --dbname=$STAGING_DATABASE_URL --clean pre_migration_destructive.dump

# 7. Rollback code to previous version
az webapp config container set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --docker-custom-image-name shecare-api:v1.0.0-staging

# 8. Restore traffic
az webapp config appsettings set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --settings MAINTENANCE_MODE=false

# 9. Verify
curl -s https://shecare-api-staging.azurewebsites.net/health/live
# Expected: {"status": "ok"}

# 10. Verify data integrity
psql $STAGING_DATABASE_URL -c "SELECT count(*) FROM users;"
psql $STAGING_DATABASE_URL -c "\d users" | grep display_name
# Expected: column restored, row count matches before-value
```

### Validation Criteria
- [ ] Pre-migration backup complete
- [ ] Destructive migration removes column
- [ ] `pg_restore --clean` restores column + data
- [ ] App health returns after restore
- [ ] Data integrity: row counts match before-and-after
- [ ] Downtime < 15 min

---

## 9.5 Test: Automated Daily Backup

### Verify Azure PostgreSQL backup configuration

```bash
az postgres flexible-server show \
  --resource-group shecare-staging \
  --name shecare-db-staging \
  --query '{backup_retention_days:backupRetentionDays, geo_redundant_backup:geoRedundantBackup}'

# Expected: backup_retention_days=7, geo_redundant_backup=Disabled
```

### Perform a point-in-time restore (PITR) test

```bash
# Create a new server from PITR (this takes ~10-15 min)
az postgres flexible-server restore \
  --restore-time "$(date -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
  --source-server shecare-db-staging \
  --name shecare-db-restore-test \
  --resource-group shecare-staging

# Verify data in restored instance
PGPASSWORD=$STAGING_DB_PASSWORD psql \
  --host=shecare-db-restore-test.postgres.database.azure.com \
  --username=shecare_admin \
  --dbname=shecare_staging \
  --command="SELECT count(*) FROM users;"

# Compare row counts with production
# (They should match to the restore time)

# Teardown
az postgres flexible-server delete \
  --name shecare-db-restore-test \
  --resource-group shecare-staging \
  --yes
```

---

## 9.6 Pre-Deployment Checklist Automation

**File:** `scripts/check-pre-deploy.sh`

```bash
#!/bin/bash
# Fail if any check fails

echo "=== Pre-Deployment Check ==="

# 1. Verify pre-migration backup
if [ ! -f "pre_migration_*.dump" ]; then
  echo "FAIL: No pre-migration backup found"
  exit 1
fi
echo "PASS: Pre-migration backup exists"

# 2. Verify migration backward-compatible
# (Manual review — check for DROP or ALTER ... SET NOT NULL)
echo "REVIEW: Check migration for destructive DDL"

# 3. Verify rollback plan documented in PR
echo "REVIEW: Check PR description for rollback section"

# 4. Verify tests pass
cd backend && poetry run pytest --tb=short -x modules/ -q
if [ $? -ne 0 ]; then
  echo "FAIL: Tests not passing"
  exit 1
fi
echo "PASS: All tests pass"
```

---

## 9.7 Adding to CI/CD

Add to `.github/workflows/deploy-staging.yml`:

```yaml
  pre-migration-backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with: { creds: ${{ secrets.AZURE_CREDENTIALS }} }
      - name: pg_dump
        run: |
          pg_dump --format=custom --file=pre_migration_$(date +%Y%m%d_%H%M%S).dump \
            --dbname="${{ secrets.STAGING_DATABASE_URL }}" --no-owner --no-acl
      - uses: actions/upload-artifact@v4
        with:
          name: pre-migration-backup
          path: pre_migration_*.dump
          retention-days: 7
```

---

## 9.8 Validation Checklist

- [ ] Code-only rollback: deploy bug → rollback → health restored
- [ ] Backward-compatible schema: add column → downgrade → column gone
- [ ] Destructive schema: drop column → restore from dump → column restored
- [ ] Automated daily backup: retention=7 days, geo-redundant=Disabled
- [ ] PITR: restore to 1 hour ago → data matches
- [ ] Pre-deployment script: backup exists, tests pass, migration reviewed
- [ ] CI/CD: pre-migration backup runs before deploy
- [ ] Rollback tested in staging within last 30 days
