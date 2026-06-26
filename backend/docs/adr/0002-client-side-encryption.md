# ADR 0002: Journal Content Encryption

**Date:** 2026-06-13
**Status:** Accepted

## Context
Journal entries and medical notes contain sensitive user data. Must be encrypted at rest.

## Decision
Use **server-side encryption** with a per-user derived key. Encryption is performed in the service layer using `cryptography` Fernet and a key derived from the master key + per-user salt (PBKDF2).

## Rationale
- Client-side encryption would require key management on mobile, which is hard to rotate.
- Server-side gives us the ability to run AI analysis (sentiment) without exposing raw content to third parties.
- Per-user salt prevents bulk decryption if master key leaks.

## Consequences
- Encryption/decryption calls must go through the service layer, never in routes or models.
- AI analysis tasks (sentiment) run inside the encrypted service boundary.
