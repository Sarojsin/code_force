SheCare Backend Plan (Full Detail, No Code)
1. Overview & Architecture
1.1. System Context
The backend serves the SheCare mobile app (React Native) and future web admin panel. It handles authentication, business logic, AI sentiment analysis (text), notifications, SOS, partner linking, pregnancy tracking, nurse content management, and chat (via external service). Voice journal and voice emotion analysis are stubbed for future implementation.

1.2. High-Level Architecture
text
[Mobile App] <-- HTTPS/JSON --> [API Gateway / Load Balancer] --> [FastAPI Application Servers]
                                                                      |
                                                                      v
                                                              [PostgreSQL Primary]
                                                                      |
                                                              [Redis (cache, rate limit)]
                                                                      |
                                                              [Worker (Celery/RQ)]
                                                                      |
                                                              [External Services]
                                                                 (Twilio, FCM, Stream Chat, S3)
1.3. Design Principles
Stateless – All user state stored in DB or JWT.

Privacy-first – End-to-end encryption for journals; minimal logging of PII.

Role-based access – User, Family, Nurse, Admin.

Async processing – For notifications, AI sentiment, and non-critical tasks.

Future-ready – Placeholders for voice journal APIs (return 501 Not Implemented with explanation).

2. Technology Stack (Backend)
Category	Technology	Justification
API Framework	FastAPI (Python 3.11+)	Async, auto-docs, type hints, high performance.
Database	PostgreSQL 15+	ACID, JSONB support, full-text search for journal analysis.
Cache & Queue	Redis 7+	Rate limiting, session store, Celery broker.
Task Queue	Celery with Redis broker	Async: AI analysis, push notifications, SMS.
Object Storage	AWS S3 / MinIO	Nurse videos, user-uploaded medical reports (future).
Authentication	JWT + OTP (Twilio Verify)	Stateless, short-lived tokens, refresh rotation.
AI Sentiment	Hugging Face (distilbert-base-uncased-finetuned-sst-2-english)	Pre-trained, fine-tuned on health journals.
Notifications	Firebase Cloud Messaging (FCM) + APNS	Push notifications.
SMS	Twilio	OTP and SOS alerts.
Chat	Stream Chat API (managed)	Avoid building real-time infrastructure.
Monitoring	Sentry + Prometheus + Grafana	Error tracking, metrics.
Deployment	Docker + Kubernetes (or ECS)	Scalable.
3. Database Schema Design
All tables include created_at, updated_at (timestamptz). Sensitive columns encrypted at application level (using cryptography Fernet with per-user key). Indices for foreign keys and frequently queried columns.

