# Final Specification: Targeted Correction Notification & Permanent Manual Override

## Objective

Implement a proactive correction flow that:

1. gently reminds users near the predicted date,
2. provides a persistent sticky card on the dashboard during the window, and
3. ensures 100% of correction data is captured via a permanent manual override, especially for periods arriving significantly early or late.

---

## 1. The Correction Window & Notification Trigger

### 1.1 Definition

For every active prediction (next period start date = P):

```
Window Start = P - 3 days
Window End   = P + 6 days
```

### 1.2 Push Notification (Single, Non-Spam)

**Trigger:** A daily Celery task (`app/tasks/checkin.py`) checks if `Today == P - 3`.

**Action:** Sends one push notification to the user:

> "We expected your period around [Date]. Did it arrive? Tap to confirm or adjust."

**Constraint:** No further push notifications are sent for this specific cycle, regardless of response, to prevent notification fatigue.

---

## 2. The "Sticky Card" (Dashboard UI)

To handle users who dismiss the notification or open the app before the notification is sent, a persistent card appears at the top of the Cycle Dashboard.

### 2.1 Visibility Rules

- Appears automatically on `Today == P - 3` (same day as the push notification).
- Remains visible until the user explicitly acts on it OR until `Today > P + 6`.
- **Auto-Dismisses:** After `P + 6`, the card disappears. The assumption is that the user will use the permanent manual override if they are late.

### 2.2 User Actions on the Card

| User Action | System Behavior |
|-------------|-----------------|
| "Yes, started on [Predicted Date]" | Confirms the model was correct. Links/Creates a `cycle_entry`. Sets `prediction_error_days = 0`. Adds to `avg_error` (weighted update). Card disappears. |
| "No, adjust date" | Opens a date picker. User selects the actual start date. Triggers `log_correction()` (calculates deviation, updates `avg_error`, sets dirty flag). Card disappears. |
| "It hasn't started yet" (Snooze) | Hides the card for 24 hours. Logs a `snooze_event`. The card reappears the next day (day offset +1). This captures the progression of lateness as a feature for the global model. |

---

## 3. Permanent Manual Override (The Universal Safety Net)

**CRITICAL:** Since the push notification is only sent around `P - 3`, and the sticky card auto-dismisses at `P + 6 `, we need a permanent fallback for outliers (e.g., period arriving 14 days early or 30 days late).

### 3.1 UI Placement

Place a permanent, prominent button/icon (e.g., "Adjust Period Date" or a pencil icon) on the Cycle Dashboard screen.

This button is always visible, regardless of whether the sticky card is shown or the push notification was sent.

### 3.2 Behavior (No Restrictions)

Tapping the button opens a standard date picker.

**Crucial:** The date picker has NO restrictions. The user can select any date�past, present, or future.

### 3.3 Edge Case Handling (Period Arrives Early)

**Scenario:** Prediction is 30th. User gets period on 16th (14 days early).

**Flow:**

1. The user opens the app on the 16th.
2. The push notification is not scheduled yet (it would fire on the 28th).
3. The user taps the "Adjust Period Date" button.
4. User selects 16th from the date picker.
5. System calculates `prediction_error_days = 16 - 30 = -14` (negative indicates early).
6. System updates `avg_prediction_error_days` (running average).
7. System sets `is_dirty_for_retraining = True`.
8. Calendar updates immediately. The sticky card (set to appear on the 28th) is canceled/suppressed because the prediction is now resolved.

### 3.4 Edge Case Handling (Period Arrives Significantly Late)

**Scenario:** Prediction is 30th. User's period starts on 15th of next month (15 days late).

**Flow:**

1. Sticky card auto-dismissed at `P + 6 ` (6th of next month).
2. User misses the card. Opens app later.
3. User taps the permanent "Adjust Period Date" button.
4. User selects 15th.
5. System calculates `prediction_error_days = 15 - 30 = +15`.
6. Correction flow triggers as usual.

---

## 4. Backend Logic (Celery Check-in Task)

### 4.1 Task Definition

```python
@celery_app.task(name="app.tasks.checkin.daily_checkin")
def daily_checkin() -> None:
    """Check for predictions approaching P-3 and trigger push notifications."""
    today = date.today()
    
    # 1. Find predictions where today == P-3
    target_predictions = query(
        predicted_next_period_start == today + timedelta(days=3)
        AND actual_cycle_entry_id IS NULL
        AND checkin_sent == False  # Idempotency flag
    )
    
    for pred in target_predictions:
        # 2. Send push notification
        push_notification(pred.user_id, f"Expected period around {pred.predicted_next_period_start}...")
        
        # 3. Mark checkin_sent = True to prevent duplicate triggers
        pred.checkin_sent = True
        db.commit()
```

### 4.2 Suppression Rule

If the user corrects the period manually via the "Adjust Period Date" button before `P-2`, the `checkin_sent` flag is set to `True` automatically. This suppresses the notification, preventing the app from reminding the user of an already-logged period.

---

## 5. Data Model Changes

Add `checkin_sent` (Boolean, default `False`) to `predicted_cycles` table to ensure idempotency of the notification trigger.

```sql
ALTER TABLE predicted_cycles ADD COLUMN checkin_sent BOOLEAN DEFAULT FALSE;
```

---

## 6. Summary Flow Diagram

```
Prediction Date = 30th
  �
  +- User gets period on 16th (Early) --? User taps "Adjust Period Date".
  �                                      Logs 16th.
  �                                      prediction_error = -14.
  �                                      Notification scheduled for 27th is canceled.
 
  +- 27th (Day -3) ---------------------? System sends Push Notification.
                                       Sticky Card appears on Dashboard.
 
  +- 27th - 6th (Window) --------------? User ignores notification but opens app.
                                       Sticky Card handles correction.
 
  +- 7th (Day +7) ----------------------? Sticky Card Auto-Dismisses.
  �
  +- User gets period on 15th (Late) ---? User taps "Adjust Period Date".
                                          Logs 15th.
                                          prediction_error = +15.
```

---

## 7. Validation Criteria

- [ ] Push notification triggers exactly on `P-3` (no duplicates, no early/late triggers).
- [ ] Sticky card appears on `P-3` and disappears on `P+6 `.
- [ ] Snooze hides card for 24 hours and logs `snooze_event`.
- [ ] Permanent "Adjust Period Date" button is always visible and has no date restrictions.
- [ ] Manual correction before `P-3` cancels the scheduled notification.
- [ ] Manual correction after `P+6 ` still triggers the full correction loop (updates `avg_error`, sets dirty flag).
- [ ] Early correction (negative `prediction_error_days`) correctly updates `avg_error` and dirty flag.
- [ ] Late correction (positive `prediction_error_days`) correctly updates `avg_error` and dirty flag.
- [ ] `checkin_sent` flag prevents duplicate push notifications.
