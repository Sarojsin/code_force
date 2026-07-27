# SheCare Mobile API Endpoints

Base path: `/api/v1`

---

## Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List users (pagination) |
| PUT | `/admin/users/{user_id}/role` | Update user role |
| POST | `/admin/nurses/{nurse_id}/verify` | Verify nurse profile |
| GET | `/admin/analytics/dashboard` | Get dashboard analytics |
| POST | `/admin/system/broadcast` | Send broadcast notification |

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new account |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/otp/request` | Request OTP |
| POST | `/auth/otp/verify` | Verify OTP |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/device/register` | Register FCM device token |

---

## Calendar

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cycle/calendar` | Get calendar days (ETag-supported) |

---

## Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/token` | Get Stream Chat token |
| POST | `/chat/link/generate` | Generate invite link |
| POST | `/chat/link/{token}/use` | Use invite link |
| GET | `/chat/rooms` | List chat rooms |

---

## Companion / Luna

| Method | Path | Description |
|--------|------|-------------|
| GET | `/features/luna/metadata` | Get Luna asset metadata for install |

---

## Cycle

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cycle/entries` | List period entries |
| POST | `/cycle/entries` | Create period entry |
| PUT | `/cycle/entries/{id}` | Update period entry |
| GET | `/cycle/predictions` | Get next prediction |
| GET | `/cycle/predictions/history` | Get prediction history |
| GET | `/cycle/calendar` | Get calendar data |
| GET | `/cycle/analytics` | Get cycle analytics |
| GET | `/cycle/models/status` | Get model status |
| GET | `/cycle/models/download/{filename}` | Download model file |
| POST | `/cycle/corrections` | Log correction |
| POST | `/cycle/snooze` | Log snooze |

---

## Family

| Method | Path | Description |
|--------|------|-------------|
| GET | `/family/links` | List family links |
| POST | `/family/link/generate` | Generate invite link |
| GET | `/family/link/{token}/info` | Get invite info |
| POST | `/family/link/{token}/accept` | Accept invite |
| PUT | `/family/links/{link_id}/permissions` | Update permissions |
| DELETE | `/family/links/{link_id}` | Remove link |

---

## Home

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wellness/health-tips` | Get daily health tips (static fallback if offline) |

---

## Nurse Content

| Method | Path | Description |
|--------|------|-------------|
| GET | `/nurse/contents` | List own nurse content |
| GET | `/nurse/contents/{id}` | Get nurse content detail |

---

## Onboarding

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/onboarding` | Upsert onboarding data |
| GET | `/onboarding` | Get onboarding data |
| GET | `/onboarding/status` | Get onboarding status |

---

## Pregnancy

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pregnancy/profile` | Get pregnancy profile |
| PUT | `/pregnancy/profile` | Update pregnancy profile |
| GET | `/pregnancy/daily-logs` | List daily logs |
| POST | `/pregnancy/daily-log` | Create daily log |
| GET | `/pregnancy/milestone` | Get current milestone |
| GET | `/pregnancy/recommendations` | Get recommendations |

---

## Profile

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

## Safety / SOS

| Method | Path | Description |
|--------|------|-------------|
| GET | `/safety/emergency-contacts` | List contacts |
| POST | `/safety/emergency-contacts` | Add contact |
| PUT | `/safety/emergency-contacts/{id}` | Update contact |
| DELETE | `/safety/emergency-contacts/{id}` | Delete contact |
| POST | `/safety/sos/trigger` | Trigger SOS |
| GET | `/safety/sos/active` | Get active SOS |
| GET | `/safety/sos/history` | Get SOS history |
| POST | `/safety/sos/{alert_id}/cancel` | Cancel SOS |
| POST | `/safety/sos/{alert_id}/resolve` | Resolve SOS |
| GET | `/safety/status` | Get safety status |

---

## Sync

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sync/batch` | Push batch of offline operations |
| GET | `/sync/changes` | Pull server changes since timestamp |

---

## Voice

| Method | Path | Description |
|--------|------|-------------|
| POST | `/voice/daily` | Submit voice journal |
| GET | `/voice/analysis/{entry_id}` | Get voice analysis |

---

## Wellness

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wellness/journal` | List journal entries |
| POST | `/wellness/journal` | Create journal entry |
| GET | `/wellness/journal/{id}` | Get journal entry |
| DELETE | `/wellness/journal/{id}` | Delete journal entry |
| POST | `/wellness/mood` | Create mood log |
| GET | `/wellness/mood/history` | Get mood history |
| GET | `/wellness/breathing-exercises` | List breathing exercises |
| POST | `/wellness/breathing-sessions/{id}/complete` | Complete exercise |
| GET | `/wellness/insights` | Get wellness insights |
| POST | `/wellness/journal/analysis` | Sync journal analysis |
| GET | `/wellness/journal/{id}/analysis` | Get journal analysis |
| GET | `/models/wellness-classifier/version` | Get model version |
| GET | `/models/wellness-classifier/{version}.onnx` | Download model |