3.1. Core Tables
users
Column	Type	Description
id	UUID (PK)	Primary identifier.
phone_number	VARCHAR(20) UNIQUE	Used for OTP (no email required).
hashed_password	VARCHAR(255)	Optional if using OTP-only; stored for MFA.
role	ENUM('user', 'family', 'nurse', 'admin')	Default 'user'.
display_name	VARCHAR(100)	For chat and family linking.
profile_pic_url	TEXT	Optional.
date_of_birth	DATE	For age‑based recommendations.
blood_group	VARCHAR(5)	For SOS medical info.
medical_notes	TEXT	Encrypted; user‑provided.
is_active	BOOLEAN	Soft delete.
mfa_enabled	BOOLEAN	Default false.
mfa_secret	VARCHAR(255)	Encrypted TOTP secret.
encryption_key_salt	VARCHAR(255)	For client‑side key derivation (server stores salt only).
user_sessions
Column	Type	Description
id	UUID (PK)	Session ID.
user_id	UUID FK(users.id)	On delete cascade.
refresh_token	VARCHAR(255)	Hashed refresh token.
expires_at	TIMESTAMPTZ	Refresh expiry.
device_info	JSONB	Device OS, model (non‑sensitive).
emergency_contacts
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
name	VARCHAR(100)	
phone_number	VARCHAR(20)	For SMS.
relationship	VARCHAR(50)	e.g., 'spouse', 'parent'.
is_primary	BOOLEAN	Default false; only one primary.
3.2. Reproductive Wellness
cycle_entries
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
period_start_date	DATE	First day of period.
period_end_date	DATE	Nullable if ongoing.
flow_intensity	ENUM('light','medium','heavy')	
symptoms	JSONB	List of symptom IDs (e.g., ["cramps","headache"]).
mood_tags	JSONB	List of mood strings.
energy_level	SMALLINT	1–5.
notes	TEXT	Encrypted.
logged_at	DATE	Default current date.
predicted_cycles (computed via background job)
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
predicted_next_period_start	DATE	
predicted_fertile_window_start	DATE	
predicted_fertile_window_end	DATE	
model_version	VARCHAR(20)	e.g., 'rule_based_v2'
3.3. Emotional Wellness
journal_entries
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
content	TEXT	Encrypted (E2EE client‑side or server‑side).
sentiment_score	FLOAT	-1 (negative) to +1 (positive); computed async.
sentiment_label	VARCHAR(20)	'positive','neutral','negative'
analyzed_at	TIMESTAMPTZ	Nullable.
entry_date	DATE	Default current date.
mood_logs
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
mood	VARCHAR(50)	'happy','calm','sad','stressed','irritated'
intensity	SMALLINT	1–5.
logged_at	TIMESTAMPTZ	Default now.
breathing_exercises (static content)
Column	Type	Description
id	UUID (PK)	
name	VARCHAR(100)	'Box Breathing'
duration_seconds	INT	
instructions	JSONB	Step‑by‑step timings.
audio_url	TEXT	Optional guided audio.
user_exercise_sessions
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
exercise_id	UUID FK(breathing_exercises.id)	
completed_at	TIMESTAMPTZ	
3.4. Pregnancy Support
pregnancy_profiles
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id) UNIQUE	One active pregnancy per user.
due_date	DATE	Calculated from LMP or ultrasound.
lmp_date	DATE	Last menstrual period.
current_week	SMALLINT	Computed (1–42).
is_active	BOOLEAN	Default true; false after delivery.
pregnancy_daily_logs
Column	Type	Description
id	UUID (PK)	
pregnancy_id	UUID FK(pregnancy_profiles.id)	
symptoms	JSONB	['morning_sickness','fatigue',...]
cravings	JSONB	['chocolate','pickles',...]
mood	VARCHAR(50)	
notes	TEXT	Encrypted.
log_date	DATE	Default today.
pregnancy_milestones (static table)
Column	Type	Description
week	SMALLINT	1–42.
baby_size_cm	FLOAT	
baby_weight_g	FLOAT	
development_tip	TEXT	Medical disclaimer appended.
3.5. Safety System
sos_alerts
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
triggered_at	TIMESTAMPTZ	
latitude	DECIMAL(10,8)	
longitude	DECIMAL(11,8)	
location_accuracy_m	INT	
contact_ids_notified	UUID[]	List of emergency_contacts.id
sms_status	VARCHAR(20)	'sent','failed'
push_status	JSONB	Per contact.
3.6. Partner / Family Linking
family_links
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	The woman (data owner).
linked_user_id	UUID FK(users.id)	Family member.
permission_level	ENUM('view_mood','view_pregnancy','view_cycle','sos_contact')	Bitmask stored as integer.
invite_token	VARCHAR(64)	Unique, one‑time use.
token_expires_at	TIMESTAMPTZ	
status	ENUM('pending','accepted','revoked')	
accepted_at	TIMESTAMPTZ	
3.7. Nurse Content Management
nurse_profiles
Column	Type	Description
user_id	UUID FK(users.id) PK	One‑to‑one.
qualification	TEXT	
verified_at	TIMESTAMPTZ	By admin.
hospital_affiliation	VARCHAR(200)	Optional.
educational_contents
Column	Type	Description
id	UUID (PK)	
nurse_id	UUID FK(users.id)	
title	VARCHAR(200)	
description	TEXT	
video_url	TEXT	S3 signed URL.
thumbnail_url	TEXT	
category	VARCHAR(50)	'pregnancy','pcod','exercise','stress'
tags	TEXT[]	
status	ENUM('pending','approved','rejected')	
approved_by	UUID FK(users.id)	Admin ID.
published_at	TIMESTAMPTZ	
3.8. Future Modules (Stubbed)
health_records (future)

hospital_integrations (future)

voice_journals (future) – just a table schema defined but not used yet.

