# Gap Plan 6: Staging Azure Provisioning

> **Target:** Fully provisioned staging environment with health checks passing
> **Current:** 0 — no Azure resources exist (only `docs/staging-environment.md`)
> **Priority:** MEDIUM — blocked by Azure CLI + subscription access

---

## 6.1 Resource Requirements

| Resource | SKU | Purpose | Estimated Cost/Month |
|----------|-----|---------|---------------------|
| Azure App Service (Linux) | B2 (2 vCPU, 4 GB) | FastAPI backend API | ~$70 |
| Azure Cache for Redis | Basic C0 (250 MB) | Celery broker + rate limiting | ~$15 |
| PostgreSQL Flexible Server | B1ms (1 vCPU, 2 GB) | Primary database | ~$25 |
| Azure Blob Storage | LRS Hot (10 GB) | Model files, backups | ~$1 |
| Application Insights | Pay-as-you-go | Logging + metrics | ~$5 |
| **Total estimated** | | | **~$116/mo** |

---

## 6.2 Provisioning Steps

### Step 1: Create Resource Group

```bash
az group create --name shecare-staging --location eastus
```

### Step 2: Create PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group shecare-staging \
  --name shecare-db-staging \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --backup-retention 7 \
  --geo-redundant-backup Disabled \
  --admin-user shecare_admin \
  --admin-password "$STAGING_DB_PASSWORD" \
  --database-name shecare_staging \
  --public-access 0.0.0.0  # Restrict to App Service IP after creation
```

### Step 3: Create Redis Cache

```bash
az redis create \
  --resource-group shecare-staging \
  --name shecare-redis-staging \
  --sku Basic \
  --vm-size C0 \
  --enable-non-ssl-port
```

### Step 4: Create App Service Plan + Web App

```bash
az appservice plan create \
  --resource-group shecare-staging \
  --name shecare-plan-staging \
  --sku B2 \
  --is-linux

az webapp create \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --plan shecare-plan-staging \
  --runtime "PYTHON:3.11"
```

### Step 5: Create Blob Storage

```bash
az storage account create \
  --resource-group shecare-staging \
  --name shecarestoragestaging \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --account-name shecarestoragestaging \
  --name models \
  --public-access off

az storage container create \
  --account-name shecarestoragestaging \
  --name backups \
  --public-access off
```

### Step 6: Configure App Settings

```bash
az webapp config appsettings set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --settings \
    ENVIRONMENT=staging \
    DATABASE__URL="postgresql+asyncpg://shecare_admin:$STAGING_DB_PASSWORD@shecare-db-staging.postgres.database.azure.com/shecare_staging" \
    REDIS__URL="redis://$STAGING_REDIS_KEY@shecare-redis-staging.redis.cache.windows.net:6379/0" \
    SENTRY__BACKEND_DSN="$STAGING_SENTRY_DSN" \
    RATE_LIMIT__ENABLED=true \
    CORS__ORIGINS="https://shecare-app-staging.azurewebsites.net" \
    AZURE_STORAGE__CONNECTION_STRING="$STAGING_STORAGE_CONNECTION_STRING" \
    APPINSIGHTS_INSTRUMENTATIONKEY="$STAGING_APPINSIGHTS_KEY"
```

### Step 7: Enable Application Insights

```bash
az monitor app-insights component create \
  --resource-group shecare-staging \
  --app shecare-ai-staging \
  --location eastus \
  --application-type web

# Get instrumentation key
AI_KEY=$(az monitor app-insights component show \
  --resource-group shecare-staging \
  --app shecare-ai-staging \
  --query instrumentationKey -o tsv)

# Link to App Service
az webharness config appsettings set \
  --resource-group shecare-staging \
  --name shecare-api-staging \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$AI_KEY
```

### Step 8: Deploy via GitHub Actions

The existing `.github/workflows/deploy-staging.yml` is configured to use `azd up`. Ensure:

1. Azure service principal created and added as `AZURE_CREDENTIALS` secret
2. All secrets provisioned in GitHub environment "staging":
   - `AZURE_CREDENTIALS`
   - `STAGING_DATABASE_URL`
   - `STAGING_REDIS_URL`
   - `STAGING_SENTRY_DSN`
   - `AZURE_STORAGE_CONNECTION_STRING`

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "shecare-staging-github" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/shecare-staging \
  --sdk-auth

# Output JSON stored as GitHub secret AZURE_CREDENTIALS
```

### Step 9: Verify Health Check

```bash
# After deployment
curl https://shecare-api-staging.azurewebsites.net/health/live
# Expected: {"status": "ok"}

curl https://shecare-api-staging.azurewebsites.net/health/ready
# Expected: {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}
```

---

## 6.3 Network Security

| Rule | Source | Destination | Purpose |
|------|--------|-------------|---------|
| App Service → PostgreSQL | App Service outbound IPs | PostgreSQL :5432 | Database access |
| App Service → Redis | App Service outbound IPs | Redis :6380 | Cache + broker |
| Public → App Service | `*` | App Service :443 | User-facing API |
| App Service → Storage | App Service identity | Storage :443 | Model file backup |

---

## 6.4 Configuration Management

All config in `app/core/config.py` using Pydantic `BaseSettings`. The `ENVIRONMENT` env var selects the config class:

```python
class Settings(BaseSettings):
    environment: str = "development"
    database: DatabaseSettings
    redis: RedisSettings
    sentry: SentrySettings
    rate_limit: RateLimitSettings

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.getenv("ENVIRONMENT", "development")
        if env == "staging":
            return cls(rate_limit=RateLimitSettings(enabled=True))
        return cls()
```

---

## 6.5 CI/CD Flow

```
Push to main/develop
  → GitHub Actions: backend-ci.yml (lint, test, security)
  → If all pass: build Docker image
  → Push to Azure Container Registry
  → Trigger deploy-staging.yml (manual for now)

Manual trigger:
  → Deploy: azd up --environment staging
  → Validate: /health/ready returns 200
  → Notify: Slack #deployments channel
```

---

## 6.6 Day-2 Operations

```bash
# SSH into App Service container
az webapp ssh --resource-group shecare-staging --name shecare-api-staging

# Tail logs
az webapp log tail --resource-group shecare-staging --name shecare-api-staging

# Run migrations
az webapp ssh --resource-group shecare-staging --name shecare-api-staging \
  --command "cd /home/site/wwwroot && alembic upgrade head"
```

---

## 6.7 Validation

```bash
# All resources exist
az resource list --resource-group shecare-staging --output table

# Health checks pass
curl -s https://shecare-api-staging.azurewebsites.net/health/ready | jq .
# {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}

# App Insights receiving telemetry
az monitor app-insights query \
  --app shecare-ai-staging \
  --analytics-query "requests | where timestamp > ago(5m) | count"
```

---

## 6.8 Pre-requisites

- [ ] Azure CLI installed and logged in
- [ ] Contributor access to Azure subscription
- [ ] SSL certificate for custom domain (optional)
- [ ] GitHub environment `staging` configured with secrets
- [ ] Dockerfile or `azd` template ready for deployment
