# API Contract — SheCare Mobile ↔ Backend

> **Source of truth (project invariant §1):** Any change to request/response shape
> must update this file in the same PR. Mobile cannot break on a backend change.

---

## 1. Base URL & Headers

| Env | URL |
|-----|-----|
| Development | `http://localhost:8000/api/v1` |
| Production | `https://api.shecare.app/api/v1` |

### Common headers

| Header | Value | Notes |
|--------|-------|-------|
| `Content-Type` | `application/json` | All requests |
| `Authorization` | `Bearer <access_token>` | Authenticated endpoints |
| `X-Request-ID` | `uuid-v4` | Correlation id (project invariant §10) |
| `Idempotency-Key` | `uuid-v4` | SOS, payments (project invariant §5) |

---

## 2. Response Envelope (project invariant §2)

### Success

```json
{
  "data": { ... },
  "message": "ok"
}
```

### Error

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "details": "User not found",
    "request_id": "uuid-string"
  }
}
```

### Pagination (project invariant §3)

| Type | Used for | Params |
|------|----------|--------|
| Cursor | User-facing lists (journals, logs) | `?cursor=<opaque>&limit=20` |
| Offset | Admin lists | `?page=1&per_page=20` |

Response shape:
```json
{
  "data": [ ... ],
  "next_cursor": "opaque-string-or-null",
  "total": 0
}
```

---

## 3. Auth Endpoints

### 3.1 Register (Email + Password)

```
POST /auth/register
Rate-Limit: 5/hour per IP
Auth: None
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "display_name": "Jane"   // optional
}
```

**Response `201`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone_number": null,
    "display_name": "Jane",
    "role": "user",
    "is_active": true,
    "is_verified": false,
    "provider": "local",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "access_token": "jwt...",
    "refresh_token": "jwt...",
    "token_type": "bearer",
    "expires_in": 3600
  },
  "requires_mfa": false
}
```

**Errors:** `409 CONFLICT` (email exists), `422 VALIDATION_FAILED` (bad email/weak password)

### 3.2 Login (Email + Password)

```
POST /auth/login
Rate-Limit: 10/min per email
Auth: None
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "device_info": { "os": "ios", "app_version": "1.2.0" }   // optional
}
```

**Response `200`:**
```json
{
  "user": { ... },
  "tokens": { ... },
  "requires_mfa": false
}
```

**Errors:** `401 INVALID_CREDENTIALS`

### 3.3 OTP Request (Legacy Phone)

```
POST /auth/otp/request
Rate-Limit: 5/10min per phone
Auth: None
```

**Request:**
```json
{
  "phone": "+14155552671"
}
```

**Response `202`:**
```json
{
  "expires_in": 300,
  "dev_code": "123456"   // only in dev/test; null in prod
}
```

### 3.4 OTP Verify

```
POST /auth/otp/verify
Rate-Limit: 10/min per phone
Auth: None
```

**Request:**
```json
{
  "phone": "+14155552671",
  "otp": "123456",
  "device_info": { "os": "android" }
}
```

**Response `200`:** Same shape as login (`{ user, tokens, requires_mfa }`)

**Errors:** `400 OTP_INVALID`, `400 OTP_EXPIRED`

### 3.5 Refresh Token Rotation

```
POST /auth/refresh
Auth: None (uses body token)
```

**Request:**
```json
{
  "refresh_token": "jwt...",
  "device_info": { ... }
}
```

