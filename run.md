# Run
Email: testuser@shecare.app
Password: TestPass123!

User 1 — Priya Sharma (Regular 28-day cycles)
Email: priya.sharma@test.shecare / Password: Test@1234
Onboarding: age 25, BMI 22.1, moderate stress/exercise, balanced diet
6 cycle entries, avg cycle: 28.0 days (std dev 0.0)
Prediction: next period start predicted for 2025-07-02

User 2 — Ananya Verma (Irregular/PCOS pattern)

Email: ananya.verma@test.shecare / Password: Test@1234
Onboarding: age 32, BMI 28.8, high stress, low exercise, poor sleep
6 cycle entries, avg cycle: 37.0 days (range 33–43)
Prediction: next period start predicted for 2025-09-08
## Quick Start (Full Stack)

### 1. Start Infrastructure

```bash
cd backend
docker compose up -d postgres redis minio
```

### 2. Start Backend API

```bash
cd backend

# Install dependencies (first run / after lock change)
poetry install

# Apply database migrations
poetry run alembic upgrade head

# Start dev server (hot-reload)
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# OR: poetry run python run.py
```

API available at `http://localhost:8000`
Docs at `http://localhost:8000/docs`

### 3. Start Celery Workers

Open separate terminals:

```bash
cd backend

# Main worker (default + priority queues)
poetry run celery -A app.core.celery_app worker --loglevel=info -Q default,priority

# AI worker (separate for ML inference)
poetry run celery -A app.core.celery_app worker --loglevel=info -Q ai

# Beat scheduler (periodic tasks)
poetry run celery -A app.core.celery_app beat --loglevel=info
```

### 4. Start Mobile App

```bash
cd mobile
npx expo start
# iOS
npx react-native run-ios

# Android
npx react-native run-android

# Metro bundler (if not auto-started)
npx react-native start
```

---

## Individual Component Commands

### Backend API Only

```bash
cd backend
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Workers Only

```bash
cd backend
poetry run celery -A app.core.celery_app worker --loglevel=info --concurrency=4
```

### Database Migrations

```bash
cd backend
poetry run alembic upgrade head          # Apply all pending
poetry run alembic downgrade -1           # Rollback one step
poetry run alembic history                # Show migration history
```

### Seed Reference Data

```bash
cd backend
poetry run python -m app.seed
```

### Run Tests

```bash
cd backend

# All tests
poetry run pytest

# With coverage
poetry run pytest --cov=app --cov-report=term-missing

# Specific module
poetry run pytest tests/modules/cycle/

# Integration tests (requires DB + Redis)
poetry run pytest -m integration
```

### Lint & Type Check

```bash
cd backend

poetry run ruff check app/
poetry run mypy app/
poetry run black --check app/
poetry run isort --check-only app/
```

---

## Production Deployment

### Docker Build

```bash
cd backend

# API image
docker build -t shecare-api:latest .

# Worker image
docker build -t shecare-worker:latest -f Dockerfile.worker .
```

### Docker Compose (Full Stack)

```bash
cd backend
docker compose up -d
```

This starts: API, worker, beat scheduler, PostgreSQL, Redis, MinIO.

### Health Checks

```bash
# Liveness (is the process alive?)
curl http://localhost:8000/health/live

# Readiness (can it serve traffic?)
curl http://localhost:8000/health/ready

# Prometheus metrics
curl http://localhost:8000/metrics
```

### Expected Responses

```json
// Health live
{ "status": "ok" }

// Health ready (all dependencies healthy)
{ "status": "ok", "checks": { "database": "ok", "redis": "ok" } }

// Metrics
# HELP shecare_http_requests_total Total HTTP requests
# TYPE shecare_http_requests_total counter
```

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `Connection refused` on DB | PostgreSQL not running | `docker compose up -d postgres` |
| `No module named 'app'` | Not in venv or wrong directory | Activate venv, run from `backend/` |
| Migration fails | Alembic head mismatch | `alembic stamp head` then `alembic upgrade head` |
| Redis connection error | Redis not running | `docker compose up -d redis` |
| CORS error on mobile | API_BASE_URL wrong | Check `mobile/.env` matches backend URL |
| 429 Too Many Requests | Rate limit hit | Wait for window to expire (check `Retry-After`) |
| SOS not sending SMS | Twilio credentials missing | Set `TWILIO__*` env vars |

---

## Android Crash: SIGSEGV during migrations (drizzle `useMigrations`)

**Signature:** `Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0 in tid ... (mqt_v_js)` crashing in `exsqlite3_clear_bindings` at app startup ("Preparing your data...").

**Root cause:** A migration file contains a `--> statement-breakpoint` marker *inside a comment line* (often backtick-wrapped). Drizzle splits on that marker, leaving a comment-only chunk. `sqlite3_prepare_v2` returns `SQLITE_OK` with a **NULL statement**, and `clear_bindings(NULL)` segfaults. The device can also run a *stale cached bundle* even after the file is fixed.

### 1. Confirm

```powershell
adb logcat -d | Select-String 'SIGSEGV|signal 11|F DEBUG|mqt_v_js|expo-sqlite'
rg -n "statement-breakpoint" mobile/src/db/migrations/
```

Open each matched file and look for the marker inside a `--` comment.

### 2. Fix the migration

Rewrite the comment so the marker text is not inside a comment (see `0006_fix_diary_tables.sql` for the precedent). Keep the comment sentence but drop the literal `--> statement-breakpoint` from it.

### 3. Force a fresh bundle (critical)

Metro's persisted transform cache can keep serving the old chunk to the device even after editing the file:

```powershell
# Kill Metro
Get-NetTCPConnection -LocalPort 8081 -State Listen | Select -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }

