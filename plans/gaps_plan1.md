# Gap Plan 1: Backend Coverage 31% → 80%

> **Target:** `pytest --cov=app --cov-fail-under=80` passes with >=80% line coverage
> **Current:** 31.37% (3,465 missing of 5,049 statements)
> **Need:** ~2,770 more covered lines
> **Priority:** HIGH — this is the primary Phase 6 gate

---

## 1.1 Coverage Gap Analysis

| Category | Files | Missing Lines | Strategy |
|----------|-------|---------------|----------|
| **Routes** (13 files) | all `*/routes.py` | ~700 lines | Integration tests with authenticated `TestClient` |
| **Services** (core logic) | `cycle/`, `safety/`, `auth/`, `sync/`, `wellness/`, `family/`, `users/`, `onboarding/`, `pregnancy/`, `nurse_content/`, `chat/` | ~1,300 lines | Unit tests with mocked DB + injected dependencies |
| **Tasks** (Celery) | `cycle/tasks.py`, `safety/tasks.py`, `auth/tasks.py`, `users/tasks.py`, `wellness/tasks.py`, `retention_cleanup.py` | ~280 lines | Task execution tests with Celery `task_always_eager` |
| **Core/Infra** | `monitoring.py`, `logging_config.py`, `rate_limit.py`, `pagination.py`, `security.py`, `encryption.py`, `event_bus.py`, `security_headers.py`, `responses.py`, `celery_app.py`, `token_revocation.py`, `sentry_middleware.py` | ~310 lines | Unit tests, no DB needed |
| **Integrations** | `twilio_client.py`, `huggingface_client.py`, `fcm_client.py`, `s3_client.py`, `stream_client.py`, `redis_client.py`, `prediction_engine.py` | ~370 lines | Mock external APIs at network boundary |

---

## 1.2 Implementation Steps (ordered by ROI)

### Step 1: Fix numpy dependency (unblocks 20+ cycle tests)
- **Why:** 2 cycle test files fail collection because `numpy` is not installed in the Poetry venv
- **Action:** `poetry add numpy` or add it to `pyproject.toml` dev dependencies
- **Expected gain:** ~20 tests unblocked, ~15% coverage bump in `cycle/services.py` and `cycle/tasks.py`
- **File:** `pyproject.toml`
- **Test:** `pytest tests/modules/cycle/ -v`

### Step 2: Core/Infra unit tests (~310 lines, high ROI)
Create one test file per core module:

| Test File | What to Test | Expected Lines Covered |
|-----------|-------------|----------------------|
| `tests/test_monitoring.py` | Sentry init, integration registration, `_tag_event` filters PII | ~25 |
| `tests/test_logging_config.py` | structlog JSON output, request_id binding | ~20 |
| `tests/test_rate_limit.py` | Redis incr/expire, 429 response, Retry-After header | ~20 |
| `tests/test_pagination.py` | Cursor encoding/decoding, page size limiting | ~35 |
| `tests/test_encryption.py` | encrypt/decrypt roundtrip, wrong key raises `EncryptionError` | ~30 |
| `tests/test_event_bus.py` | emit → subscriber called, multiple subscribers, error isolation | ~25 |
| `tests/test_security.py` | password hashing, token signing/verification | ~25 |
| `tests/test_responses.py` | success/error envelope format | ~10 |
| `tests/test_token_revocation.py` | revoke → verify revoked, expired TTL | ~10 |
| `tests/test_sentry_middleware.py` | request_id + user_id tagged on every request | ~15 |
| `tests/test_celery_app.py` | broker config, beat schedule loaded | ~7 |
| `tests/test_security_headers.py` | CSP, HSTS, X-Frame-Options set on response | ~15 |

**Pattern:** No DB needed, pure logic tests. Use `pytest-mock` for external deps.

**Total gain:** ~240 lines covered

### Step 3: Service layer tests — highest-impact files

