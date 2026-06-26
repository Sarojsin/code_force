"""Safety / SOS service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator
from typing import Any, ClassVar

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"


from app.core.database import Base
from app.modules.safety.exceptions import (
    ActiveSOSExistsError,
    ContactLimitExceededError,
    ContactNotFoundError,
    DuplicateIdempotencyError,
    SMSRateLimitExceededError,
    SOSAlertNotFoundError,
    SOSAlreadyCancelledError,
)
from app.modules.safety.models import TriggerSource
from app.modules.safety.schemas import EmergencyContactCreate, EmergencyContactUpdate
from app.modules.safety.services import SafetyService


class FakeTwilio:
    def __init__(self) -> None:
        self.sms: list[dict[str, Any]] = []

    async def send_sms(self, to: str, body: str) -> str:
        self.sms.append({"to": to, "body": body})
        return f"SID_{to[-4:]}"

    async def aclose(self) -> None:
        return None


class FakeFCM:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_to_token(self, token: str, title: str, body: str, data: dict | None = None) -> str:
        self.sent.append({"token": token, "title": title, "body": body})
        return "msg_ok"

    async def send_multicast(self, tokens: list[str], title: str, body: str, data: dict | None = None) -> dict:
        return {"success_count": len(tokens), "failure_count": 0, "invalid_tokens": []}


class FakeSettings:
    environment = "test"
    cors_origins: ClassVar[list[str]] = ["*"]
    debug = False
    encryption = None


class FakeEventBus:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def emit(self, event: str, **kwargs: Any) -> None:
        self.events.append({"event": event, **kwargs})

    def subscribe(self, event: str) -> Any:
        return lambda fn: fn


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.safety import models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> SafetyService:
    twilio = FakeTwilio()
    fcm = FakeFCM()
    settings = FakeSettings()
    return SafetyService(db=db_session, twilio=twilio, fcm=fcm, settings=settings)  # type: ignore[arg-type]


@pytest_asyncio.fixture
async def svc_with_bus(db_session: AsyncSession) -> tuple[SafetyService, FakeEventBus]:
    twilio = FakeTwilio()
    fcm = FakeFCM()
    settings = FakeSettings()
    bus = FakeEventBus()
    svc = SafetyService(db=db_session, twilio=twilio, fcm=fcm, settings=settings, event_bus=bus)  # type: ignore[arg-type]
    return svc, bus


user_id = uuid.uuid4()
other_user_id = uuid.uuid4()


# ---- Contact CRUD ----

@pytest.mark.asyncio
async def test_create_contact(svc: SafetyService) -> None:
    data = EmergencyContactCreate(name="Mom", phone_number="+14155552671", relationship="mother", is_primary=True)
    contact = await svc.create_contact(user_id, data)
    assert contact.name == "Mom"
    assert contact.is_primary is True


@pytest.mark.asyncio
async def test_list_contacts(svc: SafetyService) -> None:
    await svc.create_contact(user_id, EmergencyContactCreate(name="Dad", phone_number="+14155552672"))
    contacts = await svc.list_contacts(user_id)
    assert len(contacts) == 1


@pytest.mark.asyncio
async def test_get_contact_not_found(svc: SafetyService) -> None:
    with pytest.raises(ContactNotFoundError):
        await svc._get_contact(uuid.uuid4(), user_id)


@pytest.mark.asyncio
async def test_update_contact(svc: SafetyService) -> None:
    data = EmergencyContactCreate(name="Sister", phone_number="+14155552673")
    contact = await svc.create_contact(user_id, data)
    updated = await svc.update_contact(contact.id, user_id, EmergencyContactUpdate(name="Brother"))
    assert updated.name == "Brother"


@pytest.mark.asyncio
async def test_delete_contact(svc: SafetyService) -> None:
    contact = await svc.create_contact(user_id, EmergencyContactCreate(name="Friend", phone_number="+14155552674"))
    await svc.delete_contact(contact.id, user_id)
    with pytest.raises(ContactNotFoundError):
        await svc._get_contact(contact.id, user_id)


@pytest.mark.asyncio
async def test_create_contact_max_limit(svc: SafetyService) -> None:
    for i in range(5):
        await svc.create_contact(user_id, EmergencyContactCreate(name=f"Contact {i}", phone_number=f"+1415555267{i}"))
    with pytest.raises(ContactLimitExceededError):
        await svc.create_contact(user_id, EmergencyContactCreate(name="Too Many", phone_number="+14155552675"))


@pytest.mark.asyncio
async def test_row_level_permission_contact(svc: SafetyService) -> None:
    contact = await svc.create_contact(user_id, EmergencyContactCreate(name="Mine", phone_number="+14155552671"))
    with pytest.raises(ContactNotFoundError):
        await svc._get_contact(contact.id, other_user_id)


# ---- SOS ----

@pytest.mark.asyncio
async def test_trigger_sos(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.7128, longitude=-74.0060)
    assert alert.id is not None
    assert float(alert.latitude) == 40.7128
    assert alert.cancelled_at is None


@pytest.mark.asyncio
async def test_trigger_sos_rate_limit(svc: SafetyService) -> None:
    await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    with pytest.raises(ActiveSOSExistsError):
        await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)


@pytest.mark.asyncio
async def test_cancel_alert(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    cancelled = await svc.cancel_alert(alert.id, user_id)
    assert cancelled.cancelled_at is not None


@pytest.mark.asyncio
async def test_list_history(svc: SafetyService) -> None:
    await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    history = await svc.list_history(user_id)
    assert len(history) == 1


@pytest.mark.asyncio
async def test_process_sos_notifications(svc: SafetyService) -> None:
    await svc.create_contact(user_id, EmergencyContactCreate(name="Mom", phone_number="+14155552671"))
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    await svc.process_sos_notifications(alert.id)
    twilio = svc.twilio
    assert len(twilio.sms) == 1
    assert "SOS" in twilio.sms[0]["body"]


@pytest.mark.asyncio
async def test_trigger_sos_idempotency(svc: SafetyService) -> None:
    key = "test_idem_key_001"
    await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, idempotency_key=key)
    with pytest.raises(DuplicateIdempotencyError):
        await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, idempotency_key=key)


# ---- Event bus emissions ----

@pytest.mark.asyncio
async def test_trigger_sos_emits_event(svc_with_bus: tuple[SafetyService, FakeEventBus]) -> None:
    svc, bus = svc_with_bus
    await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    assert len(bus.events) == 1
    assert bus.events[0]["event"] == "sos_triggered"
    assert bus.events[0]["user_id"] == str(user_id)


@pytest.mark.asyncio
async def test_resolve_alert_emits_event(svc_with_bus: tuple[SafetyService, FakeEventBus]) -> None:
    svc, bus = svc_with_bus
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    bus.events.clear()
    await svc.resolve_alert(alert.id, user_id)
    resolved = [e for e in bus.events if e["event"] == "sos_resolved"]
    assert len(resolved) == 1


@pytest.mark.asyncio
async def test_cancel_alert_emits_event(svc_with_bus: tuple[SafetyService, FakeEventBus]) -> None:
    svc, bus = svc_with_bus
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    bus.events.clear()
    await svc.cancel_alert(alert.id, user_id)
    cancelled = [e for e in bus.events if e["event"] == "sos_cancelled"]
    assert len(cancelled) == 1


# ---- get_active_alert ----

@pytest.mark.asyncio
async def test_get_active_alert_returns_none_when_none(svc: SafetyService) -> None:
    result = await svc.get_active_alert(user_id)
    assert result is None


@pytest.mark.asyncio
async def test_get_active_alert_returns_active(svc: SafetyService) -> None:
    await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    result = await svc.get_active_alert(user_id)
    assert result is not None
    assert result.cancelled_at is None
    assert result.resolved_at is None


@pytest.mark.asyncio
async def test_get_active_alert_none_after_resolve(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    await svc.resolve_alert(alert.id, user_id)
    result = await svc.get_active_alert(user_id)
    assert result is None


# ---- SOS resolve / cancel edge cases ----

@pytest.mark.asyncio
async def test_resolve_non_existent_alert(svc: SafetyService) -> None:
    with pytest.raises(SOSAlertNotFoundError):
        await svc.resolve_alert(uuid.uuid4(), user_id)


@pytest.mark.asyncio
async def test_cancel_non_existent_alert(svc: SafetyService) -> None:
    with pytest.raises(SOSAlertNotFoundError):
        await svc.cancel_alert(uuid.uuid4(), user_id)


@pytest.mark.asyncio
async def test_double_cancel_raises(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    await svc.cancel_alert(alert.id, user_id)
    with pytest.raises(SOSAlreadyCancelledError):
        await svc.cancel_alert(alert.id, user_id)


# ---- SMS body accuracy note ----

@pytest.mark.asyncio
async def test_sms_body_has_accuracy_note_when_low_accuracy(svc: SafetyService) -> None:
    await svc.create_contact(user_id, EmergencyContactCreate(name="Mom", phone_number="+14155552671"))
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, accuracy=800)
    await svc.process_sos_notifications(alert.id)
    twilio = svc.twilio
    assert len(twilio.sms) == 1
    assert "Location approximate" in twilio.sms[0]["body"]


@pytest.mark.asyncio
async def test_sms_body_no_accuracy_note_when_good_accuracy(svc: SafetyService) -> None:
    await svc.create_contact(user_id, EmergencyContactCreate(name="Mom", phone_number="+14155552671"))
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, accuracy=100)
    await svc.process_sos_notifications(alert.id)
    twilio = svc.twilio
    assert "Location approximate" not in twilio.sms[0]["body"]


# ---- SMS rate limit ----

@pytest.mark.asyncio
async def test_sms_rate_limit_exceeded(svc: SafetyService) -> None:
    """Trigger 6 SMS attempts within the same hour; the 6th should fail."""
    await svc.create_contact(user_id, EmergencyContactCreate(name="Mom", phone_number="+14155552671"))
    for i in range(5):
        alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, idempotency_key=f"rate_key_{i}")
        await svc.process_sos_notifications(alert.id)
        await svc.cancel_alert(alert.id, user_id)
    alert6 = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, idempotency_key="rate_key_6")
    with pytest.raises(SMSRateLimitExceededError):
        await svc.process_sos_notifications(alert6.id)


# ---- Additional edge cases ----

@pytest.mark.asyncio
async def test_create_contact_not_primary(svc: SafetyService) -> None:
    contact = await svc.create_contact(user_id, EmergencyContactCreate(name="Sibling", phone_number="+14155552675"))
    assert contact.name == "Sibling"
    assert contact.is_primary is False


@pytest.mark.asyncio
async def test_trigger_sos_with_trigger_source(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, trigger_source=TriggerSource.button)
    assert alert.trigger_source == TriggerSource.button


@pytest.mark.asyncio
async def test_resolve_alert_already_resolved(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    await svc.resolve_alert(alert.id, user_id)
    with pytest.raises(SOSAlreadyCancelledError):
        await svc.resolve_alert(alert.id, user_id)


@pytest.mark.asyncio
async def test_list_history_empty(svc: SafetyService) -> None:
    history = await svc.list_history(user_id)
    assert history == []


# ---- Row-level SOS isolation ----

@pytest.mark.asyncio
async def test_row_level_permission_alert(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    with pytest.raises(SOSAlertNotFoundError):
        await svc.get_alert(alert.id, other_user_id)
