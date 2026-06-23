# Implementation Plan 13: Celery Tasks - Notifications and Cleanup

## Objective
Implement Celery tasks for push/SMS notifications and routine cleanup jobs.

## Steps

### 13.1 Push notification task
- send_push_notification: fetch FCM tokens, send multicast.
- Remove invalid tokens from DB after delivery.

### 13.2 SMS task
- send_sms: call Twilio API.
- Log failures without retry (SOS handles its own retry).

### 13.3 Cleanup tasks
- prune_expired_tokens daily at 3 AM.
- cleanup_family_link_tokens hourly.
- nonymize_deleted_users weekly.

### 13.4 Weekly insights
- generate_weekly_insights Sundays.
- Compute sentiment trends and mood patterns.
- Trigger push notification with recommendations.

## Validation Criteria
- Push task removes stale tokens.
- Cleanup tasks delete expired records.
- Insights job completes and sends notification.
