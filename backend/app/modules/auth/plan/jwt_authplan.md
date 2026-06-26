# JWT Auth Implementation Plan — Email + Password

> Replaces SMS/OTP as primary login. OTP endpoints kept for future use (MFA fallback).
> Stack: Python 3.11+ / FastAPI / SQLAlchemy 2.x async / Alembic / bcrypt / python-jose

---

## 1. Database Migration (`0004_auth_email_secret`)

### User Model Changes (`app/modules/auth/models.py`)

| Column | Change | Type | Constraints |
|--------|--------|------|-------------|
| `email` | **ADD** | `String(255)` | `unique`, `nullable=True`, `index=True` |
| `user_secret_key` | **ADD** | `String(64)` | `nullable=False`, `server_default=""` |
| `provider` | **ADD** | `String(20)` | `nullable=False`, `default="local"` |
| `is_verified` | **ADD** | `Boolean` | `nullable=False`, `default=False` |
| `phone_number` | **MODIFY** | `String(20)` | `nullable=True` (was `nullable=False`) |

### Migration Steps

1. Add columns with `nullable=True` (or defaults for non-nullable)
2. Back-fill `user_secret_key` for existing users: `UPDATE users SET user_secret_key = encode(gen_random_bytes(32), 'hex')`
3. Add unique index on `email WHERE email IS NOT NULL`
4. Migration is reversible (downgrade drops added columns, restores phone_number NOT NULL)

### Migration SQL (Alembic ops)

```python
# 0004_auth_email_secret.py
op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
op.add_column("users", sa.Column("user_secret_key", sa.String(64), nullable=False, server_default=""))
op.add_column("users", sa.Column("provider", sa.String(20), nullable=False, server_default="local"))
op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"))

# Back-fill secrets for existing rows
op.execute("UPDATE users SET user_secret_key = encode(gen_random_bytes(32), 'hex') WHERE user_secret_key = ''")

# Create partial unique index
op.create_index("ix_users_email", "users", ["email"], unique=True, postgresql_where=sa.text("email IS NOT NULL"))
```

---

## 2. JWT Enhancement (`app/core/security.py`)

### Current behaviour
- `create_access_token(user_id, role, settings)` → payload: `{ sub, role, jti, type, exp }`
- `decode_token(token, secret, expected_type)` → validates JWT, returns payload

### New behaviour
- `create_access_token(user_id, email, role, user_secret_key, settings)` → payload: `{ sub, email, usk, role, jti, type, exp }`
- `decode_token(token, secret, expected_type)` → returns payload (includes `usk`)
- New: `validate_token_secret(token_payload, user_secret_key)` → raises 401 if `token.usk !== user.user_secret_key`

### Payload shape

```json
{
  "sub": "uuid-string",
  "email": "user@example.com",
  "usk": "a1b2c3...64chars",    // user_secret_key — rotated on pw change
  "role": "user",
  "jti": "uuid4-hex",
  "type": "access",
  "exp": 1700000000
}
```

### Functions to add/modify

```python
def create_access_token(
    user_id: uuid.UUID,
    email: str,
    role: str,
    user_secret_key: str,
    settings: JWTSettings,
) -> tuple[str, str, int]:
    """Returns (token, jti, expires_in_seconds)."""
    jti = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "email": email,
        "usk": user_secret_key,
        "role": role,
        "jti": jti,
        "type": "access",
        "exp": expire,
        "iat": now,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, jti, settings.access_token_expire_minutes * 60


def create_refresh_token(
    user_id: uuid.UUID,
    user_secret_key: str,
    settings: JWTSettings,
) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at). Also embeds usk for verification."""
    jti = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "usk": user_secret_key,
        "jti": jti,
        "type": "refresh",
        "exp": expire,
        "iat": now,
    }
    token = jwt.encode(payload, settings.refresh_secret_key, algorithm=settings.algorithm)
    return token, jti, expire
```

---

## 3. Auth Dependency Update (`app/modules/auth/dependencies.py`)

### `get_current_user` — enhanced validation

```
decode token → get user_id from `sub`
load User from DB (same as before)
  ↓
validate `token.usk === user.user_secret_key`
  if mismatch → raise InvalidCredentialsError("Token has been invalidated")
  ↓
validate user.is_active (same as before)
  ↓
return User
```

### Code

