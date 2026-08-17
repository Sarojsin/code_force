"""Cloudinary client: media upload URL, delete, and URL helpers.

Backend rule §18: client owns config, retry (SDK built-in), and keeps the
rest of the codebase free of Cloudinary-specific types.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, cast

import cloudinary  # type: ignore[import-untyped]
import cloudinary.api  # type: ignore[import-untyped]
import cloudinary.uploader  # type: ignore[import-untyped]
from cloudinary.utils import cloudinary_url  # type: ignore[import-untyped]

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

    @property
    def configured(self) -> bool:
        """True when credentials are present; deletes are skipped otherwise."""
        return bool(
            self._settings.cloud_name
            and self._settings.api_key
            and self._settings.api_secret
        )

    @staticmethod
    def parse_url(url: str | None) -> tuple[str, str] | None:
        """Extract ``(public_id, resource_type)`` from a Cloudinary delivery URL.

        Returns ``None`` for external links or non-media content so callers can
        skip Cloudinary cleanup safely. Example input:
        ``https://res.cloudinary.com/<cloud>/video/upload/v1653838283/health_content/<id>.mp4``
        """
        if not url:
            return None
        match = re.match(
            r"^https?://res\.cloudinary\.com/[^/]+/(image|video|raw)/upload/(.+)$",
            url.strip(),
        )
        if not match:
            return None
        resource_type, rest = match.groups()
        # Everything before the version marker (v<digits>/) — present in both
        # raw and transformed delivery URLs — is the transformation batch and is
        # not part of the public_id. If there is no version, keep the whole path.
        version = re.search(r"(?:^|/)v\d+/", rest)
        if version:
            rest = rest[version.end() :]
        # public_id keeps the folder prefix but not the file extension.
        last_slash = rest.rfind("/")
        last_dot = rest.rfind(".")
        if last_dot > last_slash:
            rest = rest[:last_dot]
        return rest, resource_type

    def delete_by_url(self, url: str | None) -> None:
        """Delete the asset referenced by a delivery URL.

        No-op for external/non-Cloudinary URLs and when credentials are
        missing. Raises ``CloudinaryError`` on real failures.
        """
        if not self.configured:
            logger.info("cloudinary.delete_skipped_not_configured")
            return
        parsed = self.parse_url(url)
        if parsed is None:
            return
        public_id, resource_type = parsed
        self.delete_by_public_id(public_id, resource_type=resource_type)

    def signed_upload_payload(
        self,
        resource_type: str,
        folder: str = "health_content",
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Return a signed upload payload the mobile client can post to
        ``https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/upload``.

        The signature is generated server-side so the API secret never leaves
        the backend. ``tags`` are embedded so the backend can later find and
        link uploaded assets to a content item.
        """
        try:
            timestamp = int(time.time())
            params: dict[str, Any] = {
                "timestamp": timestamp,
                "folder": folder,
                "tags": ",".join(tags or []),
            }
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
            return cast(str, url)
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