**Response `200`:**
```json
{
  "access_token": "new-jwt...",
  "refresh_token": "new-jwt...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Errors:** `401 TOKEN_REVOKED` (reuse detected — all sessions burned)

### 3.6 Logout

```
POST /auth/logout
Auth: Bearer <access_token>
```

**Request:**
```json
{
  "refresh_token": "jwt...",    // optional: revoke this session
  "all_devices": false           // optional: revoke ALL sessions
}
```

**Response `204`:** No content

### 3.7 MFA Enable

```
POST /auth/mfa/enable
Auth: Bearer <access_token>
```

**Response `200`:**
```json
{
  "secret": "base32-secret",
  "otpauth_uri": "otpauth://totp/SheCare:+14155552671?secret=..."
}
```

### 3.8 MFA Verify Setup

```
POST /auth/mfa/verify-setup
Auth: Bearer <access_token>
```

**Request:**
```json
{
  "code": "123456"
}
```

**Response `200`:** `{ "enabled": true }`

### 3.9 MFA Login (Complete Challenge)

```
POST /auth/mfa/login
Auth: None
```

**Request:**
```json
{
  "mfa_token": "challenge-jwt...",
  "code": "123456",
  "device_info": { ... }
}
```

**Response `200`:** `{ access_token, refresh_token, token_type, expires_in }`

### 3.10 Set / Change Password

```
POST /auth/password
Auth: Bearer <access_token>
```

**Request:**
```json
{
  "new_password": "newSecurePassword456"
}
```

**Response `204`:** No content (all prior tokens invalidated; user must re-login)

### 3.11 List Active Sessions

```
GET /auth/sessions
Auth: Bearer <access_token>
```

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "device_info": { "os": "ios" },
    "last_used_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-01-31T00:00:00Z"
  }
]
```

### 3.12 Revoke Session

```
DELETE /auth/sessions/{session_id}
Auth: Bearer <access_token>
```

**Response `204`:** No content

### 3.13 Change Password (with old-password verification)

```
POST /auth/password/change
Auth: Bearer <access_token>
```

**Request:**
```json
{
  "old_password": "currentPassword123",
  "new_password": "newSecurePassword456"
}
```

**Response `204`:** No content. Rotates `user_secret_key` and revokes ALL sessions — the client's tokens become invalid and the user must re-login on every device (`ChangePasswordScreen` shows this note).

**Errors:** `401 INVALID_CREDENTIALS` (old password wrong), `422 VALIDATION_FAILED` (weak new password), `400` when the account is not `provider == "local"`.

### 3.14 Get / Update / Delete Profile

```
GET    /auth/me                 → 200 UserResponse (server-authoritative hydration)
PUT    /auth/me                 → 200 UserResponse (update display_name / phone_number)
DELETE /auth/me                 → 204 No content (soft-delete account, password required)
Auth: Bearer <access_token> (all three)
```

**PUT request:**
```json
{
  "display_name": "Jane Doe",      // optional
  "phone_number": "+14155552671"   // optional; E.164, must be unique
}
```

