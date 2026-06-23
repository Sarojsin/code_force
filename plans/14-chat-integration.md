# Implementation Plan 11: Chat Integration via Stream Chat

## Objective
Implement Stream Chat token generation and invite-based private chat rooms.

## Steps

### 11.1 Stream user sync
- Create Stream user on SheCare registration using server SDK.
- Map SheCare UUID to Stream user ID.

### 11.2 Token generation
- POST /chat/token generates short-lived Stream Chat token.
- Token expiry = 24 hours.

### 11.3 Invite link flow
- POST /chat/link/generate validates relationship (family link or nurse).
- Create Stream channel with members.
- Return shareable link with room_id.

### 11.4 Accept invite
- POST /chat/accept-invite/{room_id} adds user to channel.
- Enforce expiry and use_count limits.

### 11.5 Chat metadata
- Store chat_invites table for backend tracking.
- Log room creation, joins, and link usage for audit.

## Validation Criteria
- Token endpoint returns valid Stream token.
- Invite link creates channel and allows join.
- Expired or invalid links are rejected.
