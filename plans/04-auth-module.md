# Plan 4: Authentication Module

## Steps
1. Build OTP service: Twilio Verify with Redis store (key otp:{phone}, TTL 5min), SMS fallback.
2. Implement JWT with python-jose: claims {sub, role, iat, exp, jti}, 15min access, 7d refresh.
3. Implement refresh token rotation with hashed storage in user_sessions.
4. Build TOTP MFA: enable/verify endpoints, encrypted secret storage, enforcement on login.
5. Add optional password support with passlib bcrypt.
6. Add token revocation list in Redis for logout.

## Validation
- OTP sent/verified with mocked Twilio
- Token rotation works, revoked tokens cannot be reused
- MFA enrollment/verification complete
