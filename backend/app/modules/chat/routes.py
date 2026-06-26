"""Chat HTTP routes (plan 14).

Endpoints:
  POST /api/v1/chat/token
  POST /api/v1/chat/link/generate
  POST /api/v1/chat/link/{token}/use
  GET  /api/v1/chat/rooms
"""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.auth.dependencies import CurrentUser
from app.modules.chat.dependencies import ChatServiceDep
from app.modules.chat.schemas import (
    ChatTokenResponse,
    InviteLinkCreate,
    InviteLinkResponse,
    RoomResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post(
    "/token",
    response_model=ChatTokenResponse,
    summary="Generate a Stream Chat token for the authenticated user",
)
async def get_chat_token(
    current_user: CurrentUser,
    svc: ChatServiceDep,
) -> ChatTokenResponse:
    token = svc.generate_token(str(current_user.id))
    return ChatTokenResponse(token=token, user_id=str(current_user.id))


@router.post(
    "/link/generate",
    response_model=InviteLinkResponse,
    summary="Generate a shareable chat room invite link",
)
async def generate_invite_link(
    payload: InviteLinkCreate,
    current_user: CurrentUser,
    svc: ChatServiceDep,
) -> InviteLinkResponse:
    invite = await svc.create_invite(current_user.id, payload.room_id, payload.max_uses)
    return InviteLinkResponse(
        invite_token=invite.invite_token,
        room_id=invite.room_id,
        expires_at=invite.expires_at,
    )


@router.post(
    "/link/{token}/use",
    summary="Use an invite link to join a chat room",
)
async def use_invite_link(
    token: str,
    svc: ChatServiceDep,
) -> dict:
    room_id = await svc.use_invite(token)
    return {"room_id": room_id, "message": "Joined room"}


@router.get(
    "/rooms",
    response_model=list[RoomResponse],
    summary="List user's chat rooms",
)
async def list_rooms(
    current_user: CurrentUser,
    svc: ChatServiceDep,
) -> list[RoomResponse]:
    rooms = await svc.list_rooms(current_user.id)
    return [RoomResponse(**r) for r in rooms]


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
