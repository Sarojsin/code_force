# SheCare Cycle Prediction — Learning & Audit Report

## Critical Issues

### CRITICAL-1: Race condition — lost update on log_correction
**Severity:** Critical  
**File:** `app/modules/cycle/services.py:514-547`  
**Function:** `log_correction`

**Problem:** Two concurrent corrections for the same prediction (or same user, different predictions) can lose updates on `User.avg_prediction_error_days` and `User.total_cycles_logged`.

**Why:** `_update_user_ml_metrics` reads `user.total_cycles_logged` and `user.avg_prediction_error_days`, computes new values, and writes them back. Between the read and write, another concurrent request can:
- Read the same old values
- Compute new values from them
- Overwrite with stale data (last-writer-wins)

**Example scenario:**
```
User has total_cycles_logged=5, avg_error=2.0
Correction A: error=3 → reads 5/2.0 → computes 6/(2.0*5+3)/6 = 2.17 → writes total=6, avg=2.17
Correction B (concurrent): error=1 → reads 5/2.0 → computes 6/(2.0*5+1)/6 = 1.83 → writes total=6, avg=1.83
Result: total=6 (correct), avg=1.83 (should be ~2.14). One correction's effect is lost.
```

**Recommended fix:**
```python
# Use SELECT ... FOR UPDATE when fetching the prediction
stmt = (
    select(PredictedCycle)
    .where(PredictedCycle.id == prediction_id)
    .where(PredictedCycle.user_id == user_id)
    .with_for_update()
)
```

---

### CRITICAL-2: Redis global lock prevents crash recovery
**Severity:** Critical  
**File:** `app/tasks/checkin.py:39-43`  
**Function:** `daily_checkin`

**Problem:** The `redis.setnx` idempotency key is acquired BEFORE any work is done and persists for 25 hours. If the task crashes AFTER acquiring the lock but BEFORE committing `checkin_sent` flags:
- Celery redelivers the message (`acks_late=True`)
- Retry sees the lock still held → skips entire run
- No notifications are sent to any user for that day

**Why it happens:** The lock acquisition and the actual work are not atomic. Crash in the window between `setnx` success and `session.commit()` leaves the lock held.

**Example scenario:**
```
Task starts at 08:00, acquires Redis lock
Fetches 5000 predictions, starts sending FCM messages
At 08:05, worker OOM-killed
Message redelivered at 08:06
Lock still held → skip
No user receives their P-3 notification today
```

**Recommended fix:** Remove the global Redis lock entirely. Rely on `checkin_sent` per-prediction idempotency flag (which already exists in the query). Add a date-range query to catch missed predictions:
```python
# Instead of exact date match, use a range
target_end = today + timedelta(days=3)
stmt = (
    select(PredictedCycle)
    .where(PredictedCycle.predicted_next_period_start <= target_end)
    .where(PredictedCycle.predicted_next_period_start >= today)
    .where(PredictedCycle.checkin_sent.is_(False))
    .where(PredictedCycle.actual_cycle_entry_id.is_(None))
    .where(PredictedCycle.is_active.is_(True))
)
```

---

### CRITICAL-3: No guard against duplicate corrections
**Severity:** Critical  
**File:** `app/modules/cycle/services.py:533-542`  
**Function:** `log_correction`

**Problem:** `log_correction` unconditionally overwrites `prediction.actual_cycle_entry_id` without checking if the prediction already has one. A user can send two corrections for the same prediction, creating two cycle entries and double-counting ML metrics.

**Why:** The `if corrected_prediction_id is not None` branch never checks `prediction.actual_cycle_entry_id`. On the second call, it overwrites the link and `_update_user_ml_metrics` increments `total_cycles_logged` again.

**Example scenario:**
```
User corrects prediction with actual date May 15 → actual_cycle_entry_id=E1, error=3
User accidentally corrects again with May 16 → actual_cycle_entry_id=E2, error=4
total_cycles_logged incremented twice for one cycle
First entry E1's correction linkage is lost
```