| Module | Current % | Target % | Focus Areas | Lines to Cover |
|--------|-----------|----------|-------------|---------------|
| `auth/services.py` | 20% | 80% | register→verify→login→refresh→logout→password change→MFA | ~150 |
| `cycle/services.py` | 3% | 70% | create entry, calendar calculation, ML model chain (heuristic→median→lr→rf), prediction_window, global model export | ~280 |
| `safety/services.py` | 14% | 80% | SOS trigger, idempotency, FCM sent, resolve, emergency contacts CRUD, checkin task logic | ~170 |
| `sync/services.py` | 0% | 60% | push_item(pull_from_server, push_to_server), resolve_conflict(last_writer_wins), get_sync_status | ~140 |
| `wellness/services.py` | 27% | 80% | create_journal_entry, local_analysis (heuristic vs LLM fallback), get_insights, mood stats, exercise tracking | ~55 |
| `family/services.py` | 20% | 80% | create/respond accept-decline invite, get_invite_info, get_shared_data, unlink | ~55 |
| `users/services.py` | 22% | 80% | soft-delete account (anonymize fields, clear content), export data (profile+cycle+journal+mood+pregnancy+contacts) | ~60 |
| `onboarding/services.py` | 25% | 80% | create onboarding, backfill 4 cycle entries, emit onboarding_completed event | ~45 |
| `pregnancy/services.py` | 29% | 80% | create/update tracking, calculate gestational age, due date | ~40 |
| `nurse_content/services.py` | 27% | 80% | get content by week, search, filter by category | ~40 |
| `chat/services.py` | 39% | 80% | send message, get history, mark read | ~20 |

**Pattern per service test:**
```python
async def test_create_journal_entry(self, db_session, sample_user):
    service = WellnessService(db_session, encryption_service=encryption_service)
    entry = await service.create_journal_entry(user_id=sample_user.id, data=...)
    assert entry.id is not None
```

**Total gain:** ~1,050 lines covered

### Step 4: Route integration tests (~700 lines)

Use authenticated `httpx.AsyncClient` with a test user fixture. Write ONE integration test file per module covering happy path + 1 error case.

| Route File | Test File | Key Tests (2-3 each) |
|------------|-----------|---------------------|
| `auth/routes.py` | `tests/modules/auth/test_routes.py` (EXISTS, expand) | register→login→refresh→logout, MFA flow, password change |
| `cycle/routes.py` | `tests/modules/cycle/test_routes.py` | create entry, get calendar, get predictions, global model download |
| `safety/routes.py` | `tests/modules/safety/test_routes.py` | trigger SOS, resolve SOS, CRUD contacts |
| `wellness/routes.py` | `tests/modules/wellness/test_routes.py` | create journal, get insights, log mood, log exercise |
| `users/routes.py` | `tests/modules/users/test_routes.py` | export data, delete account |
| `family/routes.py` | `tests/modules/family/test_routes.py` | create invite, respond, get shared data |
| `onboarding/routes.py` | `tests/modules/onboarding/test_routes.py` | create onboarding, complete onboarding |
| `pregnancy/routes.py` | `tests/modules/pregnancy/test_routes.py` | create tracking, get by week |
| `nurse_content/routes.py` | `tests/modules/nurse_content/test_routes.py` | get content, search |
| `chat/routes.py` | `tests/modules/chat/test_routes.py` | send message, get history |
| `admin/routes.py` | `tests/modules/admin/test_routes.py` | list users, get stats |
| `sync/routes.py` | `tests/modules/sync/test_routes.py` | push, pull, get status |
| `voice/routes.py` | `tests/modules/voice/test_routes.py` | upload, transcribe (mock external) |

**Route test pattern:**
```python
@pytest.fixture
async def auth_client(client, sample_user):
    """TestClient with valid Bearer token."""
    token = create_access_token(subject=sample_user.id)
    client.headers["Authorization"] = f"Bearer {token}"
    return client

async def test_create_cycle_entry(auth_client):
    resp = await auth_client.post("/api/v1/cycle/entries", json={...})
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["day_type"] in {"period", "follicular", "ovulatory", "luteal"}
```

**Total gain:** ~600 lines covered

### Step 5: Task tests (~280 lines, use `task_always_eager`)

