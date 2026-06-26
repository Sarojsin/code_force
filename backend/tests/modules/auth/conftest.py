"""Shared fixtures for the auth module tests.

We override Twilio with a fake that never hits the network, and we use
SQLite in-memory for fast iteration. Postgres-specific features (JSONB,
UUID column types) are exercised by the integration tests in CI.
"""

from __future__ import annotations

import os
from typing import Any

import pytest

# Test environment must be configured before importing the app.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS__URL", "redis://localhost:6379/15")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")
# Disable real Twilio in tests; the dev-mode path takes over.
os.environ.setdefault("TWILIO__ACCOUNT_SID", "")
os.environ.setdefault("TWILIO__AUTH_TOKEN", "")
os.environ.setdefault("TWILIO__VERIFY_SERVICE_SID", "")


# JSONB → JSON compatibility for SQLite test runner
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


class FakeTwilio:
    """Drop-in replacement for TwilioClient that does not make HTTP calls."""

    def __init__(self) -> None:
        self.has_credentials = False
        self.sent: list[dict[str, Any]] = []
        self.sms: list[dict[str, Any]] = []
        self.approve_codes: set[str] = set()
        self.fail_next = False

    async def send_otp(self, phone: str, channel: str = "sms") -> str:
        self.sent.append({"phone": phone, "channel": channel})
        return f"VERIFY_FAKE_{phone[-4:]}"

    async def verify_otp(self, phone: str, code: str) -> bool:
        if self.fail_next:
            self.fail_next = False
            return False
        return code in self.approve_codes

    async def send_sms(self, to: str, body: str) -> str:
        self.sms.append({"to": to, "body": body})
        return f"SMS_FAKE_{to[-4:]}"

    async def aclose(self) -> None:
        return None


@pytest.fixture
def fake_twilio() -> FakeTwilio:
    return FakeTwilio()
