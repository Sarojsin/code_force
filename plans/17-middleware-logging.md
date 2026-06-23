# Implementation Plan 16: Middleware, Error Handling, and Logging

## Objective
Standardize API responses, rate limiting, audit logging, and error handling.

## Steps

### 16.1 Response format
- Success: { data, message }.
- Error: { error: { code, details } }.
- Global exception handler for unhandled exceptions.

### 16.2 Rate limiting
- Use slowapi with Redis storage.
- Per-endpoint groups: auth stricter (5/10min), default 100/min.

### 16.3 Audit middleware
- Log sensitive actions with user_id, action, timestamp, hashed IP.
- Use after-request or dependency injection.

### 16.4 Structured logging
- JSON logs with request_id, level, timestamp.
- Log API requests without sensitive data.
- Log background job starts/ends and failures.

## Validation Criteria
- Error responses match standard format.
- Rate limits trigger after threshold.
- Audit logs capture expected actions.
