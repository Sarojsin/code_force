from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any, ClassVar

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base
from app.modules.safety.exceptions import (
    ActiveSOSExistsError,
    ContactNotFoundError,
    SOSAlertNotFoundError,
)
from app.modules.safety.models import SOSAlert
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
        from app.modules.auth import models as auth_models  # noqa: F401
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
    return SafetyService(db=db_session, twilio=twilio, fcm=fcm, settings=settings)


@pytest_asyncio.fixture
async def svc_with_bus(db_session: AsyncSession) -> tuple[SafetyService, FakeEventBus]:
    twilio = FakeTwilio()
    fcm = FakeFCM()
    settings = FakeSettings()
    bus = FakeEventBus()
    svc = SafetyService(db=db_session, twilio=twilio, fcm=fcm, settings=settings, event_bus=bus)
    return svc, bus


user_id = uuid.uuid4()
other_user_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_get_alert_by_id(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    found = await svc.get_alert(alert.id, user_id)
    assert found.id == alert.id


@pytest.mark.asyncio
async def test_get_alert_wrong_user(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    with pytest.raises(SOSAlertNotFoundError):
        await svc.get_alert(alert.id, other_user_id)


@pytest.mark.asyncio
async def test_process_sos_notifications_no_contacts(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    await svc.process_sos_notifications(alert.id)
    assert alert.manual_intervention_needed is True


@pytest.mark.asyncio
async def test_trigger_sos_with_idempotency_key(svc: SafetyService) -> None:
    key = "unique-key-001"
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0, idempotency_key=key)
    assert alert.idempotency_key == key


@pytest.mark.asyncio
async def test_update_contact_clear_primary(svc: SafetyService) -> None:
    c1 = await svc.create_contact(user_id, EmergencyContactCreate(name="Mom", phone_number="+1111111111", is_primary=True))
    c2 = await svc.create_contact(user_id, EmergencyContactCreate(name="Dad", phone_number="+1222222222", is_primary=True))
    assert c2.is_primary is True
    fresh_c1 = await svc._get_contact(c1.id, user_id)
    assert fresh_c1.is_primary is False


@pytest.mark.asyncio
async def test_update_contact_with_linked_user(svc: SafetyService) -> None:
    c = await svc.create_contact(user_id, EmergencyContactCreate(name="Sister", phone_number="+1333333333"))
    linked_id = str(uuid.uuid4())
    updated = await svc.update_contact(c.id, user_id, EmergencyContactUpdate(contact_user_id=linked_id))
    assert updated.contact_user_id is not None


@pytest.mark.asyncio
async def test_delete_contact_already_deleted(svc: SafetyService) -> None:
    c = await svc.create_contact(user_id, EmergencyContactCreate(name="Ghost", phone_number="+1444444444"))
    await svc.delete_contact(c.id, user_id)
    with pytest.raises(ContactNotFoundError):
        await svc._get_contact(c.id, user_id)


@pytest.mark.asyncio
async def test_sms_rate_limit_check_passes(svc: SafetyService) -> None:
    await svc._check_sms_rate_limit(user_id)


@pytest.mark.asyncio
async def test_cancel_alert_with_no_contacts_notified(svc: SafetyService) -> None:
    alert = await svc.trigger_sos(user_id, latitude=40.0, longitude=-74.0)
    cancelled = await svc.cancel_alert(alert.id, user_id)
    assert cancelled.false_alarm is True
