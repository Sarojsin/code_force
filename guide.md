# Guide

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                 Mobile App                   │
│  React Native / TypeScript / React Query     │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / JSON
                   ▼
┌─────────────────────────────────────────────┐
│           FastAPI Backend                    │
│  Routes → Services → Models → PostgreSQL     │
│  Celery Workers for async tasks              │
│  Redis for rate limiting + broker            │
└─────────────────────────────────────────────┘
```

### Backend — Package by Feature

```
app/
  core/              # config, database, security, encryption
  integrations/      # twilio, stream_chat, fcm, s3, huggingface
  modules/
    auth/            # OTP login, JWT, MFA
    users/           # profile, FCM tokens, consents, audit
    cycle/           # period tracking, predictions
    wellness/        # journal, mood, breathing exercises
    pregnancy/       # profiles, milestones, daily logs
    safety/          # emergency contacts, SOS alerts
    family/          # invite-based linking, shared data
    nurse_content/   # educational content, approval
    chat/            # Stream Chat tokens, room invites
    admin/           # user mgmt, analytics, broadcast
    voice/           # voice journal stubs (future)
  main.py            # app factory
```

### Mobile — Screens per Feature

```
src/
  screens/
    auth/            # PhoneScreen, OtpScreen
    cycle/           # CycleDashboardScreen
    wellness/        # WellnessHomeScreen
    pregnancy/       # PregnancyHomeScreen
    safety/          # SafetyHomeScreen
    profile/         # ProfileHomeScreen, FCM settings
  components/ui/     # Button, Card, Text, FormField, Skeleton
  navigation/        # AuthStack, MainTabs, FeatureStacks
  services/          # API client, React Query hooks
  stores/            # Zustand (auth state only)
  validation/        # Zod schemas
  theme/             # colors, typography, spacing tokens
```

---

## Development Workflow

### 1. Feature Module Checklist

- [ ] Create `app/modules/<feature>/` with 7 standard files
- [ ] Add routes in `routes.py` — thin HTTP handlers only
- [ ] Implement business logic in `services.py`
- [ ] Define models in `models.py` (SQLAlchemy)
- [ ] Define schemas in `schemas.py` (Pydantic)
- [ ] Register dependencies in `dependencies.py`
- [ ] Add async tasks in `tasks.py` (if needed)
- [ ] Define exceptions in `exceptions.py`
- [ ] Register `init_module` in `main.py`
- [ ] Add Alembic migration
- [ ] Write tests in `tests/modules/<feature>/`
- [ ] Create mobile screen in `src/screens/<feature>/`
- [ ] Update API contract in `plans/30-mobile-api-contract.md`

### 2. Cross-Module Communication

Do NOT import another module's `services` directly. Use the event bus:

```python
# Emitter module
event_bus.emit("period_started", user_id=user.id)

# Subscriber module
@event_bus.subscribe("period_started")
def on_period_started(user_id: str):
    # enqueue Celery task
    some_task.apply_async(args=[user_id])
```

### 3. Celery Tasks

- Tasks are idempotent — running twice must not cause inconsistency
- Use `task_id` based on business key for deduplication
- Every task has `soft_time_limit` and `time_limit`
- Three queues: `default`, `priority` (SOS), `ai` (ML inference)

### 4. Testing

```bash
# Run all tests
pytest

# Run specific module tests
pytest tests/modules/cycle/

# With coverage
pytest --cov=app
```

### 5. Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "feature_add_field"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## API Patterns

### Response Envelope

```json
// Success
{ "data": { ... }, "message": "ok" }

// Error
{ "error": { "code": "RESOURCE_NOT_FOUND", "details": "..." } }
```

### Pagination

```json
// Offset (admin lists)
GET /admin/users?limit=50&offset=0

// Cursor (user-facing lists)
GET /cycle/entries?limit=20&cursor=<opaque_token>
```

### Authentication

```
Authorization: Bearer <access_token>
```

### Rate Limiting

- Auth endpoints: 5 requests / 10 minutes per phone
- Default: 100 requests / minute per user
- Response: HTTP 429 with `Retry-After` header

---

## Data Encryption

- Journal content and medical notes are encrypted at the service layer
- Encryption uses Fernet (AES-128-CBC) with a per-user salt
- The service layer handles encryption/decryption — routes never see raw keys
- See `app/core/encryption.py` for implementation