**PUT response `200`:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "phone_number": "+14155552671",
  "display_name": "Jane Doe",
  "role": "user",
  "is_active": true,
  "is_verified": false,
  "provider": "local",
  "created_at": "2024-01-01T00:00:00Z",
  "last_login_at": "2024-01-01T00:00:00Z",
  "onboarding_completed": true
}
```

**DELETE request:**
```json
{ "password": "currentPassword123" }
```

**DELETE behavior:** verifies the password, revokes all sessions, flips `is_active = false` (soft delete, backend rule §1.4). Any further request returns 401/404 immediately.

**PUT errors:** `409 CONFLICT` (phone already in use), `422 VALIDATION_FAILED`.
**DELETE errors:** `401 INVALID_CREDENTIALS` (password wrong).

---

## 4. Feature Flags

```
GET /features
Rate-Limit: 1/min per IP
Auth: None (but may vary by user)
```

**Response `200`:**
```json
{
  "email_auth": true,
  "otp_auth": true,
  "mfa": true,
  "pregnancy_tracker": true,
  "safety_sos": true
}
```

Mobile fetches on launch (project invariant §9).

---

## 5. Common Error Codes

| Code | HTTP | Auth? | Meaning |
|------|------|-------|---------|
| `INVALID_CREDENTIALS` | 401 | Yes | Wrong email/password |
| `MISSING_BEARER` | 401 | Yes | No Authorization header |
| `INVALID_TOKEN` | 401 | Yes | JWT malformed or expired |
| `TOKEN_REVOKED` | 401 | Yes | Token was revoked or session burned |
| `WRONG_TOKEN_TYPE` | 401 | Yes | Used access token for refresh or vice versa |
| `OTP_INVALID` | 400 | No | Wrong OTP code |
| `OTP_EXPIRED` | 400 | No | OTP code has expired (5 min TTL) |
| `MFA_REQUIRED` | 401 | Yes | MFA challenge needed |
| `MFA_INVALID` | 401 | Yes | Wrong MFA code |
| `CONFLICT` | 409 | No | Email already registered |
| `VALIDATION_FAILED` | 422 | No | Pydantic validation error |
| `RATE_LIMIT_EXCEEDED` | 429 | No | Too many requests |
| `RESOURCE_NOT_FOUND` | 404 | No | Entity not found |

### Retry-After

On `429`, backend sets the `Retry-After` header (seconds). Mobile shows a toast and backs off (project invariant §6).

---

## 6. Corrections

### `POST /api/v1/cycle/corrections`

Log a period start correction that may link to a previous prediction.

**Request:**

```json
{
  "period_start_date": "2026-07-15",
  "period_end_date": null,
  "symptoms": ["cramps", "bloating"],
  "corrected_prediction_id": "uuid-or-null",
  "client_updated_at": "2026-07-15T10:00:00Z"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "period_start_date": "2026-07-15",
  "period_end_date": null,
  "symptoms": ["cramps", "bloating"],
  "is_correction": true,
  "corrected_prediction_id": "uuid",
  "created_at": "2026-07-15T10:00:00Z",
  "avg_period_length": 5
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | Entry ID |
| `period_start_date` | string (ISO date) | When the period started |
| `period_end_date` | string (ISO date) \| null | `null` when unknown (pending confirmation) |
| `symptoms` | string[] | Symptom tags |
| `is_correction` | boolean | Always `true` for corrections |
| `corrected_prediction_id` | string (UUID) \| null | Prediction this correction links to |
| `created_at` | string (ISO datetime) | Timestamp |
| `avg_period_length` | int | User's historical average bleeding duration (default 5) |

**Errors:** `409 CONFLICT` (data modified since client last synced)

---

## 7. Prediction History

### `GET /api/v1/cycle/predictions/history`

Returns a list of past predictions that have been confirmed by a period correction (actual start logged).

**Response `200`:**

```json
{
  "items": [
    {
      "id": "uuid",
      "month": "Jul",
      "predicted_date": "2026-07-17",
      "actual_date": "2026-06-19",
      "delta_days": -1,
      "on_time": false
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | Prediction ID |
| `month` | string | Abbreviated month of the predicted date (e.g. "Jul") |
| `predicted_date` | string (ISO date) | Date the prediction estimated |
| `actual_date` | string (ISO date) \| null | Actual period start date from the correction |
| `delta_days` | int \| null | Difference: actual - predicted (negative = started early) |
| `on_time` | boolean | True when `abs(delta_days) <= 1` |

**Notes:**
- Empty array `{"items": []}` when the user has no confirmed predictions yet
- Ordered by `predicted_next_period_start` descending (most recent first)
- Limit defaults to 12, max 50

---

## 8. Calendar

### `GET /api/v1/cycle/calendar`

Returns a dictionary-encoded calendar grid with cycle day types, the next prediction, and check-in status.

**Query params:** `?months_back=3&months_forward=3&today=2026-08-01`

- `months_back` / `months_forward`: horizontal window in months (default 3, range 1–12). Server caps the returned history with a hard lower bound of `months_back` (31 days per month) so the payload cannot grow with account age; the recent-window entries drive the day grid while prediction statistics use an internal wider history.
- `today` (optional): client-local `YYYY-MM-DD`. The server anchors the `T` day marker and the `needs_checkin` window to it (falls back to server date when omitted). This keeps the calendar aligned with the phone's calendar day across timezones.
- `If-None-Match` (header, optional): ETag from a previous response. Server revalidates and returns `304 Not Modified` (empty body) when the body is unchanged.

**Response `200`:**

```json
{
  "days": {
    "2026-07-17": "P",
    "2026-07-18": "P",
    "2026-07-23": "Fl",
    "2026-07-28": "F",
    "2026-07-31": "O",
    "2026-08-01": "L",
    "2026-08-10": "pw",
    "2026-08-14": "p"
  },
  "predictions": {
    "id": "uuid",
    "predicted_next_period_start": "2026-08-14",
    "predicted_period_end": "2026-08-19",
    "predicted_fertile_window_start": "2026-07-31",
    "predicted_fertile_window_end": "2026-08-05",
    "model_type": "fallback",
    "confidence_score": 0.42,
    "confidence_label": "Uncertain",
    "training_data_points": 6,
    "prediction_window_days": null
  },
  "next_period_in_days": 27,
  "needs_checkin": false
}
```

| Field | Type | Notes |
|-------|------|-------|
| `days` | `Record<string, string>` | ISO date → day type code: `P`=confirmed period, `p`=predicted period, `u`=unconfirmed period (open entry, no end date), `Fl`=confirmed follicular, `fl`=predicted follicular, `F`=confirmed fertile, `f`=predicted fertile, `O`=confirmed ovulation, `o`=predicted ovulation, `L`=confirmed luteal, `l`=predicted luteal, `c`=cancelled (correction overrode this day), `pw`=prediction-window band (irregular users only, ±`prediction_window_days` around the `p` block), `T`=today |
| `predictions` | `PredictionDetail \| null` | The next active prediction. `prediction_window_days` is `int(std_dev)` when `cycle_length_std_dev > 3.5` (both model paths), else `null` |
| `next_period_in_days` | `int \| null` | Days until next predicted period (clamped to ≥ 0) |
| `needs_checkin` | `bool` | Whether the check-in card should show. `true` only when the prediction is unconfirmed, no recent period entry exists, and today is within the check-in window: `[pred − max(3, window), pred + max(6, window + 1)]` when `window = prediction_window_days`, else `[pred − 3, pred + 6]` |

**ETag:** Backend computes a SHA-256 ETag on the response body. Mobile sends `If-None-Match`; server returns `304 Not Modified` when unchanged. Mobile keeps a small in-memory ETag cache in `src/services/api/client.ts`: it attaches `If-None-Match` on GET and, on `304 Not Modified`, serves the previously cached body (no reparse, no refetch payload). ETag caching is GET-scoped and only active for endpoints that emit `ETag` (calendar).

---

### `GET /api/v1/cycle/entries`

Returns the list of cycle (period) entries, used by Analytics, Calendar and history screens.

**Query params:** `?limit=60&months_back=6&offset=0`

The mobile client keeps these bounded so cached responses (and the shared React Query `entries` cache in `getCycleKeys`) stay small (Phase D.2):

| Param | Default | Notes |
|-------|---------|-------|
| `limit` | `100` | Page size. Client uses `60` (calendar), `24` (analytics), `1` (catch-up). |
| `months_back` | `3` | History window in months (server applies a `months_back` lower bound, mirroring `GET /cycle/calendar`). Analytics passes `6`, calendar `6`, history `6`. |
| `offset` | `0` | Admin/older reads; user-facing lists typically paginate by cursor (see pagination, project invariant 3). |

Because different screens pass different `limit`/`months_back`, each combination is a **separate cache entry** (the query key embeds the params). This is intentional; the params are bounded so the union of cached entry sets stays small.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "period_start_date": "2026-05-01",
      "period_end_date": "2026-05-05",
      "flow_intensity": "medium",
      "notes": "…",
      "is_active": true,
      "created_at": "2026-05-01T09:00:00Z"
    }
  ],
  "message": "ok"
}
```

**ETag:** supports `If-None-Match` / `304 Not Modified` (see §9), exercised by the shared `api` client interceptors.

---

## 9. ETag & Offline Support (project invariant §7)

Backend emits `ETag` on journal, mood, cycle, and prediction responses.
Mobile sends `If-None-Match` for cheap revalidation.
On `304 Not Modified` → use cached data.

---

## 10. Health Tips

### `GET /api/v1/wellness/health-tips`

**Query params:**
- `metric_type` (optional): `sleep` | `water` | `food` | `exercise` | `medication`
- `limit` (optional, default 3, max 10)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "metric_type": "sleep",
      "tip": "Consistent sleep schedule improves your cycle regularity.",
      "priority": 1
    }
  ],
  "total": 1
}
```

**Errors:** None — returns empty `data: []` when no tips match.

---

## 11. Security Notes

- Access tokens expire in 60 min (configurable via `JWT__ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh tokens expire in 14 days (configurable via `JWT__REFRESH_TOKEN_EXPIRE_DAYS`)
- Tokens are **stateless** — no server-side session store for access tokens
- `user_secret_key` is embedded in every JWT; rotating it (password change) instantly invalidates all prior tokens
- Refresh tokens use rotation with reuse detection — presenting an old token after rotation burns **all** sessions
- Journal content and medical notes are encrypted at rest (per-user key via `core.encryption`)
- Mobile stores tokens in `react-native-encrypted-storage`, never plain AsyncStorage

