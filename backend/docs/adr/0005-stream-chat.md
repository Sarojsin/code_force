# ADR 0005: External Chat Service

**Date:** 2026-06-13
**Status:** Accepted

## Context
SheCare needs real-time chat between users, family members, and nurses.

## Decision
Use **Stream Chat** as the external chat provider. SheCare backend generates user tokens and manages room invites; Stream handles message delivery, history, and push.

## Rationale
- Building a real-time chat infrastructure is complex and outside core competency.
- Stream provides moderation, push notifications, and offline sync out of the box.
- HIPAA-compliant BAA available on business plan.

## Consequences
- Chat message content is not stored in SheCare database.
- Stream token generation is a thin wrapper; no chat messages flow through SheCare backend.
- Room invites are managed via SheCare's invite token system for access control.
