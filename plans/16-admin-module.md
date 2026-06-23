# Implementation Plan 15: Admin Module

## Objective
Implement admin-only endpoints for user management, nurse verification, analytics, and broadcasts.

## Steps

### 15.1 Admin auth
- Role-based dependency injection for admin routes.
- Enforce admin role on all /admin endpoints.

### 15.2 User management
- GET /admin/users with role and active filters.
- PUT /admin/users/{id}/role for role changes.

### 15.3 Nurse verification
- POST /admin/nurses/{id}/verify sets verified_at.
- Admin can reject with reason (optional).

### 15.4 Analytics dashboard
- GET /admin/analytics/dashboard with aggregated stats.
- Count active users, SOS events, pregnancy profiles.
- Use read replica if available for performance.

### 15.5 Broadcast
- POST /admin/system/broadcast sends push notification to all users.
- Rate limited to prevent abuse.

## Validation Criteria
- Non-admin users receive 403 on admin routes.
- Broadcast completes and logs delivery counts.
