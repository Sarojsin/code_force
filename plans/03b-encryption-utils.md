# Implementation Plan 22: Encryption and Security Utilities

## Objective
Implement cryptographic utilities for data protection at rest.

## Steps

### 22.1 Encryption service
- Use cryptography Fernet with per-user key derivation.
- Store salt in users.encryption_key_salt.
- Encrypt journal content and medical_notes before DB write.

### 22.2 Key management
- Derive user key from master key + salt using PBKDF2.
- Rotate master key without re-encrypting all data (use envelope encryption).

### 22.3 Secure headers
- Add HSTS, CSP, and other security headers middleware.
- Enforce TLS 1.3 in production.

## Validation Criteria
- Encrypt/decrypt roundtrip succeeds.
- Different users derive different keys.
- Security headers present in responses.
