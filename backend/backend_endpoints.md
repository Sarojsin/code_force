# SheCare Backend API Endpoints

Base path: `/api/v1`

---

## Meta / Health

> Non-authenticated operational endpoints.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe (DB + Redis checks) |
| GET | `/metrics` | Prometheus metrics (internal, excluded from audit) |

---

## Admin
All endpoints require admin role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List users with filters (role, is_active, limit, offset) |
| PUT | `/admin/users/{user_id}/role` | Change a user's role |
| POST | `/admin/nurses/{nurse_id}/verify` | Verify a nurse profile |
| GET | `/admin/analytics/dashboard` | Aggregated analytics dashboard |
| POST | `/admin/system/broadcast` | Send push notification to all users |
| GET | `/admin/contents/pending` | List unapproved educational content |
| PUT | `/admin/contents/{content_id}/approve` | Approve or reject educational content |

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account with email + password |
| POST | `/auth/login` | Email + password login |
| POST | `/auth/login/phone` | Phone + password login |
| POST | `/auth/otp/request` | Send OTP to phone number |
| POST | `/auth/otp/verify` | Verify OTP and issue tokens |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke current access token |
| POST | `/auth/mfa/enable` | Generate TOTP secret |
| POST | `/auth/mfa/verify-setup` | Confirm TOTP setup |
| POST | `/auth/mfa/login` | Complete MFA challenge |
| POST | `/auth/password` | Set or change password |
| POST | `/auth/password/change` | Change password with old-password check |
| GET | `/auth/me` | Get authenticated user's profile |
| GET | `/auth/sessions` | List active sessions |
| DELETE | `/auth/sessions/{session_id}` | Revoke a specific session |
| POST | `/auth/device/register` | Register device FCM token for push notifications |

---

## Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/token` | Generate Stream Chat token |
| POST | `/chat/link/generate` | Generate shareable chat room invite link |
| POST | `/chat/link/{token}/use` | Use invite link to join room |
| GET | `/chat/rooms` | List user's chat rooms |

---

## Cycle

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cycle/entries` | Log a period entry |
| GET | `/cycle/entries` | List period entries |
| GET | `/cycle/entries/{entry_id}` | Get single period entry |
| PUT | `/cycle/entries/{entry_id}` | Update period entry |
| DELETE | `/cycle/entries/{entry_id}` | Soft-delete period entry |
| GET | `/cycle/predictions` | Get next predicted cycle |
| GET | `/cycle/predictions/history` | Get prediction history |
| GET | `/cycle/analytics` | Cycle analytics (avg length, symptoms, mood) |
| POST | `/cycle/corrections` | Log a correction linking to prediction |
| POST | `/cycle/snooze` | Log 'Not yet' event for prediction |
| GET | `/cycle/calendar` | Calendar days (ETag-supported) |
| GET | `/cycle/models/status` | Active global model version and download URL |
| GET | `/cycle/models/download/{filename}` | Download versioned global model file |

---

## Family

| Method | Path | Description |
|--------|------|-------------|
| POST | `/family/link/generate` | Generate family invite link |
| GET | `/family/link/{token}/info` | Get public invite info |
| POST | `/family/link/{token}/accept` | Accept family invite |
| GET | `/family/links` | List all family links |
| PUT | `/family/links/{link_id}/permissions` | Update permission level |
| DELETE | `/family/links/{link_id}` | Revoke family link |
| GET | `/family/shared-data` | Aggregated shared data from linked members |

---

## Luna
> Feature companion module. Router exists but **not registered** in `app/main.py` MODULE_INITS.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/features/luna/metadata` | Get Luna asset metadata (version, download URL) |

---

## Nurse Content

| Method | Path | Description |
|--------|------|-------------|
| POST | `/nurse/contents` | Upload content metadata |
| GET | `/nurse/contents` | List own content |
| PUT | `/nurse/contents/{content_id}` | Update own content |
| DELETE | `/nurse/contents/{content_id}` | Delete own content |
| GET | `/contents` | List approved educational content (public) |
| GET | `/contents/{content_id}` | Get single approved content (public) |

---

## Onboarding

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/onboarding` | Create or update onboarding data |
| GET | `/onboarding` | Fetch current onboarding data |
| GET | `/onboarding/status` | Check onboarding completion status |

---

## Pregnancy

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pregnancy/profile` | Create pregnancy profile |
| GET | `/pregnancy/profile` | Get current pregnancy info |
| PUT | `/pregnancy/profile` | Update pregnancy profile |
| DELETE | `/pregnancy/profile` | Archive pregnancy profile |
| POST | `/pregnancy/daily-log` | Log daily symptoms, cravings, mood |
| GET | `/pregnancy/daily-logs` | List daily logs |
| GET | `/pregnancy/milestone` | Get current week's milestone |
| GET | `/pregnancy/recommendations` | Personalized diet/exercise tips |

---

## Safety / SOS

| Method | Path | Description |
|--------|------|-------------|
| GET | `/safety/emergency-contacts` | List emergency contacts |
| POST | `/safety/emergency-contacts` | Add emergency contact |
| PUT | `/safety/emergency-contacts/{contact_id}` | Update emergency contact |
| DELETE | `/safety/emergency-contacts/{contact_id}` | Delete emergency contact |
| POST | `/safety/sos/trigger` | Trigger SOS alert with GPS |
| GET | `/safety/sos/history` | Past SOS alerts |
| POST | `/safety/sos/{alert_id}/cancel` | Cancel active SOS alert |
| POST | `/safety/sos/{alert_id}/resolve` | Mark SOS as resolved |
| GET | `/safety/sos/active` | Get current active SOS alert |
| GET | `/safety/status` | Safety status (active SOS + contacts) |

---

## Sync

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sync/batch` | Push batch of offline operations |
| GET | `/sync/changes` | Pull server changes since timestamp |

---

## Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Get own user profile |
| PUT | `/users/me` | Update user profile |
| DELETE | `/users/me` | Soft delete account |
| GET | `/users/me/export` | Export personal data |
| POST | `/users/me/avatar` | Upload avatar |
| POST | `/users/me/fcm-tokens` | Register FCM push token |
| DELETE | `/users/me/fcm-tokens/{token}` | Remove FCM push token |
| GET | `/users/me/consents` | List consent records |
| POST | `/users/me/consents` | Record user consent |

---

## Voice

> Placeholder endpoints for future implementation.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/voice/daily` | Accept audio recording (queued) |
| GET | `/voice/analysis/{entry_id}` | Get voice analysis (501 Not Implemented) |
| POST | `/voice/emotion/realtime` | Real-time emotion detection (501 Not Implemented) |

---

## Wellness

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wellness/journal` | Create journal entry |
| GET | `/wellness/journal` | List journal entries (metadata) |
| GET | `/wellness/journal/{entry_id}` | Get single journal entry |
| DELETE | `/wellness/journal/{entry_id}` | Delete journal entry |
| POST | `/wellness/mood` | Log mood entry |
| GET | `/wellness/mood/history` | Mood history |
| GET | `/wellness/breathing-exercises` | List breathing exercises |
| POST | `/wellness/breathing-sessions/{exercise_id}/complete` | Log completed exercise |
| GET | `/wellness/insights` | Weekly wellness insights |
| POST | `/wellness/journal/analysis` | Sync on-device journal analysis |
| GET | `/wellness/journal/{entry_id}/analysis` | Get journal analysis |
| GET | `/wellness/health-tips` | Get health tips |
| GET | `/models/wellness-classifier/version` | Current model version |
| GET | `/models/wellness-classifier/{version}.onnx` | Download model binary |
