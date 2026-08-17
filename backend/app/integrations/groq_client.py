"""Groq (Llama 3) chat-completions client: cycle report generation.

Backend rule §18 / AGENTS §1.15: the client owns retry, timeout, and
circuit-friendly handling. No credentials (or disabled) => generate_report
returns an empty string so callers fall back to the rule-based generator.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

from app.core.config import GroqSettings

logger = logging.getLogger(__name__)


class GroqError(Exception):
    """Raised when Groq fails after retries."""


_PROMPT_SYSTEM = (
    "You are a women's health data analyst. Based on the user's cycle data "
    "provided, generate a health summary in strict JSON format matching this "
    "schema exactly. Include an overall summary, a cycle regularity score "
    "(0-100 integer), the top recurring symptoms, one lifestyle correlation "
    "(e.g. sleep vs energy) found in the data, and a carefully worded "
    "non-diagnostic doctor's note. When the provided stats contain "
    "avg_period_length_days, avg_cycle_length_days, avg_sleep_hours, "
    "avg_pain_level, or common_moods, echo those numeric/array values verbatim "
    "into the response under the same keys (or omit them when absent). "
    "Output ONLY valid JSON — no markdown, no code fences, no commentary."
)


class GroqClient:
    def __init__(
        self,
        settings: GroqSettings,
        max_retries: int = 3,
        timeout: float = 30.0,
    ) -> None:
        self._settings = settings
        self._max_retries = max_retries
        self._timeout = timeout
        self._has_credentials = bool(settings.api_key and settings.enabled)

    async def generate_report(self, prompt: str) -> str:
        """Return the raw LLM text response for the report prompt.

        Empty string when Groq is disabled or has no credentials, so callers
        can switch to the deterministic rule-based generator.
        """
        if not self._has_credentials:
            logger.warning("groq.dev_mode_rule_based_fallback")
            return ""

        payload: dict[str, Any] = {
            "model": self._settings.model,
            "messages": [
                {"role": "system", "content": _PROMPT_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            "temperature": self._settings.temperature,
            "max_tokens": self._settings.max_tokens,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {self._settings.api_key}",
            "Content-Type": "application/json",
        }

        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(
                        self._settings.inference_url,
                        headers=headers,
                        json=payload,
                    )

                if resp.status_code == 429:
                    delay = min(2**attempt * 5.0, 60.0) + random.uniform(0, 1.0)
                    logger.warning("groq.rate_limited", extra={"attempt": attempt, "delay": delay})
                    await asyncio.sleep(delay)
                    continue

                if resp.status_code >= 500:
                    delay = min(2**attempt * 2.0, 30.0) + random.uniform(0, 0.5)
                    logger.warning("groq.server_error", extra={"status": resp.status_code, "attempt": attempt})
                    await asyncio.sleep(delay)
                    continue

                if resp.status_code != 200:
                    logger.error(
                        "groq.api_error",
                        extra={"status": resp.status_code, "body": resp.text[:200]},
                    )
                    return ""

                data = resp.json()
                choices = data.get("choices") or []
                if not choices:
                    return ""
                content = choices[0].get("message", {}).get("content")
                return content if isinstance(content, str) else ""

            except httpx.TimeoutException as exc:
                last_exc = exc
                logger.warning("groq.timeout", extra={"attempt": attempt})
                if attempt == self._max_retries:
                    break
                await asyncio.sleep(min(2**attempt * 1.0, 10.0))
            except httpx.RequestError as exc:
                last_exc = exc
                logger.warning("groq.network_error", extra={"attempt": attempt})
                if attempt == self._max_retries:
                    break
                await asyncio.sleep(min(2**attempt * 1.0, 10.0))

        raise GroqError(f"Groq request failed after {self._max_retries + 1} attempts: {last_exc}")
