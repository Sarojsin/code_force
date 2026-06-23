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

## 6. ETag & Offline Support (project invariant §7)

Backend emits `ETag` on journal, mood, cycle, and prediction responses.
Mobile sends `If-None-Match` for cheap revalidation.
On `304 Not Modified` → use cached data.

---

## 7. Security Notes

- Access tokens expire in 60 min (configurable via `JWT__ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh tokens expire in 14 days (configurable via `JWT__REFRESH_TOKEN_EXPIRE_DAYS`)
- Tokens are **stateless** — no server-side session store for access tokens
- `user_secret_key` is embedded in every JWT; rotating it (password change) instantly invalidates all prior tokens
- Refresh tokens use rotation with reuse detection — presenting an old token after rotation burns **all** sessions
- Journal content and medical notes are encrypted at rest (per-user key via `core.encryption`)
- Mobile stores tokens in `react-native-encrypted-storage`, never plain AsyncStorage
