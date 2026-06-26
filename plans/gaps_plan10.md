# Gap Plan 10: Remaining Backend Must-Test Paths

> **Target:** Coverage of all critical paths listed in Phase 6 §6.1 table
> **Current:** Most critical paths are untested (0% coverage)
> **Priority:** MEDIUM — these are the highest-risk untested paths

---

## 10.1 Critical Path Audit

| Path | Module | Current State | Risk |
|------|--------|---------------|------|
| Register → login → refresh → logout → password change (invalidates tokens) | auth | 20% service coverage, 0% route | 🔴 HIGH — auth is the gate |
| MFA enable → verify → login with MFA | auth | 0% | 🔴 HIGH — sensitive |
| Token with rotated `user_secret_key` → 401 | auth | 0% | 🔴 HIGH — security boundary |
| Create entry → calendar returns correct day types | cycle | 3% service, 0% route | 🔴 HIGH — core feature |
| Heuristic → median → linear regression → RF fallback chain | cycle (prediction_engine) | 7% prediction_engine | 🔴 HIGH — ML reliability |
| Dirty flag set → retrain task picks it up | cycle | 0% (tasks 0%) | 🟡 MEDIUM |
| Irregular user (std_dev > 3.5) → prediction_window_days set | cycle | 0% | 🟡 MEDIUM |
| Global model: train → export JSON → download endpoint | cycle | 0% | 🟡 MEDIUM |
| Create onboarding → backfill 4 cycle_entries created | onboarding | 25% service, 0% route | 🟡 MEDIUM |
| Onboarding_completed event emitted | onboarding + event_bus | 56% event_bus | 🟡 MEDIUM |
| Past cycle data correctly inserted | onboarding | 0% end-to-end | 🟡 MEDIUM |
| SOS trigger → idempotency check → FCM sent | safety | 14% service, 0% route | 🔴 HIGH — safety critical |
| SOS resolve → status changed | safety | 0% route | 🟡 MEDIUM |
| Emergency contact CRUD | safety | 0% route | 🟡 MEDIUM |
| 15-min checkin task | safety/tasks | 0% tasks | 🟡 MEDIUM |
| Create journal → local analysis → structured data sync | wellness | 27% service, 0% route | 🟡 MEDIUM |
| LLM/heuristic fallback analysis | wellness | 0% | 🟡 MEDIUM |

---

## 10.2 Detailed Test Specifications

### Auth: Full Token Lifecycle

**Test file:** `tests/modules/auth/test_token_lifecycle.py`

| Test | Steps | Expectations |
|------|-------|-------------|
| Register → Login → Access protected route | POST register → POST login → GET /users/me | 200 for /users/me with valid token |
| Refresh token cycle | POST login → POST refresh → GET /users/me with new token | New token works, old token 401 |
| Logout invalidates refresh | POST login → POST logout → POST refresh with old refresh | 401, token_revoked error |
| Password change invalidates all tokens | POST register → POST login → PUT password → POST login with new password → GET /users/me with old token | Old token 401 |
| MFA enable → verify → login with MFA code | POST enable → POST verify with code → POST login with code | 200 on each step |
| Token rotation detection | Login → rotate `user_secret_key` directly → use old token | 401, "token_secret_rotated" error |

**Priority:** HIGH (auth security)

### Cycle: ML Prediction Chain

**Test file:** `tests/modules/cycle/test_prediction_chain.py`

| Test | Steps | Expectations |
|------|-------|-------------|
| Heuristic with 3 cycles | Provide 3 complete cycles (exactly 28d each) | Prediction = 28d, model_used = "heuristic" |
| Median with 5+ cycles | Provide 5 cycles with varying lengths (26, 27, 28, 29, 30) | Prediction = 28d (median), model_used = "median" |
| Linear regression with 8+ cycles | Provide 8 cycles with consistent trend | model_used = "linear_regression" |
| RF fallback with many cycles | Provide 12+ cycles with high variance | model_used = "random_forest" |
| Irregular user detection | std_dev > 3.5 → `prediction_window_days` = rounded(std_dev) | prediction_window_days >= 4 |
| Calendar day types for period | Entry on day 1-5 → those days are "period" | Correct day types returned |
| Calendar day types for follicular | Days 6-13 → "follicular" (for 28d cycle) | Correct day types |
| Calendar day types for ovulatory | Day 14 → "ovulatory" | Correct day type |
| Calendar day types for luteal | Days 15-28 → "luteal" | Correct day types |
| Global model training | Train model from all users → export JSON | JSON valid, contains model params |
| Download endpoint returns model | GET /api/v1/cycle/model/download | 200, Content-Type: application/json |
| Dirty flag triggers retrain | Set is_dirty=true on user → cycle task picks it up | Task executed, is_dirty set to false |

**Priority:** HIGH (cycle tracking is core feature)

### Safety: Full SOS Lifecycle

**Test file:** `tests/modules/safety/test_sos_lifecycle.py`

