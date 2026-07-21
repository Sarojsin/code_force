# Storage Plan 1: Foundation — Storage Audit & Schema Design

**Priority:** Critical (2 days)
**Dependencies:** None (foundational — must be completed before any other storage plan)
**Phase:** Phase 2 (SQLite Integration)

---

## 1. Objective

Audit every API response shape used by the mobile app and design the full Drizzle ORM schema that mirrors them exactly. This is the blueprint that all subsequent plans build on. If the schema is wrong, everything downstream is wrong.

---

## 2. Deliverables

| Deliverable | Output | Acceptance Criteria |
|-------------|--------|---------------------|
| 1a. API shape inventory | `docs/storage_api_shapes.md` | Every endpoint consumed by mobile has its response shape documented with field names, types, nullability |
| 1b. Drizzle schema | `src/db/schema.ts` | All tables defined, PKs, indexes, JSON columns, foreign keys, checked with `drizzle-kit generate` |
| 1c. State machine doc | `docs/storage_state_machines.md` | Each entity's lifecycle states + transitions documented |
| 1d. Risk assessment | Section in this plan | Migration risks, data loss scenarios, rollback strategy |

---

## 3. Sub-tasks

### 3.1 Task 1a: Inventory All API Response Shapes

Walk every TanStack Query hook in `src/services/queries/` and every mutation hook that receives server data. Extract the exact response shapes.

**Files to audit:**

```
src/services/queries/
├── useCycleCalendar.ts          → Response shape: CycleEntry[]
├── useCycleHistory.ts           → Response shape: CycleEntry[]
├── useLogCorrection.ts          → Response shape: CorrectionResponse
├── useHealthInsights.ts         → Response shape: HealthInsight[]
├── useCreateJournalEntry.ts     → Response shape: JournalEntry
├── useJournalEntries.ts         → Response shape: JournalEntry[]
├── useMoodLogs.ts               → Response shape: MoodLog[]
├── usePregnancyTimeline.ts      → Response shape: PregnancyMilestone[]
├── useSymptoms.ts               → Response shape: SymptomLog[]
├── useFamilyMembers.ts          → Response shape: FamilyMember[]
├── useNotifications.ts          → Response shape: Notification[]
├── useUserProfile.ts            → Response shape: UserProfile
├── useFeatureFlags.ts           → Response shape: FeatureFlagMap
└── useSyncStatus.ts             → Response shape: SyncStatus
```

For each hook, extract:

- **Endpoint URL** and HTTP method
- **Fields** — name, type (TS type + runtime format), nullable/optional
- **Arrays** — are they always present? minItems? maxItems?
- **Nested objects** — flatten them or keep nested in JSON columns?
- **Date fields** — ISO date string or ISO datetime? Timezone info?
- **Server-generated fields** — `id`, `created_at`, `updated_at`, `synced_at`

**Output format:** A markdown table per endpoint in `docs/storage_api_shapes.md`.

**Example row:**

```markdown
### GET /api/v1/cycles?user_id={uuid}&limit={n}

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID string | No | PK, server-generated |
| user_id | UUID string | No | FK to users |
| period_start_date | ISO date string | No | YYYY-MM-DD |
| period_end_date | ISO date string | Yes | Null during active period |
| flow_intensity | enum string | Yes | 'light' | 'medium' | 'heavy' | 'spotting' |
| symptoms | string[] | Yes | JSON string array, max 20 items |
| mood_tags | string[] | Yes | JSON string array |
| energy_level | integer (1-5) | Yes | |
| is_correction | boolean | No | Default false |
| corrected_prediction_id | UUID string | Yes | |
| created_at | ISO datetime string | No | |
| updated_at | ISO datetime string | No | |
```

**Validation:** Cross-reference every field with the backend Pydantic Response schema in `backend/app/modules/cycle/schemas.py` (or the equivalent for each module). If the backend schema is missing a field that the mobile expects, that is a bug — file it.

---

### 3.2 Task 1b: Design and Implement the Drizzle Schema

With the API shape inventory as the source of truth, create `src/db/schema.ts`.

**Rules:**

1. **PKs:** Always `text('id').primaryKey()` — server-issued UUIDs. Never auto-increment integers.
2. **Dates:** Always `text(...)` with ISO 8601. SQLite has no native date type.
3. **JSON arrays/objects:** Use `text(..., { mode: 'json' })`.
4. **Booleans:** Use `integer(..., { mode: 'boolean' })`.
5. **Timestamps:** `created_at`, `updated_at` from server. Add `synced_at` for local tracking (ISO datetime, updated on every upsert).
6. **Foreign keys:** Define them in Drizzle for schema clarity, but DO NOT rely on SQLite's FK enforcement (it's opt-in via `PRAGMA foreign_keys = ON`). The app logic is the real enforcement.
7. **Indexes:** Add indexes on `user_id` (every table), `period_start_date` (cycle entries), `created_at` (logs), `synced_at` (sync engine queries). Use composite indexes for common query patterns.
8. **CHECK constraints:** Use Drizzle's `.$default()` or validate at the service layer (not raw SQLite CHECK — they're not portable).
9. **Soft delete:** Every main entity table gets `is_active: integer({ mode: 'boolean' }).default(true)` and `deleted_at: text()` nullable. Service layer filters `WHERE is_active = true`.

