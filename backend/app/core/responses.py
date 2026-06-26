from __future__ import annotations

import hashlib
from typing import Any

from fastapi import Response


class ETagResponse(Response):
    """Auto-computes a strong ETag from JSON-serialized content."""

    media_type = "application/json"

    def __init__(self, content: Any, *args, **kwargs) -> None:
        body = str(content).encode() if not isinstance(content, bytes) else content
        etag = hashlib.sha256(body).hexdigest()
        kwargs.setdefault("headers", {})
        kwargs["headers"]["ETag"] = f'"{etag}"'
        super().__init__(*args, content=content, **kwargs)
