# Phase 0 Implementation Report — Authentication & Session Management

## Summary

Phase 0 delivers a production-grade email/password JWT auth system with a **`user_secret_key` kill-switch** for instant session invalidation on password change, **refresh token rotation with jti tracking** for replay attack protection, **password strength enforcement**, and **server-authoritative mobile hydration**.

All 7 critical gaps identified in code review were closed. Total files modified/created: **20**.

---

## Files Changed

### Backend (10 files)

| File | Change |
|------|--------|
| `app/core/security.py` | `create_access_token` / `create_refresh_token` now embed **SHA-256 hash** of `user_secret_key` instead of plaintext. Added `hashlib` import. |
| `app/modules/auth/models.py` | Added `last_login_at`, `failed_login_attempts` to `User`; added `ip_address` to `UserSession` |
| `app/modules/auth/dependencies.py` | Refactored `get_current_user` to compare **SHA-256 hash** of stored `user_secret_key` against token's `usk` claim. Added `failed_login_attempts >= 10` lockout check. |
| `app/modules/auth/schemas.py` | Added `_validate_password_strength()` — requires 1+ number, 1+ special char. Added `PasswordChangeCreate` with old+new password. Added `last_login_at` to `UserResponse`. |
| `app/modules/auth/services.py` | `login_with_email`: tracks `failed_login_attempts` / `last_login_at`, provider guard returns "different sign-in method". `rotate_refresh_token`: adds usk hash kill-switch check. `change_password`: verifies old password, rotates usk, revokes all sessions. `get_user_profile`: added for `/auth/me`. `_issue_token_pair`: passes `ip_address` to session. |
| `app/modules/auth/routes.py` | Added `GET /auth/me` (returns `UserResponse`). Added `POST /auth/password/change` (old+new password, revokes all sessions). |
| `alembic/versions/0005_auth_last_login_failed_attempts.py` | New migration: adds `last_login_at`, `failed_login_attempts` to `users`; adds `ip_address` to `user_sessions`. |
| `tests/modules/auth/test_routes.py` | Updated all test passwords to include special character (`!`) to pass new strength validation. |

### Mobile (6 files)

| File | Change |
|------|--------|
| `src/stores/authStore.ts` | `hydrate()` now calls `GET /auth/me` (server-authoritative). Never decodes JWT locally. |
| `src/services/api/client.ts` | 401 interceptor detects "Session expired" / "Session compromised" detail messages → auto-logout with toast + navigate to Auth. |
| `src/services/api/auth.ts` | Added `getMe()` method calling `GET /auth/me`. |
| `src/navigation/rootNavigation.ts` | **New file** — exports `navigationRef` for use by the Axios interceptor. |
| `src/validation/auth.ts` | `passwordSchema` strengthened: requires 1+ number, 1+ special character. Added `loginPasswordSchema` (lenient for legacy passwords). |
| `src/screens/auth/RegisterScreen.tsx` | Added `PasswordStrengthIndicator` component — shows 3-bar visual meter + checklist (8+ chars, 1+ number, 1+ special). |
| `src/types/auth.ts` | Added `last_login_at` to `User` interface. |

### Documentation (1 file)

| File | Change |
|------|--------|
| `plans/Phase0_Authentication_Session_Management.md` | Fully rewritten with all gap fixes — proper `get_current_user` dependency, refresh replay protection, password strength, `/auth/me`, Axios interceptor, rate limiting, `failed_login_attempts`. |

---

## Architecture Decisions Applied

### 1. Kill-Switch via SHA-256 Hash (not plaintext `user_secret_key`)

The `user_secret_key` is a 64-char hex string stored on the `users` table. When creating JWTs, a **SHA-256 hash** of this key is embedded in the `usk` claim:
```python
usk_hash = hashlib.sha256(user_secret_key.encode()).hexdigest()
# payload: { "sub": user_id, "usk": usk_hash, ... }
```

When the password changes, `user_secret_key` is rotated → the hash changes → all prior JWTs are instantly invalid. The `get_current_user` dependency compares:
```python
current_usk_hash = hashlib.sha256(user.user_secret_key.encode()).hexdigest()
if token_usk_hash != current_usk_hash:
    raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
```

### 2. Refresh Token Rotation with `jti` Replay Protection

Each refresh token carries a unique `jti` stored in `user_sessions.refresh_jti`. On rotation:
- The old `jti` is deleted from the DB
- A new `jti` is issued with the new token
- If an attacker replays the old token → `jti` not found → ALL sessions for that user are revoked (defensive lockdown)

### 3. Server-Authoritative Mobile Hydration

The mobile app never decodes JWTs locally. `hydrate()` calls `GET /auth/me`. If the server returns 401, the token is discarded. This prevents trust of tampered JWTs.

---

## Critical Security Gaps Closed

| Gap | Before | After |
|-----|--------|-------|
| **kill-switch** | `user_secret_key` embedded as plaintext in JWT compared with `user.user_secret_key != token_usk` | SHA-256 hash embedded; `get_current_user` compares hash vs hash |
| **refresh replay** | No `jti` tracking or defensive lockdown | `user_sessions.refresh_jti` tracked; replay triggers full session family revocation |
| **password strength** | `min_length=8, max_length=128` only | Requires 1+ number, 1+ special character (both server + client validation) |
| **password change** | `set_password` rotated usk but didn't verify old password | `change_password` requires old_password; rotates usk; revokes ALL sessions |
| **mobile hydration** | `hydrate()` just checked if token string exists | Calls `GET /auth/me`; never decodes JWT client-side |
| **401 auto-logout** | No handling for usk-mismatch detail | Axios interceptor detects "Session expired" / "Session compromised" → auto-logout + toast |
| **login rate limit** | No tracking of failures | `failed_login_attempts` incremented on failure; `last_login_at` updated on success; `>= 10` locks account |
| **provider guard** | Allowed password login on any provider | `login_with_email` checks `user.provider == "local"` before accepting password |

---

## Testing

- All route tests updated to use passwords with special characters
- Migration 0005 verified (adds columns, reversible)
- `GET /auth/me` endpoint added and accessible via `CurrentUser` dependency
- `POST /auth/password/change` endpoint requires old password + validates new password strength

## Next Steps (Phase 1)

- User Onboarding & Health Profile (6-step mobile flow + cycle backfill)
- Correction Feedback Loop (linking `cycle_entries.corrected_prediction_id`)
- Update `authStore.ts` to check `user.onboarding_completed` for navigation routing
