"""Cloudinary client: media upload URL, delete, and URL helpers.

Backend rule §18: client owns config, retry (SDK built-in), and keeps the
rest of the codebase free of Cloudinary-specific types.
"""

from __future__ import annotations

import logging
from typing import Any

import cloudinary
import cloudinary.api
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

from app.core.config import CloudinarySettings

logger = logging.getLogger("app.integrations.cloudinary")


class CloudinaryError(Exception):
    """Raised when a Cloudinary operation fails."""


class CloudinaryClient:
    def __init__(self, settings: CloudinarySettings) -> None:
        if not settings.cloud_name or not settings.api_key or not settings.api_secret:
            logger.warning("cloudinary.not_configured")
        cloudinary.config(
            cloud_name=settings.cloud_name,
            api_key=settings.api_key,
            api_secret=settings.api_secret,
            secure=True,
        )
        self._settings = settings

    @property
    def cloud_name(self) -> str:
        return self._settings.cloud_name or ""

    def signed_upload_payload(
        self,
        resource_type: str,
        folder: str = "health_content",
        tags: list[str] | None = None,
        expires_in: int = 900,
    ) -> dict[str, Any]:
        """Return a signed upload payload the mobile client can post to
        ``https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/upload``.

        The signature is generated server-side so the API secret never leaves
        the backend. ``tags`` are embedded so the backend can later find and
        link uploaded assets to a content item.
        """
        try:
            timestamp = cloudinary.utils.get_timestamp()
            params: dict[str, Any] = {
                "timestamp": timestamp,
                "folder": folder,
                "tags": ",".join(tags or []),
            }
            if expires_in:
                params["expires_at"] = timestamp + expires_in
            signature = cloudinary.utils.api_sign_request(
                params, self._settings.api_secret
            )
            payload = {
                "cloud_name": self.cloud_name,
                "api_key": self._settings.api_key,
                "timestamp": timestamp,
                "folder": folder,
                "tags": ",".join(tags or []),
                "signature": signature,
            }
            if expires_in:
                payload["expires_at"] = timestamp + expires_in
            logger.info("cloudinary.signed_upload", extra={"folder": folder, "resource_type": resource_type})
            return payload
        except Exception as exc:  # noqa: BLE001 - SDK raises generic Exception
            logger.error("cloudinary.sign_failed", extra={"error": str(exc)})
            raise CloudinaryError(str(exc)) from exc

    def build_url(
        self,
        public_id: str,
        resource_type: str = "image",
        *,
        width: int | None = None,
        height: int | None = None,
        crop: str = "fill",
        quality: str = "auto",
        format: str = "auto",
    ) -> str:
        """Build an optimized delivery URL (auto format + quality)."""
        try:
            options: dict[str, Any] = {"secure": True, "resource_type": resource_type}
            if width:
                options["width"] = width
            if height:
                options["height"] = height
            if crop:
                options["crop"] = crop
            if quality:
                options["quality"] = quality
            if format:
                options["format"] = format
            url, _ = cloudinary_url(public_id, **options)
            return url
        except Exception as exc:  # noqa: BLE001
            logger.error("cloudinary.url_failed", extra={"error": str(exc), "public_id": public_id})
            raise CloudinaryError(str(exc)) from exc

    def delete_by_public_id(self, public_id: str, resource_type: str = "image") -> None:
        """Delete a single asset. Idempotent — missing assets do not raise."""
        try:
            result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            if result.get("result") not in {"ok", "not found"}:
                logger.warning("cloudinary.delete_unexpected", extra={"result": result, "public_id": public_id})
            else:
                logger.info("cloudinary.deleted", extra={"public_id": public_id, "resource_type": resource_type})
        except Exception as exc:  # noqa: BLE001
            logger.error("cloudinary.delete_failed", extra={"error": str(exc), "public_id": public_id})
            raise CloudinaryError(str(exc)) from exc

    def delete_resources(self, public_ids: list[str], resource_type: str = "image") -> None:
        """Delete multiple assets by public id (images/video/raw)."""
        if not public_ids:
            return
        try:
            result = cloudinary.api.delete_resources(
                public_ids, resource_type=resource_type
            )
            deleted = result.get("deleted", {})
            logger.info("cloudinary.bulk_deleted", extra={"count": len(deleted), "resource_type": resource_type})
        except Exception as exc:  # noqa: BLE001
            logger.error("cloudinary.bulk_delete_failed", extra={"error": str(exc)})
            raise CloudinaryError(str(exc)) from exc