**Recommended fix:**
```python
if corrected_prediction_id is not None:
    prediction = await self.get_prediction_by_id(corrected_prediction_id, user_id)
    if prediction.actual_cycle_entry_id is not None:
        raise CycleError("Prediction already has a correction linked")
    error = (period_start_date - prediction.predicted_next_period_start).days
    prediction.actual_cycle_entry_id = entry.id
    prediction.prediction_error_days = error
```

---

### CRITICAL-4: Dual-write problem — FCM sent before DB commit
**Severity:** Critical  
**File:** `app/tasks/checkin.py:81-106`  
**Function:** `daily_checkin`

**Problem:** FCM push notifications are sent BEFORE the `checkin_sent` flag is committed. If the DB commit fails, FCM messages have already been dispatched but `checkin_sent=False`, so on retry the same users receive duplicate notifications.

**Why:** The send-and-mark cycle is:
```
send_to_token() → FCM delivers → pred.checkin_sent = True → flush() → ... later: session.commit()
```
If `session.commit()` fails, the entire batch rolls back, including `checkin_sent`. But FCM cannot be un-sent.

**Example scenario:**
```
Task sends FCM to 10,000 users → FCM delivers
session.commit() fails due to DB restart
All checkin_sent flags rolled back
Task retries → sends another 10,000 duplicate notifications
```

**Recommended fix:** Write `checkin_sent=True` and `session.flush()` BEFORE sending FCM, or use a transactional outbox pattern:
```python
pred.checkin_sent = True
await session.flush()
# Now send FCM — if this fails, checkin_sent is already committed on next flush/commit
try:
    await fcm.send_to_token(...)
except Exception:
    # Could revert checkin_sent or handle separately
    pass
```

---

## High Issues

### HIGH-5: FCM loop breaks on first token failure
**Severity:** High  
**File:** `app/tasks/checkin.py:81-104`

**Problem:** The `for token in tokens` loop is wrapped in a single `try/except`. If token 1/5 is invalid (`UnregisteredError`), the exception propagates to the outer handler, skipping tokens 2-5 and NOT setting `checkin_sent`.

**Why:** The `try/except` is around the entire token loop, not around individual `send_to_token` calls.

**Example scenario:**
```
User has 3 FCM tokens (phone, tablet, backup phone)
Token 1 is expired → FCM returns UnregisteredError
Tokens 2 and 3 are never notified
checkin_sent remains False
Task will retry tomorrow, same expired token still in list → infinite failure loop
```

**Recommended fix:**
```python
valid = True
for token in tokens:
    try:
        await fcm.send_to_token(...)
    except FCMError:
        valid = False  # Track per-token failure
if valid:
    pred.checkin_sent = True
    await session.flush()
```
Also clean up invalid tokens from `user.fcm_tokens`.

---

### HIGH-6: Daily checkin misses predictions from downtime
**Severity:** High  
**File:** `app/tasks/checkin.py:55-63`

**Problem:** The query uses `WHERE predicted_next_period_start == today + 3`. If the Celery beat is down for 1+ days, predictions whose P-3 fell on a missed day are never notified.

**Why:** Exact date match means the window shifts. A prediction with P-3 on Sunday is queried on `today+3=Sunday` only. If Sunday is missed, Monday's task queries `today+3=Monday`, not Sunday.

**Example scenario:**
```
Prediction: predicted_start = July 12 → P-3 = July 9
Celery task down July 9 (Redis outage)
July 10 task queries: WHERE predicted_next_period_start == July 13 → doesn't find July 12 prediction
User is never notified
```

**Recommended fix:** Use a date range:
```python
.where(PredictedCycle.predicted_next_period_start.between(today, today + timedelta(days=3)))
```

---

### HIGH-7: `_update_user_ml_metrics` full scan per correction
**Severity:** High (Performance)  
**File:** `app/modules/cycle/services.py:608-626`

**Problem:** Every correction fetches ALL cycle entries for the user and recomputes `avg_cycle_length` and `std_dev` from scratch. For users with 500+ entries, this is an O(n) scan on every correction.