---

## 12. Luna State Sync (Phase 4 — aggregate only)

> Cross-device continuity for Luna's **aggregate** companion state. Privacy
> boundary (AGENTS.md §3.8): ONLY aggregate state crosses the wire — NEVER
> journal content, dialogue history, or raw health data. Source of truth:
> `luna2/luna2phase4_plan.md`.

### 12.1 `GET /api/v1/luna/state`

Auth: `Authorization: Bearer <access_token>`.

Returns the caller's aggregate state (creates a default row on first access).

**Response:**
```json
{
  "id": "uuid",
  "xp": 1234,
  "level": 5,
  "coins": 88,
  "relationship_level": 3,
  "mood_trend": {
    "trend": "improving",
    "samples": [
      { "date": "2026-08-06", "mood": "happy", "intensity": 4, "source": "day_logged", "created_at": "2026-08-06T18:00:00Z" }
    ],
    "updated_at": "2026-08-06T18:00:00Z"
  },
  "preferences": { "speechEnabled": true, "speechRate": 1.2, "muteSounds": false },
  "achievements": [ { "id": "sleep_streak_7", "unlocked_at": "2026-08-01T00:00:00Z" } ],
  "habit_patterns": { "sleep_avg_hour": 23.1, "top_log_types": ["sleep", "water"] },
  "created_at": "2026-08-01T00:00:00Z",
  "updated_at": "2026-08-06T18:00:00Z"
}
```

