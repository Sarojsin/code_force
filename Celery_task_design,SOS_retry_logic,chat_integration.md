A. Celery Task Design (Detailed)
A.1. Task Organization
Celery tasks are grouped into modules by responsibility. All tasks share:

Retry policy: Exponential backoff (max 3 retries, except SOS which has custom logic)

Idempotency: Tasks can be safely re-run (using task_id based on business key where possible)

Monitoring: All tasks report duration and outcome to Prometheus

A.2. Task Definitions
tasks/ai.py – Sentiment Analysis
Task name: analyze_journal_sentiment

Args: journal_entry_id (UUID)

Steps:

Fetch journal entry from DB (only if not already analyzed within last hour).
Decrypt content (if server-side encrypted; if client-side encrypted, skip because server cannot read – in that case sentiment is done on device. Choose one model. We'll assume client-side encryption → sentiment on device. For backend plan, we assume opt-in users allow server to read for AI features.)
Call Hugging Face Inference API (or local container) with model distilbert-base-uncased-finetuned-sst-2-english.
Parse response: { "label": "POSITIVE", "score": 0.98 } → convert to sentiment_score (map POSITIVE → +1, NEGATIVE → -1, NEUTRAL → 0) and scale by confidence.
Update journal_entries table.
If sentiment is strongly negative (score < -0.7), trigger a recommendation task (see below).
Retry: On API timeout or rate limit, retry after 60, 300, 900 seconds.

Idempotency: Uses journal_entry_id as task_id prefix; DB check prevents duplicate analysis.

tasks/cycle.py – Prediction Updates
Task name: update_cycle_predictions

Schedule: Daily 2 AM (beat schedule)

Steps:

Query all users with at least 3 complete cycle entries.
For each user:
Calculate average cycle length (mode or median, ignoring outliers > 45 days).
Calculate average luteal phase (if enough data) – optional.
Predict next period start = last period start + average cycle length.
Predict fertile window: ovulation day = next period start - 14 (average), fertile window = ovulation ± 2 days.
Store in predicted_cycles table (upsert).
For users with insufficient data, use default 28-day cycle.
Log number of users processed.
Idempotency: Replace existing prediction for same user/date.

tasks/notifications.py – Push & SMS
Task name: send_push_notification

Args: user_id (UUID), title, body, data (optional dict)

Steps:

Fetch user's FCM tokens from users.fcm_tokens (JSONB array).
For each token, send via FCM using send_multicast.
Remove invalid tokens (response indicates NotRegistered).
Update DB with cleaned token list.
Task name: send_sms (used by SOS)

Args: phone_number, message

Steps:

Call Twilio API.
On failure (e.g., invalid number), log and do not retry (SOS has its own retry wrapper).
tasks/safety.py – SOS Workflow (see detailed section B)
tasks/cleanup.py – Housekeeping
Task name: prune_expired_tokens (daily)

Task name: cleanup_family_link_tokens (hourly)

Task name: anonymize_deleted_users (weekly, GDPR)

A.3. Queue Configuration
Queue Name	Worker Count	Tasks	Priority
priority	2	send_sos_alerts, send_push_notification (SOS only)	High
default	4	Most tasks (cycle updates, cleanup)	Normal
ai	1 (GPU if available)	analyze_journal_sentiment	Low (can be delayed)
A.4. Monitoring & Failure Handling
Dead Letter Queue: Tasks that fail all retries go to a celery dead letter exchange. Admin alerted via Sentry.

Task timeouts: Soft time limit = 30s, hard = 60s for AI; longer for cycle updates.

Visibility timeout: Redis broker – tasks are acknowledged only after success. If worker dies, task is redelivered after visibility timeout (180s).

B. SOS Retry Logic (Detailed)
B.1. Overview
The SOS is the most critical feature. It must be reliable even when the backend is under load, Twilio fails, or the user has poor connectivity. The strategy:

Immediate: Try all contacts in parallel (SMS + push).

Retry with backoff: For each failed delivery attempt, retry up to 3 times with exponential backoff.

Escalation: If all attempts fail after 5 minutes, escalate to a fallback channel (e.g., email if user provided, or log for manual follow-up).

User feedback: The app receives a sos_alert_id and can poll status.

B.2. Celery Task: send_sos_alerts
Trigger: Called synchronously from /safety/sos/trigger API endpoint. The endpoint creates the sos_alert record, then fires the Celery task and returns immediately (202 Accepted) with the alert ID.

Arguments:

alert_id (UUID)

user_id (UUID)

location: { "lat": float, "lng": float, "accuracy": int }

user_medical_info: fetched from DB (blood group, medical notes)

Steps:

Fetch contacts: Get all emergency contacts for the user. If none, log error and send a fallback SMS to the user's own number (self-alert).

Prepare message:

SMS body: "EMERGENCY: [User Name] needs help. Location: https://maps.google.com/?q={lat},{lng}. Blood group: {blood}. Notes: {notes}" (shortened to fit SMS, 160 chars max).

Push notification: { "title": "SOS Alert", "body": "[User Name] triggered emergency. Tap to see location.", "data": { "alert_id": "...", "lat": "...", "lng": "..." } }

For each contact, create a subtask notify_contact (chord) to run in parallel.

Sub-task: notify_contact
Input: contact_id, alert_id, message, push_payload

Steps:

Try push notification (if contact has FCM token).
Try SMS (Twilio).
Record outcome in a sos_notification_attempts table (new table: attempt_id, alert_id, contact_id, channel, status, retry_count, error_message, attempted_at).
If either push or SMS succeeds, mark contact as notified.
If both fail, raise a retryable exception.
Retry logic for notify_contact:

Use Celery's retry with countdown = 2^retry_count * 5 seconds (5, 10, 20 seconds).

Max retries = 3.

After final failure, mark contact as failed and escalate.

Escalation (after all contacts failed for an alert):

A final task escalate_sos is called once all contacts are processed.

It sends an email to a pre‑configured safety email (or logs to a high‑priority Slack channel).

It also marks the alert as needs_manual_intervention.

B.3. Idempotency & Duplicate Prevention
The mobile app may send multiple SOS triggers (e.g., user double‑clicks twice). Backend uses a rate limit for SOS per user: only one active SOS alert per user within 5 minutes. If a second request arrives, return existing alert_id instead of creating a new one.

The sos_alert table has a unique constraint: (user_id, created_at::date) – one per day per user, but rate limit is stricter.

B.4. User Cancellation
Endpoint POST /safety/sos/{alert_id}/cancel:

Cancels any pending Celery tasks for that alert (using revoke(terminate=True) – careful, only if not already sent).

Updates alert status to cancelled.

Sends a follow-up SMS to contacts: "[User Name] is safe. SOS cancelled."

B.5. Monitoring & Alerting for Devops
If any SOS alert has needs_manual_intervention = True, send a PagerDuty alert.

Dashboard: SOS success rate per contact method (target > 99% for SMS, > 95% for push).

C. Chat Integration Details (Stream Chat)
C.1. Why Stream Chat, Not Custom?
Real‑time infrastructure (WebSocket scaling, message ordering, typing indicators) is complex and error‑prone.

Moderation (spam, abuse) requires constant updates.

Compliance: Stream Chat offers GDPR compliance and data locality options.

Cost: Free tier up to 1,000 monthly active users; beyond that, affordable.

C.2. Architecture
SheCare backend acts as a trusted server that:

Creates Stream users (mapping SheCare user UUID → Stream user ID).

Generates short‑lived JWTs for Stream Chat (scoped to the user).

Manages invite links for chat rooms (since we don't allow public search).

No chat data is stored in SheCare database – only references (chat room ID mappings for permission checks).

C.3. User Mapping
When a SheCare user registers, backend automatically creates a Stream user via Server SDK:

python
# Pseudocode
stream_client.users.upsert([{ "id": str(user_id), "name": user.display_name, "role": "user" }])
Role mapping: SheCare user → Stream user; SheCare admin → Stream admin.

C.4. Chat Token Generation (Endpoint: /chat/token)
Mobile app calls this endpoint with valid SheCare JWT.

Backend generates a Stream Chat token using Stream’s create_token(user_id).

Token expiry = 24 hours (re‑fetch on expiry).

Response: { "stream_token": "...", "api_key": "...", "user_id": "..." }

C.5. Invite Link Flow (Private Chat Rooms)
SheCare does not allow searching for users. Instead, to start a 1:1 chat:

User A wants to chat with User B (e.g., family member after linking).

App calls POST /chat/link/generate with { "target_user_id": "uuid-of-B" }.

Backend checks: are A and B already linked via family links? Or is B a nurse? Only allow if there's a pre‑existing relationship or user B has enabled "allow chat requests" (future).

Backend generates a random, unguessable room ID (e.g., room_<uuid>).

Using Stream Chat server SDK, creates a channel of type messaging with members = [A, B].

Returns a shareable link: https://shecare.app/chat/invite/{room_id}.

User A sends this link to User B via external channel (WhatsApp, SMS, etc.).

User B opens link, app calls POST /chat/accept-invite/{room_id} with B’s token. Backend verifies the link hasn’t expired (e.g., 7 days) and adds B to the channel (or the channel already includes B if backend pre‑added them).

Security:

Links are one‑time use? We allow multiple uses within expiry to simplify UX; but backend logs each join.

Link cannot be guessed (UUID v4).

C.6. Group Chats (Family Groups)
For family groups (e.g., woman + husband + mother), we reuse the same link flow but with multiple target users.

Backend creates a channel with all members at link generation time.

The invite link contains a group_id and anyone with the link can join (if not already a member). This is similar to WhatsApp group invites.

C.7. Message Retention & Compliance
Stream Chat allows setting message retention policies (e.g., delete messages after 1 year). We enforce 90 days for health‑related chats.

SheCare backend logs metadata of chat rooms (room_id, member IDs, creation date) for audit purposes – but not message content.

Users can delete their entire chat history via Stream Chat API (call from backend on user deletion).

C.8. Moderation
Stream Chat provides built‑in profanity filter and flagging.

SheCare adds a webhook: when a message is flagged, backend receives a webhook, logs it, and admins can review/ban users.

C.9. Fallback if Stream Chat is Down
Not required for MVP; but we can add a fallback: store messages temporarily in Redis and replay when service recovers. This is complex – better to rely on Stream’s 99.99% SLA.

C.10. Future: Nurse Support Chat
Verified nurses could have a “consultation” chat room type. This would require additional permissions and possibly payment – out of scope for now but supported by Stream’s roles.

D. Integration of All Three (Example Scenario)
User triggers SOS:

App sends POST /safety/sos/trigger with GPS.

Backend creates sos_alert record, returns 202.

Celery task send_sos_alerts runs on priority queue.

It spawns notify_contact subtasks for each emergency contact.

Each subtask tries push (via FCM) and SMS (via Twilio). If a contact doesn’t have the app, push fails, SMS succeeds – recorded.

Retry logic: if Twilio temporarily fails (500 error), retry after 5 seconds.

After 3 retries, if SMS still fails, task marks contact as failed and escalates.

Meanwhile, the user can cancel via POST /safety/sos/{id}/cancel, which revokes pending tasks and sends a cancellation SMS.

User chats with linked partner:

User creates a family link for partner (endpoint /family/link/generate).

Partner accepts link.

User then generates a chat invite link (/chat/link/generate with partner’s ID).

Backend creates Stream channel, returns link.

User sends link via SMS (or copies). Partner opens link, app gets token, joins channel.

All messages go through Stream Chat; SheCare backend only involved in token generation.

User writes a journal entry:

App sends encrypted content to /wellness/journal.

Backend stores it, then triggers analyze_journal_sentiment (Celery, ai queue).

Model returns sentiment, DB updated.

If sentiment is very negative, a separate task suggest_self_care runs, which may trigger a push notification recommending a breathing exercise.

E. Database Additions for the Above
To support SOS retry logic:

sql
-- Table: sos_notification_attempts
-- Tracks each attempt per contact per SOS alert
CREATE TABLE sos_notification_attempts (
    id UUID PRIMARY KEY,
    sos_alert_id UUID REFERENCES sos_alerts(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES emergency_contacts(id),
    channel VARCHAR(20), -- 'sms', 'push'
    status VARCHAR(20), -- 'pending', 'sent', 'failed', 'retrying'
    retry_count SMALLINT DEFAULT 0,
    error_message TEXT,
    attempted_at TIMESTAMPTZ,
    succeeded_at TIMESTAMPTZ
);

-- Add to sos_alerts: escalation_flag, manual_intervention_needed
ALTER TABLE sos_alerts ADD COLUMN escalation_flag BOOLEAN DEFAULT false;
ALTER TABLE sos_alerts ADD COLUMN manual_intervention_needed BOOLEAN DEFAULT false;
To support chat link management:

sql
-- Table: chat_invites
CREATE TABLE chat_invites (
    id UUID PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL, -- Stream channel ID
    inviter_user_id UUID REFERENCES users(id),
    invite_token VARCHAR(255) UNIQUE, -- hashed token for link
    expires_at TIMESTAMPTZ,
    max_uses INT DEFAULT 10,
    use_count INT DEFAULT 0
);
F. Testing These Modules
Module	Test Approach
Celery tasks	Unit test with mocked @shared_task and real Redis in Docker. Test retry by raising retryable exception.
SOS retry	Integration test: simulate Twilio failure (mock returns 500) and verify retry count and escalation.
Chat integration	Use Stream’s test environment. Test token generation, link creation, and that only linked users can chat.
G. Summary of Elaborations
Celery: Designed with queues, idempotency, and dead letter handling. Sentiment and predictions are robust.

SOS: Multi‑channel, exponential backoff, escalation, and user cancellation – ensuring high reliability.

Chat: Outsourced to Stream Chat for real‑time features; backend only manages authentication and link‑based invites, preserving privacy.