**Why:** The method always reads all `period_start_date` rows and recomputes intervals/recalculates statistics incrementally.

**Scenario @ scale:**
```
1M users, each correcting once per cycle (~12x/year)
Each correction queries the full entry list
DB load grows linearly with entry count per user
```

**Recommended fix:** Only recompute when `_compute_cycle_lengths` would change (i.e., a new entry is added). Store running stats on the User model:
- `avg_cycle_length` updated as running average
- `cycle_length_std_dev` updated via Welford's online algorithm

---

### HIGH-8: No input validation on `CorrectionCreate`
**Severity:** High  
**File:** `app/modules/cycle/schemas.py:61-65`

**Problem:** No validation on:
- `period_start_date` could be in the future (impossible)
- `period_end_date` could be before `period_start_date`
- `corrected_prediction_id` is a free string — bad UUID format crashes the route with 500

**Why:** The route calls `_uuid.UUID(payload.corrected_prediction_id)` which raises `ValueError` on bad input, bypassing FastAPI's validation exception handler.

**Example scenario:**
```http
POST /corrections { "period_start_date": "2099-01-01", "corrected_prediction_id": "not-a-uuid" }
→ ValueError → FastAPI returns 500 instead of 422
```

**Recommended fix:** Add Pydantic validators:
```python
@field_validator("period_start_date")
@classmethod
def not_in_future(cls, v: date) -> date:
    if v > date.today():
        raise ValueError("period_start_date cannot be in the future")
    return v

@field_validator("corrected_prediction_id")
@classmethod
def valid_uuid(cls, v: str | None) -> str | None:
    if v is not None:
        uuid.UUID(v)  # validates format
    return v
```

---

### HIGH-9: `asyncio.run()` in Celery task incompatible with async worker pools
**Severity:** High  
**File:** `app/tasks/checkin.py:111`

**Problem:** `daily_checkin` uses `asyncio.run(_run())` which creates a new event loop. If the Celery worker is configured with an async-compatible pool (threads, solo, or `celery[async]`), this crashes with "asyncio.run() cannot be called from a running event loop".

**Why:** Celery's default pool (prefork) works, but any future switch to threads or gevent silently breaks.

**Recommended fix:**
```python
@celery_app.task(...)
def daily_checkin() -> dict[str, int]:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()
```
Or use `anyio.run()` or `asgiref.sync_to_async`.

---

## Medium Issues

### MEDIUM-10: FCMClient not thread-safe at initialization
**Severity:** Medium  
**File:** `app/integrations/fcm_client.py:26-35`

**Problem:** `FCMClient._initialized` is a class-level flag checked/set without a lock. Two workers can both pass the guard and call `firebase_admin.initialize_app()`, which raises if already initialized.

**Why:** `_initialized` check-then-set is not atomic.

**Recommended fix:** Initialize Firebase in the app lifespan instead of lazily in the client:
```python
# In lifespan.py or main.py
if settings.fcm.service_account_json_path:
    cred = credentials.Certificate(settings.fcm.service_account_json_path)
    firebase_admin.initialize_app(cred)
```

---

### MEDIUM-11: Snooze data stored but never consumed
**Severity:** Medium  
**File:** `app/modules/cycle/services.py:566-581`

**Problem:** `log_snooze` creates a `SnoozeEvent` record in the database, but no code path ever queries these records. The snooze logic is entirely on the mobile side (AsyncStorage). The DB storage is dead code.

**Why:** The backend stores snooze events but has no:
- Query to check if a user has snoozed
- Logic to suppress notifications based on snooze
- API endpoint to read snooze status

**Recommended fix:** Either:
- **a.** Remove the `log_snooze` endpoint and `SnoozeEvent` model (clean up dead code)
- **b.** Or implement server-side snooze tracking (check snooze events before sending `daily_checkin`)

---

### MEDIUM-12: `checkin_sent` set to True when user has no FCM token
**Severity:** Medium  
**File:** `app/tasks/checkin.py:72-78`

