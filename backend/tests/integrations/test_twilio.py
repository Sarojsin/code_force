"""Twilio client unit tests (no real network)."""

from __future__ import annotations

import pytest

from app.core.config import TwilioSettings
from app.integrations.twilio_client import (
    CircuitBreaker,
    TwilioClient,
)


def test_circuit_breaker_opens_after_threshold() -> None:
    cb = CircuitBreaker(failure_threshold=3, reset_seconds=10)
    assert cb.allow() is True
    cb.record_failure()
    cb.record_failure()
    assert cb.allow() is True
    cb.record_failure()
    assert cb.allow() is False


def test_circuit_breaker_resets_on_success() -> None:
    cb = CircuitBreaker(failure_threshold=2, reset_seconds=10)
    cb.record_failure()
    cb.record_failure()
    assert cb.allow() is False
    # Simulate elapsed time.
    cb.opened_at -= 11
    assert cb.allow() is True
    cb.record_success()
    assert cb.failures == 0


def test_dev_mode_works_without_credentials() -> None:
    client = TwilioClient(TwilioSettings(account_sid="", auth_token=""))
    assert client.has_credentials is False


@pytest.mark.asyncio
async def test_send_otp_dev_mode_returns_sid() -> None:
    client = TwilioClient(TwilioSettings(account_sid="", auth_token=""))
    sid = await client.send_otp("+14155552671")
    assert sid.startswith("VERIFY_DEV_")


@pytest.mark.asyncio
async def test_verify_otp_dev_mode_accepts_digits() -> None:
    client = TwilioClient(TwilioSettings(account_sid="", auth_token=""))
    assert await client.verify_otp("+14155552671", "123456") is True
    assert await client.verify_otp("+14155552671", "abc") is False
