# Implementation Plan: Targeted Correction Notification & Permanent Manual Override

> Based on `cycle_rule_rawplan.md` — refined for current codebase.

---

## Overview

Add a proactive correction flow: a daily Celery task checks for predictions at
`P-3` (predicted start minus 3 days), sends a **single** push notification, and
the mobile dashboard shows a **sticky card** during `P-3` to `P+6` to capture
corrections. A **permanent "Adjust Period Date"** button acts as the universal
safety net for early/late outliers.

---

## 1. Data Model Change

### 1.1 `checkin_sent` on `PredictedCycle`

**File:** `app/modules/cycle/models.py`

Add column:

```python
checkin_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

**Purpose:** Idempotency flag — prevents the daily task from sending duplicate
push notifications for the same prediction.

### 1.2 Alembic Migration

**File:** `alembic/versions/0015_add_checkin_sent.py`

| Field | Value |
|-------|-------|
| Revision ID | `0015` |
| Down revision | `ea796595c9f5` (latest wellness migration) |
| Change | `ALTER TABLE predicted_cycles ADD COLUMN checkin_sent BOOLEAN DEFAULT FALSE NOT NULL;` |
| Reversible | Yes — `DROP COLUMN checkin_sent` |

---

## 2. Service Layer Changes

### 2.1 `app/modules/cycle/services.py`

#### 2.1.1 `mark_checkin_sent(prediction_id)`

New public method. Sets `checkin_sent = True` on a prediction. Used by the
Celery task after sending the push notification.

#### 2.1.2 Update `log_correction()` — Suppression Rule

If `corrected_prediction_id` is provided and the actual period start is before
the prediction's `P-3` date, set `checkin_sent = True` automatically. This
prevents the notification from firing for an already-resolved prediction.

**Logic addition** (at end of existing method, after error calculation):

```python
if corrected_prediction_id is not None:
    pred = await self.get_prediction_by_id(corrected_prediction_id, user_id)
    cutoff = pred.predicted_next_period_start - timedelta(days=3)
    if period_start_date < cutoff:
        pred.checkin_sent = True
        await self.db.flush()
```

#### 2.1.3 No changes needed to `log_snooze()`

The `SnoozeEvent` model and route already capture snooze data. The sticky card
visibility is a frontend concern based on `SnoozeEvent` + `PredictedCycle`.

---

## 3. New Celery Task: `app/tasks/checkin.py`

### 3.1 Task Definition

```python
@celery_app.task(
    name="app.tasks.checkin.daily_checkin",
    soft_time_limit=120,
    time_limit=240,
    acks_late=True,
)
def daily_checkin() -> dict[str, int]:
    """Send one push notification per prediction at P-3."""
    return asyncio.run(_run())
```

### 3.2 Inner `_run()` Logic

1. Query `PredictedCycle` where:
   - `predicted_next_period_start == date.today() + timedelta(days=3)`
   - `checkin_sent == False`
   - `actual_cycle_entry_id IS NULL`
   - `is_active == True`
2. For each match:
   a. Fetch user's FCM token (from `User.fcm_token` or `UserDevice` table)
   b. Call `FCMClient.send_to_token()` with title/body
   c. Call `CycleService.mark_checkin_sent(prediction.id)`
3. Return `{"notifications_sent": N, "errors": E}`

### 3.3 Notification Content

- **Title:** "Period Reminder"
- **Body:** `"We expected your period around {date}. Did it arrive? Tap to confirm or adjust."`
- **Data payload:** `{"type": "checkin", "prediction_id": "...", "screen": "CycleDashboard"}`

### 3.4 Error Handling

- If FCM send fails → log warning, do NOT mark `checkin_sent` → task will retry
- If DB error → task retries (Celery auto-retry)
- Redis `SETNX` idempotency key (same pattern as `retention_cleanup.py`) to
  prevent concurrent runs

---

## 4. Celery Wiring

### 4.1 `app/core/celery_app.py`

**Add to `include`:**

```python
include=[
    "app.tasks.retention_cleanup",
    "app.tasks.checkin",               # <-- new
    "app.modules.cycle.tasks",         # uncomment (for daily prediction update)
]
```

**Add to beat schedule:**

```python
"checkin-daily": {
    "task": "app.tasks.checkin.daily_checkin",
    "schedule": crontab(hour=8, minute=0),   # 8:00 AM daily
},
```

---

## 5. Frontend Summary (for API contract)

### 5.1 Sticky Card Logic

Mobile computes window from existing `PredictionDetail`:

```
window_start = predicted_next_period_start - 3 days
window_end   = predicted_next_period_start + 6 days
today in [window_start, window_end]  → show card
```

### 5.2 Card Actions

| Action | API Call |
|--------|----------|
| "Yes, started on predicted date" | `POST /api/v1/cycle/corrections` with `corrected_prediction_id` |
| "No, adjust" | Same endpoint — user picks actual start date |
| "Not yet" (snooze) | `POST /api/v1/cycle/snooze` with `day_offset` |

### 5.3 Permanent Override Button

- Always visible on Cycle Dashboard
- Opens unrestricted date picker
- Calls `POST /api/v1/cycle/corrections` with `corrected_prediction_id`

### 5.4 Push Notification Handling

- Register FCM token via existing `POST /api/v1/auth/fcm/register`
- On notification tap → deep-link to Cycle Dashboard
- Notification payload: `{"type": "checkin", "prediction_id": "..."}`

---

## 6. Files Not Changed

| File | Reason |
|------|--------|
| `app/modules/cycle/schemas.py` | Existing `CorrectionCreate`/`SnoozeCreate` fully cover the flow |
| `app/modules/cycle/routes.py` | No new endpoints needed; `init_module` doesn't need new subscriptions |
| `app/modules/cycle/dependencies.py` | No new dependencies |
| `app/core/config.py` | No new configuration needed (scheduling is hardcoded in Celery beat) |

---

## 7. Validation Checklist

- [ ] `checkin_sent` column exists on `predicted_cycles` table (via migration)
- [ ] `daily_checkin` task queries only uncorrected, unsent predictions at P-3
- [ ] FCM push is sent once per prediction (idempotent via `checkin_sent`)
- [ ] Manual correction before P-3 suppresses the notification
- [ ] Manual correction after P+6 still updates `avg_error` and dirty flag
- [ ] Snooze (already implemented) continues to log `SnoozeEvent` correctly
- [ ] Alembic migration is reversible
- [ ] Beat schedule registered in `celery_app.py`
