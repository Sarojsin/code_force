"""Safety/SOS HTTP routes (backend_rules.md §2.2: thin routes).

Endpoints:
  GET    /api/v1/safety/emergency-contacts
  POST   /api/v1/safety/emergency-contacts
  PUT    /api/v1/safety/emergency-contacts/{contact_id}
  DELETE /api/v1/safety/emergency-contacts/{contact_id}
  POST   /api/v1/safety/sos/trigger
  GET    /api/v1/safety/sos/history
  POST   /api/v1/safety/sos/{alert_id}/cancel
  POST   /api/v1/safety/sos/{alert_id}/resolve
  GET    /api/v1/safety/sos/active
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Header, status
from pydantic import BaseModel, Field

from app.modules.auth.dependencies import CurrentUser
from app.modules.safety.dependencies import SafetyServiceDep
from app.modules.safety.models import TriggerSource
from app.modules.safety.schemas import (
    EmergencyContactCreate,
    EmergencyContactResponse,
    EmergencyContactUpdate,
    SafetyStatusResponse,
    SOSAlertResponse,
    SOSCancelResponse,
    SOSHistoryResponse,
)


class SOTriggerCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location_accuracy_m: int | None = None
    trigger_source: str | None = Field(None, pattern=r"^(button|shake|hardware_triple_press)$")


router = APIRouter(prefix="/safety", tags=["safety"])


@router.get(
    "/emergency-contacts",
    response_model=list[EmergencyContactResponse],
    summary="List emergency contacts",
)
async def list_contacts(
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> list[EmergencyContactResponse]:
    contacts = await svc.list_contacts(current_user.id)
    return [EmergencyContactResponse.model_validate(c) for c in contacts]


@router.post(
    "/emergency-contacts",
    response_model=EmergencyContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an emergency contact",
)
async def create_contact(
    payload: EmergencyContactCreate,
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> EmergencyContactResponse:
    contact = await svc.create_contact(current_user.id, payload)
    return EmergencyContactResponse.model_validate(contact)


@router.put(
    "/emergency-contacts/{contact_id}",
    response_model=EmergencyContactResponse,
    summary="Update an emergency contact",
)
async def update_contact(
    contact_id: uuid.UUID,
    payload: EmergencyContactUpdate,
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> EmergencyContactResponse:
    contact = await svc.update_contact(contact_id, current_user.id, payload)
    return EmergencyContactResponse.model_validate(contact)


@router.delete(
    "/emergency-contacts/{contact_id}",
    response_model=None,
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an emergency contact",
)
async def delete_contact(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> None:
    await svc.delete_contact(contact_id, current_user.id)
    return None


@router.post(
    "/sos/trigger",
    response_model=SOSAlertResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger an SOS alert with GPS location",
)
async def trigger_sos(
    payload: SOTriggerCreate,
    current_user: CurrentUser,
    svc: SafetyServiceDep,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> SOSAlertResponse:
    trigger_source = TriggerSource(payload.trigger_source) if payload.trigger_source else None
    alert = await svc.trigger_sos(
        current_user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.location_accuracy_m,
        idempotency_key=idempotency_key,
        trigger_source=trigger_source,
    )
    return SOSAlertResponse.model_validate(alert)


@router.get(
    "/sos/history",
    response_model=list[SOSHistoryResponse],
    summary="Past SOS alerts",
)
async def sos_history(
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> list[SOSHistoryResponse]:
    alerts = await svc.list_history(current_user.id)
    return [SOSHistoryResponse.model_validate(a) for a in alerts]


@router.get(
    "/sos/active",
    response_model=SOSAlertResponse | None,
    summary="Get the current active SOS alert, if any",
)
async def active_sos(
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> SOSAlertResponse | None:
    alert = await svc.get_active_alert(current_user.id)
    if alert is None:
        return None
    return SOSAlertResponse.model_validate(alert)


@router.get(
    "/status",
    response_model=SafetyStatusResponse,
    summary="Get safety status (active SOS + contacts)",
)
async def safety_status(
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> SafetyStatusResponse:
    active = await svc.get_active_alert(current_user.id)
    contacts = await svc.list_contacts(current_user.id)
    return SafetyStatusResponse(
        active_sos=SOSAlertResponse.model_validate(active) if active else None,
        emergency_contacts=[EmergencyContactResponse.model_validate(c) for c in contacts],
    )


@router.post(
    "/sos/{alert_id}/cancel",
    response_model=SOSCancelResponse,
    summary="Cancel an active SOS alert (mark as false alarm)",
)
async def cancel_sos(
    alert_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> SOSCancelResponse:
    alert = await svc.cancel_alert(alert_id, current_user.id)
    return SOSCancelResponse(
        false_alarm=alert.false_alarm,
        contacts_notified_of_false_alarm=len(alert.contact_ids_notified) > 0,
    )


@router.post(
    "/sos/{alert_id}/resolve",
    response_model=SOSAlertResponse,
    summary="Mark SOS as resolved (user is safe)",
)
async def resolve_sos(
    alert_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SafetyServiceDep,
) -> SOSAlertResponse:
    alert = await svc.resolve_alert(alert_id, current_user.id)
    return SOSAlertResponse.model_validate(alert)


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