voice_journal_future (placeholder)
Column	Type	Description
id	UUID (PK)	
user_id	UUID FK(users.id)	
recording_uri	TEXT	Local device path or cloud URI.
transcript	TEXT	Null until future feature.
emotion_analysis	JSONB	Null.
created_at	TIMESTAMPTZ	
4. API Modules & Endpoints (Detailed)
All endpoints under /api/v1/. Authentication: Bearer JWT (except /auth/*). Rate limiting: 100 req/min per user, 20 req/min for anonymous.

4.1. Authentication Module (/auth)
Method	Endpoint	Description	Request Body	Response
POST	/auth/otp/request	Send OTP to phone number	{ "phone": "+1234567890" }	{ "message": "OTP sent", "expires_in": 300 }
POST	/auth/otp/verify	Verify OTP, return tokens	{ "phone": "...", "otp": "123456" }	{ "access_token": "...", "refresh_token": "...", "user": {...} }
POST	/auth/refresh	Refresh access token	{ "refresh_token": "..." }	New access_token
POST	/auth/logout	Invalidate refresh token	(Auth header)	204
POST	/auth/mfa/enable	Enable TOTP	{ "code": "123456" }	{ "secret": "...", "qr_uri": "..." }
POST	/auth/mfa/verify	Verify MFA during login (after OTP)	{ "phone": "...", "mfa_code": "..." }	Tokens
4.2. User Profile (/users)
Method	Endpoint	Description
GET	/users/me	Get own profile
PUT	/users/me	Update profile (name, DOB, blood group, medical notes)
POST	/users/me/avatar	Upload avatar to S3, return URL
DELETE	/users/me	Soft delete account (GDPR erasure queued)
4.3. Cycle Tracking (/cycle)
Method	Endpoint	Description
POST	/cycle/entries	Log a period entry
GET	/cycle/entries	Paginated list (default last 6 months)
GET	/cycle/entries/{entry_id}	Detail
PUT	/cycle/entries/{entry_id}	Update
DELETE	/cycle/entries/{entry_id}	Delete
GET	/cycle/predictions	Get next period, fertile window (computed real‑time)
GET	/cycle/analytics	Statistics: average cycle length, common symptoms, mood trends
4.4. Emotional Wellness (/wellness)
Method	Endpoint	Description
POST	/wellness/journal	Create journal entry (content encrypted client‑side). Triggers async sentiment analysis.
GET	/wellness/journal	List journal entries (metadata only, content sent encrypted)
GET	/wellness/journal/{id}	Get single entry
DELETE	/wellness/journal/{id}	Delete
POST	/wellness/mood	Log current mood
GET	/wellness/mood/history	Mood timeline with optional date range
GET	/wellness/breathing-exercises	List all exercises
POST	/wellness/breathing-sessions/{exercise_id}/complete	Log completion
GET	/wellness/insights	Weekly summary: sentiment trend, mood patterns, recommended activities
4.5. AI Sentiment Analysis (Background & On‑Demand)
Method	Endpoint	Description
POST	/wellness/journal/analyze	Force re‑analysis of a journal entry (admin/user)
GET	/wellness/journal/suggestions	Personalized suggestion based on recent sentiment (e.g., "Try breathing exercise")
Background job: Celery task analyze_journal_sentiment runs on new/updated journal, stores sentiment_score and sentiment_label.

4.6. Pregnancy Module (/pregnancy)
Method	Endpoint	Description
POST	/pregnancy/profile	Create/update pregnancy profile (LMP or due date)
GET	/pregnancy/profile	Get current pregnancy info
POST	/pregnancy/daily-log	Log daily symptoms, cravings
GET	/pregnancy/daily-logs	List logs
GET	/pregnancy/milestone	Current week's milestone (from static table)
GET	/pregnancy/recommendations	Personalized diet/exercise tips (rule‑based + AI)
DELETE	/pregnancy/profile	End pregnancy (archive)
4.7. Safety & SOS (/safety)
Method	Endpoint	Description
GET	/safety/emergency-contacts	List contacts
POST	/safety/emergency-contacts	Add contact
PUT	/safety/emergency-contacts/{contact_id}	Update
DELETE	/safety/emergency-contacts/{contact_id}	Delete
POST	/safety/sos/trigger	Trigger SOS manually (app also uses device‑side double‑click, but this is fallback)
GET	/safety/sos/history	Past SOS alerts with status
POST	/safety/sos/{alert_id}/cancel	Cancel ongoing alert (user safe)
SOS flow (backend):

Receive SOS request with GPS (lat,lng).

Create sos_alert record.

Fetch emergency contacts.

For each: send SMS (via Twilio) with Google Maps link + user's blood group/notes.

Send push notification (FCM) to contacts who have app installed.

Log status.

4.8. Partner / Family Linking (/family)
Method	Endpoint	Description
POST	/family/link/generate	Generate invite link (returns token)
GET	/family/link/{token}/info	Public: show inviter's name (no other data)
POST	/family/link/{token}/accept	Accept link (requires logged‑in family member)
GET	/family/links	List all active family links (outgoing and incoming)
PUT	/family/links/{link_id}/permissions	Update permission level
DELETE	/family/links/{link_id}	Revoke link
GET	/family/shared-data	For family member: aggregated data based on permissions (mood, pregnancy updates)
4.9. Nurse Content (/nurse – role required)
Method	Endpoint	Description
POST	/nurse/contents	Upload video metadata (S3 presigned URL first)
GET	/nurse/contents	List nurse's own content
PUT	/nurse/contents/{content_id}	Update
DELETE	/nurse/contents/{content_id}	Delete
Public endpoints (all users):
| GET | /contents | Approved educational content (paginated, filter by category) |
| GET | /contents/{content_id} | Detail |

Admin endpoints:
| PUT | /admin/contents/{content_id}/approve | Approve/reject |
| GET | /admin/contents/pending | List unapproved |

4.10. Chat System (via Stream Chat Integration)
The backend does not implement chat logic. Instead, it provides:

Method	Endpoint	Description
POST	/chat/token	Generate Stream Chat user token (JWT signed with Stream secret)
POST	/chat/link/generate	Generate a shareable chat room link (invite only)
GET	/chat/rooms	List user's chat rooms (fetched from Stream via server SDK)
How it works:

Each SheCare user gets a Stream user ID = SheCare user UUID.

Chat link contains a room ID (random string) and invites are handled by Stream's create_channel with members.

No public search – only link sharing.

4.11. Admin Module (/admin – role=admin)
Method	Endpoint	Description
GET	/admin/users	List users with filters (role, active)
PUT	/admin/users/{user_id}/role	Change role
POST	/admin/nurses/{nurse_id}/verify	Verify nurse profile
GET	/admin/analytics/dashboard	Aggregated stats (active users, SOS events, pregnancy profiles)
POST	/admin/system/broadcast	Send push notification to all users (rate limited)
5. Authentication & Security Details
5.1. JWT Claims
sub: user UUID

role: user, family, nurse, admin

iat, exp

jti: token ID (for revocation list optional)

Access token expiry: 15 minutes
Refresh token expiry: 7 days (stored in DB, hashed)

5.2. OTP Flow
User enters phone number.

Backend generates 6‑digit code, stores in Redis (key otp:{phone}, TTL 5 min).

Sends via Twilio Verify (or SMS fallback).

On verify: create user if not exists, generate tokens, rotate refresh token.

5.3. Encryption Strategy
At rest: PostgreSQL encrypted using AWS KMS (if using RDS) or LUKS.

Application level: For journal content and medical notes, use client‑side encryption (recommended). Server only stores encrypted blob and cannot decrypt. Alternatively, server‑side with per‑user key stored in a separate KMS service.

In transit: TLS 1.3 only.

5.4. Rate Limiting
Implemented in FastAPI using slowapi with Redis storage.

Per endpoint groups (auth stricter: 5 attempts per 10 min).

5.5. Audit Logs
All actions on sensitive data (view journal, update pregnancy profile, SOS trigger, family link creation) are logged to an audit_logs table with user_id, action, timestamp, IP (hashed).

6. Background Jobs (Celery)
6.1. Tasks
Task Name	Trigger	Description
send_sos_alerts	On SOS trigger	Send SMS & push notifications, retry up to 3 times.
analyze_journal_sentiment	On journal create/update	Call Hugging Face model via Inference API or local container.
update_cycle_predictions	Daily 2 AM	Recompute predictions for all users with sufficient data (at least 3 cycles).
prune_expired_tokens	Daily 3 AM	Delete expired refresh tokens from DB.
generate_weekly_insights	Weekly (Sunday)	Compute sentiment trends, mood patterns, push notification.
check_pregnancy_reminders	Daily 9 AM	Send reminders for upcoming scans, milestones (opt‑in).
cleanup_family_link_tokens	Daily	Delete expired invite tokens.
6.2. Queue Configuration
Redis as broker and result backend.

Queues: default, priority (for SOS), ai (for sentiment).

7. External Service Integrations
7.1. Twilio (SMS & OTP)
OTP: Use Twilio Verify API (more reliable, compliance-ready). Fallback to SMS if Verify not available.

SOS: Send SMS using Twilio Messaging API with pre‑approved template.

7.2. Firebase Cloud Messaging (FCM)
Store FCM registration tokens per user in users.fcm_tokens (JSONB array).

On SOS, send high‑priority notification with click_action to open app.

7.3. Stream Chat
Server SDK (Python) to create users, channels, and issue tokens.

Backend validates that chat links are generated only between users with an existing family link or after invitation.

7.4. Google Maps API
Only used for generating static map preview URL in SOS SMS (not real‑time tracking).

Example: https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=14&size=400x200

7.5. AWS S3
Nurse videos: direct upload via presigned URL (POST /nurse/contents/upload-url returns S3 upload URL).

User avatars: same pattern.

8. Error Handling & Logging
8.1. API Response Format
Success: { "data": {...}, "message": "ok" }

Error: { "error": { "code": "RESOURCE_NOT_FOUND", "details": "..." } }

8.2. HTTP Status Codes
200: Success

201: Created

400: Validation error

401: Unauthorized (invalid/missing token)

403: Forbidden (role insufficient)

404: Resource not found

429: Rate limit exceeded

500: Internal server error (with Sentry reporting)

8.3. Logging Levels
INFO: API requests (without sensitive data), background job starts/ends.

ERROR: Exceptions, failed external calls.

WARNING: Rate limit hits, expired tokens.

Use structured logging (JSON) with request_id for tracing.

9. Deployment & DevOps
9.1. Containerization
Dockerfile for FastAPI app (multi‑stage, non‑root user).

Dockerfile for Celery worker (same codebase).

docker-compose.yml for local development (Postgres, Redis, MinIO).

9.2. Environment Variables (example)
text
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
FCM_SERVICE_ACCOUNT_JSON=...
STREAM_API_KEY=...
STREAM_API_SECRET=...
AWS_ACCESS_KEY=...
HUGGINGFACE_API_TOKEN=...
9.3. CI/CD (GitHub Actions)
On push to main:

Run unit tests (pytest) and linting (ruff).

Build Docker image.

Push to Amazon ECR.

Deploy to ECS/Fargate (rolling update).

Database migrations run automatically on startup using Alembic.

9.4. Scalability
FastAPI behind Application Load Balancer (ALB), auto‑scaling based on CPU/memory.

PostgreSQL read replicas for analytics queries.

Redis Cluster for higher throughput.

10. Testing Strategy (Backend Focus)
10.1. Unit Tests (pytest)
Test each API endpoint with mocked dependencies.

Test authentication, rate limiting, input validation.

Test background tasks in isolation.

10.2. Integration Tests
Use test database (PostgreSQL temp) and Redis.

Test full flows: OTP → create journal → sentiment analysis → prediction update.

Test SOS with Twilio mock.

10.3. Performance Tests
Locust script simulating 500 concurrent users: login, log period, trigger SOS.

Measure p95 latency < 500 ms.

10.4. Security Tests
OWASP ZAP scan on staging.

Dependency scanning (Snyk).

11. Future Feature Stubs (Voice Journal & Emotion Analysis)
Even though not implemented now, the backend must be ready:

11.1. API Endpoints (return 501 with "feature_coming": true)
Method	Endpoint	Planned Behavior
POST	/voice/daily	Accept audio file (base64), store in voice_journal_future, queue for transcription. Returns 202 Accepted.
GET	/voice/analysis/{journal_id}	Return emotion scores once implemented.
POST	/voice/emotion/realtime	For live analysis (WebSocket). Not implemented.
11.2. Database table voice_journal_future (already defined)
Allows seamless migration when feature is built.

11.3. Placeholder Background Task
Celery task process_voice_journal defined but raises NotImplementedError and logs "Feature not yet available".

12. Monitoring & Alerting
Sentry: Capture exceptions from API and workers.

Prometheus: Expose metrics via /metrics (requests per endpoint, error rate, queue length).

Grafana: Dashboard for daily active users, SOS count, sentiment distribution.

Alerting: PagerDuty for >5% error rate or >30s queue backlog.

13. Documentation
OpenAPI (Swagger) auto‑generated by FastAPI at /docs.

Postman Collection exported for manual testing.

Architecture Decision Records (ADR) in /docs/adr/ (e.g., why we chose external chat service).

14. Compliance & Privacy
Data Retention: Journal entries deleted after 2 years (user configurable). SOS logs after 90 days.

Data Deletion: API endpoint DELETE /users/me triggers background task to anonymize or erase all records.

Consent Log: Table user_consents records user's acceptance of privacy policy and AI analysis opt‑in.

Third‑party Subprocessors: Twilio, Stream Chat, Google Maps, AWS – disclosed to users.

15. Conclusion & Next Steps
This backend plan provides a complete, production‑ready blueprint for SheCare. It separates concerns, uses industry‑standard technologies, and leaves clear stubs for future voice features. The estimated lines of code (excluding tests) for the backend is between 3500–4500 lines of Python (API endpoints, models, services, background tasks). With tests, documentation, and configurations, total backend effort is about 2–3 developer months.

Immediate next actions for backend team:

Set up PostgreSQL schema (migrations using Alembic).

Implement authentication module (OTP + JWT).

Build core cycle tracking API.

Integrate sentiment analysis (Hugging Face).

Deploy staging environment on AWS ECS.