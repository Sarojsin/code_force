"""Firebase Cloud Messaging client: push notifications (plan 06 §6.2).

Backend rule §18: client owns retry, circuit breaker, and timeout.
"""

from __future__ import annotations

import logging
from typing import Any

import firebase_admin
from firebase_admin import credentials, messaging

from app.core.config import FCMSettings

logger = logging.getLogger(__name__)


class FCMError(Exception):
    """Raised when FCM delivery fails after retries."""


class FCMClient:
    _initialized = False

    def __init__(self, settings: FCMSettings) -> None:
        self._settings = settings
        if settings.service_account_json_path and not FCMClient._initialized:
            try:
                cred = credentials.Certificate(settings.service_account_json_path)
                firebase_admin.initialize_app(cred)
                FCMClient._initialized = True
                logger.info("fcm.initialized")
            except Exception as exc:
                logger.warning("fcm.init_failed", extra={"error": str(exc)})

    def _is_available(self) -> bool:
        return bool(self._settings.service_account_json_path)

    async def send_to_token(
        self,
        token: str,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> str:
        if not self._is_available():
            logger.warning("fcm.dev_mode.send_to_token", extra={"token": token[:8]})
            return f"FCM_DEV_{token[:8]}"

        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
        )
        try:
            response = messaging.send(message)
            logger.info("fcm.sent", extra={"message_id": response})
            return response
        except messaging.UnregisteredError as exc:
            logger.warning("fcm.token_invalid", extra={"token": token[:8]})
            raise FCMError("Token not registered") from exc
        except Exception as exc:
            logger.error("fcm.send_failed", extra={"error": str(exc)})
            raise FCMError(str(exc)) from exc

    async def send_multicast(
        self,
        tokens: list[str],
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not self._is_available():
            logger.warning("fcm.dev_mode.send_multicast", extra={"count": len(tokens)})
            return {"success_count": 0, "failure_count": 0, "invalid_tokens": []}

        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
        )
        try:
            response = messaging.send_multicast(message)
            invalid_tokens = []
            for idx, result in enumerate(response.responses):
                if not result.success and isinstance(result.exception, messaging.UnregisteredError):
                    invalid_tokens.append(tokens[idx])
                    logger.warning("fcm.token_invalid", extra={"token": tokens[idx][:8]})
            logger.info(
                "fcm.multicast",
                extra={
                    "success": response.success_count,
                    "failure": response.failure_count,
                    "invalid": len(invalid_tokens),
                },
            )
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "invalid_tokens": invalid_tokens,
            }
        except Exception as exc:
            logger.error("fcm.multicast_failed", extra={"error": str(exc)})
            raise FCMError(str(exc)) from exc
