# Implementation Plan 9: Family Linking Module

## Objective
Implement invite-based family linking with permission levels and shared data access.

## Steps

### 9.1 Invite generation
- POST /family/link/generate creates unique invite_token.
- Store hashed token, expiry, permission_level.
- Return shareable link.

### 9.2 Invite acceptance
- GET /family/link/{token}/info shows inviter name only.
- POST /family/link/{token}/accept links users.
- Enforce one-time use and expiry.

### 9.3 Link management
- List active links (outgoing and incoming).
- PUT /family/links/{id}/permissions updates bitmask.
- DELETE /family/links/{id} revokes.

### 9.4 Shared data access
- GET /family/shared-data returns allowed data for family member.
- Filter by permission_level (mood, pregnancy, cycle, sos_contact).

## Validation Criteria
- Invite flow creates valid link.
- Expired token is rejected.
- Shared data respects permissions.
