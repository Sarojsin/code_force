"""Diary Celery tasks (backend_rules §1.8: idempotent, time limits, no sync calls)."""

from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.integrations.s3_client import S3Client


@celery_app.task(
    bind=True,
    soft_time_limit=300,
    time_limit=360,
    max_retries=3,
    acks_late=True,
)
def upload_diary_media(self, media_id: str, user_id: str, local_path: str, mime_type: str) -> dict:
    """Upload a diary media file from local path to S3.

    Called by the mobile background sync after media is captured locally.
    """
    try:
        s3 = S3Client(settings=get_settings().s3)
        bucket = "shecare-diary-media"
        s3_key = f"users/{user_id}/diary/{media_id}/{local_path.split('/')[-1]}"

        with open(local_path, "rb") as f:
            s3.put_object(
                bucket=bucket,
                key=s3_key,
                body=f,
                content_type=mime_type,
            )

        return {"media_id": media_id, "s3_key": s3_key, "status": "synced"}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(
    bind=True,
    soft_time_limit=60,
    time_limit=120,
    max_retries=2,
)
def generate_thumbnail(self, media_id: str, s3_key: str) -> dict:
    """Generate a thumbnail for a diary image/video (placeholder for future).

    Actual implementation requires thumbnailing library (Pillow / ffmpeg).
    Currently just marks the media as having no thumbnail.
    """
    return {"media_id": media_id, "thumbnail_s3_key": None, "status": "skipped"}
