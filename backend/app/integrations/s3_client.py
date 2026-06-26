"""S3 / MinIO client: presigned URLs for direct upload (plan 06 §6.4).

Backend rule §18: client owns retry, circuit breaker, timeout.
"""

from __future__ import annotations

import logging
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import S3Settings

logger = logging.getLogger(__name__)


class S3Error(Exception):
    """Raised when an S3 operation fails."""


class S3Client:
    def __init__(self, settings: S3Settings) -> None:
        self._settings = settings
        config = Config(
            region_name=settings.region,
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "adaptive"},
        )
        client_kwargs: dict[str, Any] = {
            "config": config,
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
        }
        if settings.endpoint_url:
            client_kwargs["endpoint_url"] = settings.endpoint_url

        self._client = boto3.client("s3", **client_kwargs)

    def presigned_upload_url(
        self,
        bucket: str,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 900,
    ) -> str:
        try:
            url = self._client.generate_presigned_url(
                "put_object",
                Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=expires_in,
            )
            logger.info("s3.presigned_upload", extra={"bucket": bucket, "key": key})
            return url
        except ClientError as exc:
            logger.error("s3.presigned_upload_failed", extra={"error": str(exc)})
            raise S3Error(str(exc)) from exc

    def presigned_download_url(self, bucket: str, key: str, expires_in: int = 3600) -> str:
        try:
            url = self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        except ClientError as exc:
            logger.error("s3.presigned_download_failed", extra={"error": str(exc)})
            raise S3Error(str(exc)) from exc

    def delete_object(self, bucket: str, key: str) -> None:
        try:
            self._client.delete_object(Bucket=bucket, Key=key)
            logger.info("s3.deleted", extra={"bucket": bucket, "key": key})
        except ClientError as exc:
            logger.error("s3.delete_failed", extra={"error": str(exc)})
            raise S3Error(str(exc)) from exc

    def object_exists(self, bucket: str, key: str) -> bool:
        try:
            self._client.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError:
            return False
