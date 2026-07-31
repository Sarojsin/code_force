"""Diary assets HTTP routes — metadata + static asset serving."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/features/diary", tags=["diary_assets"])

ASSETS_DIR = Path(__file__).resolve().parent / "assets"


class DiaryAssetMetadata(BaseModel):
    version: str = "1.0.0"
    size_mb: float = 0.39
    checksum_sha256: str = "e5dc38d44f6efd829a80106863f0cc5859d069c7ed9fe734adc76ffb5e19e8bb"
    download_url: str = "/api/v1/features/diary/assets/diary_assets_v1.0.0.zip"
    manifest: dict = {
        "asset_version": "1.0.0",
        "minimum_app_version": "1.0.0",
        "compatible_versions": ["1.0.0"],
    }


@router.get("/metadata", response_model=DiaryAssetMetadata)
async def get_diary_metadata() -> DiaryAssetMetadata:
    return DiaryAssetMetadata()


@router.get("/assets/{filename}")
async def serve_asset(filename: str):
    asset_path = ASSETS_DIR / filename
    if not asset_path.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(str(asset_path), media_type="application/zip")


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
