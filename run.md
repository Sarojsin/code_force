# Run
Email: testuser@shecare.app
Password: TestPass123!
## Quick Start (Full Stack)

### 1. Start Infrastructure

```bash
cd backend
docker compose up -d postgres redis minio
```

### 2. Start Backend API

```bash
cd backend

# Install dependencies (first run / after lock change)
poetry install

# Apply database migrations
poetry run alembic upgrade head

# Start dev server (hot-reload)
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# OR: poetry run python run.py
```

API available at `http://localhost:8000`
Docs at `http://localhost:8000/docs`

### 3. Start Celery Workers

Open separate terminals:

```bash
cd backend

# Main worker (default + priority queues)
poetry run celery -A app.core.celery_app worker --loglevel=info -Q default,priority

# AI worker (separate for ML inference)
poetry run celery -A app.core.celery_app worker --loglevel=info -Q ai

# Beat scheduler (periodic tasks)
poetry run celery -A app.core.celery_app beat --loglevel=info
```

### 4. Start Mobile App

```bash
cd mobile
npx expo start
# iOS
npx react-native run-ios

# Android
npx react-native run-android

# Metro bundler (if not auto-started)
npx react-native start
```

---

## Individual Component Commands

### Backend API Only

```bash
cd backend
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Workers Only

```bash
cd backend
poetry run celery -A app.core.celery_app worker --loglevel=info --concurrency=4
```

### Database Migrations

```bash
cd backend
poetry run alembic upgrade head          # Apply all pending
poetry run alembic downgrade -1           # Rollback one step
poetry run alembic history                # Show migration history
```

### Seed Reference Data

```bash
cd backend
poetry run python -m app.seed
```

### Run Tests

```bash
cd backend

# All tests
poetry run pytest

# With coverage
poetry run pytest --cov=app --cov-report=term-missing

# Specific module
poetry run pytest tests/modules/cycle/

# Integration tests (requires DB + Redis)
poetry run pytest -m integration
```

### Lint & Type Check

```bash
cd backend

poetry run ruff check app/
poetry run mypy app/
poetry run black --check app/
poetry run isort --check-only app/
```

---

## Production Deployment

### Docker Build

```bash
cd backend

# API image
docker build -t shecare-api:latest .

# Worker image
docker build -t shecare-worker:latest -f Dockerfile.worker .
```

### Docker Compose (Full Stack)

```bash
cd backend
docker compose up -d
```

This starts: API, worker, beat scheduler, PostgreSQL, Redis, MinIO.

### Health Checks

```bash
# Liveness (is the process alive?)
curl http://localhost:8000/health/live

# Readiness (can it serve traffic?)
curl http://localhost:8000/health/ready

# Prometheus metrics
curl http://localhost:8000/metrics
```

### Expected Responses

```json
// Health live
{ "status": "ok" }

// Health ready (all dependencies healthy)
{ "status": "ok", "checks": { "database": "ok", "redis": "ok" } }

// Metrics
# HELP shecare_http_requests_total Total HTTP requests
# TYPE shecare_http_requests_total counter
```

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `Connection refused` on DB | PostgreSQL not running | `docker compose up -d postgres` |
| `No module named 'app'` | Not in venv or wrong directory | Activate venv, run from `backend/` |
| Migration fails | Alembic head mismatch | `alembic stamp head` then `alembic upgrade head` |
| Redis connection error | Redis not running | `docker compose up -d redis` |
| CORS error on mobile | API_BASE_URL wrong | Check `mobile/.env` matches backend URL |
| 429 Too Many Requests | Rate limit hit | Wait for window to expire (check `Retry-After`) |
| SOS not sending SMS | Twilio credentials missing | Set `TWILIO__*` env vars |
