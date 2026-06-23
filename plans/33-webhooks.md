# Implementation Plan 33: Webhook Handling

## Objective
Implement inbound webhooks for external service events.

## Steps

### 33.1 Stream Chat webhooks
- Receive flagged message events.
- Log to audit table and notify admin.
- Verify webhook signature.

### 33.2 Twilio status callbacks
- Handle delivery receipts for SOS SMS.
- Update sos_notification_attempts with final status.

### 33.3 Security
- Validate signatures on all inbound webhooks.
- Rate limit webhook endpoints.

## Validation Criteria
- Webhook endpoint accepts valid payloads.
- Invalid signatures are rejected.
