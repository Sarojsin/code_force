# Implementation Plan 40: Session Management and Device Tracking

## Objective
Track user sessions and provide device management features.

## Steps

### 40.1 Session tracking
- Store device info (OS, model) in user_sessions on login.
- Enforce single session per device or allow multiple.

### 40.2 Remote logout
- Endpoint to revoke specific sessions or all sessions.
- List active sessions with last used timestamp.

### 40.3 Suspicious activity
- Detect login from new device or location.
- Notify user via FCM or SMS.

## Validation Criteria
- Sessions created on login.
- Revoke removes session from DB.
- New device login triggers notification.
