# Implementation Plan 24: Rate Limiting and Abuse Prevention

## Objective
Protect all endpoints from abuse with layered rate limiting.

## Steps

### 24.1 Slowapi configuration
- Redis-backed rate limiter with sliding window.
- Auth endpoints: 5 requests per 10 minutes per IP/phone.
- Default API: 100 requests per minute per user.

### 24.2 SOS rate limit
- One active SOS per user per 5 minutes.
- Return existing alert_id if duplicate request detected.

### 24.3 IP allowlisting
- Optional admin IP allowlist for sensitive endpoints.

## Validation Criteria
- Rate limit returns 429 after threshold.
- SOS duplicate requests return existing alert.
