# Auth Module — Workflow Reference

> **File:** `backend/app/modules/auth/`
> **Routes:** `/api/v1/auth/*`
> **Status:** Primary login — Email + Password; Legacy — OTP (SMS)

---

## Table of Contents

1. [Data Model](#1-data-model)
2. [JWT Structure & Validation](#2-jwt-structure--validation)
3. [Flow: Register (Email + Password)](#3-flow-register-email--password)
4. [Flow: Login (Email + Password)](#4-flow-login-email--password)
5. [Flow: OTP Request & Verify (Legacy Phone)](#5-flow-otp-request--verify-legacy-phone)
6. [Flow: Refresh Token Rotation](#6-flow-refresh-token-rotation)
7. [Flow: Logout](#7-flow-logout)
8. [Flow: MFA (TOTP)](#8-flow-mfa-totp)
9. [Flow: Password Change](#9-flow-password-change)
10. [Flow: Phone + Password Login](#10-flow-phone--password-login)
11. [Celery Tasks](#11-celery-tasks)
12. [Error Handling](#12-error-handling)
13. [Security Invariants](#13-security-invariants)
14. [Testing Guide](#14-testing-guide)

---

## 1. Data Model

Three tables, all owned by this module (rule §4.1):

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Inherited from `Base` |
| `created_at` / `updated_at` | DateTime | Inherited from `Base` |
| `is_active` | Boolean | Soft-delete flag; default `true` |
| `email` | String(255), unique, nullable | Partial unique index `ix_users_email WHERE email IS NOT NULL` |
| `phone_number` | String(20), unique, nullable | E.164 format; may be `null` for email-only users |
| `display_name` | String(100), nullable | |
| `profile_pic_url` | String(500), nullable | |
| `date_of_birth` | DateTime, nullable | |
| `blood_group` | String(5), nullable | |
| `medical_notes` | Text, nullable | Encrypted at rest via `core.encryption` |
| `role` | String(20), indexed | Default `"user"`. Polymorphic discriminator for future subclasses |
| **`user_secret_key`** | String(64), NOT NULL | 32-byte hex (64 chars). Embedded in every JWT. Rotated on password change → all prior tokens invalidated |
| **`provider`** | String(20), NOT NULL | `"local"` (email/pw) or future `"google"` |
| **`is_verified`** | Boolean, NOT NULL | Email verification status (future feature) |
| `mfa_enabled` | Boolean, default `false` | |
| `mfa_secret` | String(255), nullable | Encrypted TOTP secret |
| `encryption_key_salt` | String(255), nullable | Per-user salt for field-level encryption |
| `fcm_tokens` | JSONB, default `[]` | Push notification tokens |
| `hashed_password` | String(255), nullable | bcrypt hash |

### `user_sessions`

Refresh token session family. One row per issued refresh token.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users.id` | `ON DELETE CASCADE` |
| `refresh_token_hash` | String(255), indexed | SHA-256 of the refresh token value |
| `refresh_jti` | String(64), unique, indexed | JTI embedded in the refresh JWT |
| `expires_at` | DateTime(tz), indexed | |
| `device_info` | JSONB | Client-reported device info |
| `last_used_at` | DateTime(tz) | Updated on token rotation |
| `revoked_at` | DateTime(tz), nullable | Set when rotated/revoked |
| `is_active` | Boolean | Inherited from `Base` |

### `otp_attempts`

One row per OTP sent. Phone is SHA-256 hashed for privacy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `phone_hash` | String(64), indexed | SHA-256 of E.164 phone |
| `code_hash` | String(255) | SHA-256 of the OTP code |
| `expires_at` | DateTime(tz), indexed | 300 s TTL |
| `consumed` | Boolean | `true` after successful verify |
| `attempt_count` | Integer | Number of failed verify attempts |

---

## 2. JWT Structure & Validation

### Access Token Payload

```json
{
  "sub": "uuid-string",
  "email": "user@example.com",
  "usk": "a1b2c3d4...64hexchars",
  "role": "user",
  "iat": 1700000000,
  "exp": 1700003600,
  "jti": "uuid-string",
  "type": "access"
}
```

### Refresh Token Payload

```json
{
  "sub": "uuid-string",
  "usk": "a1b2c3d4...64hexchars",
  "iat": 1700000000,
  "exp": 1700086400,
  "jti": "uuid-string",
  "type": "refresh"
}
```

### Validation Chain (every authenticated request)

```
Request with Bearer token
  ↓
core/security.py: get_current_user_id()
  1. Extract Bearer token from Authorization header
  2. decode_token() — verify JWT signature, check type="access"
  3. Check Redis revocation list (jti) — reject if revoked
  4. Return decoded payload dict {sub, usk, role, email, jti}
  ↓
auth/dependencies.py: get_current_user()
  5. Look up User by payload["sub"] (UUID)
  6. Reject if user is None or not is_active
  7. Validate payload["usk"] == user.user_secret_key
     → Mismatch means secret was rotated (pw change).
       All tokens issued before the rotation are instantly invalid.
  8. Return User model instance
```

### Key Design: `user_secret_key`

- **Generated** on user creation via `secrets.token_hex(32)` → 64 hex chars
- **Embedded** in both access and refresh JWTs as `usk`
- **Rotated** by `_rotate_user_secret()` on every password change
- **Effect of rotation:** Every JWT ever issued with the old `usk` becomes invalid at step 7 above — no revocation list lookup needed for this check
- **No performance concern:** The check is a single string comparison, no DB write

---

## 3. Flow: Register (Email + Password)

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "display_name": "Jane"
}
```

### Route → Service Chain

```
register() route (routes.py:64)
  ↓ normalize email (strip, lowercase)
  ↓ svc.register(email, password, display_name)
       |
       ├─ get_user_by_email() — ConflictError 409 if taken
       ├─ secrets.token_hex(32) → user_secret_key
        ├─ bcrypt → hashed_password
       ├─ CREATE User { email, hashed_password, user_secret_key,
       │               provider="local", is_verified=false,
       │               display_name, encryption_key_salt }
       ├─ COMMIT
       └─ _issue_token_pair(user, device_info=None)
            ├─ create_access_token(user.id, email, role, usk, settings)
            ├─ create_refresh_token(user.id, usk, settings)
            ├─ CREATE UserSession { user_id, refresh_token_hash,
            │                       refresh_jti, expires_at }
            └─ RETURN TokenPair { access_token, refresh_token, expires_in }
  ↓
RETURN 201 { user, tokens, requires_mfa: false }
```

### Rate Limit: 5 requests/hour per IP

### Error Responses

| Status | Code | When |
|--------|------|------|
| 409 | `CONFLICT` | Email already registered |
| 422 | `VALIDATION_FAILED` | Invalid email format / password < 8 chars |

---

## 4. Flow: Login (Email + Password)

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "device_info": { "os": "ios", "app_version": "1.2.0" }
}
```

### Route → Service Chain

```
login() route (routes.py:85)
  ↓ rate limit check: login:{email}, 10/min
  ↓ svc.login_with_email(email, password, device_info)
       │
       ├─ normalize email, get_user_by_email()
       ├─ REJECT if user is None → InvalidCredentialsError
       ├─ REJECT if user.provider != "local" → InvalidCredentialsError
       ├─ REJECT if hashed_password is None → InvalidCredentialsError
       ├─ REJECT if !verify_password(password, hash) → InvalidCredentialsError
       ├─ REJECT if !user.is_active → InvalidCredentialsError
       └─ _issue_token_pair(user, device_info)
            └─ (same as register — see above)
  ↓
RETURN 200 { user, tokens, requires_mfa: false }
```

### Rate Limit: 10 requests/minute per email

### Key Security Detail

All rejection paths for wrong credentials return the same `InvalidCredentialsError` with a generic message (`"Invalid email or password"`) — no information leakage about whether the email exists.

---

## 5. Flow: OTP Request & Verify (Legacy Phone)

### Request

```
POST /api/v1/auth/otp/request
Content-Type: application/json

{ "phone": "+14155552671" }
```

```
request_otp() route (routes.py:111)
  ↓ rate limit: otp_request:{phone}, 5/10min
  ↓ svc.request_otp(phone)
       │
       ├─ Generate 6-digit code (secrets.randbelow)
       ├─ CREATE OTPAttempt { phone_hash, code_hash, expires_at=now+300s }
       ├─ TwilioClient.send_otp(phone) — real SMS in prod
       └─ RETURN dev_code or None (dev only)
  ↓
RETURN 202 { expires_in: 300, dev_code: "123456" | null }
```

### Verify

```
POST /api/v1/auth/otp/verify
Content-Type: application/json

{ "phone": "+14155552671", "otp": "123456", "device_info": {...} }
```

```
verify_otp() route (routes.py:126)
  ↓ svc.verify_otp(phone, code, device_info)
       │
       ├─ Find OTPAttempt by phone_hash where !consumed AND expires_at > now
       ├─ If found: compare code_hash. On mismatch → try Twilio fallback
       ├─ If not found: delegate to TwilioClient.verify_otp()
       ├─ Mark OTPAttempt consumed
       ├─ _get_or_create_user(phone)
       │    └─ Find by phone_number or CREATE new User with
       │        { phone_number, user_secret_key, role="user",
       │          encryption_key_salt }
       └─ If user.mfa_enabled → challenge tokens, requires_mfa=true
          Else → _issue_token_pair(user, device_info), requires_mfa=false
  ↓
RETURN 200 { user, tokens, requires_mfa }
```

### Rate Limit: 5 req/10min per phone (request), 10/min per phone (verify)

---

## 6. Flow: Refresh Token Rotation

```
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refresh_token": "...", "device_info": {...} }
```

### Design (Plan 40 — token rotation with reuse detection)

```
refresh() route (routes.py:171)
  ↓ svc.rotate_refresh_token(presented_token, device_info)
       │
       ├─ decode_token(presented, secret=refresh_secret, type="refresh")
       ├─ Find UserSession by refresh_jti (unique index)
       │
       ├─ [REUSE DETECTED] if session is None OR !is_active OR revoked_at
       │    → Burn ALL active sessions for this user
       │    → raise TokenRevokedError
       │
       ├─ [NORMAL ROTATION]
       │    → Mark current session is_active=false, revoked_at=now
       │    → _issue_token_pair(user, device_info) — new access + refresh
       └─ RETURN new TokenPair
```

### Why this matters

If an attacker steals a refresh token and the legitimate user also uses it, the first one to rotate "wins" and the second triggers the reuse detection — burning all sessions and forcing the attacker out.

---

## 7. Flow: Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{ "refresh_token": "...", "all_devices": false }
```

```
logout() route (routes.py:188)
  ↓ get_current_user_id() — validates token, extracts payload
  ↓ Extract user_id from payload["sub"], jti from payload["jti"]
  ↓ If jti found → revoke(jti) in Redis (TTL = access_token expiry)
  ↓ If all_devices → svc.logout(user_id, jti)
       ├─ Redis revocation (jti)
       └─ _revoke_user_sessions(user_id) — mark all UserSession inactive
  ↓
RETURN 204 (no content)
```

---

## 8. Flow: MFA (TOTP)

### Enable

```
POST /api/v1/auth/mfa/enable
Authorization: Bearer <access_token>
```

1. `svc.enable_mfa(user_id)` — generates `pyotp.random_base32()` secret
2. Encrypts with per-user salt if available
3. Returns `{ secret, otpauth_uri }` — user scans QR with authenticator app
4. **Does NOT flip `mfa_enabled` yet** — user must verify first

### Verify Setup

```
POST /api/v1/auth/mfa/verify-setup
Authorization: Bearer <access_token>
{ "code": "123456" }
```

1. `svc.verify_mfa_setup(user_id, code)` — verify via `pyotp.TOTP(secret).verify(code)`
2. On success → `user.mfa_enabled = true`
3. MFA is now active for this account

### Login with MFA

1. **First factor** (OTP verify or email/pw login): If `user.mfa_enabled`, returns `requires_mfa: true` and **challenge** tokens (still valid JWTs, but the service will refuse them for normal use)
2. **Second factor**:

```
POST /api/v1/auth/mfa/login
{ "mfa_token": "...", "code": "123456", "device_info": {...} }
```

3. `svc.verify_mfa_login(user, code, device_info)` — verify TOTP, issue real token pair

---

## 9. Flow: Password Change

```
POST /api/v1/auth/password
Authorization: Bearer <access_token>
{ "new_password": "newSecurePassword456" }
```

```
set_password() route (routes.py:285)
  ↓ svc.set_password(user_id, new_password)
       │
       ├─ Load user (404 if inactive)
       ├─ user.hashed_password = hash_password(new_password)
       ├─ _rotate_user_secret(user_id)
       │    └─ secrets.token_hex(32) → new user_secret_key
       │    └─ User.user_secret_key = new_secret
       ├─ COMMIT
       └─ (no tokens issued — user must log in again)
  ↓
RETURN 204
```

### Side Effect: all prior tokens invalidated

Because `user_secret_key` is now different from the `usk` in all previously-issued JWTs, every auth check will fail at the `get_current_user` validation step (step 7 in section 2). The user must re-login.

---

## 10. Flow: Phone + Password Login

```
POST /api/v1/auth/login/phone
Content-Type: application/json

{ "phone": "+14155552671", "password": "...", "device_info": {...} }
```

```
login_phone() route (routes.py:148)
  ↓ svc.login_with_password(phone, password, device_info)
       ├─ Find user by phone_number
       ├─ REJECT if no user, no hashed_password, or pw mismatch
       ├─ REJECT if !user.is_active
       └─ If user.mfa_enabled → challenge tokens, requires_mfa=true
          Else → full token pair, requires_mfa=false
  ↓
RETURN 200 { user, tokens, requires_mfa }
```

---

## 11. Celery Tasks

### `anonymize_deleted_users` (daily cron)

- Finds users where `is_active=false` AND `updated_at > 30 days ago` AND `display_name IS NOT NULL` (unanonymized)
- Blanks: `phone_number`, `display_name`, `profile_pic_url`, `medical_notes`, `mfa_secret`, `hashed_password`, `fcm_tokens`, `encryption_key_salt`
- Revokes all sessions
- Soft limit: 60 s, hard limit: 120 s, 3 retries with backoff

### `prune_expired_sessions` (hourly cron)

- Finds `UserSession` rows where `is_active=true` AND `expires_at < now`
- Marks them `is_active=false`, sets `revoked_at`
- Soft limit: 30 s, hard limit: 60 s

---

## 12. Error Handling

### Hierarchy

```
SheCareError (core/exceptions.py)
 ├── AuthError                    (401)
 │    ├── InvalidCredentialsError (401)
 │    ├── OTPExpiredError         (400)
 │    ├── OTPInvalidError         (400)
 │    ├── MFAMissingError         (401)
 │    ├── MFAInvalidError         (401)
 │    └── TokenRevokedError       (401)
 ├── NotFoundError                (404)
 ├── ConflictError                (409)
 └── RateLimitError               (429)
```

### Response Envelope (project invariant §2)

**Success:**
```json
{
  "data": { ... },
  "message": "ok"
}
```

**Error (auth & general):**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "details": "Invalid email or password",
    "request_id": "uuid-string"
  }
}
```

### Global Exception Handler (`core/exceptions.py`)

- `SheCareError` subclasses → mapped to `error.code + http_status`
- `StarletteHTTPException` → mapped via `code_map`
- `RequestValidationError` (Pydantic) → 422, `code: "VALIDATION_FAILED"`
- Unhandled → 500, logged + Sentry-ready

---

## 13. Security Invariants

### §1. Row-level permission (rule §14.1)

`user_id` is **never** read from the request body. All auth operations derive the user identity from the JWT's `sub` claim. The dependency `get_current_user_id()` in `core/security.py` enforces this.

### §2. user_secret_key rotation

Every password change rotates the secret, instantly invalidating all prior JWTs. No token revocation list needed for this — it's a single string comparison on every authenticated request.

### §3. No information leakage

Login failure messages are generic (`"Invalid email or password"`) — the caller cannot distinguish between "email not found" and "wrong password".

### §4. Credential storage

- Passwords: bcrypt (not stored in plaintext under any circumstance)
- Refresh tokens: SHA-256 hash stored in DB, not the raw token
- Phone numbers: SHA-256 hashed in OTP audit table (`otp_attempts.phone_hash`)
- MFA secrets: encrypted with per-user salt via `core.encryption`
- JWTs: never stored server-side (stateless auth)

### §5. Rate limits

| Endpoint | Limit | Key |
|----------|-------|-----|
| `POST /register` | 5/hour | IP address |
| `POST /login` | 10/min | Email |
| `POST /login/phone` | 10/min | Phone |
| `POST /otp/request` | 5/10min | Phone |
| `POST /otp/verify` | 10/min | Phone |

### §6. Refresh token reuse detection

If a rotated refresh token is presented again, **all** sessions for that user are revoked (plan 40). This limits the window for token theft.

### §7. Redis revocation list

Access token JTIs are stored in Redis with a TTL matching the token's remaining lifetime. Used for explicit logout. Not needed for `user_secret_key` rotation (that's handled by the `usk` claim check).

---

## 14. Testing Guide

### Fixture Structure

```
tests/modules/auth/
  conftest.py          → auth_service fixture with in-memory PG + mock Twilio
  test_services.py     → unit tests for AuthService methods
  test_routes.py       → integration tests for HTTP endpoints
```

### Key Test Patterns

```python
# Service test — mock external boundary only
async def test_register_creates_user(auth_service: AuthService):
    user, tokens = await auth_service.register("test@example.com", "password123")
    assert user.email == "test@example.com"
    assert user.provider == "local"
    assert tokens.access_token

# Route test — use TestClient
async def test_login_returns_tokens(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()["data"]["tokens"]

# user_secret_key rotation test
async def test_password_change_invalidates_old_tokens(auth_service: AuthService):
    user, first_tokens = await auth_service.register("test@example.com", "pw1")
    await auth_service.set_password(user.id, "pw2")
    # Login with old password fails
    with pytest.raises(InvalidCredentialsError):
        await auth_service.login_with_email("test@example.com", "pw1")
    # Login with new password works (and new usk)
    user2, second_tokens = await auth_service.login_with_email("test@example.com", "pw2")
    assert second_tokens.access_token != first_tokens.access_token
```

### Mocking Guidelines (rule §10.4)

- Mock `TwilioClient` at the module boundary — never mock internal service functions
- Use a real DB session against a test PG instance (async `create_async_engine` with `TEST_DATABASE_URL`)
- Override `get_db` and `get_redis_client` dependencies in route tests
- Set `ENCRYPTION__MASTER_KEY` env var before importing app