# Restart with cache clear
cd mobile
npx expo start --dev-client --port 8081 --clear

# Clear device-side caches, then relaunch via dev-client deep link
adb shell am force-stop com.shecare.app
adb shell run-as com.shecare.app rm -rf cache/http-cache
adb shell run-as com.shecare.app rm -f files/DevLauncherApp-BridgelessReactNativeDevBundle.js
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d "shecare://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

### 4. Verify

```powershell
Start-Sleep 50
adb logcat -d | Select-String 'SIGSEGV|signal 11|Migrated store data to SQLite'
adb shell pidof com.shecare.app
```

No SIGSEGV + app reaches `Migrated store data to SQLite` = fixed.

### Defense in depth

- `patches/expo-sqlite+57.0.1.patch` (applied via `patch-package` on `npm ci`) adds a NULL-statement guard in `NativeDatabaseBinding.cpp::sqlite3_prepare_v2`, turning this crash into a catchable `SQLiteErrorException`. **Requires a native rebuild** (`npx expo run:android` / `eas build`) to take effect.
- Never place `--> statement-breakpoint` inside a comment line in any future migration.

hi
# my way
cd backend
poetry shell
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 
or poetry run python run.py or directly python run.py
  and 
  cd mobile
  npx expo start 
  npx expo prebuild --clean
  npx expo run:android
  npx expo run:android (debug) + npx expo start
  npx expo run:android --variant release
  npx expo run:android --clear-cache (not aviable now a day)
  adb uninstall com.shecare.app
  eas build --profile development --platform android
  eas build --profile production --platform android

  for eas used use this  ,npx expo start --dev-client or .\start.ps1

  or npx expo start --clear 
  or npx react-native run-ios 
  or npx react-native run-android 

my log file location #C:/User/U S E R/AppData/Roaming/Code/User/workspaceStorage/c95bbe9dc516bdbe7656911793b956b8/redhat.java/jdt_ws/.metadata/.log

🔁 Command ComparisonActionExpo (npx expo)React Native CLI (npx react-native)Initial Build & Install over USBnpx expo run:androidnpx react-native run-androidDaily Dev Server Startnpx expo startnpx react-native start (or npm start)Local Backend Port Forwardingadb reverse tcp:8000 tcp:8000adb reverse tcp:8000 tcp:8000

start.ps1 is for the dev workflow — it writes the WiFi IP to .env, starts the backend (port 8000), then runs npx expo start --dev-client (Metro). It is not needed for what's on your device right now.

Two paths:

To test the release build already installed (recommended for checking lag):

Just open the app: tap the SheCare icon, or adb shell am start -n com.shecare.app/.MainActivity
No Metro, no start.ps1 needed. (It runs standalone with the embedded bundle.)
Note: data screens hit the API at .env's URL — if the backend isn't running, they'll show cache/error states. You can start only the backend with cd E:\her_care\backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload.
To go back to the dev workflow (start.ps1):

start.ps1 starts backend + Metro, but the installed app is now the release build — a release dev-client embeds its bundle and ignores Metro. You'd first reinstall the debug build: npx expo run:android (or --variant debug), then run start.ps1.
Why it opens without expo run:android: npx expo run:android only does the build + install — it compiles the app and puts the APK on your phone. Once installed, it's just a normal Android app: you tap the icon and it launches. The release APK already embeds the JavaScript bundle inside it, so there's no server to connect to.

Why it's fast: Dev mode was the bottleneck. In dev (npx expo start), every render runs:

JS over Metro with dev-server round-trips and hot-reload checks
Unminified code + dev-only warnings/overhead
Debug-mode Hermes (no bytecode optimizations)
A release build gets:

Hermes precompiled bytecode AOT (much faster JS execution)
Minified/bundled JS, no Metro, no debugger checks
Optimized native builds (no debug symbols/dev flags)
So the lag you felt before was mostly dev-mode overhead, not your code. The app itself was fine.