# Plan 3: Encryption and Security Utilities

## Steps
1. Implement cryptography Fernet wrapper with per-user key derivation (PBKDF2 + master key + salt).
2. Create encrypt/decrypt helpers for journal content and medical_notes.
3. Add security headers middleware: HSTS, CSP, X-Content-Type-Options.
4. Enforce TLS 1.3 in production config.
5. Add SECRET_KEY, REFRESH_SECRET_KEY env validation at startup.

## Validation
- Roundtrip encrypt/decrypt succeeds
- Different users derive different keys
- Security headers present in responses
