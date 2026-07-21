# Storage API Shapes — Mobile Response Shape Inventory

> **Source:** Comprehensive audit of every TanStack Query hook and API service in `mobile/src/services/`.
> **Cross-referenced with:** Backend Pydantic Response schemas where available.
> **Date:** 2026-07-20

---

## 1. Response Envelope (All Endpoints)

Success: `{ data: T, message: "ok" }`
Error: `{ error: { code: string, details: string, request_id: string } }`

All date fields are ISO 8601 strings. All IDs are server-generated UUIDs.

---

## 2. Auth Endpoints

### POST /api/v1/auth/register
**Response:** `LoginResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| user.id | string (UUID) | No | |
| user.email | string | Yes | |
| user.phone_number | string | Yes | |
| user.display_name | string | Yes | |
| user.role | 'user' \| 'family' \| 'nurse' \| 'admin' | No | |
| user.is_active | boolean | No | |
| user.is_verified | boolean | No | |
| user.provider | 'local' \| 'google' | No | |
| user.created_at | ISO datetime | No | |
| user.last_login_at | ISO datetime | Yes | |
| user.onboarding_completed | boolean | No | |
| tokens.access_token | string | No | JWT |
| tokens.refresh_token | string | No | JWT |
| tokens.token_type | 'bearer' | No | |
| tokens.expires_in | number | No | seconds |

### POST /api/v1/auth/login
**Response:** Same as `LoginResponse` above.

### POST /api/v1/auth/otp/request
**Response:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| message | string | No | |
| expires_in | number | No | seconds |
| dev_code | string | Yes | Only in dev mode |

### POST /api/v1/auth/otp/verify
**Response:** Same as `LoginResponse` above.

### POST /api/v1/auth/logout
**Response:** `void` (204 No Content)

---

## 3. Onboarding

### GET /api/v1/onboarding/status
**Response:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| completed | boolean | No | |

### POST /api/v1/onboarding
**Response:** `OnboardingResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | string (UUID) | No | |
| user_id | string (UUID) | No | |
| age | number | No | |
| height_cm | number | No | |
| weight_kg | number | No | |
| stress_level | 'low' \| 'moderate' \| 'high' | No | |
| exercise_frequency | 'low' \| 'moderate' \| 'high' | No | |
| sleep_hours | number | No | |
| diet | 'balanced' \| 'normal' \| 'junk' | No | |
| current_cycle_start | ISO date | No | YYYY-MM-DD |
| current_cycle_length | number | No | days |
| current_period_length | number | No | days |
| current_symptoms | string[] | No | |
| past_cycles | PastCycle[] | No | see below |
| onboarding_completed | boolean | No | |
| completed_at | ISO datetime | Yes | |
| created_at | ISO datetime | No | |
| updated_at | ISO datetime | No | |

**PastCycle:**

| Field | Type | Nullable |
|-------|------|----------|
| cycle_start | ISO date | No |
| cycle_length | number | No |
| period_length | number | No |
| symptoms | string[] | No |

---

## 4. Cycle Tracking

### GET /api/v1/cycle/entries?limit=&offset=&months_back=
**Response:** `CycleEntry[]`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | string (UUID) | No | |
| user_id | string (UUID) | No | |
| period_start_date | ISO date | No | YYYY-MM-DD |
| period_end_date | ISO date | Yes | null during active |
| flow_intensity | string | Yes | 'light' \| 'medium' \| 'heavy' \| 'spotting' |
| symptoms | string[] | Yes | max ~20 items |
| mood_tags | string[] | Yes | |
| energy_level | integer (1-5) | Yes | |
| notes | string | Yes | |
| created_at | ISO datetime | No | |
| updated_at | ISO datetime | No | (present on server model but not always queried) |
| is_correction | boolean | — | server field, may not be in all responses |
| corrected_prediction_id | string (UUID) | — | |

### POST /api/v1/cycle/entries
**Request:** `CycleEntry` minus `id`, `created_at`, `updated_at`
**Response:** `CycleEntry` (with server-generated `id`)

