# Implementation Plan 8: Safety and SOS Module

## Objective
Implement emergency contacts and SOS alerting with SMS, push, retry, and escalation.

## Steps

### 8.1 Emergency contacts CRUD
- GET/POST/PUT/DELETE /safety/emergency-contacts.
- Enforce single primary contact per user.

### 8.2 SOS trigger
- POST /safety/sos/trigger accepts GPS.
- Create sos_alert, fire Celery task, return 202 with alert_id.
- Rate limit: one active alert per user within 5 minutes.

### 8.3 SOS Celery task
- send_sos_alerts on priority queue.
- For each contact, spawn 
otify_contact subtasks (push + SMS).
- Record attempts in sos_notification_attempts.

### 8.4 Retry logic
- Exponential backoff: 5s, 10s, 20s. Max 3 retries per channel.
- After final failure, mark contact failed.

### 8.5 Escalation
- If all contacts fail, escalate_sos emails safety team or logs to Slack.
- Mark alert with manual_intervention_needed.
- Alert devops via PagerDuty if needed.

### 8.6 Cancellation
- POST /safety/sos/{id}/cancel revokes pending tasks and sends safe SMS.

## Validation Criteria
- SOS creates alert and triggers notifications.
- Retry logic re-runs on simulated Twilio failure.
- Escalation triggers when all contacts fail.
