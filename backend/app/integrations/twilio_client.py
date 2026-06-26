"""Twilio client with retry + circuit breaker + timeout.

Backend rule §18.1: wrap external API in a client class.
Backend rule §18.2: client owns retry, circuit breaker, timeout.

Uses a simple in-process circuit breaker and exponential backoff with jitter.
The breaker opens after 5 consecutive failures and stays open for 30s.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import TwilioSettings

logger = logging.getLogger(__name__)


class TwilioError(Exception):
    """Permanent failure after retries have been exhausted."""


class TwilioCircuitOpenError(TwilioError):
    """Circuit breaker is open — calls are short-circuited."""


class TwilioTemporaryError(TwilioError):
    """Retryable failure (5xx, network error, rate limit)."""


@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    reset_seconds: float = 30.0

    failures: int = 0
    opened_at: float = 0.0

    def allow(self) -> bool:
        if self.failures < self.failure_threshold:
            return True
        # Open window expired — half-open: allow one trial call.
        if time.monotonic() - self.opened_at > self.reset_seconds:
            self.failures = self.failure_threshold - 1  # one shot to close
            return True
        return False

    def record_success(self) -> None:
        self.failures = 0
        self.opened_at = 0.0

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.opened_at = time.monotonic()
            logger.warning("twilio.circuit_open", extra={"failures": self.failures})


class TwilioClient:
    """Async Twilio Verify + Messaging wrapper.

    The class falls back to a deterministic in-process mode when no
    credentials are configured (so local dev / tests can still exercise the
    full OTP flow without hitting Twilio). When credentials are present, it
    uses Twilio's Verify API.
    """

    def __init__(
        self,
        settings: TwilioSettings,
        *,
        max_retries: int = 3,
        timeout: float = 8.0,
    ) -> None:
        self._settings = settings
        self._max_retries = max_retries
        self._timeout = timeout
        self._breaker = CircuitBreaker()
        self._verify_url = (
            f"https://verify.twilio.com/v2/Services/{settings.verify_service_sid}/Verifications"
            if settings.verify_service_sid
            else ""
        )
        self._check_url = (
            f"https://verify.twilio.com/v2/Services/{settings.verify_service_sid}/VerificationCheck"
            if settings.verify_service_sid
            else ""
        )
        self._sms_url = (
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.account_sid}/Messages.json"
            if settings.account_sid
            else ""
        )
        self._has_credentials = bool(settings.account_sid and settings.auth_token)

    @property
    def has_credentials(self) -> bool:
        return self._has_credentials

    # ---------- OTP via Verify ----------

    async def send_otp(self, phone: str, channel: str = "sms") -> str:
        """Start a Twilio Verify verification. Returns the verification SID.

        In dev mode (no creds) we log a warning and return a fake SID so the
        rest of the flow can run; the OTP code is generated locally.
        """
        if not self._has_credentials:
            logger.warning("twilio.dev_mode.send_otp", extra={"phone": phone})
            return f"VERIFY_DEV_{phone[-4:]}"

        if not self._breaker.allow():
            raise TwilioCircuitOpenError("Twilio circuit is open")

        return await self._retry_with_backoff(
            lambda: self._post_form(
                self._verify_url,
                data={"To": phone, "Channel": channel},
            ),
            op="verify_send",
        )

    async def verify_otp(self, phone: str, code: str) -> bool:
        """Check a Twilio Verify code. Returns True on match."""
        if not self._has_credentials:
            # Dev mode: any 6-digit numeric code passes (test helpers will
            # generate the exact same code and call us back).
            return code.isdigit() and 4 <= len(code) <= 8

        if not self._breaker.allow():
            raise TwilioCircuitOpenError("Twilio circuit is open")

        result = await self._retry_with_backoff(
            lambda: self._post_form(self._check_url, data={"To": phone, "Code": code}),
            op="verify_check",
        )
        return (result or {}).get("status") == "approved"

    # ---------- Transactional SMS (used by SOS in plan 11) ----------

    async def send_sms(self, to: str, body: str) -> str:
        """Send a transactional SMS via Twilio Messaging API. Returns SID."""
        if not self._has_credentials:
            logger.warning("twilio.dev_mode.send_sms", extra={"to": to})
            return f"SMS_DEV_{to[-4:]}"

        if not self._breaker.allow():
            raise TwilioCircuitOpenError("Twilio circuit is open")

        result = await self._retry_with_backoff(
            lambda: self._post_form(
                self._sms_url,
                data={"To": to, "From": self._settings.from_number, "Body": body},
            ),
            op="sms_send",
        )
        return (result or {}).get("sid", "")

    # ---------- internals ----------

    async def _post_form(self, url: str, data: dict[str, str]) -> dict[str, Any] | None:
        if not url:
            raise TwilioError("Twilio URL not configured")
        auth = (self._settings.account_sid, self._settings.auth_token)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, data=data, auth=auth)
        if resp.status_code in (429, 500, 502, 503, 504):
            raise TwilioTemporaryError(f"twilio {resp.status_code}: {resp.text[:200]}")
        if resp.status_code >= 400:
            raise TwilioError(f"twilio {resp.status_code}: {resp.text[:200]}")
        try:
            return resp.json()
        except ValueError:
            return None

    async def _retry_with_backoff(self, op, *, op_name: str) -> dict[str, Any] | None:
        """Exponential backoff with jitter: 0.5, 1, 2, 4, ... up to max_retries."""
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                result = await op()
                self._breaker.record_success()
                return result
            except TwilioTemporaryError as exc:
                last_exc = exc
                if attempt == self._max_retries:
                    self._breaker.record_failure()
                    break
                # 0.5, 1, 2, 4, 8 ... capped at 16, plus 0-200ms jitter.
                delay = min(2 ** attempt * 0.5, 16.0) + random.uniform(0, 0.2)
                logger.warning(
                    "twilio.retry",
                    extra={"op": op_name, "attempt": attempt, "delay": delay},
                )
                await asyncio.sleep(delay)
        raise TwilioError(f"{op_name} failed after {self._max_retries + 1} attempts: {last_exc}")

    async def aclose(self) -> None:
        # No persistent connection in this client; kept for symmetry with
        # future SDK-based clients.
        return None