### PUT /api/v1/cycle/entries/{id}
**Request:** Partial `CycleEntry`
**Response:** `CycleEntry`

### GET /api/v1/cycle/calendar?months_back=&months_forward=
**Response:** `CalendarResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| days | Record<string, string> | No | ISO date → day type |
| predictions | PredictionDetail | Yes | see below |
| next_period_in_days | number | Yes | |
| needs_checkin | boolean | Yes | |

**PredictionDetail:**

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| predicted_next_period_start | ISO date | No |
| predicted_period_end | ISO date | Yes |
| predicted_fertile_window_start | ISO date | Yes |
| predicted_fertile_window_end | ISO date | Yes |
| model_type | string | No |
| confidence_score | number | Yes |
| confidence_label | string | Yes |
| training_data_points | number | No |
| prediction_window_days | number | Yes |

### GET /api/v1/cycle/predictions
**Response:** `PredictionListResponse`

| Field | Type | Nullable |
|-------|------|----------|
| prediction | PredictionDetail | Yes |
| days_until | number | Yes |
| model_used | string | No |
| data_quality | string | No |

### GET /api/v1/cycle/predictions/history?limit=
**Response:** `{ items: PredictionHistoryItem[] }`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| month | string | No |
| predicted_date | ISO date | No |
| actual_date | ISO date | Yes |
| delta_days | number | Yes |
| on_time | boolean | No |

### GET /api/v1/cycle/analytics
**Response:** `CycleAnalytics`

| Field | Type | Nullable |
|-------|------|----------|
| average_cycle_length_days | number | Yes |
| shortest_cycle_days | number | Yes |
| longest_cycle_days | number | Yes |
| common_symptoms | Array<{ symptom: string; count: number }> | No |
| common_moods | Array<{ mood: string; count: number }> | No |
| total_entries | number | No |

### POST /api/v1/cycle/corrections
**Headers:** `Idempotency-Key`, `X-Client-Updated-At`
**Response:** `CorrectionResponse` (extends CycleEntry with correction fields)

---

## 5. Wellness / Journal

### GET /api/v1/wellness/journal?limit=&offset=
**Response:** `JournalEntry[]`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | string (UUID) | No | |
| user_id | string (UUID) | No | |
| title | string | Yes | |
| content | string | No | (encrypted at rest) |
| mood | string | Yes | |
| sentiment_score | number | Yes | -1 to 1 |
| sentiment_label | string | Yes | |
| entry_date | ISO date | No | |
| created_at | ISO datetime | No | |
| updated_at | ISO datetime | No | |

### POST /api/v1/wellness/journal
**Request:** JournalEntry minus `id`, `created_at`, `updated_at`
**Response:** `JournalEntry` (with server-generated `id`)

### GET /api/v1/wellness/mood/history?days_back=
**Response:** `MoodLog[]`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | string (UUID) | No | |
| user_id | string (UUID) | No | |
| mood | string | No | |
| intensity | integer (1-10) | No | |
| notes | string | Yes | |
| logged_at | ISO datetime | No | |

### POST /api/v1/wellness/mood
**Response:** `MoodLog`

### GET /api/v1/wellness/breathing-exercises
**Response:** `BreathingExercise[]`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| name | string | No |
| title | string | No |
| description | string | Yes |
| technique | string | Yes |
| duration_seconds | number | No |
| instructions | Record<string, unknown> | No |
| audio_url | string | Yes |

### POST /api/v1/wellness/breathing-sessions/{exerciseId}/complete
**Response:**

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| user_id | string (UUID) | No |
| exercise_id | string (UUID) | No |
| completed_at | ISO datetime | No |

### GET /api/v1/wellness/insights
**Response:** `WellnessInsights`

| Field | Type | Nullable |
|-------|------|----------|
| total_journal_entries | number | No |
| total_mood_logs | number | No |
| average_mood_intensity | number | Yes |
| most_common_mood | string | Yes |
| recommendation | string | Yes |

---

## 6. Safety

### GET /api/v1/safety/emergency-contacts
**Response:** `EmergencyContact[]`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | string (UUID) | No | |
| user_id | string (UUID) | No | |
| name | string | No | |
| phone_number | string | No | |
| relationship | string | Yes | |
| is_primary | boolean | No | |
| contact_user_id | string (UUID) | Yes | linked app user |
| contact_user_id_linked_at | ISO datetime | Yes | |

### POST /api/v1/safety/emergency-contacts
**Response:** `EmergencyContact`

### PUT /api/v1/safety/emergency-contacts/{id}
**Response:** `EmergencyContact`

### DELETE /api/v1/safety/emergency-contacts/{id}
**Response:** `void` (204)

### POST /api/v1/safety/sos/trigger
**Headers:** `Idempotency-Key`
**Response:** `SosAlert`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | string (UUID) | No | |
| user_id | string (UUID) | No | |
| triggered_at | ISO datetime | No | |
| latitude | number | No | |
| longitude | number | No | |
| location_accuracy_m | number | Yes | |
| sms_status | string | No | |
| cancelled_at | ISO datetime | Yes | |
| resolved_at | ISO datetime | Yes | |
| false_alarm | boolean | No | |
| manual_intervention_needed | boolean | No | |
| trigger_source | string | Yes | |

### GET /api/v1/safety/sos/active
**Response:** `SosAlert | null` — polling every 30s

### GET /api/v1/safety/sos/history
**Response:** `SosAlert[]`

### POST /api/v1/safety/sos/{alertId}/cancel
**Response:** `SosCancelResponse`

| Field | Type | Nullable |
|-------|------|----------|
| message | string | No |
| false_alarm | boolean | No |
| contacts_notified_of_false_alarm | boolean | No |

### POST /api/v1/safety/sos/{alertId}/resolve
**Response:** `SosAlert`

---

## 7. Pregnancy

### GET /api/v1/pregnancy/profile
**Response:** `PregnancyProfile`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| user_id | string (UUID) | No |
| due_date | ISO date | Yes |
| weeks_pregnant | number | No |
| trimester | integer (1-3) | No |
| baby_name | string | Yes |
| blood_type | string | Yes |
| allergies | string[] | Yes |
| created_at | ISO datetime | No |
| updated_at | ISO datetime | No |

### PUT /api/v1/pregnancy/profile
**Response:** `PregnancyProfile`

### GET /api/v1/pregnancy/daily-logs
**Response:** `PregnancyDailyLog[]`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| user_id | string (UUID) | No |
| date | ISO date | No |
| symptoms | Record<string, unknown> | Yes |
| mood | string | Yes |
| weight_kg | number | Yes |
| blood_pressure_systolic | number | Yes |
| blood_pressure_diastolic | number | Yes |
| notes | string | Yes |

### POST /api/v1/pregnancy/daily-log
**Response:** `PregnancyDailyLog`

### GET /api/v1/pregnancy/milestone
**Response:** `PregnancyMilestone[]`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| week | integer | No |
| title | string | No |
| description | string | No |
| category | string | No |
| is_completed | boolean | No |
| completed_at | ISO datetime | Yes |

### GET /api/v1/pregnancy/recommendations
**Response:** `PregnancyRecommendation[]`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| week | integer | No |
| category | string | No |
| title | string | No |
| description | string | No |
| priority | 'low' \| 'medium' \| 'high' | No |

---

## 8. Family

### GET /api/v1/family/links
**Response:** `FamilyLink[]`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| user_id | string (UUID) | No |
| linked_user_id | string (UUID) | Yes |
| status | string | No |
| permissions | string[] | No |
| created_at | ISO datetime | No |

### POST /api/v1/family/link/generate
**Response:** `InviteToken`

| Field | Type | Nullable |
|-------|------|----------|
| token | string | No |
| expires_at | ISO datetime | No |

### GET /api/v1/family/link/{token}/info
**Response:** `InviteInfo`

| Field | Type | Nullable |
|-------|------|----------|
| inviter_name | string | No |
| inviter_phone | string | No |
| expires_at | ISO datetime | No |

### POST /api/v1/family/link/{token}/accept
**Response:** `FamilyLink`

### PUT /api/v1/family/links/{linkId}/permissions
**Response:** `FamilyLink`

### DELETE /api/v1/family/links/{linkId}
**Response:** `void` (204)

---

## 9. Nurse Content

### GET /api/v1/nurse/contents?page=&per_page=
**Response:** `NurseContent[]`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| title | string | No |
| summary | string | No |
| category | string | No |
| tags | string[] | Yes |
| published_at | ISO datetime | No |

### GET /api/v1/nurse/contents/{id}
**Response:** `NurseContentDetail`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| title | string | No |
| summary | string | No |
| category | string | No |
| tags | string[] | Yes |
| body | string | No |
| references | string[] | Yes |
| published_at | ISO datetime | No |
| updated_at | ISO datetime | No |

---

## 10. Chat

### GET /api/v1/chat/token
**Response:** `ChatToken`

| Field | Type | Nullable |
|-------|------|----------|
| token | string | No |
| user_id | string (UUID) | No |
| expires_at | ISO datetime | No |

### POST /api/v1/chat/link/generate
**Response:** `ChatLink`

| Field | Type | Nullable |
|-------|------|----------|
| link_id | string | No |
| token | string | No |
| expires_at | ISO datetime | No |

### POST /api/v1/chat/link/{token}/use
**Response:** `ChatRoom`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| name | string | No |
| participant_count | number | No |
| last_message | string | Yes |
| last_message_at | ISO datetime | Yes |
| unread_count | number | No |

### GET /api/v1/chat/rooms
**Response:** `ChatRoom[]`

---

## 11. Sync

### POST /api/v1/sync/batch
**Headers:** `Content-Encoding: gzip` (if >10 ops), `Idempotency-Key` per operation
**Request:** `{ operations: PendingOperation[] }`
**Response:** `SyncBatchResponse`

| Field | Type | Notes |
|-------|------|-------|
| results | SyncResult[] | |
| conflicts | SyncResult[] | |

**SyncResult:**

| Field | Type | Nullable |
|-------|------|----------|
| index | number | No |
| status | 'created' \| 'updated' \| 'deleted' \| 'conflict' \| 'failed' | No |
| entity_id | string (UUID) | Yes |
| temp_id | string | Yes |
| server_data | Record<string, unknown> | Yes |
| error | string | Yes |

### GET /api/v1/sync/changes?since={timestamp}
**Response:** `SyncChangesResponse`

| Field | Type | Nullable |
|-------|------|----------|
| changes | SyncChangeItem[] | No |
| has_more | boolean | No |
| next_token | string | Yes |

**SyncChangeItem:**

| Field | Type | Nullable |
|-------|------|----------|
| entity_type | string | No |
| entity_id | string (UUID) | No |
| action | 'created' \| 'updated' \| 'deleted' | No |
| data | Record<string, unknown> | No |
| updated_at | ISO datetime | No |

---

## 12. Feature Flags

### GET /api/v1/features
**Response:** `Record<string, boolean>` — map of feature key to enabled state.

---

## 13. Admin (Internal Only — Not Cached Locally)

Not inventoried — admin endpoints are not consumed by the mobile app in production user flows.

---

## 14. Voice Journal

### POST /api/v1/voice/daily
**Response:** `VoiceDailyJournal`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| user_id | string (UUID) | No |
| transcription | string | No |
| audio_duration_seconds | number | Yes |
| mood | string | Yes |
| created_at | ISO datetime | No |

### GET /api/v1/voice/analysis/{entryId}
**Response:** `VoiceAnalysis`

| Field | Type | Nullable |
|-------|------|----------|
| id | string (UUID) | No |
| entry_id | string (UUID) | No |
| sentiment | string | No |
| sentiment_score | number | No |
| keywords | string[] | No |
| summary | string | No |
| analyzed_at | ISO datetime | No |

---

## 15. Device / Session Management

### POST /api/v1/auth/register-device
**Response:** `DeviceRegisterResponse`

| Field | Type | Nullable |
|-------|------|----------|
| message | string | No |
| fcm_token_prefix | string | No |