```python
async def get_current_user(
    svc: AuthServiceDep,
    payload: dict = Depends(get_current_user_id),  # from security.py
) -> User:
    user_id = payload.get("sub")
    token_usk = payload.get("usk")
    user = await svc.get_user_by_id(uuid.UUID(user_id))
    if not user or not user.is_active:
        raise InvalidCredentialsError()
    if user.user_secret_key and token_usk and user.user_secret_key != token_usk:
        raise InvalidCredentialsError("Token has been invalidated")
    return user
```

---

## 4. Service Layer Changes (`app/modules/auth/services.py`)

### New constants

```python
SECRET_KEY_BYTES = 32   # 64 hex chars
BCRYPT_ROUNDS = 10
```

### New methods on `AuthService`

#### `register(email: str, password: str, display_name: str | None) -> (User, TokenPair)`

```
1. Normalize email (lowercase, strip)
2. Validate uniqueness — raise ConflictError if email exists
3. user_secret_key = secrets.token_hex(SECRET_KEY_BYTES)
4. password_hash = hash_password(password)  # bcrypt
5. Create User:
     User(
       email=email,
       hashed_password=password_hash,
       user_secret_key=user_secret_key,
       provider="local",
       display_name=display_name,
     )
6. Issue token pair using _issue_token_pair (updated to include usk)
   - _issue_token_pair(user, device_info) now calls create_access_token with usk
7. Emit event: event_bus.emit("user_registered", user_id=user.id)
8. RETURN user, token_pair
```

#### `login_with_email(email: str, password: str, device_info: dict | None) -> (User, TokenPair)`

```
1. Normalize email, find user by email
2. raise InvalidCredentialsError if:
   - user not found
   - user.provider != "local"
   - hashed_password is None
   - not verify_password(password, user.hashed_password)
3. Issue fresh token pair
4. RETURN user, token_pair
```

#### `_rotate_user_secret(user_id: uuid.UUID) -> str`

```
1. new_secret = secrets.token_hex(SECRET_KEY_BYTES)
2. UPDATE user SET user_secret_key = new_secret WHERE id = user_id
3. RETURN new_secret
```

Called on:
- Password change (existing `set_password` endpoint)
- Future: security events (device revoke, admin force-logout)

#### `_issue_token_pair` — updated signature

```python
async def _issue_token_pair(
    self,
    user: User,
    device_info: dict | None,
) -> TokenPair:
    access, jti, expires_in = create_access_token(
        user_id=user.id,
        email=user.email or "",
        role=user.role,
        user_secret_key=user.user_secret_key,
        settings=self.settings,
    )
    refresh, refresh_jti, expires_at = create_refresh_token(
        user_id=user.id,
        user_secret_key=user.user_secret_key,
        settings=self.settings,
    )
    # ... create UserSession row (same as before) ...
    return TokenPair(...)
```

---

## 5. Schema Changes (`app/modules/auth/schemas.py`)

### New request schemas

```python
class RegisterCreate(BaseModel):
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)

class LoginCreate(BaseModel):
    email: str
    password: str
    device_info: dict | None = None
```

### Updated response schemas

```python
class UserResponse(BaseModel):
    id: str
    email: str | None      # NEW
    phone_number: str | None  # was required
    display_name: str | None
    role: UserRole
    is_active: bool
    is_verified: bool       # NEW
    provider: str           # NEW
    created_at: str
```

---

## 6. Route Changes (`app/modules/auth/routes.py`)

### New endpoints

| Method | Path | Handler | Rate Limit | Auth |
|--------|------|---------|-----------|------|
| POST | `/register` | `register` | 5/hour per IP | No |
| POST | `/login` | `login` | 10/min per email | No |

### Route handlers

```python
@router.post("/register", status_code=201)
async def register(
    body: RegisterCreate,
    svc: AuthServiceDep,
    request: Request,
):
    """Create account with email + password. Returns JWT pair."""
    user, tokens = await svc.register(
        email=body.email,
        password=body.password,
        display_name=body.display_name,
    )
    return {"data": {"user": UserResponse.model_validate(user), "tokens": tokens}, "message": "ok"}


@router.post("/login")
async def login(
    body: LoginCreate,
    svc: AuthServiceDep,
    request: Request,
):
    """Email + password login. Returns JWT pair."""
    user, tokens = await svc.login_with_email(
        email=body.email,
        password=body.password,
        device_info=body.device_info,
    )
    return {"data": {"user": UserResponse.model_validate(user), "tokens": tokens}, "message": "ok"}
```

### Existing OTP endpoints — UNCHANGED