**Headers:**
- `ETag` — strong SHA-256 ETag. Mobile sends `If-None-Match` for cheap
  revalidation; on `304 Not Modified` reuse the cached aggregate.

**Errors:** `401` (unauth), `429` + `Retry-After` (rate limit).

### 12.2 `PUT /api/v1/luna/state`

Auth: `Authorization: Bearer <access_token>`.

Body = partial `LunaStateUpdate` — all fields optional. **LWW merge** per
field: each write carries `client_updated_at`; the newest timestamp wins per
field; fields not sent stay untouched.

**Request body:**
```json
{
  "xp": 1244,
  "coins": 90,
  "preferences": { "speechEnabled": true, "speechRate": 1.2 },
  "client_updated_at": "2026-08-06T18:00:00Z"
}
```

**Field semantics:**
- `mood_trend` — `trend` is **server-computed** from the typed `samples`
  (client-supplied `trend` is overwritten). `samples` are capped at **30**
  (append → sort by `date` → trim newest 30). Sample shape is typed:
  `{ date, mood, intensity (1..5), source, created_at }` with `mood` ∈
  `happy|sad|anxious|angry|neutral` and `source` ∈
  `day_logged|manual|journal_analysis`. Invalid samples → 422.
- `preferences` — object, capped at **50 keys**.
- `achievements` — array capped at **100** items.
- `habit_patterns` — object capped at **100 keys**; `top_log_types` capped at
  **20**.

**Headers:**
- `Idempotency-Key` (optional) — dedupe replayed offline writes; server PUT is
  LWW-idempotent by `client_updated_at` regardless.
- `ETag` on response.

**Errors:**
- `422` — oversized or invalid payload (upload over the cap fails loudly,
  never silently truncates).
- `429` + `Retry-After` — rate limit exceeded.

### 12.3 `day_logged` event bridge

The backend subscribes to `day_logged` and appends a `MoodSample` with
`source: "day_logged"` into `mood_trend.samples`, recomputing `trend` — keeps
the aggregate fresh even when the mobile client never PUTs.

