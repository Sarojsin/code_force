# Phase 0: Authentication & Session Management (Foundation)

## Objective

Replace legacy SMS/OTP-only auth with a production-grade email/password JWT system featuring a **`user_secret_key` kill-switch** for instant session invalidation on password change. This is the bedrock for all subsequent phases.

## Architectural Decisions

1. **kill-switch via `user_secret_key`**: Every JWT embeds a SHA-256 hash of the user's `user_secret_key`. When the password changes, the key is rotated, instantly invalidating ALL previously issued tokens — no Redis blacklist required.

2. **Refresh token rotation with `jti` tracking**: Every refresh token gets a unique `jti` (JWT ID). The `jti` is stored in `user_sessions`. On each refresh, the old `jti` is deleted and a new one issued. Replay of a used refresh token triggers **defensive lockdown** (all sessions revoked).

3. **Server-authoritative client hydration**: The mobile app never decodes JWTs locally. It calls `GET /auth/me` to restore user state, preventing trust of tampered tokens.

---

## Table of Contents

1. [Database: User Model + Sessions](#1-database-user-model--sessions)
2. [Backend: Dependencies (get_current_user)](#2-backend-dependencies-get_current_user)
3. [Backend: Token Service](#3-backend-token-service)
4. [Backend: Login Service (with provider guard + rate limit)](#4-backend-login-service)
5. [Backend: Refresh Service (with replay protection)](#5-backend-refresh-service)
6. [Backend: Password Change (rotates usk)](#6-backend-password-change)
7. [Backend: Registration (password strength)](#7-backend-registration)
8. [Backend: GET /auth/me](#8-backend-get-authme)
9. [Mobile: Auth Store (hydration via /me)](#9-mobile-auth-store)
10. [Mobile: Axios 401 Interceptor](#10-mobile-axios-401-interceptor)
11. [Mobile: Register Screen (password rules)](#11-mobile-register-screen)
12. [Validation Criteria](#12-validation-criteria)

---

## 1. Database: User Model + Sessions

### `users` — Existing Columns (Migration 0004)

| Column | Type | Purpose |
|--------|------|---------|
| `email` | `String(320)`, unique partial index | Login identifier |
| `password_hash` | `String(128)` | bcrypt hash using `passlib[bcrypt]` with `rounds=12` |
| `user_secret_key` | `String(64)` | 64-char hex; rotated on password change |
| `provider` | `String(20)`, default `"local"` | Auth provider |
| `is_verified` | `Boolean`, default `True` | Auto-verified in V1 |
| `last_login_at` | `DateTime(tz)`, nullable | Updated on each successful login |
| `failed_login_attempts` | `Integer`, default `0` | Incremented on failed login; reset on success |

### `user_sessions` — New Table (Migration 0004b)

```python
class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True)
    refresh_token_jti: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True)  # The jti of the current valid refresh token
    device_info: Mapped[str | None] = mapped_column(String(255), nullable=True)  # "iPhone 15 Pro / iOS 18.2"
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False)  # Matches refresh token expiry
    is_revoked: Mapped[bool] = mapped_column(default=False, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False)
```

**Indexes**: unique on `refresh_token_jti`, compound index on `(user_id, is_revoked)`, partial index on `expires_at` for clean-up queries.

---

## 2. Backend: Dependencies (`get_current_user`)

### `app/modules/auth/dependencies.py`

```python
import uuid, hashlib
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.modules.auth.models import User

oauth2_scheme = HTTPBearer(auto_error=False)  # Returns None if no header

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token = credentials.credentials

    # 1. Decode JWT
    try:
        payload = jwt.decode(
            token, settings.jwt.secret_key,
            algorithms=[settings.jwt.algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # 2. Extract claims
    user_id = payload.get("sub")
    token_usk_hash = payload.get("usk")
    if not user_id or not token_usk_hash:
        raise HTTPException(status_code=401, detail="Malformed token")

    # 3. Fetch user (single DB hit)
    try:
        user = await db.get(User, uuid.UUID(user_id))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # 4. THE KILL-SWITCH — compare token's usk hash against current DB hash
    current_usk_hash = hashlib.sha256(user.user_secret_key.encode()).hexdigest()
    if token_usk_hash != current_usk_hash:
        # Password was changed — all prior tokens are dead
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please log in again.",
        )

    # 5. Optional: rate-limit brute force at dependency level (check failed_login_attempts)
    if user.failed_login_attempts and user.failed_login_attempts >= 10:
        raise HTTPException(status_code=401, detail="Account locked. Reset password.")

    return user


# Convenience alias for routes that require an authenticated user
CurrentUser = Depends(get_current_user)
```

### Usage in every protected route:

```python
from app.modules.auth.dependencies import CurrentUser

@router.get("/cycle/calendar")
async def get_calendar(current_user: User = CurrentUser, ...):
    # current_user is the fully-hydrated User row
    pass
```

---

## 3. Backend: Token Service

### `app/modules/auth/services.py` — Token helpers

```python
import uuid, hashlib, secrets
from datetime import datetime, timezone, timedelta
import jwt
from app.core.config import settings

def generate_user_secret_key() -> str:
    return secrets.token_hex(32)  # 64 hex chars

def create_access_token(user: User) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user.id),
        "usk": hashlib.sha256(user.user_secret_key.encode()).hexdigest(),
        "exp": now + timedelta(seconds=settings.jwt.access_token_expire_seconds),
        "iat": now,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt.secret_key, algorithm=settings.jwt.algorithm)

def create_refresh_token(user: User, jti: str | None = None) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user.id),
        "usk": hashlib.sha256(user.user_secret_key.encode()).hexdigest(),
        "jti": jti or str(uuid.uuid4()),
        "exp": now + timedelta(days=settings.jwt.refresh_token_expire_days),
        "iat": now,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt.secret_key, algorithm=settings.jwt.algorithm)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt.secret_key, algorithms=[settings.jwt.algorithm])
```

---

## 4. Backend: Login Service (with provider guard + rate limiting)

### `app/modules/auth/services.py`

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12)

class AuthService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def login(self, email: str, password: str, device_info: str | None = None,
                    ip_address: str | None = None) -> LoginResponse:
        # 1. Rate limit check (5 attempts per 5 minutes per IP + email)
        rate_key = f"login:{email}:{ip_address or 'unknown'}"
        attempts = await self.redis.incr(rate_key)
        if attempts == 1:
            await self.redis.expire(rate_key, 300)  # 5 min window
        if attempts > 5:
            raise RateLimitExceededError("Too many login attempts. Try again later.")

        # 2. Fetch user
        user = await self._get_user_by_email(email)
        if not user:
            raise UnauthorizedError("Invalid email or password")

        # 3. Provider guard — only "local" accounts can use password
        if user.provider != "local":
            raise UnauthorizedError(
                f"This account uses {user.provider} sign-in. Please log in with {user.provider}."
            )

        # 4. Verify password
        if not pwd_context.verify(password, user.password_hash):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            await self.db.flush()
            raise UnauthorizedError("Invalid email or password")

        # 5. Reset failed attempts on success
        user.failed_login_attempts = 0
        user.last_login_at = datetime.now(tz=timezone.utc)

        # 6. Generate tokens
        access_token = create_access_token(user)
        jti = str(uuid.uuid4())
        refresh_token = create_refresh_token(user, jti=jti)

        # 7. Store session
        session = UserSession(
            user_id=user.id,
            refresh_token_jti=jti,
            device_info=device_info,
            ip_address=ip_address,
            expires_at=datetime.now(tz=timezone.utc) + timedelta(days=settings.jwt.refresh_token_expire_days),
        )
        self.db.add(session)
        await self.db.flush()

        # 8. Clear rate limit on success
        await self.redis.delete(rate_key)

        return LoginResponse(
            user=UserResponse.from_orm(user),
            tokens=TokenPair(access_token=access_token, refresh_token=refresh_token),
            requires_mfa=False,
        )
```

---

## 5. Backend: Refresh Service (with replay protection)

```python
async def refresh(self, refresh_token_str: str) -> TokenPair:
    # 1. Decode refresh token
    try:
        payload = decode_token(refresh_token_str)
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type")

    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise UnauthorizedError("Malformed refresh token")

    # 2. Look up session by jti
    session = await self.db.execute(
        select(UserSession).where(
            UserSession.refresh_token_jti == jti,
            UserSession.is_revoked == False,
        )
    )
    session = session.scalar_one_or_none()

    # 3. REPLAY DETECTED — jti not found or already consumed
    if not session:
        # DEFENSIVE LOCKDOWN: revoke ALL sessions for this user
        await self.db.execute(
            update(UserSession)
            .where(UserSession.user_id == uuid.UUID(user_id), UserSession.is_revoked == False)
            .values(is_revoked=True, revoked_at=datetime.now(tz=timezone.utc))
        )
        await self.db.flush()
        raise UnauthorizedError("Session compromised. All sessions revoked. Please log in again.")

    # 4. Verify user still active
    user = await self.db.get(User, uuid.UUID(user_id))
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    # 5. Kill-switch check on the refresh token itself
    current_usk_hash = hashlib.sha256(user.user_secret_key.encode()).hexdigest()
    if payload.get("usk") != current_usk_hash:
        raise UnauthorizedError("Session expired. Please log in again.")

    # 6. Rotate: delete old session, create new one
    session.is_revoked = True
    session.revoked_at = datetime.now(tz=timezone.utc)

    new_jti = str(uuid.uuid4())
    new_refresh_token = create_refresh_token(user, jti=new_jti)
    new_access_token = create_access_token(user)

    new_session = UserSession(
        user_id=user.id,
        refresh_token_jti=new_jti,
        device_info=session.device_info,
        ip_address=session.ip_address,
        expires_at=datetime.now(tz=timezone.utc) + timedelta(days=settings.jwt.refresh_token_expire_days),
    )
    self.db.add(new_session)
    await self.db.flush()

    return TokenPair(access_token=new_access_token, refresh_token=new_refresh_token)
```

---

## 6. Backend: Password Change

```python
async def change_password(self, user: User, old_password: str, new_password: str) -> None:
    # 1. Verify old password
    if not pwd_context.verify(old_password, user.password_hash):
        raise UnauthorizedError("Current password is incorrect")

    # 2. Validate new password strength
    validate_password_strength(new_password)  # raises ValidationError if weak

    # 3. Hash new password
    user.password_hash = pwd_context.hash(new_password)

    # 4. Rotate user_secret_key → invalidates ALL JWTs
    user.user_secret_key = generate_user_secret_key()

    # 5. Revoke ALL sessions for this user (password change = global logout)
    await self.db.execute(
        update(UserSession)
        .where(UserSession.user_id == user.id, UserSession.is_revoked == False)
        .values(is_revoked=True, revoked_at=datetime.now(tz=timezone.utc))
    )

    await self.db.flush()
```

---

## 7. Backend: Registration (with password strength)

### `app/modules/auth/schemas.py`

```python
import re
from pydantic import BaseModel, field_validator

class RegisterCreate(BaseModel):
    email: str
    password: str
    display_name: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8 or len(v) > 128:
            raise ValueError("Password must be between 8 and 128 characters")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=~`\[\];']", v):
            raise ValueError("Password must contain at least one special character")
        return v
```

### Registration service

```python
async def register(self, data: RegisterCreate) -> LoginResponse:
    # 1. Check email uniqueness
    existing = await self._get_user_by_email(data.email)
    if existing:
        raise ConflictError("Email already registered")

    # 2. Create user
    user = User(
        email=data.email,
        password_hash=pwd_context.hash(data.password),
        user_secret_key=generate_user_secret_key(),
        display_name=data.display_name or data.email.split("@")[0],
        provider="local",
        is_verified=True,
    )
    self.db.add(user)
    await self.db.flush()

    # 3. Generate tokens + session (same pattern as login)
    ...

    return LoginResponse(user=..., tokens=..., requires_mfa=False)
```

---

## 8. Backend: `GET /auth/me`

```python
@router.get("/api/v1/auth/me")
async def get_me(current_user: User = CurrentUser) -> UserResponse:
    """Lightweight endpoint used by mobile to hydrate user state
       without decoding the JWT on the client side."""
    return UserResponse.from_orm(current_user)
```

---

## Endpoint Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/auth/register` | No | Create account with validated password |
| `POST` | `/api/v1/auth/login` | No | Email + password → JWT pair (rate-limited: 5/5min) |
| `POST` | `/api/v1/auth/refresh` | No | Rotate refresh token (replay-protected via `jti`) |
| `POST` | `/api/v1/auth/logout` | Yes | Revoke current session (delete `jti` from DB) |
| `POST` | `/api/v1/auth/password` | Yes | Change password (rotates `usk`, revokes all sessions) |
| `GET` | `/api/v1/auth/sessions` | Yes | List active sessions |
| `DELETE` | `/api/v1/auth/sessions/{id}` | Yes | Revoke specific session |
| `GET` | `/api/v1/auth/me` | Yes | Return current user (client hydration) |

---

## 9. Mobile: Auth Store

### `src/stores/authStore.ts`

```typescript
interface AuthState {
  user: User | null;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  hydrate: () => Promise<void>;
  reset: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
}
```

### `hydrate()` — Server-authoritative (do NOT decode JWT locally)

```typescript
async hydrate() {
  // 1. Check if token exists in EncryptedStorage
  const token = await EncryptedStorage.getItem('access_token');
  if (!token) {
    this.setUser(null);
    this.isHydrated = true;
    return;
  }

  try {
    // 2. Call /api/v1/auth/me to validate token on the server
    //    Never decode/trust the JWT payload on the client side.
    const user = await api.get('/api/v1/auth/me');
    this.setUser(user);
  } catch (error) {
    // 3. If /me returns 401, token is invalid or expired — clear everything
    await this.reset();
  } finally {
    this.isHydrated = true;
  }
}
```

### `reset()`

```typescript
async reset() {
  await EncryptedStorage.removeItem('access_token');
  await EncryptedStorage.removeItem('refresh_token');
  this.setUser(null);
}
```

### Navigation

```typescript
// RootNavigator.tsx
const user = useAuthStore(state => state.user);
const isHydrated = useAuthStore(state => state.isHydrated);

if (!isHydrated) return <SplashScreen />;
if (!user) return <AuthStack />;          // Login/Register
if (!user.onboarding_completed) return <OnboardingStack />;
return <MainTabs />;
```

---

## 10. Mobile: Axios 401 Interceptor

### `src/services/api/client.ts`

```typescript
import axios from 'axios';
import { useAuthStore } from '../../stores/authStore';
import { navigationRef } from '../../navigation/rootNavigation';
import Toast from 'react-native-toast-message';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await EncryptedStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const detail = error.response.data?.detail || '';

      // If session was revoked (password change / usk mismatch / replay attack)
      if (detail === 'Session expired. Please log in again.' ||
          detail === 'Session compromised. All sessions revoked. Please log in again.') {
        await useAuthStore.getState().reset();
        navigationRef.navigate('Auth');
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Your session was terminated due to a password change.',
        });
      }
    }
    return Promise.reject(error);
  }
);
```

### Refresh Token Interceptor (automatic rotation)

```typescript
// Queue concurrent requests while refreshing
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await EncryptedStorage.getItem('refresh_token');
        const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        await EncryptedStorage.setItem('access_token', data.access_token);
        await EncryptedStorage.setItem('refresh_token', data.refresh_token);

        // Retry queued requests
        failedQueue.forEach(({ resolve }) => resolve(data.access_token));
        failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        await useAuthStore.getState().reset();
        navigationRef.navigate('Auth');
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 11. Mobile: Register Screen (password rules)

### `src/screens/auth/RegisterScreen.tsx` — password validation

```typescript
const registerSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(128)
    .regex(/[0-9]/, 'At least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=~`\[\];']/, 'At least one special character'),
  displayName: z.string().optional(),
});
```

UI shows a password strength indicator with 3 checkboxes:
- ✓ 8+ characters
- ✓ 1+ number
- ✓ 1+ special character

---

## 12. Validation Criteria

### Backend Tests (add to `tests/modules/auth/`)

- [ ] Register with email+password creates user and returns JWT pair containing `usk`
- [ ] Register with weak password (no number) returns 422 validation error
- [ ] Register with weak password (no special char) returns 422 validation error
- [ ] Login with correct credentials returns JWT pair
- [ ] Login with wrong password returns 401 (generic "Invalid email or password")
- [ ] Login with `provider != "local"` returns 401 with provider-specific message
- [ ] Login: 6th attempt within 5 minutes returns 429 (rate limited)
- [ ] Access token with mismatched `usk` returns 401 "Session expired. Please log in again."
- [ ] `get_current_user` dependency returns user when token is valid
- [ ] `get_current_user` dependency returns 401 when Authorization header missing
- [ ] `get_current_user` dependency returns 401 when token is malformed
- [ ] Refresh token with valid `jti` in DB returns new token pair
- [ ] **Refresh token replay**: using a consumed refresh token returns 401 + revokes ALL sessions
- [ ] **Password change**: old password verified before rotating `usk`
- [ ] **Password change**: all sessions revoked after password change
- [ ] **Password change**: prior tokens return 401 after rotation
- [ ] `GET /auth/me` returns authenticated user
- [ ] `GET /auth/me` with invalid token returns 401
- [ ] Login: `failed_login_attempts` incremented on failure, reset on success
- [ ] Login: `last_login_at` updated on success
- [ ] Rate limit: clear rate limit key on successful login
- [ ] All MFA + OTP endpoints remain backward compatible
- [ ] `GET /auth/sessions` returns list of user's active sessions
- [ ] `DELETE /auth/sessions/{id}` revokes only that session

### Mobile Tests

- [ ] `hydrate()` with valid token calls `/auth/me` and sets user
- [ ] `hydrate()` with expired/invalid token clears storage and sets user: null
- [ ] `reset()` clears both tokens from EncryptedStorage
- [ ] LoginScreen renders form fields + Sign In button + Create One link
- [ ] RegisterScreen renders password strength indicators
- [ ] 401 interceptor triggers auto-logout with toast for usk-mismatch detail
- [ ] 401 interceptor triggers auto-logout for "Session compromised" detail
- [ ] Refresh interceptor retries queued requests after successful refresh
- [ ] Refresh interceptor navigates to Auth if refresh also fails
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors
