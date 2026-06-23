# Implementation Plan 14: External Service Integrations

## Objective
Integrate Twilio, FCM, Stream Chat, S3, and Hugging Face into backend services.

## Steps

### 14.1 Twilio integration
- OTP via Twilio Verify with SMS fallback.
- SOS SMS via Twilio Messaging API.
- Handle delivery receipts and error codes.

### 14.2 Firebase Cloud Messaging
- Initialize with service account JSON.
- Send multicast and single-token messages.
- Handle NotRegistered and invalid token responses.

### 14.3 Stream Chat
- Server SDK for user upsert, channel creation, token generation.
- Webhook handler for flagged messages.

### 14.4 S3 / MinIO
- Presigned URL generation for direct upload.
- Validate uploads and store URLs in DB.

### 14.5 Hugging Face
- Call Inference API for sentiment analysis.
- Handle rate limits and timeouts with retries.

## Validation Criteria
- Each service client initializes without errors.
- Mocked integration tests pass.