**Problem:** If `user.fcm_tokens` is empty, `checkin_sent` is still set to `True`. The user is permanently marked as notified even though they never received (and cannot receive) the notification.

**Why:** The intent is to avoid infinite retries for users without FCM tokens. But it means users who later register a device (e.g., install the app mid-cycle) are permanently locked out of notifications for this prediction.

**Recommended fix:** Only set `checkin_sent=True` when a notification was actually delivered:
```python
if not tokens:
    # Don't mark as sent — user may register token later
    continue
```
Or add a state `checkin_skipped` for no-token users.

---

### MEDIUM-13: Missing composite index for daily_checkin query
**Severity:** Medium  
**File:** `app/modules/cycle/models.py:48-78`

**Problem:** The daily checkin query filters on `(predicted_next_period_start, checkin_sent, actual_cycle_entry_id, is_active)`. With only a single-column index on `predicted_next_period_start`, PostgreSQL must filter the remaining columns via bitmap scan or sequential scan.

**Why:** No composite index exists for the specific query pattern.

**Recommended fix:**
```python
__table_args__ = (
    Index("ix_pred_checkin", "predicted_next_period_start", "checkin_sent", 
          "actual_cycle_entry_id", postgresql_where=text("is_active = true")),
)
```
Also add for `_update_user_ml_metrics`:
```python
Index("ix_cycle_user_date", "user_id", "period_start_date")
```

---

### MEDIUM-14: `get_predictions` returns transient objects with fake UUIDs
**Severity:** Medium  
**File:** `app/modules/cycle/services.py:374-382`

**Problem:** Predictions 2 and 3 are `copy.copy()` of the first prediction with a newly generated UUID. These UUIDs don't exist in the database. If any downstream code stores or references these IDs, it creates an orphaned reference.

**Why:** `copy.copy()` is a shallow copy — the `snooze_events` list is shared by reference. Modifying one prediction's snooze events affects all predictions.

**Recommended fix:** Don't return fake objects. Either:
- **a.** Return only 1 prediction (the real one)
- **b.** Generate response dicts directly instead of copying ORM objects
- **c.** Use `copy.deepcopy()` at minimum

---

### MEDIUM-15: No autoretries on daily_checkin
**Severity:** Medium  
**File:** `app/tasks/checkin.py:19-24`

**Problem:** The task has no `autoretry_for`, `max_retries`, or `default_retry_delay`. On transient failure (DB timeout, Redis blip), the task fails permanently (or retries only via Celery `acks_late` redelivery).

**Why:** No retry configuration.

**Recommended fix:**
```python
@celery_app.task(
    name="app.tasks.checkin.daily_checkin",
    soft_time_limit=120,
    time_limit=240,
    acks_late=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=300,
)
```

---

## Low Issues

### LOW-16: `get_predictions` overly complex avg_cycle calculation
**Severity:** Low  
**File:** `app/modules/cycle/services.py:371-372`

**Problem:**
```python
avg_cycle = (latest.predicted_next_period_start - 
    (latest.predicted_next_period_start - timedelta(days=latest.prediction_window_days or 28))).days
```
This mathematically simplifies to `latest.prediction_window_days or 28`. The complex expression is misleading and suggests a bug.

---

### LOW-17: Duplicate `from app.modules.auth.models import User` imports
**Severity:** Low  
**File:** `app/modules/cycle/services.py:134, 247`

**Problem:** User is imported inside two separate methods (`compute_predictions`, `_predict_with_fallback`) at module-scope level and again as local imports. The module-scope import at line 134 is a forward reference issue, but once resolved, the local imports in `_predict_with_fallback` at line 247 are redundant.

---

### LOW-18: New Redis connection per task invocation
**Severity:** Low  
**File:** `app/tasks/checkin.py:38`

**Problem:**
```python
r = aredis.from_url(settings.redis.url)
```
Creates a new connection for each daily run. Use a global or class-level connection pool.

---

### LOW-19: No downgrade on migration 0015
**Severity:** Low  
**File:** `alembic/versions/0015_add_checkin_sent.py:28`

