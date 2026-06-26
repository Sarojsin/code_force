# Staging Environment

## Required Azure resources

| Resource | SKU / Tier | Purpose |
|----------|-----------|---------|
| App Service (Linux) | B1 (Burstable) | FastAPI application host |
| App Service Plan | B1 | Underlying compute |
| Deployment Slot | staging | Swap-ready warm slot |
| PostgreSQL Flexible Server | B1ms (1 vCore, 2 GB) | Primary database |
| Redis Cache | Standard C0 (250 MB) | Celery broker + rate limiter |
| Storage Account (blob) | Standard LRS | User uploads (avatars, videos) |
| Application Insights | Consumption | APM + distributed tracing |
| Log Analytics Workspace | Per-GB | Central log aggregation |

## Configuration checklist

### Application settings (App Service → Configuration → Application settings)

| Key | Value / Source | Notes |
|-----|---------------|-------|
| `ENVIRONMENT` | `staging` | |
| `DATABASE__URL` | `postgresql+asyncpg://...` | Use PG admin user + SSL |
| `REDIS__URL` | `redis://...:6379/0` | Include access key if non-SSL |
| `REDIS__CELERY_BROKER_URL` | `redis://...:6379/2` | |
| `REDIS__CELERY_RESULT_BACKEND` | `redis://...:6379/3` | |
| `JWT__SECRET_KEY` | random 32+ chars | Rotate quarterly |
| `JWT__REFRESH_SECRET_KEY` | random 32+ chars | Different from SECRET_KEY |
| `ENCRYPTION__MASTER_KEY` | Fernet-compatible key | Generate via `fernet.Fernet.generate_key()` |
| `SENTRY__DSN` | Sentry project DSN | |

### App Service TLS/SSL

- Enable HTTPS Only
- Minimum TLS version: 1.2
- Import wildcard `*.shecare.app` cert or use Azure App Service Managed Cert

### CORS

- Set `CORS_ORIGINS` to `["https://staging.shecare.app"]`

### PostgreSQL

- Enforce SSL connections
- Set `connection_pool_size=5` (B1ms is constrained)
- Weekly `VACUUM ANALYZE` cron (via pg_cron or Azure Maintenance Window)

## Deployment steps

The canonical deploy workflow is defined in `.github/workflows/deploy-staging.yml`.

### Trigger

Push to the `develop` branch (any path under `backend/`).

### Pipeline steps

1. Checkout
2. Python setup (3.11)
3. `pip install -r requirements.txt`
4. Pre-deploy DB backup (pg_dump simulation)
5. `alembic upgrade head`
6. Deploy to staging slot
7. Smoke test (`GET /health/live`)
8. Swap slot to production (manual confirmation)

### Manual deploy

```bash
az webapp deployment slot create --name shecare-api-staging --slot staging --resource-group rg-shecare-staging
az webapp deploy --resource-group rg-shecare-staging --name shecare-api-staging --slot staging --src-path backend/dist.zip
```

## Accessing the staging environment

### Base URL

```
https://shecare-api-staging.azurewebsites.net
```

### Health endpoints

| Endpoint | Expected status |
|----------|----------------|
| `GET /health/live` | `200 OK` |
| `GET /health/ready` | `200 OK` (DB + Redis reachable) |
| `GET /api/v1/health` | `{"status": "ok"}` |

### Connecting the mobile app

Set `API_BASE_URL` in the mobile app's .env to the staging URL.

### SSH into App Service

```bash
az webapp ssh --resource-group rg-shecare-staging --name shecare-api-staging --slot staging
```

### Viewing logs

```bash
az webapp log tail --resource-group rg-shecare-staging --name shecare-api-staging --slot staging
```

For structured queries, use Application Insights:

```
traces
| where cloud_RoleName == "shecare-api-staging"
| where timestamp > ago(1h)
| order by timestamp desc
```
