# The Pregnancy Module — A Logical Evolution of SheCare

**Status:** ✅ BRILLIANT IDEA — This is the perfect "Phase 2" downloadable feature.

You have identified a critical user lifecycle transition: users start on the app for period tracking, but their needs shift to Trying to Conceive (TTC) or Pregnancy. If they have to leave your app to use a dedicated pregnancy app, you lose them forever. By making this a downloadable module that swaps the main dashboard, you keep the user locked into your ecosystem for years (pre-conception → pregnancy → postpartum → back to cycle tracking).

Here is the complete architectural plan to make this work.

---

## 1. The "Swap" Architecture (Period ↔ Pregnancy)

### The Core Idea

Instead of just adding a "Pregnancy" tab, you replace the entire main dashboard when the user installs the module.

| Phase | Dashboard | Purpose |
|-------|-----------|---------|
| Default (Period Tracking) | Cycle Dashboard | Period predictions, calendar, mood, journal. |
| Trying to Conceive (TTC) | Fertility Dashboard | Ovulation predictions, BBT tracking, cervical mucus, fertile window. |
| Pregnancy | Pregnancy Dashboard | Due date countdown, week-by-week development, fetal milestones, kick counter. |
| Postpartum | Postpartum Dashboard | Period return prediction, baby feeding logs, sleep tracking. |

### How the "Swap" Happens

The user's Life Stage setting determines which dashboard renders.

**The UI Flow:**

1. User installs the Pregnancy Module from the Feature Store.
2. Settings → Life Stage now appears: Menstrual Tracking | Trying to Conceive | Pregnant | Postpartum.
3. When toggled: The MainTabs or HomeStack dynamically rebuilds:
   - If `life_stage = 'pregnant'` → Render `PregnancyStack` as the primary home screen.
   - If `life_stage = 'menstrual'` → Render `CycleStack` as the primary home screen.
4. **Data persistence:** The user's past period logs are never deleted. They are archived under the `cycle_entries` table but hidden from the main dashboard. If they switch back, all data reappears.

---

## 2. What the Pregnancy Module Must Deliver

### Phase A: Trying to Conceive (TTC) — "The Fertility Mode"

| Feature | How It Works | Offline? |
|---------|--------------|----------|
| Ovulation Prediction | Uses your existing cycle data and global ML model to predict the fertile window with higher precision. | ✅ Yes (JSON model). |
| BBT (Basal Body Temperature) Logging | User logs temperature daily. The app highlights ovulation confirmation (3 days of rising temps). | ✅ Yes (SQLite). |
| Cervical Mucus Tracking | User logs mucus consistency. The app shows the fertile window. | ✅ Yes. |
| Ovulation Test (LH) Logging | User uploads a photo of an LH test strip (or logs positive/negative). | ✅ Yes. |
| Fertility Score | A daily score combining BBT, mucus, and cycle data. | ✅ Yes. |

### Phase B: Pregnancy — "The Journey Mode"

| Feature | How It Works | Offline? |
|---------|--------------|----------|
| Due Date Calculator | LMP (Last Menstrual Period) + 280 days = Due Date. | ✅ Yes (Math). |
| Week-by-Week Countdown | Shows the current week. "You are 12 weeks pregnant." | ✅ Yes. |
| Fetal Size Comparison | "Baby is the size of a lemon." (Database of sizes per week). | ✅ Yes (Bundled JSON). |
| Pregnancy Weight Tracker | Log weight weekly. Shows recommended gain range. | ✅ Yes. |
| Kick Counter | User taps a button to count baby's kicks (per hour). | ✅ Yes. |
| Contraction Timer | User taps "Start" and "Stop" to track contraction duration/frequency. | ✅ Yes (Local timer). |
| To-Do List (Pre-Natal) | Checklist for doctor visits, tests (Glucose, Ultrasound). | ✅ Yes (SQLite). |

### Phase C: Postpartum — "The Recovery Mode"

| Feature | How It Works | Offline? |
|---------|--------------|----------|
| Period Return Prediction | Predicts when the period will return based on breastfeeding status. | ✅ Yes (Heuristic). |
| Baby Feeding Log | Track breastfeeding or bottle feeding times. | ✅ Yes. |
| Baby Sleep Log | Track baby's sleep patterns. | ✅ Yes. |
| Postpartum Recovery Checklist | Physical therapy reminders, mental health check-ins. | ✅ Yes. |
| Mood Tracker (Specialized) | Postpartum depression screening (Edinburgh scale). | ✅ Yes (Local calculation). |

---

## 3. How the Swap Works Technically (Without Code)

**Step 1: Feature Installation**
- Backend: `user_features` table gets `pregnancy: true`.
- Mobile: SQLite `feature_installed = true`.

**Step 2: Life Stage Setting**
- UI: Settings → "Life Stage" dropdown.
- Storage: SQLite `user_meta` table → `life_stage: 'pregnant'`.

