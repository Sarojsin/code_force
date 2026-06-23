# Implementation Plan 25: Health Checks and Readiness

## Objective
Implement health, readiness, and liveness probes for orchestration.

## Steps

### 25.1 Health endpoints
- GET /health/live returns 200 if app is running.
- GET /health/ready checks DB and Redis connectivity.
- GET /health/startup indicates app has finished initialization.

### 25.2 Dependency checks
- Verify database connection with lightweight query.
- Verify Redis ping.
- Optional: check external service reachability (Twilio, FCM).

## Validation Criteria
- Live endpoint always returns 200 when app is up.
- Ready returns 503 when DB is down.