**Entity tables (subject to Task 1a discovery):**

```typescript
export const cycleEntries = sqliteTable('cycle_entries', { ... });
export const journalEntries = sqliteTable('journal_entries', { ... });
export const moodLogs = sqliteTable('mood_logs', { ... });
export const symptomLogs = sqliteTable('symptom_logs', { ... });
export const pregnancyMilestones = sqliteTable('pregnancy_milestones', { ... });
export const healthInsights = sqliteTable('health_insights', { ... });
export const familyMembers = sqliteTable('family_members', { ... });
export const notifications = sqliteTable('notifications', { ... });
export const userProfile = sqliteTable('user_profile', { ... });
export const featureFlags = sqliteTable('feature_flags', { ... });
export const syncLog = sqliteTable('sync_log', { ... }); // Audit trail
```

**Migration readiness:**

After writing the schema, run:

```bash
npx drizzle-kit generate --name=storage_plan1_initial_schema
```

This produces a migration file under `src/db/migrations/`. Verify the SQL looks correct (column types, constraints, index statements). The migration will be wired into app startup in Plan 2.

---

### 3.3 Task 1c: Document State Machines

For each entity, document the possible states and transitions. This is essential for the sync engine conflict resolution logic (Plan 4).

**Example — CycleEntry state machine:**

```
states: [created, synced, corrected, archived]
transitions:
  created → synced   (server returns 200)
  synced → corrected (user submits correction)
  corrected → synced (server confirms correction)
  created → archived (user deletes offline before sync)
  synced → archived  (user deletes, synced delete)
```

**Example — OfflineQueueItem state machine:**

```
states: [pending, syncing, failed, discarded, completed]
transitions:
  pending → syncing     (sync engine picks up)
  syncing → completed   (server 200)
  syncing → failed      (server 4xx/5xx, retry < max)
  failed → pending      (retry timer fires)
  failed → discarded    (max retries exceeded)
  syncing → completed   (server 409 — overwritten with server data)
```

**Output:** `docs/storage_state_machines.md`

---

### 3.4 Task 1d: Risk Assessment & Rollback Strategy

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema misses a field that backend returns | Medium | High | Field-by-field cross-reference with Pydantic schemas + API contract doc. Automated schema drift detection in CI. |
| Migration causes data loss on downgrade | Low | Critical | Every migration has a downgrade script. Test both directions before merging. |
| Schema change requires mobile app update | High | Medium | Version the schema; old app versions continue with React Query cache. Handle gracefully in service layer. |
| Foreign key constraint breaks on reorder | Low | Medium | No FK enforcement at SQLite level; app logic handles ordering. |
| DateTime format inconsistency | Medium | Low | Enforce ISO 8601 at the schema level; write validation in service layer. Document the format in the API contract. |

**Rollback procedure:**

1. Revert the schema file to the previous commit.
2. Run `npx drizzle-kit generate --name=rollback` to produce a revert migration.
3. Submit a hotfix PR that applies the rollback migration + reverts any code changes.
4. Increment the React Query buster to `'v2'` to force a full cache refresh.

---

## 4. Dependencies

| Plan | Depends On | Why |
|------|-----------|-----|
| Plan 2 (SQLite DB Layer) | Plan 1 | Needs the schema and API shape inventory |
| Plan 3 (Service Layer) | Plan 1, Plan 2 | Needs the schema and DB connection |
| Plan 4 (Sync Engine) | Plan 1, Plan 2, Plan 3 | Needs services to call |
| Plan 5 (Read/Write Path) | Plan 1, Plan 2, Plan 3, Plan 4 | Needs sync engine hydrated |
| Plan 6 (Store Migration) | All above | Needs everything in place |

---

## 5. Success Criteria

- [ ] `docs/storage_api_shapes.md` written with every mobile-consumed endpoint documented
- [ ] `src/db/schema.ts` compiles with TypeScript strict
- [ ] `npx drizzle-kit generate` produces valid SQL migration
- [ ] `docs/storage_state_machines.md` covers all 4 entity types + queue items
- [ ] Cross-reference audit completed — every field in every query hook matches the backend schema
- [ ] Risk assessment reviewed by team