**Status:** ✅ Correct  
The downgrade is correctly implemented (`op.drop_column`). No issue here — this is correct.

---

## Correct Implementation Points

The following are implemented correctly:

| Component | Status | Notes |
|-----------|--------|-------|
| `checkin_sent` column | ✅ Correct | Boolean, non-nullable, default `False` — correct for idempotency |
| Log correction suppression | ✅ Correct | `period_start_date < cutoff` correctly catches corrections before P-3 and sets `checkin_sent=True` |
| Error calculation | ✅ Correct | `(period_start_date - predicted_start).days` correctly computes signed error |
| Running average formula | ✅ Correct | `(old_avg * old_total + error) / (old_total + 1)` is mathematically correct |
| Row-level security | ✅ Correct | All queries filter by `user_id` from auth, not from request body |
| `actual_cycle_entry_id` FK | ✅ Correct | `ondelete="SET NULL"` correctly avoids cascading issues |
| `corrected_prediction_id` FK | ✅ Correct | `ondelete="SET NULL"` is correct |
| `is_correction` flag | ✅ Correct | Correctly set when `corrected_prediction_id` is provided |
| Migration | ✅ Correct | Simple, reversible, single-column add — no risk |
| Celery beat schedule | ✅ Correct | 8 AM with `crontab(hour=8, minute=0)` is correct for daily P-3 check |
| Soft delete | ✅ Correct | All entries use `is_active` flag per spec |
| `apply_global_model` | ✅ Correct | Features properly normalized against scaler, month seasonality via sin/cos |
| Fallback prediction | ✅ Correct | Median-based with correct clamping to [20, 45] |

---

## Edge Case Coverage

| Edge Case | Status | Notes |
|-----------|--------|-------|
| Early period (14d early) | ✅ Covered | Error = -14, correct negative calcd, suppression at `< P-3` |
| Late period (15d late) | ✅ Covered | Error = +15, correct positive calcd |
| Very late (45d late) | ✅ Covered | Error = +45, no special logic needed |
| Period on P | ✅ Covered | Error = 0, correct |
| Period on P-3 | ✅ Covered | Error = -3, cutoff = P-3, `period_start_date < cutoff` is True for -3 → suppressed |
| Period on P+6 | ✅ Covered | Error = +6, suppression not triggered (today ≥ P-3) |
| Period after P+6 | ✅ Covered | Sticky card not shown (mobile checks window) |
| User ignores notification | ✅ Covered | `checkin_sent=True`, no retry |
| User never opens app | ✅ Covered | `checkin_sent=True`, no nagging |
| User taps twice | ⚠️ Partial | Redis lock prevents double-execution (but has crash issue) |
| User confirms twice | ❌ Critical | No guard against duplicate corrections (Issue CRITICAL-3) |
| User adjusts twice | ❌ Critical | Same as above — overwrites `actual_cycle_entry_id` |
| User edits correction | ❌ Missing | No endpoint to update a correction's linkage |
| Multiple devices | ✅ Covered | Token loop sends to all tokens |
| No FCM token | ⚠️ Medium | `checkin_sent` set to True → permanent skip (Issue MEDIUM-12) |
| Invalid FCM token | ⚠️ High | Single-token failure blocks all tokens (Issue HIGH-5) |
| Celery crash | ❌ Critical | Redis lock prevents recovery (Issue CRITICAL-2) |
| DB rollback | ❌ Critical | FCM sent but `checkin_sent` rolled back (Issue CRITICAL-4) |
| Duplicate Celery execution | ❌ Critical | Dual-write problem allows duplicates (Issue CRITICAL-4) |
| Concurrent correction | ❌ Critical | Lost update on ML metrics (Issue CRITICAL-1) |
| Offline correction synced | ✅ Covered | No online check in service layer |
| Prediction already resolved | ❌ Critical | No guard (Issue CRITICAL-3) |
| Multiple active predictions | ✅ Covered | Single prediction per user (upsert) |
| Notification already sent | ✅ Covered | `checkin_sent` filter in query |
| User logs before P-3 | ✅ Covered | Suppression logic in `log_correction` |
| User logs after P+6 | ✅ Covered | No suppression needed (beyond sticky window) |
| User deletes correction | ⚠️ Partial | Soft-delete works, but prediction linkage remains |
| Prediction replaced | ✅ Covered | `_upsert_prediction` replaces old prediction |
| Missing prediction_id | ✅ Covered | `corrected_prediction_id=None` → `is_correction=False` |
| Invalid dates | ❌ High | No Pydantic validation (Issue HIGH-8) |
| Timezone | ✅ Covered | All dates are date objects (no time), Celery UTC |
| Leap year / Month / Year | ✅ Covered | Python's `date` + `timedelta` handles all calendar edge cases |