All current OTP, refresh, logout, MFA, password, sessions endpoints remain operational under `/api/v1/auth/otp/*`.

---

## 7. Alembic Migration (`0004_auth_email_secret`)

### File: `alembic/versions/0004_auth_email_secret.py`

```
Revision ID: 0004
Revises: 0003_add_composite_indexes
```

Operations:
1. ADD `email` (nullable, unique index later)
2. ADD `user_secret_key` (non-nullable, server_default="")
3. ADD `provider` (non-nullable, server_default="local")
4. ADD `is_verified` (non-nullable, server_default=False)
5. Back-fill `user_secret_key` via `gen_random_bytes()`
6. Back-fill `provider = 'local'` for existing rows
7. ALTER `phone_number` → nullable
8. CREATE partial unique index `ix_users_email` WHERE email IS NOT NULL
9. Downgrade: reverse all operations

---

## 8. Mobile Client Changes

### Types (`src/types/auth.ts`)

```typescript
export interface User {
  id: string;
  email: string | null;        // NEW
  phone_number: string | null; // was required
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;         // NEW
  provider: 'local' | 'google'; // NEW
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}
```

### Validation (`src/validation/auth.ts`)

```typescript
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z.string().min(8, 'Min 8 characters').max(128);
export const displayNameSchema = z.string().min(1, 'Required').max(100).optional();

export const registerFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
});
export type RegisterForm = z.infer<typeof registerFormSchema>;

export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginForm = z.infer<typeof loginFormSchema>;
```

### Auth service (`src/services/api/auth.ts`)

Add methods:
```typescript
async register(data: RegisterRequest): Promise<LoginResponse>
async login(email: string, password: string): Promise<LoginResponse>
```

### Auth store (`src/stores/authStore.ts`)

Add methods:
```typescript
login: (email: string, password: string) => Promise<void>
register: (data: RegisterRequest) => Promise<void>
```

These call the service, store tokens via `tokenStore.setBoth()`, and set `user` in Zustand.

### Navigation types (`src/navigation/types.ts`)

```typescript
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  // Keep OTP for future:
  // Phone: undefined;
  // Otp: { phone: string; expiresIn: number; devCode?: string | null };
};
```

### New screens

- `LoginScreen` — email input + password input + "Sign in" button + "Create account" link
- `RegisterScreen` — email input + password input + display name input + "Create account" button

### AuthStack (`src/navigation/AuthStack.tsx`)

Replace PhoneScreen → LoginScreen, OtpScreen → RegisterScreen.

---

## 9. Environment Variables

### Backend `.env` additions

```bash
# JWT (already exists)
JWT__SECRET_KEY=your-256-bit-secret
JWT__REFRESH_SECRET_KEY=your-256-bit-refresh-secret

# No new variables needed for email+password auth
```

### Mobile `.env` additions

```bash
SHE_CARE_API_URL=http://localhost:8000/api/v1
```

---

## 10. Implementation Order

| Step | What | Files |
|------|------|-------|
| 1 | Create plan file (this doc) | `plan/jwt_authplan.md` |
| 2 | Update User model | `models.py` |
| 3 | Update Pydantic schemas | `schemas.py` |
| 4 | Update core security (JWT with usk) | `core/security.py` |
| 5 | Update auth dependencies (validate usk) | `dependencies.py` |
| 6 | Update auth service (register, login, rotate_secret) | `services.py` |
| 7 | Update auth routes (add /register, /login) | `routes.py` |
| 8 | Create Alembic migration | `alembic/versions/0004_auth_email_secret.py` |
| 9 | Update mobile types | `types/auth.ts` |
| 10 | Update mobile validation | `validation/auth.ts` |
| 11 | Update mobile auth service | `services/api/auth.ts` |
| 12 | Create mobile LoginScreen + RegisterScreen | `screens/auth/` |
| 13 | Update mobile AuthStack navigation | `navigation/AuthStack.tsx`, `navigation/types.ts` |
| 14 | Update mobile auth store | `stores/authStore.ts` |
| 15 | Update mobile query hooks | `services/queries/auth.ts` |

---

## 11. Backward Compatibility Notes

- Existing users with `phone_number` only → `email = null`, `provider = "local"`, `user_secret_key` back-filled by migration
- OTP login still works for phone-based users
- After migration, all existing tokens are INVALIDATED (no `user_secret_key` in old token payload). Users must re-login. This is acceptable for dev phase.
- `/auth/password` endpoint already exists — update to also rotate `user_secret_key`
