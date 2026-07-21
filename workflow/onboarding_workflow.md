# Onboarding Workflow — SheCare

> **Codebase version:** 0.1.0  
> **Last updated:** 2026-07-19  
> **Scope:** From app launch through splash, auth, onboarding form, to dashboard display.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Navigation Flow](#3-navigation-flow)
4. [Splash Screen](#4-splash-screen)
5. [Authentication](#5-authentication)
   - 5.1 [Login](#51-login)
   - 5.2 [Register](#52-register)
   - 5.3 [OTP Flow](#53-otp-flow)
   - 5.4 [Refresh Token](#54-refresh-token)
   - 5.5 [Logout](#55-logout)
   - 5.6 [Session Expiry](#56-session-expiry)
    - 5.7 [Password Management](#57-password-management)
    - 5.8 [MFA (TOTP) Flow](#58-mfa-totp-flow)
    - 5.9 [Phone + Password Login](#59-phone--password-login)
    - 5.10 [Device Registration](#510-device-registration)
    - 5.11 [Session Management](#511-session-management)
 6. [Onboarding Form](#6-onboarding-form)
   - 6.1 [Personal Info](#61-personal-info)
   - 6.2 [Lifestyle & Health](#62-lifestyle--health)
   - 6.3 [Current Cycle](#63-current-cycle)
    - 6.4 [Past Cycles](#64-past-cycles)
 7. [Backend Processing](#7-backend-processing)
8. [Database Schema](#8-database-schema)
9. [Offline Architecture](#9-offline-architecture)
10. [Synchronization](#10-synchronization)
11. [Security](#11-security)
12. [Error Handling](#12-error-handling)
13. [API Reference](#13-api-reference)

---

## 1. Architecture Overview

### 1.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                     Mobile App                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Auth Screens│ │Onboarding│  │ Dashboard (Main) │  │
│  │ Login     │ │ Screens  │  │ Home | Calendar  │  │
│  │ Register  │ │ Personal │  │ Profile | Chat   │  │
│  │ OTP       │ │ Lifestyle│  │ Analytics        │  │
│  │ Forgot Pwd│ │ Cycles   │  └──────────────────┘  │
│  └─────┬─────┘ └────┬─────┘        │                │
│        │             │              │                │
│  ┌─────┴─────────────┴──────────────┴──────────┐   │
│  │         Zustand Store (AuthStore)           │   │
│  │  user, isHydrated, tokens in EncryptedStore │   │
│  └──────────────────┬─────────────────────────┘   │
│                     │                              │
│  ┌──────────────────┴─────────────────────────┐   │
│  │         TanStack Query Cache               │   │
│  │  API responses, stale-while-revalidate     │   │
│  │  + placeholderData from SQLite             │   │
│  │  + write-through on mutation onSuccess     │   │
│  └──────────┬────────────────────┬────────────┘   │
│             │                    │                  │
│             ▼                    ▼                  │
│  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  SQLite Local DB │  │  API Client (Axios)  │   │
│  │  Drizzle ORM     │  │  Base URL → ...      │   │
│  │  18 tables       │  │  Interceptors →      │   │
│  │  CRUD services   │  │  Bearer, refresh,401 │   │
│  └──────────────────┘  └──────────┬───────────┘   │
└─────────────────────┼──────────────────────────────┘
                      │ HTTPS
┌─────────────────────┼──────────────────────────────┐
│  Backend (FastAPI)  │                              │
│  ┌──────────────────┴─────────────────────────┐   │
│  │         FastAPI App Factory                │   │
│  │  app/main.py → create_app()               │   │
│  └──────────────────┬─────────────────────────┘   │
│                     │                              │
│  ┌──────────────────┴─────────────────────────┐   │
│  │         Auth Module                        │   │
│  │  /api/v1/auth/register                    │   │
│  │  /api/v1/auth/login                       │   │
│  │  /api/v1/auth/refresh                     │   │
│  │  /api/v1/auth/logout                      │   │
│  │  /api/v1/auth/otp/request                 │   │
│  │  /api/v1/auth/otp/verify                  │   │
│  │  /api/v1/auth/password                    │   │
│  │  /api/v1/auth/password/change             │   │
│  └──────────────────┬─────────────────────────┘   │
│                     │                              │
│  ┌──────────────────┴─────────────────────────┐   │
│  │         Onboarding Module                  │   │
│  │  PUT  /api/v1/onboarding                   │   │
│  │  GET  /api/v1/onboarding                   │   │
│  │  GET  /api/v1/onboarding/status            │   │
│  └──────────────────┬─────────────────────────┘   │
│                     │                              │
│  ┌──────────────────┴─────────────────────────┐   │
│  │  PostgreSQL │ Redis │ Celery Worker        │   │
│  └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### 1.2 Module Structure

Each feature follows the "package by feature" pattern:

```
app/modules/<feature>/
  routes.py        — Thin: parse request, call service, return response
  services.py      — Business logic, DB queries, no HTTP types
  models.py        — SQLAlchemy models owned by THIS module
  schemas.py       — Pydantic Create / Update / Response / InDB
  dependencies.py  — FastAPI Depends (get_current_user, get_service)
  tasks.py         — Celery tasks owned by this module
  exceptions.py    — Module-specific exceptions
```

### 1.3 Cross-Module Communication

Modules communicate via an in-process `EventBus`:

```python
await event_bus.emit("onboarding_completed", user_id=str(user_id))
```

Subscribers (defined in the subscriber's module, not the emitter's):

```python
@event_bus.subscribe("onboarding_completed")
def on_onboarding_completed(user_id: str):
    # Cycle module computes initial prediction
    ...
```

---

## 2. Folder Structure

### 2.1 Backend Onboarding & Auth

```
backend/app/modules/auth/
├── __init__.py
├── routes.py          # 15 endpoints (register, login, OTP, MFA, sessions, etc.)
├── services.py        # AuthService: password hashing, token creation, OTP, MFA
├── models.py          # User, UserSession, OTPAttempt tables
├── schemas.py         # RegisterCreate, LoginCreate, TokenPair, UserResponse, etc.
├── dependencies.py    # get_current_user, AuthServiceDep, CurrentUser
├── exceptions.py      # AuthError, InvalidCredentialsError, etc.
├── tasks.py           # Session cleanup, token revocation tasks

backend/app/modules/onboarding/
├── __init__.py
├── routes.py          # 3 endpoints (PUT /, GET /, GET /status)
├── services.py        # OnboardingService: upsert, backfill cycles, emit event
├── models.py          # UserOnboarding table
├── schemas.py         # OnboardingCreate, OnboardingResponse, OnboardingStatusResponse
├── dependencies.py    # OnboardingServiceDep
├── exceptions.py      # OnboardingNotFoundError
├── tasks.py           # Post-onboarding tasks (if any)

backend/app/core/
├── config.py          # Pydantic BaseSettings — all env config
├── database.py        # AsyncEngine, async_session, Base
├── security.py        # JWT encode/decode, password hashing, get_current_user_id
├── event_bus.py       # In-process async pub/sub
├── encryption.py      # Fernet + PBKDF2 per-user encryption
├── exceptions.py      # SheCareError base, handlers
├── redis_client.py    # Redis connection pool
├── rate_limit.py      # Sliding-window rate limiter
├── token_revocation.py # Redis-backed JWT revocation
├── logging_config.py  # Structlog JSON logger
├── monitoring.py      # Sentry + Prometheus
├── pagination.py      # Offset + cursor pagination
├── responses.py       # ETag response helper
├── audit.py           # Audit logging
├── security_headers.py # HSTS/CSP middleware
├── sentry_middleware.py # Sentry tagging middleware
├── celery_app.py      # Celery app singleton
```

### 2.2 Mobile Auth & Onboarding

```
mobile/src/
├── app/
│   ├── App.tsx               # Entry point, providers wrapper
│   └── providers.tsx         # GestureHandlerRootView, SafeAreaProvider, QueryClient, etc.
├── navigation/
│   ├── RootNavigator.tsx     # Splash → Auth | Onboarding | Main
│   ├── MainTabs.tsx          # Home | Calendar | Analytics | AI Chat | Profile
│   ├── AuthStack.tsx         # Login, Register, OTP entry
│   ├── OnboardingStack.tsx   # Welcome, PersonalInfo, Lifestyle, CurrentCycle, PastCycles, Complete
│   ├── HomeStack.tsx         # Dashboard, CyclePredictions, Journal, etc.
│   ├── CalendarStack.tsx     # CalendarMain, CycleDashboard, LogPeriod, etc.
│   ├── FeatureStacks.tsx     # Wellness, Cycle, Pregnancy, Safety, Profile stacks
│   └── types.ts              # ParamList types for all navigators
├── screens/
│   ├── SplashScreen.tsx      # Animated logo, auth hydration
│   ├── auth/
│   │   ├── LoginScreen.tsx       # Email + password
│   │   ├── RegisterScreen.tsx    # Email + password + display name
│   │   ├── PhoneScreen.tsx       # Phone OTP entry (E.164)
│   │   └── OtpScreen.tsx         # OTP code verification
│   ├── onboarding/
│   │   ├── WelcomeScreen.tsx             # Intro + Get Started
│   │   ├── PersonalInfoScreen.tsx        # Age, height, weight (PickerField)
│   │   ├── LifestyleScreen.tsx           # Stress, exercise, sleep (Slider), diet
│   │   ├── CurrentCycleScreen.tsx        # Current period start, length, symptoms
│   │   ├── PastCycleScreen.tsx           # Reusable: PastCycle1/2/3 by route param
│   │   └── CompleteScreen.tsx            # Success, calls submitOnboarding() → API
│   └── cycle/
│       ├── CycleDashboardScreen.tsx     # Calendar + predictions + sticky card
│       ├── CyclePredictionsScreen.tsx   # Next prediction detail
│       ├── CycleHistoryScreen.tsx       # Historical cycles
│       ├── LogPeriodScreen.tsx          # Log period entry
│       └── CycleAnalyticsScreen.tsx     # Analytics charts
├── services/
│   ├── api/
│   │   ├── client.ts          # Axios instance, interceptors, token store
│   │   ├── auth.ts            # authService: login, register, OTP, logout, refresh
│   │   └── onboarding.ts     # onboardingService: get/update status
│   ├── queries/
│   │   ├── auth.ts            # useLogin, useRegister, useRequestOtp, useVerifyOtp, useLogout
│   │   └── cycle.ts           # useCycleCalendar, useLogCorrection, useLogSnooze
│   └── storage/
│       └── index.ts           # EncryptedStorage wrapper (react-native-encrypted-storage)
├── stores/
│   ├── authStore.ts           # Zustand: user, isHydrated, hydrate(), login(), register(), reset()
│   └── onboardingStore.ts     # Zustand+persist: 26-field state, setPersonalInfo/Lifestyle/CurrentCycle, addPastCycle, submitOnboarding()
├── db/
│   ├── schema.ts              # Drizzle ORM schema (18 tables)
│   ├── connection.ts          # SQLite singleton (openDatabaseSync)
│   └── migrations/            # Migration files
├── services/localDb/
│   ├── index.ts               # Barrel export
│   ├── BaseLocalService.ts    # Abstract CRUD base class
│   ├── cycle.ts               # CycleLocalService
│   ├── journal.ts             # JournalLocalService
│   ├── mood.ts                # MoodLocalService
│   ├── emergencyContact.ts    # EmergencyContactLocalService
│   ├── sosAlert.ts            # SosAlertLocalService
│   ├── syncPlaceholders.ts    # 13 placeholder readers
│   ├── writeThroughHelpers.ts # Merge-and-upsert helpers
│   ├── pruneLocalDb.ts        # Hard-delete + VACUUM
│   ├── backfillSqlite.ts      # Backfill RQ cache → SQLite
│   └── cleanupObsoleteKeys.ts # Remove obsolete AsyncStorage keys
└── types/
    └── auth.ts                # User, LoginResponse, TokenPair, RegisterRequest, etc.
```

---

## 3. Navigation Flow

### 3.1 Complete Navigation State Machine

```
                    ┌──────────────┐
                    │  App Launch  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ SplashScreen │
                    │ - Logo anim  │
                    │ - Check auth │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Hydrate?     │
                    │ isHydrated?  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌────▼────┐  ┌───▼────────┐
     │ Token      │  │ Token   │  │ Token      │
     │ exists     │  │ missing │  │ exists     │
     │ + valid    │  │         │  │ + network  │
     │ + online   │  │         │  │ error      │
     └─────┬──────┘  └────┬────┘  └─────┬──────┘
           │              │             │
     ┌─────▼──────┐  ┌────▼────┐  ┌────▼──────┐
     │ GET /auth/ │  │ Navigate│  │ Load user │
     │ me (API)   │  │ to Auth │  │ from cache │
     └─────┬──────┘  └────┬────┘  └─────┬──────┘
           │              │             │
     ┌─────▼──────┐       │       ┌─────▼───────┐
     │ User       │       │       │ isHydrated  │
     │ fetched    │       │       │ = true      │
     └─────┬──────┘       │       └─────┬───────┘
           │              │             │
     ┌─────▼──────┐       │             │
     │ Cache user │       │             │
     │ in Encrypt │       │             │
     └─────┬──────┘       │             │
           │              │             │
     ┌─────▼───────────────────────────────────┐
     │         User exists?                    │
     └─────┬────────────────────────┬──────────┘
           │                        │
     ┌─────▼──────┐          ┌──────▼───────┐
     │ Check      │          │ Navigate to  │
     │ onboarding │          │ Auth Stack   │
     │ status     │          │              │
     └─────┬──────┘          └──────────────┘
           │
     ┌─────┼────────────────────┐
     │     │                    │
  ┌──▼──┐ │            ┌───────▼─────┐
  │ Onb │ │            │ Onboarding  │
  │ not │ │            │ completed   │
  │ done│ │            │             │
  └──┬──┘ │            └──────┬──────┘
     │    │                   │
  ┌──▼────┴──┐          ┌────▼──────┐
  │ Onboard  │          │ Navigate  │
  │ Stack    │          │ to Main   │
  │          │          │ Tabs      │
  └──────────┘          └───────────┘
```

### 3.2 `RootNavigator.tsx` — Decision Logic

```typescript
// Pseudocode of RootNavigator.tsx
function RootNavigator() {
  // 1. Show splash immediately
  // 2. Call useAuthStore.hydrate() in useEffect
  //    - Reads encrypted token store
  //    - If token exists → calls GET /auth/me
  //    - If network error → loads from encrypted cache
  //    - If token invalid/expired → clears token, user=null
  // 3. Once hydrated, check onboarding status via GET /onboarding/status
  // 4. Decision:
  //    user && onboardingCompleted → MainTabs
  //    user && !onboardingCompleted → OnboardingStack
  //    !user → AuthStack
}
```

### 3.3 Auth Stack Routes

```typescript
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Phone: undefined;          // OTP phone entry
  Otp: { phone: string; expiresIn: number; devCode?: string | null };
  Mfa: { phone: string };   // MFA challenge
};
```

### 3.4 Onboarding Stack Routes

```typescript
type OnboardingStackParamList = {
  Welcome: undefined;
  PersonalInfo: undefined;
  Lifestyle: undefined;
  CurrentCycle: undefined;
  PastCycle1: undefined;
  PastCycle2: undefined;
  PastCycle3: undefined;
  Complete: undefined;
};
```

### 3.5 Main Tab Routes

```typescript
type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Calendar: NavigatorScreenParams<CalendarStackParamList>;
  Analytics: NavigatorScreenParams<AnalyticsStackParamList>;
  AIChat: NavigatorScreenParams<AIChatStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};
```

### 3.6 Calendar Stack (Cycle Context)

```typescript
type CalendarStackParamList = {
  CalendarMain: undefined;
  PhaseDetail: { phase: string };
  CycleDashboard: undefined;
  LogPeriod: undefined;
  CycleHistory: undefined;
  CyclePredictions: undefined;
  CycleAnalytics: undefined;
};
```

---

## 4. Splash Screen

### 4.1 Purpose

Display the SheCare animated logo while the app performs critical startup tasks:
1. Hydrate authentication state from encrypted storage
2. Check network connectivity
3. Fetch user profile (if token exists)
4. Check onboarding status
5. Determine initial navigation destination

### 4.2 UI Components

- `SafeAreaView` — full-screen background
- `Animated.View` (Reanimated) — logo container with spring animation
- `Svg` — SheCare heart/leaf logo
- `ActivityIndicator` — loading spinner (optional)

### 4.3 Sequence Diagram

```
User opens app
       │
       ▼
┌─────────────────────┐
│  SplashScreen       │
│  onFinish callback  │
│  sets showSplash =  │
│  false after 2s     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  RootNavigator      │
│                     │
│  useEffect →        │
│  hydrate()          │
│                     │
│  ┌─────────────────┐│
│  │ tokenStore      ││
│  │ .getAccess()    ││
│  │ (EncryptedStore)││
│  └────────┬────────┘│
│           │         │
│    ┌──────▼──────┐  │
│    │ Token null? │  │
│    └──┬──────┬───┘  │
│   Yes│      │No     │
│      │      │       │
│  ┌───▼─┐ ┌──▼────┐ │
│  │Set  │ │GET    │  │
│  │user │ │/auth/ │  │
│  │null │ │me     │  │
│  └───┬─┘ └──┬────┘  │
│      │      │       │
│      │  ┌───▼────┐  │
│      │  │Success?│  │
│      │  └┬──┬──┬─┘  │
│      │  Y│  │N │    │
│      │   │  │  │    │
│      │   │  │ ┌▼───┐│
│      │   │  │ │Net ││
│      │   │  │ │Err?││
│      │   │  │ └┬───┘│
│      │   │  │ Y│  N │
│      │   │  │  │    │
│      │   │  │ ┌▼┐ ┌─▼──┐
│      │   │  │ │ │ │Clear│
│      │   │  │ │ │ │token│
│      │   │  │ │ │ │user=│
│      │   │  │ │ │ │null │
│      │   │  │ │ │ └─────┘
│      │   │  │ │ │
│      │   │  │ ┌▼──────┐
│      │   │  │ │Load   │
│      │   │  │ │cached │
│      │   │  │ │user   │
│      │   │  │ └───────┘
│      │   │  │
│      ▼   ▼  ▼       ▼
│   isHydrated = true
│
│  ┌──────────────────┐
│  │ user exists?     │
│  └──┬───────────┬───┘
│  No │           │ Yes
│     │           │
│  ┌──▼──┐  ┌────▼────────┐
│  │Auth │  │ /onboarding │
│  │Stack│  │ /status     │
│  └─────┘  └────┬────────┘
│                │
│          ┌─────▼─────┐
│          │ Logged     │
│          │ Completed? │
│          └──┬──────┬──┘
│         Yes │      │ No
│             │      │
│        ┌────▼──┐ ┌─▼───────┐
│        │ Main  │ │Onboard  │
│        │ Tabs  │ │Stack    │
│        └───────┘ └─────────┘
```

### 4.4 Auth Store Hydration Details

The `useAuthStore.hydrate()` function (`mobile/src/stores/authStore.ts`):

```
hydrate()
│
├── Read access token from EncryptedStorage
│   └── Key: "shecare.accessToken"
│
├── No token?
│   └── Set isHydrated=true, user=null → return
│
├── Has token?
│   ├── Call GET /auth/me
│   │   ├── Success → cache user in EncryptedStorage ("shecare.user")
│   │   │            → set user + isHydrated=true
│   │   │
│   │   ├── Network error → read cached user from EncryptedStorage
│   │   │   ├── Found → set user + isHydrated=true
│   │   │   └── Not found → clear tokens, set user=null, isHydrated=true
│   │   │
│   │   └── Other error (401, etc.) → clear tokens + cached user
│   │                                → set user=null, isHydrated=true
```

### 4.5 Token Storage

Tokens are stored in **`react-native-encrypted-storage`** (never plain AsyncStorage):

| Key | Value |
|-----|-------|
| `shecare.accessToken` | JWT access token (15 min expiry) |
| `shecare.refreshToken` | JWT refresh token (30 day expiry) |
| `shecare.user` | JSON-serialized User object (offline cache) |

---

## 5. Authentication

### 5.1 Login

#### 5.1.1 Screen: `LoginScreen.tsx`

**Purpose:** Authenticate existing users via email + password.

**UI Components:**
- `SafeAreaView` with background color
- `KeyboardAvoidingWrapper` for keyboard handling
- `DecorativeHeader` — gradient SVG background with wave curve, brand flower icon, "SheCare" title + tagline
- `View` card (surface background, border radius, shadow) overlapping the header
- `Text` "Welcome back"
- `Text` "Sign in to continue"
- `FormField` — Email input (keyboard type: email-address, autoCapitalize: none, autoComplete: email)
- `FormField` — Password input (secureTextEntry: true, autoComplete: password)
- `Text` — "Forgot password?" (muted color, non-interactive placeholder)
- `Button` — "Sign in" (primary, full width, loading state from useLogin)
- Error box shown on API failure ("Invalid email or password. Please try again.")
- Divider ("or") with horizontal lines
- `Text` + link → "Don't have an account? Create one" → navigates to RegisterScreen

**Validation (zod schema):**
```typescript
const loginFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Required').max(128),  // lenient — accepts legacy passwords
});
```

**User Actions:**

```
User taps "Log In"
│
├── Trigger form validation (react-hook-form + zod)
│   ├── Invalid → show inline errors
│   └── Valid → proceed
│
├── Set loading state (disable button, show spinner)
│
├── Call useLogin().mutateAsync({ email, password })
│   │
│   ├── authService.login() → POST /api/v1/auth/login
│   │   │
│   │   ├── Request body: { email, password }
│   │   ├── Headers: { Content-Type: application/json }
│   │   └── Rate limit: 10 requests per 10 minutes per email
│   │
│   ├── On success (200):
│   │   ├── Response: { user: {...}, tokens: { access_token, refresh_token }, requires_mfa: bool }
│   │   ├── Store tokens in EncryptedStorage
│   │   │   ├── tokenStore.setBoth(access_token, refresh_token)
│   │   │   └── Keys: "shecare.accessToken", "shecare.refreshToken"
│   │   ├── Cache user in EncryptedStorage
│   │   │   └── Key: "shecare.user"
│   │   ├── Update Zustand store
│   │   │   └── useAuthStore.setState({ user: resp.user })
│   │   ├── Update React Query cache
│   │   │   └── queryClient.setQueryData(['auth','me'], resp.user)
│   │   │
│   │   │   └── requires_mfa = true?
│   │   │       ├── Navigate to MFA screen (not yet implemented in mobile)
│   │   │       └── else → RootNavigator re-renders with MainTabs
│   │   │
│   │   └── └── Navigation
│   │           └── RootNavigator detects user !== null
│   │               ├── Reads `user.onboarding_completed` from response (no separate API call)
│   │               ├── Also checks AsyncStorage `shecare.onboarding` state for fast path
│   │               ├── If completed → show MainTabs
│   │               └── If not completed → show OnboardingStack
│   │
│   └── On error:
│       ├── 401 → "Invalid credentials"
│       ├── 429 → "Too many attempts. Try again later."
│       ├── 422 → Validation error
│       ├── Network error → "Unable to connect. Check your internet."
│       └── Show error via Toast
│
└── Reset loading state
```

#### 5.1.2 Backend: `POST /api/v1/auth/login`

**Route:** `app/modules/auth/routes.py:85-104`

```python
@router.post("/login", response_model=LoginResponse, status_code=200)
async def login(payload: LoginCreate, svc: AuthServiceDep):
    # 1. Rate limit check: 10 req/10min per email
    await _rate_limiter().check(f"login:{payload.email}", limit=10, window_seconds=600)

    # 2. Delegate to AuthService
    user, tokens = await svc.login_with_email(
        email=payload.email,
        password=payload.password,
        device_info=payload.device_info,
    )

    # 3. Return response
    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        requires_mfa=False,
    )
```

**Service:** `app/modules/auth/services.py` — `AuthService.login_with_email()`

```python
async def login_with_email(self, email: str, password: str, device_info: dict | None = None):
    # 1. Find user by email
    normalized = email.strip().lower()
    user = await self.get_user_by_email(normalized)

    if user is None:
        raise InvalidCredentialsError("Invalid email or password")

    # 2. Provider guard: only "local" accounts can use password auth
    if user.provider != "local":
        raise InvalidCredentialsError("This account uses a different sign-in method")

    # 3. Lockout check: max 10 failed attempts
    if user.failed_login_attempts >= 10:
        raise InvalidCredentialsError("Account locked. Reset password.")

    # 4. Verify password
    if user.hashed_password is None or not verify_password(password, user.hashed_password):
        user.failed_login_attempts += 1
        await self.db.flush()
        raise InvalidCredentialsError("Invalid email or password")

    if not user.is_active:
        raise InvalidCredentialsError("Account is inactive")

    # 5. Reset failed attempts, update last_login
    user.failed_login_attempts = 0
    user.last_login_at = datetime.now(tz=UTC)

    # 6. Create JWT pair via _issue_token_pair (creates UserSession, encodes both tokens)
    tokens = await self._issue_token_pair(user, device_info=device_info)

    return user, tokens
```

#### 5.1.3 JWT Token Structure

**Access Token (15 min expiry):**
```json
{
  "sub": "uuid-user-id",
  "jti": "uuid-unique-id",
  "type": "access",
  "usk": "sha256-of-user-secret-key",
  "iat": 1700000000,
  "exp": 1700000900
}
```

**Refresh Token (30 day expiry):**
```json
{
  "sub": "uuid-user-id",
  "jti": "uuid-unique-id",
  "type": "refresh",
  "session_id": "uuid-session-id",
  "usk": "sha256-of-user-secret-key",
  "iat": 1700000000,
  "exp": 1702592000
}
```

**Security features:**
- `usk` (user_secret_key hash) acts as a kill-switch — password rotation changes `usk`, instantly invalidating all prior tokens
- `jti` (JWT ID) enables per-token revocation
- Refresh token rotation with replay detection — using an old refresh token revokes the entire session family

#### 5.1.4 API Response Example

```json
// POST /api/v1/auth/login
// Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

// Response 200:
{
  "data": {
    "user": {
      "id": "e860cea6-9609-4f05-9cdd-266b30aeeafc",
      "email": "user@example.com",
      "phone_number": null,
      "display_name": "User",
      "role": "user",
      "is_verified": true,
      "onboarding_completed": true,
      "created_at": "2026-01-15T10:30:00Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
    },
    "requires_mfa": false
  },
  "message": "ok"
}

// Response 401:
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "details": "Invalid email or password"
  }
}

// Response 429:
{
  "error": {
    "code": "RATE_LIMITED",
    "details": "Too many attempts. Try again later."
  }
}
```

### 5.2 Register

#### 5.2.1 Screen: `RegisterScreen.tsx`

**Purpose:** Create a new user account.

**UI Components:**
- `DecorativeHeader` — same gradient SVG + wave + brand icon as LoginScreen
- `View` card (surface background, border radius, shadow) overlapping the header
- `Text` "Create account" heading + "Join SheCare and take control of your health."
- `FormField` — Display name (optional, autoCapitalize: words)
- `FormField` — Email (keyboardType: email-address, autoCapitalize: none)
- `FormField` — Password (secureTextEntry, hint text)
- `PasswordStrengthIndicator` — live 3-bar indicator: 8+ chars, 1+ number, 1+ special char
- `Button` — "Create account" (primary, full width, loading state)
- Error box shown on conflict ("Could not create account. The email may already be registered.")
- Divider ("or") with horizontal lines
- `Text` + link → "Already have an account? Sign in" → navigates to LoginScreen

**Validation (zod schema):**
```typescript
const registerFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .max(128)
    .regex(/[0-9]/, 'At least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=~`\[\];']/, 'At least one special character'),
  display_name: z.string().min(1, 'Required').max(100).optional(),
});
```

**User Actions:**

```
User taps "Create account"
│
├── Validate form (zod — password must have 8+ chars, 1 number, 1 special char)
│
├── Call useRegister().mutateAsync({ email, password, display_name })
│   └── authService.register() → POST /api/v1/auth/register
│       ├── Body: { email, password, display_name }
│       ├── Success 201:
│       │   ├── Response: { user: {...}, tokens: {...}, requires_mfa: false }
│       │   ├── Store tokens in EncryptedStorage
│       │   ├── Cache user in EncryptedStorage
│       │   ├── Set Zustand user
│       │   ├── RootNavigator detects user → checks onboarding_completed → show OnboardingStack
│       └── Error:
│           ├── 409 → "Account with this email already exists"
│           └── 422 → Validation error
```

#### 5.2.2 Backend: `POST /api/v1/auth/register`

```python
@router.post("/register", response_model=LoginResponse, status_code=201)
async def register(payload: RegisterCreate, svc: AuthServiceDep):
    user, tokens = await svc.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        requires_mfa=False,
    )
```

**Service logic (`AuthService.register()`):**

```
register()
│
├── Normalize email (strip, lowercase)
│
├── Check email uniqueness
│   └── Existing → raise ConflictError("An account with this email already exists")
│
├── Hash password (bcrypt directly, no passlib)
│   └── hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
│
├── Generate user_secret_key (SHA-256 hash embedded in JWTs as kill-switch)
│   └── usk = secrets.token_hex(32)
│
├── Create User record
│   ├── id = uuid4()
│   ├── email = normalized
│   ├── display_name = payload.display_name
│   ├── hashed_password = hashed
│   ├── user_secret_key = usk
│   ├── provider = "local"
│   ├── role = "user"
│   ├── is_verified = false
│   └── encryption_key_salt = make_user_salt()
│
├── Create initial session + JWT pair via _issue_token_pair()
│
└── Commit transaction
    └── Return User + TokenPair (no event emitted during registration)
```

### 5.3 OTP Flow

Two screens: **PhoneScreen** (enter number) → **OtpScreen** (enter code).

#### 5.3.1 Screen: `PhoneScreen.tsx`

**Purpose:** Enter E.164 phone number to receive an OTP code via SMS.

**UI Components:**
- `SafeAreaView` with background color, `KeyboardAvoidingWrapper`
- `Text` — "Welcome to SheCare" heading
- `Text` — "Enter your phone number to receive a one-time code."
- `FormField` — Phone input (keyboardType: phone-pad, autoComplete: tel, E.164 hint)
- `Button` — "Send code" (loading state from useRequestOtp)
- Error text shown on API failure

**Validation (zod):**
```typescript
const requestOtpFormSchema = z.object({
  phone: z.string()
    .min(8, 'Phone number is too short')
    .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format, e.g. +14155552671'),
});
```

**User Actions:**

```
User enters E.164 phone, taps "Send code"
│
├── Validate phone format (E.164 regex)
├── Call useRequestOtp().mutateAsync(phone)
│   └── authService.requestOtp() → POST /api/v1/auth/otp/request
│       ├── Body: { phone: "+14155552671" }
│       ├── Rate limit: 5 req/10min per phone
│       ├── Success 202:
│       │   ├── Response: { expires_in: 300, dev_code: "123456" }
│       │   └── Navigate to OtpScreen with { phone, expiresIn, devCode }
│       └── Error:
│           ├── 429 → "Too many OTP requests"
│           └── Network → "Unable to send OTP"
```

#### 5.3.2 Screen: `OtpScreen.tsx`

**Purpose:** Verify the 6-digit OTP code sent via SMS.

**UI Components:**
- `SafeAreaView`, `KeyboardAvoidingWrapper`
- `Text` — "Enter the code" heading
- `Text` — "We sent a 6-digit code to {phone}. It expires in {secondsLeft}s."
- Dev mode banner (visible only in dev/test) showing the OTP code
- `FormField` — OTP input (keyboardType: number-pad, maxLength: 6, autoComplete: one-time-code)
- `Button` — "Verify" (disabled until 4+ digits entered, loading state)
- `Button` — "Resend code in {secondsLeft}s" / "Resend code" (outline, disabled during countdown)
- Error text shown on verification failure

**Validation (zod):**
```typescript
const verifyOtpFormSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().regex(/^\d{4,8}$/, 'OTP must be 4-8 digits'),
});
```

**User Actions:**

```
User enters 6-digit OTP, taps "Verify"
│
├── Call useVerifyOtp().mutateAsync({ phone, otp })
│   └── authService.verifyOtp() → POST /api/v1/auth/otp/verify
│       ├── Body: { phone, otp }
│       ├── Success:
│       │   ├── Tokens stored, user cached
│       │   ├── requires_mfa? → MFA challenge (not yet implemented in mobile)
│       │   └── user set in authStore → RootNavigator shows MainTabs/OnboardingStack
│       └── Error:
│           ├── 400 → "OTP does not match" / "OTP expired"
│           └── 429 → Rate limited
│
├── User taps "Resend code"
│   └── navigate.replace('Phone') to restart the flow
```

#### 5.3.3 Backend OTP Flow

**`POST /api/v1/auth/otp/request`:**
```
request_otp(phone)
│
├── Rate limit: 5 requests / 10 minutes
├── Generate 6-digit numeric code (or return fixed `dev_code` in development)
├── Hash + salt the OTP code before storing
│   └── OTPAttempt.create(phone_hash, code_hash, expires_at)
├── Send via Twilio Verify API
│   └── twilio_client.verification_checks.create(to=phone, code=otp)
├── Return expires_in + dev_code (dev only)
```

**`POST /api/v1/auth/otp/verify`:**
```
verify_otp(phone, otp)
│
├── Find OTPAttempt by phone_hash
├── Verify not expired
├── Verify OTP hash matches
├── Find or create User by phone
├── Mark OTP consumed
├── Create session + token pair
├── Return user + tokens
```

### 5.4 Refresh Token

#### 5.4.1 Client-Side (`client.ts`)

The Axios response interceptor handles 401 errors:

```
401 Response Received
│
├── Check if detail is "Session expired" or "Session compromised"
│   ├── Yes → triggerSessionExpired()
│   │   ├── useAuthStore.getState().reset()
│   │   ├── Navigate to Auth stack
│   │   └── Show Toast "Session Expired"
│   └── No → proceed to refresh
│
├── Check if request already retried (_retry flag)
│   ├── Yes → reject (prevent infinite loop)
│   └── No → proceed
│
├── Call refreshAccessToken()
│   │
│   ├── Single-flight lock (refreshInFlight promise)
│   │   └── Prevents parallel refresh requests (stampede protection)
│   │
│   ├── Read refresh token from EncryptedStorage
│   │
│   ├── POST /api/v1/auth/refresh
│   │   └── Body: { refresh_token }
│   │
│   ├── Success:
│   │   ├── Extract new access_token + refresh_token
│   │   ├── Store via tokenStore.setBoth()
│   │   ├── Return new access_token
│   │
│   └── Failure:
│       ├── Clear tokens via tokenStore.clear()
│       ├── Return null
│       └── Next request will fail → triggerSessionExpired
│
├── New token obtained?
│   ├── Yes → retry original request with new Authorization header
│   └── No → reject original request
```

#### 5.4.2 Backend: `POST /api/v1/auth/refresh`

```python
async def rotate_refresh_token(self, refresh_token: str, device_info: dict | None):
    # 1. Decode refresh token
    claims = decode_token(refresh_token, secret=settings.refresh_secret_key, expected_type="refresh")

    # 2. Find session
    session = await self.db.execute(
        select(UserSession).where(UserSession.refresh_jti == claims["jti"])
    )
    session = session.scalar_one_or_none()

    # 3. Replay detection
    if session is None or session.revoked_at is not None:
        # Token reuse — revoke entire session family
        await self._revoke_session_family(claims["session_id"])
        raise SessionCompromisedError("Session compromised. All sessions revoked.")

    # 4. Validate not expired
    if session.expires_at < datetime.now(tz=UTC):
        raise SessionExpiredError("Session expired. Please log in again.")

    # 5. Validate USK (user secret key hash matches)
    user = await self.db.get(User, uuid.UUID(claims["sub"]))
    if not user or sha256(user.user_secret_key) != claims["usk"]:
        raise SessionCompromisedError("Session compromised.")

    # 6. Rotate: revoke old session, create new one
    session.revoke()
    new_session = UserSession(
        user_id=user.id,
        refresh_token_hash=...,
        refresh_jti=new_jti,
        expires_at=...,
        device_info=device_info or {},
    )
    self.db.add(new_session)

    # 7. Create new tokens
    access_token = self._create_access_token(user)
    refresh_token = self._create_refresh_token(user, new_session)

    await self.db.commit()

    return TokenPair(access_token=access_token, refresh_token=refresh_token)
```

### 5.5 Logout

#### 5.5.1 Client-Side (`authService.logout()`)

```
logout()
│
├── Call POST /api/v1/auth/logout (best-effort)
│   └── Body: { all_devices: bool }
│
├── Finally block (even if API fails):
│   ├── tokenStore.clear()
│   │   ├── Remove "shecare.accessToken"
│   │   └── Remove "shecare.refreshToken"
│   └── Remove cached user "shecare.user"
│
├── useAuthStore.reset()
│   ├── set user = null
│   ├── clear tokens
│
├── React Query: queryClient.clear()
│
├── Toast: "Logged out successfully"
│
└── Navigation: Auth Stack
```

#### 5.5.2 Screen: `ProfileHomeScreen.tsx`

The logout button is a red "danger" variant at the bottom of the profile screen:

```
User taps "Logout"
│
├── Show confirmation dialog
│   ├── Web: window.confirm("Are you sure?")
│   └── Native: Alert.alert("Logout", "Are you sure?", [Cancel, Logout])
│
├── Confirmed?
│   ├── Yes → Call useLogout().mutateAsync()
│   │   └── authService.logout() → described above
│   └── No → do nothing
```

### 5.6 Session Expiry

The app handles two types of session expiry:

| Type | Server Message | Client Action |
|------|---------------|---------------|
| Normal expiry | JWT expired | 401 → auto-refresh → retry |
| Kill-switch | "Session expired. Please log in again." | Clear all state, navigate to Auth |
| Replay detection | "Session compromised. All sessions revoked." | Clear all state, navigate to Auth |

The kill-switch is triggered by:
- Password change (rotates `user_secret_key`)
- Manual session revocation (admin or user)
- Refresh token reuse detection

### 5.7 Password Management

#### 5.7.1 Set Password: `POST /api/v1/auth/password`

Used during onboarding or first-time setup:

```
Request: { "new_password": "..." }
Headers: Authorization: Bearer <access_token>
Response: 204 No Content
```

#### 5.7.2 Change Password: `POST /api/v1/auth/password/change`

```
Request: { "old_password": "...", "new_password": "..." }
Headers: Authorization: Bearer <access_token>

Service:
├── Verify old_password matches current hash
├── Hash new password
├── Rotate user_secret_key (invalidates ALL existing tokens)
├── Revoke ALL sessions (user must login on all devices)
├── Commit
└── Return 204
```

### 5.8 MFA (TOTP) Flow

Three endpoints for optional TOTP multi-factor authentication:

#### 5.8.1 Enable MFA: `POST /api/v1/auth/mfa/enable`

Generates a new TOTP secret and returns the provisioning URI (for QR code) and the raw secret (for manual entry). Does NOT flip `mfa_enabled` — user must complete verify-setup first.

```
Auth required: Bearer <access_token>
Response 200: { "secret": "JBSWY3DPEHPK3PXP", "otpauth_uri": "otpauth://totp/SheCare:+14155552671?secret=..." }
```

Secret is stored encrypted via per-user `encryption_key_salt` (Fernet + PBKDF2).

#### 5.8.2 Verify MFA Setup: `POST /api/v1/auth/mfa/verify-setup`

Confirm a fresh TOTP code from the authenticator app. On success `mfa_enabled` flips to `true`.

```
Request:  { "code": "123456" }
Auth required: Bearer <access_token>
Response 200: { "enabled": true }
Error 400:   { "code": "MFA_INVALID", "details": "Code did not match" }
```

#### 5.8.3 MFA Login: `POST /api/v1/auth/mfa/login`

When the user has MFA enabled, login/OTP flows return `requires_mfa: true` plus a short-lived "challenge" access token. The client presents that token + TOTP code here to get a real token pair.

```
Request:  { "mfa_token": "<challenge_access_token>", "code": "123456", "device_info": {...} }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer", "expires_in": 900 }
Error 400: { "code": "MFA_INVALID", "details": "MFA code did not match" }
```

### 5.9 Phone + Password Login

An alternative to OTP: users who set a password on their phone-based account can login with `POST /api/v1/auth/login/phone`.

```
Request:  { "phone": "+14155552671", "password": "securePassword123", "device_info": {...} }
Rate limit: 10 req/10min per phone
Response: LoginResponse (same shape as email login, including requires_mfa)
```

Backend validates provider guard, checks `failed_login_attempts >= 10` lockout, verifies bcrypt hash, then issues token pair via `_issue_token_pair`.

### 5.10 Device Registration

Used by the Safety module for push notifications (FCM).

**`POST /api/v1/auth/device/register`**

```
Auth required: Bearer <access_token>
Request:  { "fcm_token": "fcm-abc123...", "platform": "ios" | "android", "device_info": {...} }
Response 201: { "message": "Device registered", "fcm_token_prefix": "fcm-abc123..." }
```

Stores the FCM token in the user's `fcm_tokens` JSONB array (deduplicates on re-registration).

### 5.11 Session Management

**`GET /api/v1/auth/sessions`** — List active sessions

```json
// Response:
[
  {
    "id": "uuid",
    "device_info": { "os": "iOS 17", "model": "iPhone 15" },
    "last_used_at": "2026-07-10T12:00:00Z",
    "expires_at": "2026-08-09T12:00:00Z"
  }
]
```

**`DELETE /api/v1/auth/sessions/{id}`** — Revoke specific session

---

## 6. Onboarding Form

### 6.1 Flow Overview

```
OnboardingStack
│
├── WelcomeScreen
│   ├── "Welcome to SheCare" / "Your personal wellness companion"
│   ├── SVG FlowerIcon (no Lottie — gradient background with wave)
│   ├── ProgressDots (0/6)
│   ├── Privacy footer: "Your data is encrypted end-to-end..."
│   ├── "Get started" button
│   └── → navigates to PersonalInfoScreen
│
├── PersonalInfoScreen
│   ├── ProgressDots (1/6), ← Back → goBack()
│   ├── Age (TextInput, numeric, min 13 / max 120)
│   ├── Height (PickerField dropdown: 50-250 cm)
│   ├── Weight (PickerField dropdown: 20-300 kg)
│   ├── ScreenErrorBoundary wrapper
│   ├── "Continue" button (disabled until valid)
│   └── → setPersonalInfo(store) → navigates to LifestyleScreen
│
├── LifestyleScreen
│   ├── ProgressDots (2/6), ← Back → goBack()
│   ├── Stress Level (ToggleGroup: Low / Moderate / High — values: low/moderate/high)
│   ├── Exercise Frequency (ToggleGroup: Light / Moderate / Heavy — values: low/moderate/high)
│   ├── Sleep Hours (Slider: 4-12, step 0.5, live label)
│   ├── Diet (ToggleGroup: Balanced / Normal / Junk — values: balanced/normal/junk, required)
│   ├── "Continue" button (disabled until valid)
│   └── → setLifestyle(store) → navigates to CurrentCycleScreen
│
├── CurrentCycleScreen
│   ├── ProgressDots (3/6), ← Back → goBack()
│   ├── Period start date (DatePickerField, max: today)
│   ├── Cycle length (TextInput numeric: 20-45 days)
│   ├── Period length (TextInput numeric: 2-10 days)
│   ├── Symptoms (chip toggle grid: Cramps, Bloating, Headache, Fatigue, Acne, Mood swings, Back pain, Nausea, Breast tenderness, Insomnia)
│   ├── "Continue" button (disabled until valid)
│   └── → setCurrentCycle(store) → navigates to PastCycle1
│
├── PastCycle1 (reusable PastCycleScreen, determined by route name)
│   ├── ProgressDots (4/6), ← Back → CurrentCycle
│   ├── Start date (DatePickerField, max: today)
│   ├── Cycle length (TextInput numeric: 20-45) — includes cycle_length
│   ├── Period length (TextInput numeric: 2-10)
│   ├── Symptoms (chip toggle grid, same 10 options)
│   ├── "Continue" button (label changes to "Complete" on PastCycle3)
│   └── → addPastCycle(store) → navigates to PastCycle2
│
├── PastCycle2 (same PastCycleScreen, ProgressDots 5/6, ← Back → PastCycle1)
│   └── → navigates to PastCycle3
│
├── PastCycle3 (same PastCycleScreen, ProgressDots 6/6, ← Back → PastCycle2)
│   └── → navigates to CompleteScreen (button label: "Complete")
│
└── CompleteScreen
    ├── ProgressDots (6/6), backgroundColor: primary500
    ├── CelebrationAnimation component
    ├── "You're all set!" title
    ├── "Your dashboard is ready. We've backfilled your cycle history..."
    ├── Footer with rounded top corners (surface background)
    ├── "Go to Dashboard" button
    └── → Calls submitOnboarding() from store → RootNavigator switches to MainTabs
```

### 6.2 Data Accumulation

Onboarding data is accumulated through the screens. Each screen stores data locally (not yet sent to backend):

The **Zustand store** (`onboardingStore.ts`) holds all onboarding state in-memory and persists `isCompleted` to AsyncStorage (key: `shecare.onboarding`). Each screen writes fields to the store via discrete actions, then the **`submitOnboarding()`** function (exported from the same module) maps store fields to the API schema and calls `onboardingService.upsert()`.

```typescript
// Store state (camelCase — mapped to snake_case on submit):
interface OnboardingState {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;

  stressLevel: 'low' | 'moderate' | 'high' | null;
  exerciseFrequency: 'low' | 'moderate' | 'high' | null;
  sleepHours: number | null;
  diet: 'balanced' | 'normal' | 'junk' | null;

  currentCycleStart: string | null;     // ISO date
  currentCycleLength: number | null;
  currentPeriodLength: number | null;
  currentSymptoms: string[];

  pastCycles: PastCycle[];
  isSubmitting: boolean;
  isCompleted: boolean;
}

interface PastCycle {
  cycle_start: string;     // ISO date
  cycle_length: number;    // 20-45 days (included in store)
  period_length: number;   // 2-10 days
  symptoms: string[];
}
```

### 6.3 Data Submission (CompleteScreen)

```
User taps "Go to Dashboard"
│
├── Set loading state
│
├── Call PUT /api/v1/onboarding
│   ├── Body: Full OnboardingCreate payload
│   │   {
│   │     "age": 28,
│   │     "height_cm": 165,
│   │     "weight_kg": 60,
│   │     "stress_level": "moderate",
│   │     "exercise_frequency": "moderate",
│   │     "sleep_hours": 7,
│   │     "diet": "balanced",
│   │     "current_cycle_start": "2026-06-28",
│   │     "current_cycle_length": 28,
│   │     "current_period_length": 5,
│   │     "current_symptoms": ["Cramps", "Bloating"],
│   │     "past_cycles": [
│   │       { "cycle_start": "2026-05-31", "cycle_length": 28, "period_length": 5, "symptoms": [] },
│   │       { "cycle_start": "2026-05-03", "cycle_length": 28, "period_length": 4, "symptoms": ["Cramps"] }
│   │     ]
│   │   }
│   └── Headers: Authorization: Bearer <token>
│
├── On success (200):
│   ├── Response: OnboardingResponse with onboarding_completed=true
│   ├── RootNavigator re-evaluates:
│   │   ├── user !== null → onboarding checked → completed → MainTabs
│   └── Optional: show success animation before navigation
│
├── On network error:
│   ├── Store onboarding data locally (EncryptedStorage)
│   ├── Queue for sync (sync engine)
│   ├── Show "Data saved locally. Will sync when online."
│   └── Navigate to MainTabs anyway (optimistic)
│
└── On validation error (422):
    ├── Backend rejected payload
    └── Show error, allow retry
```

### 6.4 Backend: `PUT /api/v1/onboarding`

```python
async def create_or_update(self, user_id: uuid.UUID, data: OnboardingCreate) -> UserOnboarding:
    """
    Upsert onboarding data. On first completion triggers backfill + event.
    """

    # 1. Find or create Onboarding record
    stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
    onboarding = (await self.db.execute(stmt)).scalar_one_or_none()

    was_already_completed = onboarding is not None and onboarding.onboarding_completed

    if onboarding is None:
        onboarding = UserOnboarding(user_id=user_id)
        self.db.add(onboarding)

    # 2. Update fields
    onboarding.age = data.age
    onboarding.height_cm = data.height_cm
    onboarding.weight_kg = data.weight_kg
    onboarding.stress_level = data.stress_level
    onboarding.exercise_frequency = data.exercise_frequency
    onboarding.sleep_hours = data.sleep_hours
    onboarding.diet = data.diet
    onboarding.current_cycle_start = data.current_cycle_start
    onboarding.current_cycle_length = data.current_cycle_length
    onboarding.current_period_length = data.current_period_length
    onboarding.current_symptoms = data.current_symptoms
    onboarding.past_cycles = [p.model_dump(mode="json") for p in data.past_cycles]

    # 3. Mark completed (first time only)
    if not was_already_completed:
        onboarding.onboarding_completed = True
        onboarding.completed_at = datetime.now(tz=UTC)

    await self.db.flush()

    # 4. Backfill cycle entries (idempotent)
    if not was_already_completed:
        await self._backfill_cycles(user_id, data)

    await self.db.commit()
    await self.db.refresh(onboarding)

    # 5. Emit event for cross-module subscribers
    if not was_already_completed and self.event_bus:
        await self.event_bus.emit("onboarding_completed", user_id=str(user_id))

    return onboarding
```

### 6.5 Cycle Backfill Logic

The backfill inserts the current and past cycles into the `cycle_entries` table:

```python
async def _backfill_cycles(self, user_id: uuid.UUID, data: OnboardingCreate) -> None:
    """
    Insert current and past cycles into cycle_entries.
    Idempotent: skips existing (user_id, period_start_date) pairs.
    """

    all_cycles = []

    # Current cycle
    current_end = data.current_cycle_start + timedelta(days=data.current_period_length)
    all_cycles.append({
        "period_start_date": data.current_cycle_start,
        "period_end_date": current_end,
        "symptoms": data.current_symptoms,
        "flow_intensity": None,
        "mood_tags": [],
        "energy_level": None,
        "notes": None,
    })

    # Past cycles (sorted newest-first)
    sorted_past = sorted(data.past_cycles, key=lambda p: p.cycle_start, reverse=True)
    for past in sorted_past:
        past_end = past.cycle_start + timedelta(days=past.period_length)
        all_cycles.append({
            "period_start_date": past.cycle_start,
            "period_end_date": past_end,
            "symptoms": past.symptoms,
            "flow_intensity": None,
            "mood_tags": [],
            "energy_level": None,
            "notes": None,
        })

    # Insert, skipping duplicates (idempotent)
    for cycle in all_cycles:
        exists = await self._cycle_exists(user_id, cycle["period_start_date"])
        if exists:
            continue
        self.db.add(CycleEntry(
            user_id=user_id,
            period_start_date=cycle["period_start_date"],
            period_end_date=cycle["period_end_date"],
            symptoms=cycle["symptoms"],
            flow_intensity=cycle.get("flow_intensity"),
            mood_tags=cycle.get("mood_tags", []),
            energy_level=cycle.get("energy_level"),
            notes=cycle.get("notes"),
        ))
```

### 6.6 Event-Driven Initial Prediction

When `onboarding_completed` is emitted, the cycle module's subscriber computes the first prediction:

```python
# In app/modules/cycle/routes.py (init_module):
event_bus.subscribe_sync("onboarding_completed", _on_onboarding_completed)

async def _on_onboarding_completed(user_id: str):
    # Compute initial prediction directly (no Celery task)
    import uuid
    from app.core.database import AsyncSessionLocal
    from app.modules.cycle.services import CycleService
    async with AsyncSessionLocal() as session:
        svc = CycleService(session)
        try:
            await svc.compute_initial_prediction(uuid.UUID(user_id))
        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                "cycle.initial_prediction_failed",
                extra={"user_id": user_id},
            )
```

---

## 7. Backend Processing

### 7.1 Onboarding Status Check

**`GET /api/v1/onboarding/status`**

```python
async def get_status(self, user_id: uuid.UUID) -> bool:
    stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
    onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
    if onboarding is None:
        return False
    return onboarding.onboarding_completed
```

**Response:**
```json
// 200
{ "data": { "completed": true }, "message": "ok" }

// or
{ "data": { "completed": false }, "message": "ok" }
```

### 7.2 BMI Calculation

BMI is calculated by the frontend during PersonalInfo submission:

```typescript
function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
```

The backend stores height_cm and weight_kg but does NOT re-calculate BMI (stored as a virtual field if needed).

### 7.3 Onboarding Request/Response Schema

**Request schema (`OnboardingCreate`):**
```python
class OnboardingCreate(BaseModel):
    age: int = Field(ge=13, le=120)                           # Age 13-120
    height_cm: float = Field(ge=50, le=250)                  # Height 50-250cm
    weight_kg: float = Field(ge=20, le=300)                   # Weight 20-300kg
    stress_level: str = Field(pattern=r"^(low|moderate|high)$")
    exercise_frequency: str = Field(pattern=r"^(low|moderate|high)$")
    sleep_hours: float = Field(ge=0, le=24)                   # 0-24 hours
    diet: str = Field(pattern=r"^(balanced|normal|junk)$")    # required
    current_cycle_start: date                                 # ISO date; validated <= today
    current_cycle_length: int = Field(ge=20, le=45)          # 20-45 days
    current_period_length: int = Field(ge=2, le=10)          # 2-10 days
    current_symptoms: list[str] = Field(default_factory=list)
    past_cycles: list[PastCycleSchema] = Field(default_factory=list, max_length=3)

class PastCycleSchema(BaseModel):
    cycle_start: date                                         # validated < today
    cycle_length: int = Field(ge=20, le=45)                  # included in schema
    period_length: int = Field(ge=2, le=10)
    symptoms: list[str] = Field(default_factory=list)
```

**Response schema (`OnboardingResponse`):**
```python
class OnboardingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    age: int | None                      # nullable until first submission
    height_cm: float | None
    weight_kg: float | None
    stress_level: str | None
    exercise_frequency: str | None
    sleep_hours: float | None
    diet: str | None
    current_cycle_start: date | None
    current_cycle_length: int | None
    current_period_length: int | None
    current_symptoms: list[str]
    past_cycles: list                     # JSONB, raw list
    onboarding_completed: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
```

### 7.4 Error Handling

| Scenario | HTTP Code | Error Code | Handling |
|----------|-----------|------------|----------|
| Invalid field values | 422 | VALIDATION_ERROR | Zod/Pydantic validation |
| Missing required fields | 422 | VALIDATION_ERROR | Field-level errors |
| Age < 13 | 422 | VALIDATION_ERROR | "Must be at least 13" |
| Height out of range | 422 | VALIDATION_ERROR | "Height must be 50-250cm" |
| Cycle length out of range | 422 | VALIDATION_ERROR | "Cycle length must be 20-45 days" |
| Unauthenticated | 401 | UNAUTHORIZED | "Not authenticated" |
| Internal error | 500 | INTERNAL_ERROR | Logged, generic message |

---

## 8. Database Schema

### 8.1 Users Table

```sql
-- app/modules/auth/models.py
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE,
    phone_number        VARCHAR(20) UNIQUE,
    display_name        VARCHAR(255),
    profile_pic_url     TEXT,
    date_of_birth       DATE,
    blood_group         VARCHAR(5),
    medical_notes       TEXT,
    role                VARCHAR(20) NOT NULL DEFAULT 'user',
    user_secret_key     VARCHAR(64) NOT NULL DEFAULT '',  -- Token kill-switch
    provider            VARCHAR(20) NOT NULL DEFAULT 'local',  -- 'local', 'phone', 'google'
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret          VARCHAR(255),               -- encrypted TOTP secret
    encryption_key_salt VARCHAR(255),               -- Per-user encryption salt
    fcm_tokens          JSONB DEFAULT '[]'::jsonb,  -- Push notification tokens
    hashed_password     VARCHAR(255),

    -- ML metrics
    avg_cycle_length       REAL,
    cycle_length_std_dev   REAL,
    avg_prediction_error_days REAL,
    total_cycles_logged    INTEGER NOT NULL DEFAULT 0,
    is_dirty_for_retraining BOOLEAN NOT NULL DEFAULT FALSE,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE is_active = TRUE;
CREATE INDEX idx_users_phone ON users(phone_number) WHERE is_active = TRUE;
```

### 8.2 User Sessions Table

```sql
-- app/modules/auth/models.py
CREATE TABLE user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    refresh_token_hash  VARCHAR(255) NOT NULL,  -- SHA-256 of refresh JTI
    refresh_jti         UUID NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    ip_address          VARCHAR(45),
    device_info         JSONB DEFAULT '{}'::jsonb,
    last_used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at          TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, is_active);
CREATE INDEX idx_sessions_jti ON user_sessions(refresh_jti);
```

### 8.3 OTP Attempts Table

```sql
-- app/modules/auth/models.py
CREATE TABLE otp_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_hash      VARCHAR(64) NOT NULL,
    code_hash       VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed        BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_attempts(phone_hash);
```

### 8.4 User Onboarding Table

```sql
-- app/modules/onboarding/models.py
CREATE TABLE user_onboarding (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id),

    -- Personal info
    age                     INTEGER,
    height_cm               REAL,
    weight_kg               REAL,

    -- Lifestyle
    stress_level            VARCHAR(10),       -- 'low' | 'moderate' | 'high'
    exercise_frequency      VARCHAR(10),       -- 'low' | 'moderate' | 'high'
    sleep_hours             REAL,
    diet                    VARCHAR(50),       -- 'balanced' | 'normal' | 'junk'

    -- Cycle info
    current_cycle_start     DATE,
    current_cycle_length    INTEGER,
    current_period_length   INTEGER,
    current_symptoms        JSONB DEFAULT '[]'::jsonb,
    past_cycles             JSONB DEFAULT '[]'::jsonb,

    -- Status
    onboarding_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at            TIMESTAMPTZ,

    -- Sync fields
    client_updated_at       TIMESTAMPTZ,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_user ON user_onboarding(user_id);
```

### 8.5 User Consents Table

```sql
-- app/modules/users/models.py
CREATE TABLE user_consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    consent_type    VARCHAR(50) NOT NULL,  -- 'terms', 'privacy', 'marketing'
    version         VARCHAR(20) NOT NULL,
    granted         BOOLEAN NOT NULL,
    ip_hash         VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consents_user ON user_consents(user_id, consent_type);
```

### 8.6 Audit Logs Table

```sql
-- app/modules/users/models.py
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,   -- 'register', 'login', 'logout', 'onboarding_complete', etc.
    resource        VARCHAR(50),
    resource_id     VARCHAR(50),
    ip_hash         VARCHAR(64),
    payload         JSONB DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, occurred_at);
CREATE INDEX idx_audit_action ON audit_logs(action, occurred_at);
```

### 8.7 Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐
│    users    │1──────│  user_sessions   │
│             │       │                  │
│ id (PK)     │       │ id (PK)          │
│ email       │       │ user_id (FK)     │
│ password    │       │ refresh_jti      │
│ usk         │       │ expires_at       │
│ role        │       │ revoked_at       │
│ mfa_enabled │       │ device_info      │
│ fcm_tokens  │       └──────────────────┘
│ avg_cycle   │
└──────┬──────┘
       │ 1
       │
       ├───────────────────┐
       │ 1                 │ 1
┌──────▼──────┐   ┌───────▼────────┐
│otp_attempts │   │user_onboarding │
│             │   │                │
│ phone_hash  │   │ age            │
│ code_hash   │   │ height/weight  │
│ expires_at  │   │ stress/exercise│
└─────────────┘   │ cycle info     │
                  │ past_cycles [] │
                  │ completed(bool)│
                  └────────────────┘
       │ 1
       │
┌──────▼──────┐
│user_consents│
│             │
│ consent_type│
│ version     │
│ granted     │
└─────────────┘
```

---

## 9. Offline Architecture

### 9.1 Offline-First Principle

SheCare follows an offline-first architecture:

1. **Local-first:** All critical data is stored locally before being sent to the server
2. **Optimistic UI:** The UI updates immediately without waiting for server confirmation
3. **Background sync:** Data syncs in the background when connectivity is available
4. **Conflict resolution:** Last-write-wins with client_updated_at timestamps

### 9.2 Local Storage Layers

```
┌──────────────────────────────────────────────┐
│              Application Layer               │
├──────────────────────────────────────────────┤
│  Zustand Store (in-memory)                   │
│  - Current user object                       │
│  - Auth state (isHydrated)                   │
│  - Feature flags                             │
├──────────────────────────────────────────────┤
│  TanStack Query Cache (in-memory)            │
│  - API response cache                        │
│  - Stale-while-revalidate                    │
│  - placeholderData from SQLite               │
├──────────────────────────────────────────────┤
│  SQLite Local DB (Drizzle ORM)               │
│  - 18 tables mirroring server schema         │
│  - CRUD via BaseLocalService subclasses       │
│  - placeholderData reads for instant UI      │
│  - write-through on mutation onSuccess       │
│  - Offline-first data store                  │
├──────────────────────────────────────────────┤
│  EncryptedStorage (react-native-encrypted)   │
│  - Auth tokens                               │
│  - Cached user profile                       │
│  - Encryption keys                           │
├──────────────────────────────────────────────┤
│  AsyncStorage                                │
│  - Offline action queue                      │
│  - Non-sensitive preferences                 │
│  - Push notification state                   │
│  - Zustand persist (non-sensitive only)      │
└──────────────────────────────────────────────┘
```

### 9.3 Offline Action Queue

When offline, mutations are queued for later sync. Local data is immediately written to SQLite:

```typescript
interface OfflineAction {
  id: string;
  type: 'ONBOARDING_SUBMIT' | 'CYCLE_ENTRY' | 'MOOD_LOG' | 'JOURNAL_ENTRY';
  payload: unknown;
  createdAt: string;
  retryCount: number;
}

// Local write happens immediately:
await localDb.cycle.upsert(entry);  // ← SQLite write-through
offlineStore.enqueue({ type: 'CYCLE_ENTRY', payload: entry, ... });  // ← Queue for sync
```

The sync engine processes the queue when connectivity resumes:

```
Connection restored
│
├── Process queue in FIFO order
├── For each action:
│   ├── Send API request
│   ├── Success → hydrate server response into SQLite, remove from queue
│   ├── 409 Conflict → hydrate server data into SQLite (LWW)
│   └── Network error → keep in queue, retry later (exponential backoff)
│
├── After all actions processed:
│   ├── Pull server changes since last sync
│   │   └── GET /api/v1/sync/changes?since=<timestamp>
│   ├── Hydrate changes into SQLite via syncHydrate.ts
│   └── Invalidate TanStack Query cache
```

### 9.4 Onboarding Offline Flow

```
User completes onboarding (no internet)
│
├── Save onboarding data to localDb (SQLite write)
│   └── localDb.profile.upsert(onboardingData)
│
├── Queue for sync:
│   { type: 'ONBOARDING_SUBMIT', payload: onboardingData }
│
├── Show success screen
├── Navigate to MainTabs (optimistic)
│
├── Background sync detects connectivity
│
├── Sync engine picks up pending onboarding
│
├── PUT /api/v1/onboarding
│   ├── Success → hydrate server response into SQLite, remove from queue
│   └── Failure → retry with backoff
│
└── After successful sync:
    ├── Backend creates cycle entries
    ├── Initial prediction computed
    ├── Pull sync hydrates new prediction + cycles into SQLite
    └── Next time app hydrates → onboarding status = true (from SQLite or API)
```

---

## 10. Synchronization

### 10.1 Sync Endpoints

```typescript
// POST /api/v1/sync/batch
// Push offline operations to server
interface SyncBatchRequest {
  operations: Array<{
    type: string;        // 'upsert' | 'delete'
    table: string;       // 'cycle_entries' | 'mood_logs' | 'journal_entries'
    record_id: string;
    data: Record<string, unknown>;
    client_updated_at: string;  // ISO timestamp for conflict resolution
  }>;
}

interface SyncBatchResponse {
  results: Array<{
    record_id: string;
    status: 'accepted' | 'conflict' | 'error';
    server_updated_at: string;
  }>;
}

// GET /api/v1/sync/changes
// Pull server changes since last sync
// Query params: since=<ISO timestamp>
// Response: { changes: [...], server_time: "..." }
```

### 10.2 Conflict Resolution

Conflicts are resolved using **last-write-wins** based on `client_updated_at` and `updated_at` timestamps:

```python
# Backend sync service
async def apply_operation(self, operation):
    existing = await self.get_record(operation.table, operation.record_id)
    if existing is None:
        # New record — accept
        await self.create_record(operation.table, operation.data)
        return "accepted"

    # Compare timestamps
    if operation.client_updated_at > existing.updated_at.isoformat():
        # Client has newer data — accept
        await self.update_record(operation.table, operation.record_id, operation.data)
        return "accepted"
    else:
        # Server has newer data — reject with conflict
        return "conflict"
```

### 10.3 SQLite Hydration

After every push success, pull batch, or 409 conflict, the sync engine hydrates the SQLite database via `syncHydrate.ts`:

```typescript
// mobile/src/services/sync/syncHydrate.ts

// On push success — update SQLite with server response
hydrateChangeItem(operation, responseData);
// → localDb.cycle.upsert(responseData)

// On pull — batch hydrate into SQLite
hydrateChangeItems(operationType, serverChanges);
// → maps operation type to localDb service, calls upsertMany

// On 409 conflict — overwrite SQLite with server truth
hydrateChangeItem(operation, conflict.serverData);
```

All hydrations are instrumented with timing metrics tracked in `syncMetricsStore`:

### 10.4 Background Sync

The background sync service (`mobile/src/services/sync/`) runs:

1. **On app foreground** (AppState change listener)
2. **After successful mutation** (TanStack Query `onSuccess`)
3. **Periodically** (expo-background-fetch / expo-background-task)

```typescript
// backgroundSync.ts
async function performSync(): Promise<void> {
  if (!isConnected) return;

  // 1. Push local changes
  const queue = await getOfflineQueue();
  if (queue.length > 0) {
    const result = await syncEngine.pushBatch(queue);
    // Hydrate accepted items into SQLite
    for (const item of result.accepted) {
      await hydrateChangeItem(item.operation, item.response);
    }
    // Remove accepted items from queue
    // Keep failed items for retry
  }

  // 2. Pull server changes
  const lastSync = await getLastSyncTimestamp();
  const changes = await syncEngine.pullChanges(lastSync);
  await hydrateChangeItems(operationType, changes);  // ← hydrate into SQLite

  // 3. Update last sync timestamp
  await setLastSyncTimestamp(new Date().toISOString());

  // 4. Invalidate relevant React Query caches
  invalidateQueries(change.tables);
}
```

### 10.5 Retry Mechanism

Failed sync operations follow exponential backoff:

```typescript
const retryDelays = [1000, 2000, 4000, 8000, 16000, 30000, 60000];

function getNextRetryDelay(retryCount: number): number {
  if (retryCount >= retryDelays.length) {
    return retryDelays[retryDelays.length - 1];
  }
  return retryDelays[retryCount];
}
```

After 7 failed retries, the action stays in the queue and is retried on the next app foreground event.

---

## 11. Security

### 11.1 Token Kill-Switch

Every JWT contains a SHA-256 hash of the user's `user_secret_key`:

```python
def _create_access_token(self, user: User) -> str:
    payload = {
        "sub": str(user.id),
        "jti": str(uuid.uuid4()),
        "type": "access",
        "usk": hashlib.sha256(user.user_secret_key.encode()).hexdigest(),
        "iat": datetime.now(tz=UTC),
        "exp": datetime.now(tz=UTC) + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
```

When a user changes their password, the `user_secret_key` is rotated, immediately invalidating ALL existing tokens — new tokens cannot be decoded because the `usk` claim won't match.

### 11.2 Encryption at Rest

Journal content and medical notes are encrypted using per-user Fernet keys:

```python
# app/core/encryption.py
from cryptography.fernet import Fernet
import hashlib, base64

def _derive_key(master_key: str, user_salt: str) -> bytes:
    """Derive a 32-byte Fernet key from master key + per-user salt."""
    key = hashlib.pbkdf2_hmac(
        "sha256",
        master_key.encode(),
        user_salt.encode(),
        iterations=100_000,  # configurable via settings.encryption.pbkdf2_iterations
        dklen=32,
    )
    return base64.urlsafe_b64encode(key)

def encrypt(plaintext: str, master_key: str, user_salt: str) -> str:
    f = Fernet(_derive_key(master_key, user_salt))
    return f.encrypt(plaintext.encode()).decode()

def decrypt(ciphertext: str, master_key: str, user_salt: str) -> str:
    f = Fernet(_derive_key(master_key, user_salt))
    return f.decrypt(ciphertext.encode()).decode()
```

Encryption is called from the SERVICE LAYER only (not routes or models).

### 11.3 Password Hashing

Passwords are hashed using bcrypt via `passlib`:

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### 11.4 Rate Limiting

Sliding-window rate limiter using Redis:

```python
@router.post("/login")
async def login(payload, svc):
    # 10 requests per 10 minutes per email
    await _rate_limiter().check(f"login:{payload.email}", limit=10, window_seconds=600)

@router.post("/otp/request")
async def request_otp(payload, svc):
    # 5 requests per 10 minutes per phone
    await _rate_limiter().check(f"otp_request:{payload.phone}", limit=5, window_seconds=600)

@router.post("/register")
async def register(payload, svc):
    # 3 registrations per hour per IP
    await _rate_limiter().check(f"register:{request.client.host}", limit=3, window_seconds=3600)
```

### 11.5 Security Headers

Every response includes security headers via middleware:

```python
# app/core/security_headers.py
HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}
```

### 11.6 Client-Side Security

- Auth tokens stored in `react-native-encrypted-storage`
- Sensitive data cleared on `AppState === 'background'`
- Never log journal content, GPS, or PII to console
- X-Request-ID header for trace correlation across network

---

## 12. Error Handling

### 12.1 Global Error Scenarios

| Scenario | Client Handling | Server Response |
|----------|----------------|-----------------|
| No internet | Show cached user, offline banner, queue actions | N/A |
| Token expired | Auto-refresh (single-flight) | 401, auto-refreshed |
| Session compromised | Clear state, navigate to Auth | 401 + "Session compromised" |
| Rate limited | Show toast, backoff | 429 + Retry-After header |
| Network timeout | Show retry option | N/A |
| Server error | Generic error message | 500, logged with request_id |
| Validation error | Show inline field errors | 422, field-level errors |
| Resource not found | Show empty state | 404 |

### 12.2 Backend Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "details": "Human-readable description",
    "request_id": "uuid-for-tracing"
  }
}
```

### 12.3 Mobile Error Display

- **Non-critical errors:** `react-native-toast-message` (platform-correct position)
- **Form validation:** Inline below each field (react-hook-form errors)
- **Network errors:** Offline banner + auto-retry
- **Critical errors (session expiry):** Toast + force navigation to Auth
- **Global error boundary:** Friendly fallback screen + Restart button

---

## 13. API Reference

### 13.1 Auth Endpoints

| Method | Endpoint | Description | Auth | Rate Limit |
|--------|----------|-------------|------|------------|
| POST | `/api/v1/auth/register` | Create account | No | 3/hr per IP |
| POST | `/api/v1/auth/login` | Email + password | No | 10/10min per email |
| POST | `/api/v1/auth/login/phone` | Phone + password | No | 10/10min per phone |
| POST | `/api/v1/auth/otp/request` | Send OTP | No | 5/10min per phone |
| POST | `/api/v1/auth/otp/verify` | Verify OTP | No | - |
| POST | `/api/v1/auth/refresh` | Rotate refresh token | Refresh | - |
| POST | `/api/v1/auth/logout` | Revoke session | Access | - |
| POST | `/api/v1/auth/mfa/enable` | Enable MFA | Access | - |
| POST | `/api/v1/auth/mfa/verify-setup` | Confirm MFA | Access | - |
| POST | `/api/v1/auth/mfa/login` | MFA challenge | MFA token | - |
| GET | `/api/v1/auth/me` | Get profile | Access | - |
| POST | `/api/v1/auth/password` | Set password | Access | - |
| POST | `/api/v1/auth/password/change` | Change password | Access | - |
| GET | `/api/v1/auth/sessions` | List sessions | Access | - |
| DELETE | `/api/v1/auth/sessions/{id}` | Revoke session | Access | - |
| POST | `/api/v1/auth/device/register` | Register FCM token | Access | - |

### 13.2 Onboarding Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| PUT | `/api/v1/onboarding` | Create/update onboarding | Access |
| GET | `/api/v1/onboarding` | Get onboarding data | Access |
| GET | `/api/v1/onboarding/status` | Check completion | Access |

### 13.3 Health Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health/live` | Liveness probe |
| GET | `/api/v1/health/ready` | Readiness probe (DB + Redis) |
| GET | `/api/v1/metrics` | Prometheus metrics |

---

## Appendix A: Complete Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ONBOARDING WORKFLOW                              │
│                                                                         │
│  SPLASH                                                                 │
│    ├── Animated logo (2s)                                              │
│    ├── hydrate auth store                                              │
│    │   ├── Read encrypted token                                        │
│    │   ├── Token exists? → GET /auth/me                               │
│    │   │   ├── Success → cache user, set hydrated                     │
│    │   │   ├── Network error → load cached user                        │
│    │   │   ├── 401 → clear tokens, user=null                          │
│    │   └── No token → user=null, hydrated=true                         │
│    └── Render navigator based on state                                  │
│                                                                         │
│  AUTH STACK (no user)                                                   │
│    ├── LoginScreen                                                     │
│    │   └── email + password → POST /auth/login → tokens → Main/Onboard │
│    ├── RegisterScreen                                                  │
│    │   └── email + password + name → POST /auth/register → Main/Onboard│
│    ├── OtpScreen                                                       │
│    │   └── phone → POST /auth/otp/request → OtpVerifyScreen           │
│    └── OtpVerifyScreen                                                 │
│        └── phone + otp → POST /auth/otp/verify → tokens → Main/Onboard │
│                                                                         │
│  ONBOARDING STACK (user exists, not completed)                          │
│    ├── WelcomeScreen → screens accumulate data locally                 │
│    ├── PersonalInfoScreen → age, height, weight                       │
│    ├── LifestyleScreen → stress, exercise, sleep, diet                 │
│    ├── CurrentCycleScreen → cycle start, length, symptoms              │
│    ├── PastCycleScreen × 3 → cycle history backfill                    │
│    └── CompleteScreen                                                  │
│        └── PUT /api/v1/onboarding →                                     │
│            ├── Upsert UserOnboarding                                   │
│            ├── Backfill cycle_entries                                  │
│            ├── Emit onboarding_completed event                         │
│            └── Cycle module computes initial prediction (Celery task)  │
│                                                                         │
│  MAIN TABS (user exists, onboarding completed)                          │
│    ├── Home → Dashboard, predictions                                   │
│    ├── Calendar → CalendarView, CycleDashboard                         │
│    ├── Analytics → Charts, insights                                    │
│    ├── AI Chat → Conversation                                          │
│    └── Profile → Settings, logout                                      │
│                                                                         │
│  TOKEN REFRESH (transparent)                                            │
│    ├── 401 from any API call                                           │
│    ├── Single-flight refresh → POST /auth/refresh                     │
│    ├── Success → retry original request                                │
│    └── Failure → session expired → force logout                        │
│                                                                         │
│  OFFLINE BEHAVIOR (SQLite)                                              │
│    ├── No connectivity → serve cached data from SQLite (placeholder)   │
│    ├── Mutations write through to SQLite + queue in AsyncStorage       │
│    ├── Background sync on reconnect → hydrate SQLite                   │
│    ├── Last-write-wins conflict resolution                             │
│    └── SQLite pruning: soft-delete purge >30d, sync_log trim to 500    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Key Files Reference

| File | Purpose |
|------|---------|
| `mobile/src/app/providers.tsx` | App providers: GestureHandler, SafeArea, QueryClient, Theme |
| `mobile/src/navigation/RootNavigator.tsx` | Root navigation state machine (Splash → Auth/Onboard/Main) |
| `mobile/src/stores/authStore.ts` | Zustand auth store: hydrate, login, register, reset |
| `mobile/src/services/api/client.ts` | Axios instance: token injection, 401 refresh, session expiry |
| `mobile/src/services/api/auth.ts` | authService: all auth API calls |
| `mobile/src/services/api/onboarding.ts` | onboardingService: GET/PUT/status |
| `mobile/src/services/queries/auth.ts` | TanStack Query hooks: useLogin, useRegister, etc. |
| `mobile/src/services/storage/index.ts` | EncryptedStorage wrapper |
| `mobile/src/db/schema.ts` | Drizzle ORM schema (18 tables + indexes) |
| `mobile/src/db/connection.ts` | SQLite singleton via openDatabaseSync |
| `mobile/src/services/localDb/BaseLocalService.ts` | Abstract SQLite CRUD base class |
| `mobile/src/services/localDb/syncPlaceholders.ts` | SQLite placeholder readers |
| `mobile/src/services/localDb/writeThroughHelpers.ts` | SQLite write-through helpers |
| `mobile/src/services/sync/syncHydrate.ts` | Hydrate server responses → SQLite |
| `mobile/src/components/ui/DatePickerField.tsx` | Reusable date picker with react-hook-form Controller |
| `mobile/src/components/ui/Button.tsx` | Reusable button (primary/outline/danger, animated) |
| `mobile/src/components/ui/FormField.tsx` | Reusable form field with validation |
| `backend/app/modules/auth/routes.py` | Auth HTTP endpoints |
| `backend/app/modules/auth/services.py` | Auth business logic |
| `backend/app/modules/auth/models.py` | User, UserSession, OTPAttempt tables |
| `backend/app/modules/onboarding/routes.py` | Onboarding HTTP endpoints |
| `backend/app/modules/onboarding/services.py` | Onboarding business logic + cycle backfill |
| `backend/app/modules/onboarding/models.py` | UserOnboarding table |
| `backend/app/core/security.py` | JWT encode/decode, password hashing |
| `backend/app/core/encryption.py` | Fernet + PBKDF2 per-user encryption |
| `backend/app/core/event_bus.py` | In-process async pub/sub |
| `backend/app/core/config.py` | All environment configuration |
| `backend/app/core/database.py` | Async SQLAlchemy engine and session |