| Test | Steps | Expectations |
|------|-------|-------------|
| SOS trigger creates active incident | POST /safety/sos with reason | 201, status = "active", contains id |
| SOS idempotency (same key) | POST twice with same Idempotency-Key header | Second returns 200 with same SOS id |
| SOS rate limit (3 in 5 min) | POST 4 times in succession | 4th returns 429 |
| SOS triggers FCM notification | POST sos → verify FCM client called | `fcm_client.send_notification` called with correct payload |
| Resolve SOS changes status | POST /safety/sos/resolve | status = "resolved", resolved_at set |
| Emergency contact CRUD | POST/GET/PUT/DELETE /safety/contacts | Full CRUD works |
| Emergency contact validation | POST without name → 422 | Validation error |
| Emergency contact max 5 | Try adding 6th contact → 409 | Conflict error |
| 15-min checkin task | Run task for active SOS > 15 min | Checkin notification sent |
| Active SOS prevents new SOS | Trigger SOS while active → 409 | Active SOS exists error |

**Priority:** HIGH (safety critical)

### Onboarding: Data Backfill

**Test file:** `tests/modules/onboarding/test_data_backfill.py`

| Test | Steps | Expectations |
|------|-------|-------------|
| Onboarding creates user profile | POST /onboarding with all fields | 201, user_id returned |
| Onboarding backfills 4 cycle entries | Complete onboarding → check cycle entries | 4 entries created, most recent = last_period_start |
| Past cycle data correctly inserted | Set last_period_start = 2026-05-01, cycle_length = 28 → entries on 2026-05-01, 2026-04-03, ... | Entries at correct 28-day intervals |
| Onboarding completed event emitted | Subscribe to event_bus → complete onboarding | "onboarding_completed" event fired |
| Onboarding without consent | Skip consent → 422 | Validation error |
| Onboarding duplicate (user already onboarded) | POST again after completion → 409 | Already onboarded error |

**Priority:** MEDIUM (critical for new user experience)

### Wellness: Journal + Analysis Flow

**Test file:** `tests/modules/wellness/test_journal_analysis.py`

| Test | Steps | Expectations |
|------|-------|-------------|
| Create journal entry | POST /wellness/journals with content | 201, entry_id, analysis included |
| Local heuristic analysis for short content | Content < 50 chars → heuristic used | analysis.model = "heuristic" |
| LLM fallback for long content | Content > 50 chars → LLM API called | analysis.model = "llm" |
| LLM API failure → fallback to heuristic | Mock LLM to raise → analysis still returns | analysis.model = "heuristic_fallback" |
| Mood logging CRUD | POST/GET /wellness/moods | Full CRUD |
| Exercise logging | POST /wellness/exercises | 201, exercise tracked |
| Insights generation | GET /wellness/insights with date range | Returns mood trends, exercise stats |
| Structured data sync | Sync schemas updated after journal create | Sync schemas contain latest entry |

**Priority:** MEDIUM (wellness is secondary feature)

---

## 10.3 Coverage Impact Estimate

| Critical Path | Lines to Cover | New Tests | Coverage Bump |
|---------------|---------------|-----------|---------------|
| Auth token lifecycle + MFA | ~80 | 12-15 | auth/services: 20% → 65% |
| Cycle ML chain + calendar | ~160 | 15-20 | cycle/services: 3% → 45% |
| Safety SOS lifecycle | ~100 | 12-15 | safety/services: 14% → 55% |
| Onboarding backfill | ~40 | 6-8 | onboarding: 25% → 60% |
| Wellness journal analysis | ~50 | 6-8 | wellness: 27% → 55% |
| **Total** | **~430** | **51-66** | **Overall coverage: 31% → ~40%** |

Note: These are the highest-risk paths but cover only ~430 of the ~2,770 missing lines. See Gap Plan 1 for full coverage strategy.

---

## 10.4 Test Implementation Order

```
Week 1:
  Mon: Auth token lifecycle tests (high risk, blocks everything)
  Tue: Cycle ML chain + calendar (core feature)
  Wed: Safety SOS lifecycle (safety critical)
  
Week 2:
  Mon: Onboarding backfill
  Tue: Wellness journal analysis
  Wed: Integration: end-to-end auth→cycle→safety test
```

---

## 10.5 Validation

```bash
# Auth token lifecycle
pytest tests/modules/auth/test_token_lifecycle.py -v --tb=short

# Cycle ML chain
pytest tests/modules/cycle/test_prediction_chain.py -v --tb=short

# Safety SOS lifecycle
pytest tests/modules/safety/test_sos_lifecycle.py -v --tb=short

# Onboarding backfill
pytest tests/modules/onboarding/test_data_backfill.py -v --tb=short

# Wellness journal analysis
pytest tests/modules/wellness/test_journal_analysis.py -v --tb=short

# All must-test paths pass
pytest -x --tb=short
```