### 12.4 Mobile behavior (summary)

- Reads go through React Query: `useLunaState()` (queryKey
  `[...getLunaKeys(userId).state]`, `staleTime: 5 * 60 * 1000`); `.all` prefix
  invalidated after a successful PUT.
- Offline writes queue in EncryptedStorage (cap **500**, UUID `idempotency_key`,
  FIFO replay, oldest dropped + Sentry warning on overflow).
- Launch/reconnect: `syncLunaState(userId)` replays the queue → pushes the
  local aggregate → reconciles the server row back into `companion_metadata`
  when `server.updated_at > local`.
- Sign-out clears the local queue + cache but **never** deletes the server-side
  `luna_state` row.

---

## 13. Health Content (nurse_content module)

### 13.1 Public: browse the Health Library

`GET /contents`

| Query param | Type | Notes |
|-------------|------|-------|
| `category` | `string?` | `wellness`, `nutrition`, `pregnancy`, `safety`, ... |
| `content_type` | `string?` | `article`, `video`, `image` |
| `limit` | `int?` | max `200`, default `50` |
| `offset` | `int?` | default `0` |

Returns only `status == "approved"` + `is_active == true` content, newest
published first.

`GET /contents/{content_id}` — fetch a single approved item.

**Response item shape:**

```json
{
  "id": "uuid",
  "nurse_id": "uuid",
  "title": "string",
  "description": "string|null",
  "summary": "string|null",
  "body": "string|null",
  "reading_time_minutes": 5,
  "author_name": "SheCare Nurse|string|null",
  "content_type": "article|video|image",
  "video_public_id": "string|null",
  "video_url": "string|null",
  "video_duration_seconds": 120,
  "thumbnail_public_id": "string|null",
  "thumbnail_url": "string|null",
  "images": [{"url": "string", "public_id": "string|null", "caption": "string|null", "order": 0}],
  "category": "wellness",
  "tags": ["breathing", "stress"],
  "status": "approved",
  "approved_by": "uuid|null",
  "published_at": "iso8601|null",
  "created_at": "iso8601",
  "updated_at": "iso8601"
}
```

The response envelope still applies:
`{ "data": {...}, "message": "ok" }`.

### 13.2 Admin: manage health content (single-admin model)

All endpoints require `Authorization: Bearer <admin_access_token>` and an admin
role. New content is **auto-approved** (`status: "approved"`), so no separate
approval step is needed.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/contents/upload-url?resource_type=image\|video` | Cloudinary signed upload URL |
| POST | `/admin/contents` | Create content (auto-approved) |
| GET | `/admin/contents` | List ALL content (incl. `pending`/`rejected`) |
| PUT | `/admin/contents/{content_id}` | Update content |
| DELETE | `/admin/contents/{content_id}` | Soft-delete content (`is_active = false`) |

**Create body** (`ContentCreate` shape — same as response item above, minus
`id`/`status`/timestamps; `content_type` + `category` + `title` required):

```json
{
  "title": "Breathing exercises for calm",
  "summary": "2-minute guided breathing",
  "body": "Full article text...",
  "content_type": "video",
  "video_public_id": "health_content/abc123",
  "video_url": "https://res.cloudinary.com/...",
  "thumbnail_url": "https://res.cloudinary.com/.../thumb.jpg",
  "category": "wellness",
  "tags": ["breathing", "stress"]
}
```

**Upload URL response:**

```json
{
  "data": {
    "upload_url": "https://api.cloudinary.com/v1_1/<cloud>/image/upload",
    "cloud_name": "...",
    "api_key": "...",
    "timestamp": 1720000000,
    "folder": "health_content",
    "tags": "content-<user_id>",
    "signature": "...",
    "expires_at": 1720000900
  },
  "message": "ok"
}
```

The mobile client then POSTs the media file directly to `upload_url` with
`file`, `api_key`, `timestamp`, `signature`, `folder`, `tags` and receives the
Cloudinary asset (`public_id`, `secure_url`) back, which it stores via
`/admin/contents`.

**Errors (admin endpoints):**
- `403 ADMIN_REQUIRED` — role is not `admin`.
- `404 CONTENT_NOT_FOUND` — content id does not exist or is soft-deleted.
- `403 UNAUTHORIZED_CONTENT` — content belongs to another nurse.
- `422` — invalid `ContentCreate`/`ContentUpdate` body.

---

## 14. Symptoms Master & `recommendations_completed`

### 14.1 Symptoms master (57 rows, read-only)

`GET /api/v1/cycle/symptoms` returns the active symptom master, ordered by
`display_order`. Rows are mirrored **exactly** (by `name`/`category`/`display_order`)
in `mobile/src/assets/masters/symptoms.json` and seeded into the local
`DayMasterLocalService`. The mobile side reads it offline-first; parity is enforced
by the PR-1 master-parity test.

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Abdominal Cramps",
      "category": "reproductive",
      "icon": "cramps",
      "icon_kind": "lucide|custom|emoji",
      "display_order": 1,
      "is_active": true
    }
  ],
  "message": "ok"
}
```