---

## Scores

| Category | Score | Key Reason |
|----------|-------|------------|
| Architecture | 7/10 | Good modular design, but snooze events are dead code, correction link is overwritable |
| Code Quality | 6/10 | Clean structure but race conditions, missing validations, confusing `avg_cycle` calc |
| Production Readiness | 3/10 | 4 critical bugs that WILL cause data corruption or duplicate notifications in production |
| Security | 7/10 | Row-level auth is correct, but missing input validation could cause 500s |
| Performance | 5/10 | Missing composite indexes, full scan per correction, new Redis conn per task |
| Reliability | 3/10 | Dual-write problem, crash loses notifications, no retry strategy |
| Maintainability | 7/10 | Good module structure, clear naming, adequate tests |

---

## Mandatory Fixes Before Production

1. **Remove global Redis lock in `daily_checkin`** — rely on per-prediction `checkin_sent` idempotency instead. Add date-range query for stragglers.
2. **Guard against duplicate corrections** — check `prediction.actual_cycle_entry_id` in `log_correction` before overwriting.
3. **Fix dual-write order** — set `checkin_sent=True` BEFORE sending FCM, or implement transactional outbox.
4. **Fix concurrent correction race condition** — add `SELECT ... FOR UPDATE` when fetching prediction and user rows in `log_correction` / `_update_user_ml_metrics`.
5. **Wrap individual FCM sends in try/except** — don't let one bad token block all tokens for a user.
6. **Add Pydantic validators to `CorrectionCreate`** (date not in future, end >= start, valid UUID string).
7. **Fix `asyncio.run()` to be reentrant** in `daily_checkin` and `update_cycle_predictions` tasks.

---

## Optional Improvements

1. Add composite index `(predicted_next_period_start, checkin_sent, actual_cycle_entry_id)` for daily query
2. Add composite index `(user_id, is_active, period_start_date)` for `_update_user_ml_metrics`
3. Remove dead snooze-event backend code or implement server-side snooze
4. Don't set `checkin_sent=True` when user has no FCM token (allow catching up)
5. Initialize `firebase_admin` in app lifespan instead of per-client lazy init
6. Reuse Redis connection pool in `daily_checkin`
7. Simplify `avg_cycle` calculation in `get_predictions` to `latest.prediction_window_days or 28`
8. Add `avg_prediction_error_days` running-stats columns to avoid full-scan on every correction
9. Migrate Celery task to use async-compatible pool (e.g., `celery[async]` with proper event loop handling)
10. Add rate limiting on `POST /corrections` (e.g., 5 per hour per user)

---

## Final Verdict

**Would I approve this for production? ❌ No.**

The implementation has 4 critical bugs that will cause observable production incidents:

1. **Duplicate notifications** — the dual-write issue guarantees that any database failure after FCM dispatch will resend notifications to tens of thousands of users on retry.
2. **Lost corrections** — two rapid corrections to the same prediction silently overwrite the linkage, corrupting the correction audit trail.
3. **Silent notification failures** — on worker crash, the Redis lock prevents all recovery, so every user whose P-3 falls on that day receives zero notifications.
4. **Incorrect ML metrics** — concurrent corrections create a lost-update race that skews `total_cycles_logged` and `avg_prediction_error_days`, degrading prediction quality silently.
