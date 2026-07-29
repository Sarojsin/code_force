"""Luna HTTP routes — metadata + static asset serving."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/features/luna", tags=["luna"])

ASSETS_DIR = Path(__file__).resolve().parent / "assets"


class LunaAssetMetadata(BaseModel):
    version: str = "1.1.0"
    size_mb: float = 1.8
    checksum_sha256: str = "a1a9cffea64327cf0fcb6c341da3c6ba7edc86cd8ecbb1f7bbd8ad01b2c6b14f"
    download_url: str = "/api/v1/features/luna/assets/luna_assets_v1.1.0.zip"


@router.get("/metadata", response_model=LunaAssetMetadata)
async def get_luna_metadata() -> LunaAssetMetadata:
    return LunaAssetMetadata()


@router.get("/assets/{filename}")
async def serve_asset(filename: str):
    asset_path = ASSETS_DIR / filename
    if not asset_path.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(str(asset_path), media_type="application/zip")


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
