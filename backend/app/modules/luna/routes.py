from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/features/luna", tags=["luna"])


class LunaAssetMetadata(BaseModel):
    version: str = "1.1.0"
    size_mb: float = 5.0
    checksum_sha256: str = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1"
    download_url: str = "https://cdn.shecare.app/luna_assets_v1.1.0.zip"


@router.get("/metadata", response_model=LunaAssetMetadata)
async def get_luna_metadata():
    return LunaAssetMetadata()
