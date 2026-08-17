# Richer Analytics + Per-Cycle Report History

> **Status:** Ready for review
> **Scope:** Rebuild the Analytics tab into a high-fidelity dashboard and add a
> per-cycle report history with a DB-first / Groq-on-miss read path.
> **Branch rules learned from:** AGENTS.md (§1.4, §1.6, §1.7, §1.9, §1.12,
> §1.14, §3.1), `backend_rules.md`, `frontend_rules.md` (§2.3 theme tokens,
> §2.4 components, §2.6 charts), and the previous
> `Cycle_Report-as-a-Service_(RaaS)` plan.

---

## 1. Objective

The Analytics tab is sparse and cannot express the intended dashboard because
the backend contract is too thin:

| Gap | Evidence |
|-----|----------|
| No per-cycle report read path | Only `GET /reports/latest` exists; tapping a history row does nothing |
| Analytics lacks period length / variation / sleep / pain | `get_analytics` (`services.py:1127`) only returns avg cycle length, range, symptoms, moods |
| AI card lacks real 3-column insights | `ReportData` is only 5 fields; no period-length / mood-by-phase / sleep metrics |
| Hardcoded colors violate theme rules | `#FFF8FB` x3 + `BAR_COLORS` in `AnalyticsDashboardScreen.tsx` |

**Core data-flow decision (locked with user):**

> **If a report already exists in the `cycle_reports` table, the read is a plain
> DB query — no API/LLM request. Only when a cycle has no stored report does the
> backend call Groq (with the rule-based fallback) to generate one on demand.**

This keeps reads instant (no LLM latency, no rate-limit exposure), and makes
tapping any history entry always resolve to a report.

---

## 2. Decisions (locked with user)

| Decision | Choice |
|----------|--------|
| Cycle history location | **Section on the Analytics tab** (below charts); tapping swaps to show that cycle's report |
| Analytics API | **Extend backend `GET /cycle/analytics`** + update contract — real data, no fake widgets |
| AI card richness | **Enrich `ReportData`** with optional derived metrics (period length, sleep, pain, moods, avg cycle) |
| Report read path | **DB-first**: existing report ⇒ plain READ. No report ⇒ `POST /reports?sync=true` triggers Groq (fallback rule-based) inline and stores it |
| Report identity | Per `cycle_entry_id` — one report per closed cycle (`unique_cycle_report_entry`) |

---

## 3. Backend Changes (`app/modules/cycle`)

### 3.1 Extend analytics payload

**`services.py` — `get_analytics` (line 1127).** Add fields derived from the
already-fetched `entries` plus a new `CycleDay` aggregation over the same
window:

| New key | Computation |
|---------|-------------|
| `avg_period_length_days` | mean of `period_end - period_start + 1` over closed entries |
| `cycle_length_std_dev_days` | `pstdev` of inter-start gaps filtered to 20–45 |
| `avg_ovulation_day` | median of `cycle_length - 14` (fallback 14) |
| `avg_sleep_hours` | mean `CycleDay.sleep_minutes / 60` |
| `avg_pain_level` | mean `CycleDay.pain_level` |
| `avg_energy_level` | mean `CycleDay.energy_level` |

**`schemas.py` — `AnalyticsResponse` (line 116).** Add the matching optional
fields (all `float | int | None`) so Pydantic round-trips the new keys. Existing
consumers (`useWellnessDashboard`) are unaffected because new fields are
additive.

### 3.2 Enrich `ReportData`

**`schemas.py` — `ReportData` (line 128).** Add **optional** derived metrics so
the AI-card 3-column chips render real numbers:

```python
avg_period_length_days: float | None = None
avg_cycle_length_days: float | None = None
avg_sleep_hours: float | None = None
avg_pain_level: float | None = None
common_moods: list[dict[str, Any]] = Field(default_factory=list)  # [{mood, count}]
```

All new fields are optional ⇒ already-stored `report_data` JSON stays valid.

**`services.py` — `build_rule_based_report` (line 1347).** Populate the new
fields from `stats` (which `get_aggregated_stats` already computes).

**`groq_client.py` — `_PROMPT_SYSTEM` (line 26).** Extend the required-JSON keys
to include the same optional metrics so the LLM emits them.

### 3.3 Per-cycle report read + on-demand sync generation

**`services.py`.** Expose the existing `_get_report_for_entry` (line 1458) as a
public `get_report_for_entry(user_id, cycle_entry_id)`.

**`routes.py`.**
- Add **`GET /cycle/reports/{cycle_entry_id}`** → `CycleReportResponse |
  ReportEmptyResponse`. Straight DB read; never calls Groq.
- Extend **`POST /cycle/reports`** with a `sync: bool = False` query param:
  - `sync=false` (default): existing Celery enqueue + `pending` stub — prod path.
  - `sync=true`: **if a ready report exists for the entry, return it
    immediately (no LLM call). Otherwise await `svc.generate_report(...)`
    inline — Groq, falling back to rule-based — then return the stored row.**
  This is the mobile tap path: one request in, one complete report out.

Idempotency is preserved: `generate_report` upserts on the unique
`cycle_entry_id`, so repeated sync calls never duplicate rows.

---

## 4. Contract Doc — `plans/30-mobile-api-contract.md`

