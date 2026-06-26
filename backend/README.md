# SheCare Backend

Women's wellness API — FastAPI + PostgreSQL + Redis + Celery.

## Stack

- **Python 3.11+** / **FastAPI** — async HTTP
- **SQLAlchemy 2.x async** — database
- **PostgreSQL 15** — primary store
- **Redis 7** — rate limiting, Celery broker, cache
- **Celery** — async task queue
- **Alembic** — schema migrations

## Quick Start

```bash
# Create virtualenv
python -m venv venv
.\venv\Scripts\activate

# Install
pip install poetry
poetry install

# Configure
cp .env.example .env
# Edit .env with your settings

# Start infra (Postgres + Redis + MinIO)
docker compose up -d postgres redis minio

# Run migrations
alembic upgrade head

# Seed reference data
python -m app.seed

# Start API
uvicorn app.main:app --reload
```

## API Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health/live
- Metrics: http://localhost:8000/metrics

## Architecture

```
app/
  core/           — config, database, security, event_bus, encryption
  integrations/   — twilio, stream_chat, fcm, s3, huggingface
  modules/        — feature modules (auth, cycle, wellness, ...)
    <feature>/
      routes.py       — thin HTTP handlers
      services.py     — business logic
      models.py       — SQLAlchemy models
      schemas.py      — Pydantic schemas
      dependencies.py — FastAPI dependencies
      tasks.py        — Celery tasks
      exceptions.py   — error types
  main.py         — app factory
tests/
  modules/<feature>/  — tests per module
```

## Key Rules
- Package by feature, not layer.
- Routes are thin; business logic lives in services.
- Cross-module communication uses event bus (not direct imports).
- Celery tasks are idempotent with time limits.
- Sensitive fields encrypted at service layer.

## Environment Variables
See `.env.example` for all required variables. Key ones:

| Variable | Purpose |
|----------|---------|
| `DATABASE__URL` | PostgreSQL connection string |
| `REDIS__URL` | Redis connection string |
| `JWT__SECRET_KEY` | JWT signing key (32+ chars) |
| `ENCRYPTION__MASTER_KEY` | Master encryption key (32+ chars) |
| `TWILIO__*` | Twilio Verify credentials |
| `SENTRY__DSN` | Sentry DSN (optional) |
