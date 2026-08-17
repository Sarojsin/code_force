# Cycle Report-as-a-Service (RaaS) + Dead-Chat Cleanup

> **Status:** Ready for review
> **Scope:** Populate the empty Analytics tab with AI-generated cycle reports and remove orphaned/fake chat code.
> **Branch rules learned from:** AGENTS.md (§1.4, §1.8, §1.9, §1.12, §1.14, §1.15, §3.1), `backend_rules.md`, `frontend_rules.md`.

---

## 1. Objective

The **Analytics tab** renders `AnalyticsDashboardScreen` but shows an empty
"Log at least 1 cycle" state in practice. Root cause (verified):

- `GET /cycle/analytics` (`services.py:1102`) only aggregates `CycleEntry`
  rows **with `period_end_date` set** — open/started cycles and everyday
  `CycleDay` observations (`day_symptoms`, `day_medications`, mood, sleep,
  pain) never contribute.
- `common_symptoms` / `common_moods` are sourced only from the entry's own
  `symptoms` / `mood_tags` JSONB (rarely populated because daily check-ins
  write to `cycle_days`, not `cycle_entries`).
- The dashboard gate `!analytics || analytics.total_entries === 0`
  (`AnalyticsDashboardScreen.tsx:85`) collapses to the empty state.

**Strategy — Generate once, store forever, read many times:**

1. When a cycle closes (`period_end_date` set), a background Celery task
   aggregates the user's last 3–6 cycles + day observations into a
   **privacy-safe stats blob**.
2. The stats blob goes to **Groq (Llama 3)** to produce a **strict JSON**
   report; if Groq is disabled/unavailable, a deterministic rule-based
   generator produces an equivalent report (zero secrets/cost).
3. The validated report is stored in a new `cycle_reports` table
   (`user_id`, `cycle_entry_id`, `report_data`).
4. The Analytics tab fetches the stored report real-time — no LLM latency,
   no rate-limit exposure on read.

Additionally: delete the dead `AIChatStack` and the fake hardcoded
`AIChatScreen` (Luna overlay remains the chat surface).

### Decisions (locked with user)

| Decision | Choice |
|----------|--------|
| LLM provider | **Groq (Llama 3)** — new integration client |
| Analytics layout | **Add "AI Insights" report card above existing widgets** |
| Generation trigger | **At every closed cycle** (upsert per `cycle_entry_id`) |
| Chat cleanup scope | **Delete stack + fake screen** (incl. HomeStack route + Settings row) |

---

## 2. Backend Changes

### 2.1 Migration — `0025_cycle_add_reports_table.py`

New file: `backend/alembic/versions/0025_cycle_add_reports_table.py`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` PK | |
| `user_id` | `UUID` FK → `users.id` | `ondelete="CASCADE"`, indexed |
| `cycle_entry_id` | `UUID` FK → `cycle_entries.id` | `ondelete="CASCADE"`, indexed, **UNIQUE** (one report per cycle) |
| `status` | `String(20)` | `pending` \| `ready` \| `error` |
| `report_data` | `JSONB` | validated `ReportData`, nullable |
| `generated_at` | `TIMESTAMPTZ` | nullable |
| `is_active` | `Boolean` | default `True` (soft delete, AGENTS §1.4) |

- Module-owned table, no cross-module cascade (AGENTS §1.4).
- `downgrade()` drops the table (reversible — this is a pure additive table).

```python
# alembic/versions/0025_cycle_add_reports_table.py (shape)
revision: str = "0025"
down_revision: str | None = "0024"

def upgrade() -> None:
    op.create_table(
        "cycle_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cycle_entry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cycle_entries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("report_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("cycle_entry_id", name="unique_cycle_report_entry"),
    )
    op.create_index("ix_cycle_reports_user_id", "cycle_reports", ["user_id"])

def downgrade() -> None:
    op.drop_index("ix_cycle_reports_user_id", table_name="cycle_reports")
    op.drop_table("cycle_reports")
