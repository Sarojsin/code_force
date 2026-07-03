# Setup

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15
- Redis 7
- Docker Desktop (optional, for local infra)

---

## Backend Setup

```bash
cd backend

# Install dependencies with Poetry
poetry install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see .env.example for all vars)

# Start required services (PostgreSQL + Redis + MinIO)
docker compose up -d postgres redis minio

# Run database migrations
poetry run alembic upgrade head

# Seed reference data
poetry run python -m app.seed
```

---

## Mobile Setup

```bash
cd mobile

# Install dependencies
npm install

# iOS only — install CocoaPods
cd ios && pod install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with API base URL and credentials
```

---

## Environment Variables (Backend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE__URL` | Yes | `postgresql+asyncpg://shecare:shecare@localhost:5432/shecare` | PostgreSQL connection |
| `REDIS__URL` | Yes | `redis://localhost:6379/0` | Redis connection |
| `JWT__SECRET_KEY` | Yes | — | JWT signing key (32+ chars) |
| `JWT__REFRESH_SECRET_KEY` | Yes | — | Refresh token signing key |
| `ENCRYPTION__MASTER_KEY` | Yes | — | Master encryption key (32+ chars) |
| `TWILIO__ACCOUNT_SID` | For SMS | — | Twilio account SID |
| `TWILIO__AUTH_TOKEN` | For SMS | — | Twilio auth token |
| `TWILIO__VERIFY_SERVICE_SID` | For SMS | — | Twilio Verify service SID |
| `STREAM__API_KEY` | For chat | — | Stream Chat API key |
| `STREAM__API_SECRET` | For chat | — | Stream Chat API secret |
| `FCM__SERVICE_ACCOUNT_JSON_PATH` | For push | — | Firebase service account JSON |
| `SENTRY__DSN` | No | — | Sentry error tracking DSN |
| `AWS_ACCESS_KEY_ID` | For S3 | — | AWS / MinIO access key |
| `AWS_SECRET_ACCESS_KEY` | For S3 | — | AWS / MinIO secret key |

## Environment Variables (Mobile)

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | Yes | Backend API URL |
| `STREAM_API_KEY` | For chat | Stream Chat API key |

---

## Verify Installation

```bash
# Backend — start the server
cd backend
poetry run uvicorn app.main:app --reload

# Backend — check health
curl http://localhost:8000/health/live

# Backend — check API docs
# Open http://localhost:8000/docs in browser

# Mobile — start the app
cd mobile
npx react-native start
```
