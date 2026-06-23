# Implementation Plan 21: Voice Journal Placeholder

## Objective
Stub voice journal endpoints and background task for future implementation.

## Steps

### 21.1 API stubs
- POST /voice/daily accepts audio, stores in voice_journal_future, returns 202.
- GET /voice/analysis/{id} returns 501 with feature_coming flag.
- POST /voice/emotion/realtime returns 501.

### 21.2 Background task stub
- Define process_voice_journal Celery task.
- Raise NotImplementedError and log feature not available.

### 21.3 Database
- voice_journal_future table already defined in migration plan.

## Validation Criteria
- Placeholder endpoints return 501 or 202 as specified.
- No impact on existing modules.