```

### 2.2 Model — `CycleReport` in `backend/app/modules/cycle/models.py`

Append near the other cycle models:

```python
class CycleReport(Base):
    __tablename__ = "cycle_reports"
    __table_args__ = (
        UniqueConstraint("cycle_entry_id", name="unique_cycle_report_entry"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cycle_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cycle_entries.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    report_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

### 2.3 Config — `GroqSettings` in `backend/app/core/config.py`

```python
class GroqSettings(BaseSettings):
    api_key: str = ""                      # env GROQ__API_KEY
    model: str = "llama-3.3-70b-versatile" # fallback "llama-3.1-8b-instant"
    inference_url: str = "https://api.groq.com/openai/v1/chat/completions"
    max_tokens: int = 900
    temperature: float = 0.3
    enabled: bool = False                  # off => deterministic rule-based reports
```

Wire into `Settings`:

```python
groq: GroqSettings = Field(default_factory=GroqSettings)
```

### 2.4 Integration client — `backend/app/integrations/groq_client.py`

Mirror `huggingface_client.py` (AGENTS §1.15 — client owns retry, timeout,
circuit-ish behaviour). No direct HTTP from services.

```python
class GroqError(Exception): ...

class GroqClient:
    def __init__(self, settings: GroqSettings, max_retries: int = 3, timeout: float = 30.0):
        self._settings = settings
        self._max_retries = max_retries
        self._timeout = timeout
        self._has_credentials = bool(settings.api_key and settings.enabled)

    async def generate_report(self, prompt: str) -> str:
        """Return the LLM text response. Empty string when no credentials."""
        if not self._has_credentials:
            return ""
        # POST {settings.inference_url} with OpenAI-compatible payload:
        # { model, messages:[{role:user, content:prompt}], temperature,
        #   max_tokens, response_format: {type: "json_object"} }
        # Retry/backoff on 429, 5xx, timeouts (2*capture*.backoff, capped 60s).
        # Raise GroqError after max_retries attempts.
```

### 2.5 Schemas — `backend/app/modules/cycle/schemas.py`

```python
class ReportData(BaseModel):
    """Validated JSON the LLM (or rule-based fallback) must return."""
    summary: str
    regularity_score: int = Field(ge=0, le=100)
    top_symptoms: list[str] = Field(default_factory=list, max_length=10)
    correlation_found: str
    doctor_note: str

class CycleReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    cycle_entry_id: uuid.UUID
    status: str
    report_data: ReportData | None = None
    generated_at: datetime | None = None

class ReportGenerateRequest(BaseModel):
    cycle_entry_id: uuid.UUID

class ReportEmptyResponse(BaseModel):
    """Empty-state payload so mobile has ONE shape and never parses 404."""
    report: None = None
    message: str = "No report yet"
```

### 2.6 Service methods — `backend/app/modules/cycle/services.py`

New methods on `CycleService`. **No HTTP types leak into the service layer.**

#### `async def get_aggregated_stats(self, user_id, entry) -> dict`

Builds a **privacy-safe** aggregate (last 3–6 closed cycles + overlapping day
observations). **NEVER** include dates, notes, or PII — only counts/means/freqs.

```python
{
  "cycles_count": int,
  "avg_cycle_length_days": float | None,
  "avg_period_length_days": float | None,
  "avg_sleep_hours": float | None,          # from cycle_days.sleep_minutes
  "avg_pain_level": float | None,           # pain_level 0-10
  "avg_energy_level": float | None,         # 1-3
  "common_moods": [{"mood": str, "count": int}, ...],          # top 5
  "symptoms_by_phase": {                    # menstrual|follicular|ovulation|luteal
      "menstrual": [{"symptom": str, "count": int}, ...],
      ...
  },                                        # top 5 per phase
  "cycle_length_std_dev_days": float | None,
}
```

Implementation notes:
- Closed cycles: `CycleEntry` where `is_active` AND `period_end_date` set,
  ordered desc, take latest 3–6 (`services.py` already has comparable logic at
  `_determine_period_state` / `_get_recent_entries`, `list_entries`).
- Day rows in union of cycle date ranges via a query shaped like
  `list_days` (`services.py:1366`) but **without decrypting notes** — notes
  must stay encrypted and are never sent to the LLM.
- Phase mapping for day-level symptoms: reuse the phase-keys logic present in
  `app/modules/cycle/phase_utils.py` / mobile `cyclePhases.ts`. Keep it simple:
  map by fraction-of-cycle derived from the entry's start date + cycle length.
- Symptoms on day rows come from `day_symptoms.symptom.name` (`selectinload`
  as in `services.py:1360-1364`).

#### `async def build_rule_based_report(self, stats: dict) -> ReportData`

Deterministic fallback (always available, no API key needed):

```python
ReportData(
    summary=_compose_summary(stats),           # e.g. "Your last N cycles were regular…"
    regularity_score=_regularity_score(stats), # 100 - clamp(stddev*5) etc., 0-100
    top_symptoms=[s for s in _top_overall_symptoms(stats)],  # top 3
    correlation_found=_correlation_line(stats),   # sleep vs energy when enough data
    doctor_note=_doctor_note(stats),              # templated, non-diagnostic
)
```

- Stays within `ReportData` constraints so mobile always validates the same shape.

#### `async def generate_report(self, user_id, cycle_entry_id) -> CycleReport`

Orchestrator (called from Celery task):
1. Load entry scoped by `user_id` (row-level permission AGENTS §1.12).
2. `stats = await self.get_aggregated_stats(user_id, entry)`.
3. `GroqClient(get_settings().groq)` → `generate_report(prompt)`.
   - `prompt` built from a module-level constant template + `json.dumps(stats)`.
   - System prompt: "You are a women's health data analyst… Output ONLY valid JSON."
4. If LLM text empty → `data = await self.build_rule_based_report(stats)`.
   Else try `ReportData.model_validate_json(cleaned_text)`; on `ValidationError`
   fall back to rule-based report (never store partial/garbage; rule §1.6).
5. Upsert `CycleReport` (unique `cycle_entry_id`): set `status="ready"`,
   `report_data=data.model_dump()`, `generated_at=now(UTC)`. Exceptions →
   `status="error"` + log.
6. Return row.

#### `async def get_latest_report(self, user_id) -> CycleReport | None`

Newest `is_active` row ordered by `generated_at` desc (or `cycle_entry_id`
recency when `generated_at` null).

**Trigger hook.** In `create_entry` (after successful commit + predictions,
`services.py:150`), `update_entry` (`services.py:272`), and `log_correction`
(`services.py:985`): when the resulting `entry.period_end_date` is set, emit:

```python
event_bus.emit("cycle_closed", user_id=str(entry.user_id), cycle_entry_id=str(entry.id))
```

Subscriber (registered in `init_module` in `cycle/routes.py`) enqueues the
Celery task (AGENTS §1.9). The Core report generation runs async via Celery so
the request path is untouched latency-wise.

### 2.7 Routes — `backend/app/modules/cycle/routes.py`

Thin routes (AGENTS §1.2):

```python
@router.post(
    "/reports",
    response_model=CycleReportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue cycle report generation (or return existing)",
)
async def create_report(payload: ReportGenerateRequest, current_user: CurrentUser, svc: CycleServiceDep):
    task = generate_cycle_report.apply_async(
        kwargs={"user_id": str(current_user.id), "cycle_entry_id": str(payload.cycle_entry_id)},
        task_id=f"generate_cycle_report_{payload.cycle_entry_id}",
    )
    # Return the existing/pending row if present, else a pending stub.
    report = await svc.get_latest_for_entry(current_user.id, payload.cycle_entry_id)
    if report is None:
        report = CycleReport(user_id=current_user.id, cycle_entry_id=payload.cycle_entry_id, status="pending")
        svc.db.add(report); await svc.db.commit()
    return CycleReportResponse.model_validate(report)

@router.get(
    "/reports/latest",
    response_model=CycleReportResponse | ReportEmptyResponse,
    summary="Get the user's latest stored cycle report",
)
async def get_latest_report(current_user: CurrentUser, svc: CycleServiceDep):
    report = await svc.get_latest_report(current_user.id)
    if report is None:
        return ReportEmptyResponse()
    return CycleReportResponse.model_validate(report)
```

- Both scoped by `current_user.id` (AGENTS §1.12).
- Add `/reports` + `/reports/latest` to `init_module` subscriber registration:

```python
async def _on_cycle_closed(user_id: str, cycle_entry_id: str) -> None:
    from app.modules.cycle.tasks import generate_cycle_report
    generate_cycle_report.apply_async(
        kwargs={"user_id": user_id, "cycle_entry_id": cycle_entry_id},
        task_id=f"generate_cycle_report_{cycle_entry_id}",
    )

event_bus.subscribe_sync("cycle_closed", _on_cycle_closed)
```

### 2.8 Celery task — `backend/app/modules/cycle/tasks.py`

```python
@celery_app.task(
    name="app.modules.cycle.tasks.generate_cycle_report",
    soft_time_limit=60,
    time_limit=120,
    bind=True,
)
def generate_cycle_report(self, user_id: str, cycle_entry_id: str) -> None:
    """Generate + store a cycle report. Idempotent via business-key task_id."""
    import asyncio
    async def _run() -> None:
        from app.core.database import AsyncSessionLocal
        from app.modules.cycle.services import CycleService
        async with AsyncSessionLocal() as session:
            svc = CycleService(session, None)   # encryption not needed: no notes decrypted
            try:
                await svc.generate_report(uuid.UUID(user_id), uuid.UUID(cycle_entry_id))
                logger.info("cycle.report_generated", extra={"user_id": user_id, "cycle_entry_id": cycle_entry_id})
            except Exception as exc:
                logger.error("cycle.report_failed", extra={"user_id": user_id, "cycle_entry_id": cycle_entry_id, "error": str(exc)})
                raise
    asyncio.run(_run())
```

- Celery `include` list already contains `app.modules.cycle.tasks`
  (`celery_app.py:21`) — no change needed.
- Idempotent: fixed `task_id` per `cycle_entry_id` (AGENTS §1.8) + unique DB
  constraint. Running twice upserts the same row.
- `CycleService(session, None)`: `encryption` is only used by note-decrypt
  paths; aggregation never decrypts. Keep constructor default-safe.

Note: `CycleService.__init__` currently takes `(db, encryption)`; verify the
signature and pass the real `EncryptionService` via `get_encryption_service()`
if the constructor requires it — do NOT loosen the type.

### 2.9 Exceptions — `backend/app/modules/cycle/exceptions.py`

No new exception types strictly required; `generate_report` swallows LLM +
validation failures and stores `status="error"`. Add
`CycleReportNotFoundError` only if a route NEEDS a 404; the "latest" route uses
`ReportEmptyResponse` instead to keep one mobile shape.

---

## 3. Frontend Changes

### 3.1 API layer — `mobile/src/services/api/cycle.ts`

Add types + methods (mirror existing `getAnalytics`, `unwrap` pattern):

```ts
export interface ReportData {
  summary: string;
  regularity_score: number;
  top_symptoms: string[];
  correlation_found: string;
  doctor_note: string;
}

export interface CycleReport {
  id: string;
  cycle_entry_id: string;
  status: 'pending' | 'ready' | 'error';
  report_data?: ReportData | null;
  generated_at?: string | null;
}

export interface ReportEmptyResponse {
  report: null;
  message: string;
}

// in cycleService:
  async getLatestReport(): Promise<CycleReport | null> {
    const res = await api.get('/cycle/reports/latest');
    const unwrapped = unwrap(res.data);
    // a null report / ReportEmptyResponse => null
    return unwrapped && unwrapped.report === null ? null : (unwrapped as CycleReport);
  }

  async requestReport(cycleEntryId: string): Promise<CycleReport> {
    const res = await api.post('/cycle/reports', { cycle_entry_id: cycleEntryId });
    return unwrap(res.data);
  }
```

### 3.2 Query hook — `mobile/src/services/queries/cycle.ts`

- `useCycleReport()` — user-scoped React Query key via `getCycleKeys(userId).analytics`
  (already exists) or a dedicated `report` key appended to the factory
  (recommended: add `report: ['cycle', id, 'reports']` to `getCycleKeys`).
  `staleTime: 10 * 60 * 1000`, `retry: false`.
- Add `qc.invalidateQueries({ queryKey: keys.report })` to `useCreateCycleEntry`,
  `useUpdateCycleEntry`, `useLogCorrection` `onSuccess` blocks (the same places
  that already invalidate `keys.analytics`).

### 3.3 `AnalyticsDashboardScreen.tsx` — "AI Insights" card above widgets

- Fetch `useCycleReport()` alongside existing entries/analytics.
- Above the `statRow`:

| `report.status` | UI |
|---|---|
| `ready` + `report_data` | Card: regularity score (progress ring or big number /100), `summary`, `top_symptoms` chips, `correlation_found`, `doctor_note`. Respect a "medical disclaimer" footer (consistent with app patterns). |
| `pending` | Skeleton card + "Analyzing your cycle…" |
| `error` / cast | Show the standard widgets; optionally a light "Couldn't generate insights" note. |
| `null` | No card (existing empty state governs) |

- **Keep all existing widgets** (avg length, range, line chart, symptom/mood
  bars) below the report card.
- Loosen the empty-state gate so it still reads cycle entries when a report is
  not yet available: retain current `analytics.total_entries === 0` logic, but
  do not gate on report availability.
- All styles via `theme` tokens / existing `StyleSheet` pattern (AGENTS §2.3);
  new components use shared `Card`, `Text`, `Skeleton` from `src/components/ui`.

### 3.4 API contract doc — `plans/30-mobile-api-contract.md`

Append a new section documenting (AGENTS §3.1 — contract is source of truth):

```md
#### GET /api/v1/cycle/reports/latest
- 200 => { "data": { id, cycle_entry_id, status, report_data?: ReportData, generated_at } }
  or { "data": { report: null, message } }
- ReportData = { summary, regularity_score, top_symptoms[], correlation_found, doctor_note }

#### POST /api/v1/cycle/reports
- Body { "cycle_entry_id": "<uuid>" }
- 202 => CycleReportResponse with status "pending"
- Idempotency: fixed combined with unique cycle_entry_id; no Idempotency-Key needed.
```

---

## 4. Dead-Chat Cleanup

Verified current references (grep):

| File | Line | Change |
|------|------|--------|
| `mobile/src/navigation/AIChatStack.tsx` | — | **DELETE file** |
| `mobile/src/screens/chat/AIChatScreen.tsx` | — | **DELETE file** |
| `mobile/src/navigation/types.ts` | 114–116 | Remove `AIChatStackParamList` |
| `mobile/src/navigation/types.ts` | 77 | Remove `AIChat` from `HomeStackParamList` |
| `mobile/src/navigation/HomeStack.tsx` | 10, 51 | Remove import + `<Stack.Screen name="AIChat">` |
| `mobile/src/screens/profile/SettingsScreen.tsx` | 434–445 | Remove "Chat with Luna" `SettingRow` |
| `mobile/src/navigation/MainTabs.tsx` | 3 | Fix stale comment → `Home \| Calendar \| Analytics \| Wellness \| Profile` |

Post-cleanup verification: `rg "AIChat"` across `mobile/src` → **0 matches**.

**Note:** `ChatStackParamList` (Stream.io human chat, `types.ts:66-69`) and
`ChatRoomScreen` etc. are **out of scope** — leave untouched.

---

## 5. Testing

### Backend — `backend/tests/modules/cycle/test_reports.py`

Follow `test_tasks.py` pattern: eager Celery, in-memory SQLite (`:memory:`),
JSONB→JSON compile hack already present.

| Test | Asserts |
|------|---------|
| `test_aggregated_stats_no_pii` | output keys contain no dates/notes/uuids |
| `test_aggregated_stats_with_day_rows` | sleep/pain/mood/symptom counts merged from `cycle_days` |
| `test_rule_based_report_shape` | `ReportData` validates; score ∈ [0,100]; top 3 symptoms |
| `test_generate_report_uses_groq` | mocked `GroqClient.generate_report` → stored `status=ready` |
| `test_generate_report_falls_back_on_validation_error` | LLM returns bad JSON → rule-based fallback stored |
| `test_generate_report_no_credentials` | `enabled=False` → rule-based path stored |
| `test_generate_report_task_idempotent` | calling task twice → single `cycle_reports` row |
| `test_post_report_returns_accepted` | 202, status `pending` |
| `test_get_latest_report` | returns latest; empty-user → `ReportEmptyResponse` |
| `test_report_row_isolation` | user B cannot see/read user A rows (row-level permission) |

### Frontend

- `tsc --noEmit`, `eslint` over changed files.
- Update/extend Jest tests for `useCycleReport` hook and any new pure utils.

### Manual smoke

1. Log a period (state A/B auto-fills `period_end_date`) → worker picks up
   `cycle_closed` → `cycle_reports` row becomes `ready`.
2. Analytics tab: "AI Insights" card renders with stored text. No LLM call on
   re-visit (proven by no network request on tab focus).
3. Disable `GROQ__API_KEY` / `enabled=False` → rule-based report still appears.
4. Settings → no "Chat with Luna" row. App navigates cleanly (no dangling
   `AIChat` route references).

---

## 6. Verification / Quality Gates

Run before opening PR (AGENTS checklist — backend + mobile):

- [ ] `ruff` / `isort` / `mypy --strict` pass in `backend/`
- [ ] `pytest tests/modules/cycle/` green, ≥80% coverage gate
- [ ] `tsc --noEmit` + `eslint` green in `mobile/`
- [ ] `rg "AIChat"` in `mobile/src` → 0 matches
- [ ] `plans/30-mobile-api-contract.md` updated (AGENTS §3.1)
- [ ] New files follow module-owned layout (models/schemas/routes/tasks in
      `app/modules/cycle/`)
- [ ] No cross-module service imports introduced (import-linter clean)

---

## 7. Files Touched (summary)

**Backend**
- `backend/alembic/versions/0025_cycle_add_reports_table.py` (new)
- `backend/app/modules/cycle/models.py` (+`CycleReport`)
- `backend/app/core/config.py` (+`GroqSettings`)
- `backend/app/integrations/groq_client.py` (new)
- `backend/app/modules/cycle/schemas.py` (+`ReportData`, `CycleReportResponse`, …)
- `backend/app/modules/cycle/services.py` (+stats, fallback, generate, get_latest)
- `backend/app/modules/cycle/routes.py` (+2 routes, `cycle_closed` subscriber)
- `backend/app/modules/cycle/tasks.py` (+`generate_cycle_report`)
- `backend/tests/modules/cycle/test_reports.py` (new)

**Mobile**
- `mobile/src/services/api/cycle.ts` (+report types/methods)
- `mobile/src/services/queries/cycle.ts` (+`useCycleReport`, invalidation)
- `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx` (+AI Insights card)
- `mobile/src/navigation/AIChatStack.tsx` (delete)
- `mobile/src/screens/chat/AIChatScreen.tsx` (delete)
- `mobile/src/navigation/types.ts`, `HomeStack.tsx`, `SettingsScreen.tsx`,
  `MainTabs.tsx` (cleanup)

**Docs**
- `plans/30-mobile-api-contract.md` (new endpoints)
- this plan

---

## 8. Risks & Trade-offs

- **LLM cost per edit:** generate on every closed cycle; entry *edits* re-run
  the task (upsert). ~1 LLM call per cycle log/edit when enabled. Acceptable;
  Groq free tier is large; disabled == zero cost.
- **Hallucination/latency:** mitigated by strict `ReportData` validation +
  rule-based fallback + fully async Celery path.
- **Privacy:** only aggregates cross the wire. `cycle_days.notes` stays
  encrypted end-to-end and is never decrypted/aggregated.
- **Out of scope (follow-up):** Luna overlay answering questions *from* stored
  reports; RegExp/voice intent → pull `report_data` → TTS. Not in this change.