# Implementation Plan 32: Caching Strategy

## Objective
Implement Redis caching for frequently accessed data to reduce DB load.

## Steps

### 32.1 Cache layers
- Static content cache: breathing exercises, pregnancy milestones (long TTL).
- User profile cache: short TTL (5 min) for non-sensitive fields.
- Rate limit counters: sliding window in Redis.

### 32.2 Cache invalidation
- Invalidate on profile update, content approval, pregnancy profile change.
- Use cache keys with version prefix for easy invalidation.

### 32.3 Fallback
- Gracefully degrade to DB on cache miss or Redis failure.
- Log cache hit/miss ratios for tuning.

## Validation Criteria
- Cached data returned on repeat requests.
- Cache invalidates after update.
- App remains functional if Redis is down.
