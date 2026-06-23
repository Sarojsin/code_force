# Implementation Plan 4: User Profile Module

## Objective
Implement profile CRUD, avatar upload, FCM token management, and GDPR soft delete.

## Steps

### 4.1 Profile endpoints
- GET/PUT /users/me with encrypted medical_notes and validated DOB.

### 4.2 Avatar upload
- Presigned S3 URL flow, validate file type/size, store URL.

### 4.3 FCM tokens
- Store JSONB array, deduplicate, allow removal.

### 4.4 Soft delete
- Queue anonymization background job on delete.

### 4.5 Audit logging
- Log profile reads, updates, and deletions.

## Validation Criteria
- Profile update persists.
- Avatar upload works end-to-end.
- Soft delete queues anonymization.