Six categories: `reproductive`, `mood`, `digestive`, `energy`, `pain`, `skin`.
The recommendation engine keys cards by these canonical `name` values; aliases are
resolved client-side (see `expertRecommendations.ts` `LEGACY_SLUGS`), never in the
contract.

### 14.2 `recommendations_completed` round-trip (optional string[])

`DailyDay` / `DailyUpsert` payloads accept an optional
`recommendations_completed?: string[]` (field already present on the mobile types
at `mobile/src/services/api/cycle.ts:131,149`). It records the ids of completed
recommendation cards for the day and is round-tripped through the cycle day
upsert. It is best-effort — backend treats it as opaque data; the source of truth
for rendering is the client engine's persisted `wellness.recs.done.${id}` keys.

**No request/response *shape* changed** by the recommendation feature — only the
master content grew (57 rows).

## 15. Cycle Reports (Cycle_Report-as-a-Service)

Generated **once per closed cycle** (background Celery task), stored, and read
many times — no LLM latency on the Analytics tab. Mobile distinguishes
"no report yet" via the `report: null` empty shape (never a 404).

### `GET /api/v1/cycle/reports/latest`

- **Auth:** `Authorization: Bearer <access_token>` (row-scoped by `current_user.id`)
- **200 — report ready:**
```json
{
  "data": {
    "id": "uuid",
    "cycle_entry_id": "uuid",
    "status": "ready",
    "report_data": {
      "summary": "Your last 3 cycle(s) average 28.0 days with a regular rhythm.",
      "regularity_score": 85,
      "top_symptoms": ["Cramps", "Bloating"],
      "correlation_found": "Higher pain days tended to pair with less sleep.",
      "doctor_note": "These are informational observations, not medical advice."
    },
    "generated_at": "2026-08-15T10:00:00Z"
  },
  "message": "ok"
}
```
- **200 — no report yet:**
```json
{ "data": { "report": null, "message": "No report yet" }, "message": "ok" }
```
- `ReportData` is always a validated shape (`summary`, `regularity_score` 0–100
  int, `top_symptoms[]`, `correlation_found`, `doctor_note`) — rule-based
  fallback guarantees the same shape even when Groq is disabled.
- Mobile: `report === null` ⇒ no insights card (`ReportEmptyResponse`), the
  existing empty-state governs.

### `POST /api/v1/cycle/reports`

- **Auth:** `Authorization: Bearer <access_token>`
- **Body:** `{ "cycle_entry_id": "<uuid>" }`
- **202 Accepted:** returns the existing report row if one already exists for
  this cycle, else a `status: "pending"` stub:
```json
{
  "data": {
    "id": "uuid",
    "cycle_entry_id": "uuid",
    "status": "pending",
    "report_data": null,
    "generated_at": null
  },
  "message": "ok"
}
```
- **Idempotency:** Celery task uses a fixed business-key `task_id`
  (`generate_cycle_report_{cycle_entry_id}`) + a UNIQUE `cycle_entry_id` DB
  constraint — re-POSTing the same cycle never creates a duplicate report. No
  `Idempotency-Key` header required (project invariant §5 applies to SOS/payments).

