"""External service clients: Twilio, FCM, Stream, S3, HuggingFace.

Backend rule §18: each external API wrapped in a client class with retry,
circuit breaker, and timeout. Modules depend on these, never on the raw SDK.

Lazy imports via __getattr__ so that importing one client does not force
importing all (avoiding hard dependencies on every SDK).
"""

from __future__ import annotations

import typing

if typing.TYPE_CHECKING:
    from app.integrations.fcm_client import FCMClient
    from app.integrations.huggingface_client import HuggingFaceClient
    from app.integrations.s3_client import S3Client
    from app.integrations.stream_client import StreamClient
    from app.integrations.twilio_client import TwilioClient

__all__ = [
    "FCMClient",
    "HuggingFaceClient",
    "S3Client",
    "StreamClient",
    "TwilioClient",
]


def __getattr__(name: str):
    import importlib

    if name in __all__:
        module = importlib.import_module(f"app.integrations.{name.lower().replace('client', '')}_client")
        return getattr(module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
