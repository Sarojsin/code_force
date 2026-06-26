"""Hugging Face Inference API client: sentiment analysis (plan 06 §6.5).

Backend rule §18: client owns retry, circuit breaker, timeout.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

from app.core.config import HuggingFaceSettings

logger = logging.getLogger(__name__)


class HuggingFaceError(Exception):
    """Raised when the Inference API fails after retries."""


class HuggingFaceClient:
    def __init__(
        self,
        settings: HuggingFaceSettings,
        max_retries: int = 3,
        timeout: float = 15.0,
    ) -> None:
        self._settings = settings
        self._max_retries = max_retries
        self._timeout = timeout
        self._has_credentials = bool(settings.api_token)

    async def analyze_sentiment(self, text: str) -> dict[str, Any]:
        if not text.strip():
            return {"label": "NEUTRAL", "score": 0.0}

        if not self._has_credentials:
            logger.warning("huggingface.dev_mode.analyze_sentiment")
            return {"label": "NEUTRAL", "score": 0.5}

        model = self._settings.sentiment_model
        url = f"{self._settings.inference_url}/{model}"
        headers = {"Authorization": f"Bearer {self._settings.api_token}"}

        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(url, headers=headers, json={"inputs": text})

                if resp.status_code == 503:
                    # Model loading — retry with backoff
                    delay = min(2 ** attempt * 2.0, 30.0) + random.uniform(0, 0.5)
                    logger.warning("huggingface.model_loading", extra={"attempt": attempt, "delay": delay})
                    await asyncio.sleep(delay)
                    continue

                if resp.status_code == 429:
                    delay = min(2 ** attempt * 5.0, 60.0) + random.uniform(0, 1.0)
                    logger.warning("huggingface.rate_limited", extra={"attempt": attempt, "delay": delay})
                    await asyncio.sleep(delay)
                    continue

                if resp.status_code >= 500:
                    raise HuggingFaceError(f"HuggingFace API {resp.status_code}: {resp.text[:200]}")

                if resp.status_code != 200:
                    logger.error("huggingface.api_error", extra={"status": resp.status_code, "body": resp.text[:200]})
                    return {"label": "NEUTRAL", "score": 0.5}

                result = resp.json()
                if isinstance(result, list) and len(result) > 0:
                    predictions = result[0]
                    best = max(predictions, key=lambda x: x.get("score", 0))
                    return {
                        "label": best.get("label", "NEUTRAL").upper(),
                        "score": best.get("score", 0.5),
                    }
                return {"label": "NEUTRAL", "score": 0.5}

            except httpx.TimeoutException as exc:
                last_exc = exc
                logger.warning("huggingface.timeout", extra={"attempt": attempt})
                if attempt == self._max_retries:
                    break
                await asyncio.sleep(min(2 ** attempt * 1.0, 10.0))
            except httpx.RequestError as exc:
                last_exc = exc
                logger.warning("huggingface.network_error", extra={"attempt": attempt})
                if attempt == self._max_retries:
                    break
                await asyncio.sleep(min(2 ** attempt * 1.0, 10.0))

        raise HuggingFaceError(f"Sentiment analysis failed after {self._max_retries + 1} attempts: {last_exc}")