### `POST /api/v1/cycle/reports?sync=true` — on-demand synchronous generation

Same body `{ "cycle_entry_id": "<uuid>" }`, same `202` status, but:
- **If a ready report already exists for this cycle in `cycle_reports`, it is
  returned immediately — a plain DB read, NO Groq/LLM call.**
- **If no stored report exists, the backend generates one inline (Groq Llama 3,
  falling back to the rule-based generator) and returns `status: "ready"`.**

```json
{
  "data": {
    "id": "uuid",
    "cycle_entry_id": "uuid",
    "status": "ready",
    "report_data": {
      "summary": "…",
      "regularity_score": 85,
      "top_symptoms": ["Cramps"],
      "correlation_found": "…",
      "doctor_note": "…",
      "avg_cycle_length_days": 28.0,
      "avg_period_length_days": 5.0,
      "avg_sleep_hours": 7.0,
      "avg_pain_level": 6.0,
      "common_moods": [{ "mood": "happy", "count": 3 }]
    },
    "generated_at": "2026-08-15T10:00:00Z"
  },
  "message": "ok"
}
```

**Read strategy:** always prefer the DB. `GET /reports/latest` and
`GET /reports/{cycle_entry_id}` never invoke Groq. Groq is hit **only** on the
`sync=true` miss path (and by the background `cycle_closed` Celery task).

### `GET /api/v1/cycle/reports/{cycle_entry_id}` — per-cycle read (DB-only)

- **Auth:** `Authorization: Bearer <access_token>` (row-scoped by `current_user.id`)
- **200 — report ready:** same `CycleReportResponse` shape as `/reports/latest`.
- **200 — no report yet:** `{ "data": { "report": null, "message": "No report yet" }, "message": "ok" }`.
- **No LLM call is ever made on this endpoint** — it is a pure database read.

### ReportData (enriched, optional fields)

| Key | Type | Notes |
|-----|------|-------|
| `summary` | `string` | required |
| `regularity_score` | `int` 0–100 | required |
| `top_symptoms` | `string[]` | required |
| `correlation_found` | `string` | required |
| `doctor_note` | `string` | required |
| `avg_cycle_length_days` | `float \| null` | optional derived metric |
| `avg_period_length_days` | `float \| null` | optional derived metric |
| `avg_sleep_hours` | `float \| null` | optional derived metric |
| `avg_pain_level` | `float \| null` | optional derived metric |
| `common_moods` | `{ mood: string; count: int }[]` | optional |

All optional fields are backward-compatible — older stored payloads parse fine.

---

## 16. Cycle Analytics (enriched)

`GET /api/v1/cycle/analytics` — row-scoped by `current_user.id`. Existing fields
unchanged; the following are **new and optional** (`null` until enough data):

```json
{
  "data": {
    "average_cycle_length_days": 28.0,
    "shortest_cycle_days": 27,
    "longest_cycle_days": 30,
    "common_symptoms": [{ "symptom": "Bloating", "count": 3 }],
    "common_moods": [{ "mood": "happy", "count": 2 }],
    "total_entries": 5,
    "avg_period_length_days": 5.0,
    "cycle_length_std_dev_days": 1.2,
    "avg_ovulation_day": 14.0,
    "avg_sleep_hours": 7.1,
    "avg_pain_level": 3.5,
    "avg_energy_level": 2.3
  },
  "message": "ok"
}
```

| Field | Source | Null when |
|-------|--------|-----------|
| `avg_period_length_days` | mean of `period_end - period_start + 1` over closed entries | no closed entries |
| `cycle_length_std_dev_days` | `pstdev` of inter-start gaps (20–45 filter) | < 2 gaps |
| `avg_ovulation_day` | median of `cycle_length - 14` (min 1) | no closed entries |
| `avg_sleep_hours` | mean `CycleDay.sleep_minutes / 60` in the analytics window | no logged days |
| `avg_pain_level` | mean `CycleDay.pain_level` | no logged days |
| `avg_energy_level` | mean `CycleDay.energy_level` | no logged days |

Mobile may use these to build the Cycle Overview stat cards; when a field is
`null` the card shows `--` and the widget is kept but empty (no fake data).