**Step 3: Navigation Rebuild**
- `RootNavigator` reads the `life_stage` from SQLite (synchronous).
- If `life_stage = 'pregnant'`: The main tab navigator renders `PregnancyStack` instead of `CycleStack`.
- If `life_stage = 'menstrual'`: The main tab navigator renders `CycleStack`.
- **Seamless transition:** When the user toggles, the app navigates to the new dashboard instantly (no download, since the module was already installed).

**Step 4: The "Emergency Switch"**

**Rule:** The user can always switch back to period tracking mode, even if she is pregnant, to view past logs or just use the period features.

**Option:** A small icon in the top-right corner of the Pregnancy Dashboard labeled "Switch to Cycle View" (temporary) or go to Settings to permanently change the life stage.

---

## 4. Data Migration: What Happens to Period Data?

| Scenario | System Behavior |
|----------|-----------------|
| User is TTC | Cycle logs are still used to predict ovulation. The app does not stop tracking; it just adds fertility features. |
| User logs a positive pregnancy test | The app prompts: "Congratulations! Do you want to switch to Pregnancy Mode?" If yes, the LMP is used to calculate the due date. The cycle logs are archived. |
| User switches back to Period Mode | The period logs reappear. The pregnancy logs are archived but not deleted. |
| Postpartum | The period return prediction algorithm uses the user's previous cycle data + breastfeeding status to guess when periods will restart. |

**Data Rule:** Never delete user data. All logs are archived with a `life_stage` tag (`'menstrual'`, `'ttc'`, `'pregnant'`, `'postpartum'`). This allows users to look back at their full reproductive history.

---

## 5. Offline-First Guarantees

Since this is a downloadable module, all features must work without internet:

| Feature | Offline Capability |
|---------|-------------------|
| Due Date Calculation | Pure math (LMP + 280 days). No API needed. |
| Week-by-Week Data | Bundled JSON (`pregnancy_weeks.json`) stored locally. |
| Kick Counter | Local timer and SQLite storage. |
| Contraction Timer | Local timer and SQLite storage. |
| BBT Logging | SQLite storage. |
| Weight Tracker | SQLite storage. |
| To-Do List | SQLite storage. |
| Symptoms Logging | SQLite storage. |

**Sync:**

When the user eventually connects to the internet, the pregnancy logs sync to the server via the existing `syncEngine`.

The server stores the logs in the `pregnancy_*` tables (which already exist in your backend).

---

## 6. The "Medical Disclaimer" — Critical

Because you are handling pregnancy data, you must display a strong disclaimer on every screen:

> **⚠️ Medical Disclaimer**
>
> "SheCare is for educational and tracking purposes only. It does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider for medical decisions."

**Location:** At the bottom of the Pregnancy Dashboard and in the Settings screen.

---

## 7. Monetization Strategy (The "Premium" Angle)

Since this is a downloadable module, it is an ideal premium upgrade:

| Tier | Features |
|------|----------|
| Free (Period Tracking) | Cycle dashboard, predictions, mood, journal. |
| Premium (Pregnancy Module) | All TTC features, Pregnancy Journey, Postpartum, Baby logs, Advanced insights. |
| Subscription | Premium features + professional birth education videos (content). |

---

## 8. Implementation Roadmap (3 Months)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Foundation | 2 weeks | TTC features: Ovulation prediction, BBT logging, cervical mucus. |
| 2. Pregnancy Journey | 3 weeks | Due date, week-by-week data, weight tracker, kick counter. |
| 3. Postpartum | 2 weeks | Period return prediction, baby feeding logs, mood screening. |
| 4. UI/UX Polish | 2 weeks | Life stage toggle, dashboard swap, migration logic. |
| 5. Medical Disclaimer & Legal | 1 week | Review by a medical professional, compliance check. |

---

## 9. Validation Checklist (QA)

- [ ] User installs pregnancy module → Life Stage settings appear.
- [ ] User sets Life Stage = "Pregnant" → Dashboard swaps to Pregnancy view.
- [ ] Due date updates correctly when LMP is entered.
- [ ] Week counter updates daily.
- [ ] Kick counter works offline.
- [ ] Switching back to "Menstrual" → Cycle dashboard reappears, pregnancy logs are archived.
- [ ] All pregnancy logs sync to the server when online.
- [ ] Medical disclaimer is visible on all pregnancy screens.

---

## 🏆 Final Verdict

The Pregnancy Module is a brilliant, high-value addition to SheCare.

| Aspect | Status |
|--------|--------|
| User Retention | ✅ Prevents users from leaving the app when they get pregnant. |
| Technical Fit | ✅ Perfectly aligns with the DLC/Feature Flag architecture. |
| Offline-Capable | ✅ All features can work offline (scheduled for Phase 2). |
| Monetization | ✅ High-value feature for a premium tier. |
| Data Integrity | ✅ Period logs are archived, never deleted. |