- **§ analytics (`GET /cycle/analytics`)**: document the 6 new fields.
- **§15 Cycle Reports**:
  - `GET /cycle/reports/{cycle_entry_id}` — per-cycle read, DB-only, same
    `ReportEmptyResponse` empty shape.
  - `POST /cycle/reports?sync=true` — synchronous on-demand generation;
    returns existing report when present (no LLM), generates otherwise.
  - Enriched `ReportData` optional keys.

---

## 5. Mobile Changes (`src/`)

### 5.1 API layer — `services/api/cycle.ts`

- Extend `CycleAnalytics` (line 48) with the 6 new fields.
- Add `getReportForEntry(cycleEntryId)` → `GET /cycle/reports/{id}`.
- Add `requestReportSync(cycleEntryId)` → `POST /cycle/reports?sync=true`.
- Extend `CycleReportData` (line 173) with the optional derived metrics.

### 5.2 Query hooks — `services/queries/cycle.ts`

- `useCycleReport(cycleEntryId)` — key `['cycle', userId, 'reports', entryId]`;
  returns `CycleReport | null`.
- `useRequestCycleReportSync()` — mutation calling `requestReportSync`;
  invalidates per-entry + aggregated report keys on success.
- `useCycleAnalytics` unchanged.

### 5.3 Rebuild `screens/analytics/AnalyticsDashboardScreen.tsx`

New layout (top → bottom), **all colors/spacing from `theme.*` tokens**, reusing
`Card`, `Text`, `Skeleton`, `ProgressBar`, `ScreenLayout`, `src/utils/svg.ts`:

1. **Header** — "Analytics" (h1) + subtitle "Understand your body better ✨";
   right-aligned compact date-range chip.
2. **AI Insights card** — lavender `LinearGradient`, sparkle icon in circular
   container, `NEW` pill, robot-mascot illustration; white inner panel with
   headline (derived from `regularity_score`: "Your cycle is fairly regular" /
   "…has some variability" / "…is irregular"), supporting text from `summary`,
   **3 vertical-divider insight columns** from enriched `report_data`
   (period length · mood-by-phase · sleep/ovulation), full-width **"View full
   AI report"** CTA opening a modal/sheet with `summary` + `doctor_note`.
   Skeleton + empty states preserved.
3. **Cycle Overview** — 4 stat cards: avg cycle length · avg period length ·
   avg ovulation day · variation (Low/Moderate/High from std-dev).
4. **Cycle Length Trend** — upgraded line chart: y-axis 20/25/30/35, gridlines,
   purple line + dots, value labels above points, legend.
5. **2-col grid** — Common Symptoms (top-5 `ProgressBar` rows + icons) · Mood
   Trend (mini area chart using the `MoodAreaChart` pattern).
6. **2-col grid** — Sleep Pattern (metric + 7-bar chart) · Pain Level (metric +
   pink area chart).
7. **Cycle History section** — "See all" list of last N closed cycles
   (`Cycle {n}`, date range, period length). **Tap behavior:**
   - `useCycleReport(entryId)` → if `report !== null` show it (DB read only).
   - If `null`/no ready report → `useRequestCycleReportSync()`; on success show
     the returned report. Groq is only invoked on this miss path.
   - Selected report renders as a highlighted mini AI card directly below the
     history list (or expands the main AI card).
8. **Privacy footer** — lock icon + "Your data is private and secure. Only you
   can see your reports."

### 5.4 Cleanup

- Remove hardcoded `'#FFF8FB'` and `BAR_COLORS`.
- Wire or remove the dead `AnalyticsDetail` param (`types.ts:109`).

---

## 6. Tests

**Backend** (`tests/modules/cycle/test_reports.py` + route tests):

- `get_analytics` returns the 6 new fields (with a `CycleDay` row present).
- `ReportData.model_validate` accepts both old (5-field) and enriched payloads.
- `build_rule_based_report` fills the optional metrics from stats.
- `POST /cycle/reports?sync=true` returns existing report **without** calling
  Groq (mock asserts no call).
- `POST /cycle/reports?sync=true` calls Groq when no report exists, stores, and
  returns `status: "ready"`.
- `GET /cycle/reports/{entry_id}` returns the row / `ReportEmptyResponse`.
- Re-run existing report tests to confirm no regression.

**Mobile:** `tsc --noEmit`, ESLint; add/adjust Jest for any new pure helpers.

---

## 7. File Changes

| File | Change |
|------|--------|
| `backend/app/modules/cycle/services.py` | `get_analytics` + `build_rule_based_report` + `get_report_for_entry` |
| `backend/app/modules/cycle/schemas.py` | `AnalyticsResponse`, `ReportData` |
| `backend/app/modules/cycle/routes.py` | `GET /reports/{cycle_entry_id}`, `sync` param on POST |
| `backend/app/integrations/groq_client.py` | system prompt keys |
| `plans/30-mobile-api-contract.md` | analytics + reports sections |
| `mobile/src/services/api/cycle.ts` | types + `getReportForEntry` + `requestReportSync` |
| `mobile/src/services/queries/cycle.ts` | `useCycleReport` + `useRequestCycleReportSync` |
| `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx` | full rebuild |
| `backend/tests/modules/cycle/test_reports.py` (+ routes) | new coverage |

---

## 8. Verification

1. `ruff` + `mypy --strict` + `pytest` (backend).
2. `tsc --noEmit` + ESLint (mobile).
3. Manual on the 5-cycle account: `GET /cycle/analytics` shows new fields;
   `GET /cycle/reports/{entry_id}` returns a backfilled report; tapping a
   history row with no report triggers a single sync generation.