| Task File | Test File | Key Tests |
|-----------|-----------|-----------|
| `app/tasks/retention_cleanup.py` | `tests/test_retention_cleanup.py` | purge soft-deleted users >30d, audit logs >90d, expired invites >30d; idempotent key dedup |
| `cycle/tasks.py` | `tests/modules/cycle/test_tasks.py` | retrain on dirty flag, build global model, export JSON |
| `safety/tasks.py` | `tests/modules/safety/test_tasks.py` | 15-min checkin, expired SOS resolution |
| `auth/tasks.py` | `tests/modules/auth/test_tasks.py` | cleanup expired tokens, send verification email |
| `users/tasks.py` | `tests/modules/users/test_tasks.py` | hard-delete after 30d window |
| `wellness/tasks.py` | `tests/modules/wellness/test_tasks.py` | batch analysis, LLM fallback |

**Task test pattern:**
```python
from celery import Celery
app = Celery("test", task_always_eager=True, task_eager_propagates=True)

@app.task(bind=True)
def my_task(self, ...):
    ...

result = my_task.delay(...)
assert result.successful()
```

**Total gain:** ~250 lines covered

### Step 6: Integration client tests (~370 lines)

| Client | Test File | Key Tests |
|--------|-----------|-----------|
| `twilio_client.py` | `tests/test_twilio_client.py` | send SMS success, send SMS failure→retry circuit breaker |
| `fcm_client.py` | `tests/test_fcm_client.py` | send notification, invalid token→remove |
| `huggingface_client.py` | `tests/test_huggingface_client.py` | analyze text, API error→fallback |
| `s3_client.py` | `tests/test_s3_client.py` | upload file, download file, signed URL |
| `stream_client.py` | `tests/test_stream_client.py` | create channel, send message |
| `redis_client.py` | `tests/test_redis_client.py` | get/set/delete, connection error→retry |
| `prediction_engine.py` | `tests/test_prediction_engine.py` | heuristic→median→linear regression→RF fallback chain, irregular user handling |

**Pattern:** Mock the external HTTP/API at `httpx.Client` or `aiohttp.ClientSession` layer. Use `responses` or `pytest-httpx`.

**Total gain:** ~330 lines covered

---

## 1.3 Execution Order (Dependency-Aware)

```
Week 1:
  Day 1:  Fix numpy (Step 1) + Core tests (Step 2) — 12 test files, 0 dependencies
  Day 2:  Auth service + route tests (Steps 3-4) — blocks everything
  Day 3:  Cycle service tests (Step 3) — ML chain, calendar, predictions
  
Week 2:
  Day 1:  Safety service + route tests
  Day 2:  Wellness service + route tests
  Day 3:  User/onboarding/pregnancy/nurse_content/chat — smaller files

Week 3:
  Day 1:  Sync services (hardest — need conflict resolution mock)
  Day 2:  Family + admin route tests
  Day 3:  Task tests (Step 5) — retention, cycle, safety, auth

Week 4:
  Day 1:  Integration client tests (Step 6)
  Day 2:  Coverage measurement + gap filling
  Day 3:  Buffer
```

---

## 1.4 Risk Factors

| Risk | Mitigation |
|------|-----------|
| Cycle ML chain complex to mock | Test each model separately (heuristic, median, lr, rf); use real `numpy`/`sklearn` with small dataset |
| Sync service requires multi-device conflict scenario | Mock `pull_from_server` and `push_to_server` as `async` stubs that track state |
| Route tests need auth fixture | Create `auth_client` fixture in `conftest.py` that sets `Authorization` header |
| Celery tasks fire real side effects | Set `task_always_eager=True`, mock external service clients in test config |
| 3,465 missing lines is a LOT | Even covering 2,200 lines (60% of missing) + existing 31% = ~75% total. 80% requires ~2,770 lines. |

---

## 1.5 Validation

```bash
# After each step
pytest --cov=app --cov-report=term-missing --cov-fail-under=65 tests/modules/<feature>/
pytest -x --tb=short  # no regressions

# Final gate
pytest --cov=app --cov-report=term-missing --cov-fail-under=80
```
