"""Safety Celery task tests: send_sos_alerts, sos_checkin, escalate_sos."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.celery_app import celery_app
from app.core.database import Base


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture(autouse=True)
def eager_celery() -> None:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False
    celery_app.conf.task_eager_propagates = False


@pytest.fixture
def db_session():
    """Create in-memory SQLite engine, patch AsyncSessionLocal, yield sessionmaker."""
    import app.core.database as db_module
    from app.modules.auth import models as _auth_models  # noqa: F401
    from app.modules.safety import models  # noqa: F401
    from app.modules.users import models as _users_models  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async def _init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init())

    sm = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    original = db_module.AsyncSessionLocal
    db_module.AsyncSessionLocal = sm

    yield sm

    db_module.AsyncSessionLocal = original
    asyncio.run(engine.dispose())


def _run(coro):
    """Execute an async coroutine from a synchronous test context."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_user(sm, user_id: uuid.UUID) -> None:
    from app.modules.auth.models import User

    async def _seed() -> None:
        async with sm() as session:
            session.add(User(id=user_id, email="safety@test.com", provider="local", is_verified=True))
            await session.commit()

    _run(_seed())


def _seed_sos_alert(sm, user_id: uuid.UUID, alert_id: uuid.UUID, **kwargs) -> None:
    from app.modules.safety.models import SOSAlert, TriggerSource

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                SOSAlert(
                    id=alert_id,
                    user_id=user_id,
                    latitude=37.77,
                    longitude=-122.41,
                    trigger_source=TriggerSource.button,
                    triggered_at=datetime.now(UTC),
                    **kwargs,
                )
            )
            await session.commit()

    _run(_seed())


# ---------------------------------------------------------------------------
# sos_checkin
# ---------------------------------------------------------------------------


def test_sos_checkin_nonexistent(db_session) -> None:
    from app.modules.safety.tasks import sos_checkin

    result = sos_checkin.delay(str(uuid.uuid4()))

    assert result.successful()


def test_sos_checkin_sets_manual_intervention(db_session) -> None:
    from app.modules.safety.tasks import sos_checkin
    from app.modules.safety.models import SOSAlert

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id)

    result = sos_checkin.delay(str(alert_id))

    assert result.successful()

    async def _verify() -> None:
        async with sm() as session:
            alert = (await session.execute(select(SOSAlert).where(SOSAlert.id == alert_id))).scalar_one()
            assert alert.manual_intervention_needed is True

    _run(_verify())


def test_sos_checkin_skips_resolved(db_session) -> None:
    from app.modules.safety.tasks import sos_checkin
    from app.modules.safety.models import SOSAlert

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id, resolved_at=datetime.now(UTC))

    result = sos_checkin.delay(str(alert_id))

    assert result.successful()

    async def _verify() -> None:
        async with sm() as session:
            alert = (await session.execute(select(SOSAlert).where(SOSAlert.id == alert_id))).scalar_one()
            assert alert.manual_intervention_needed is False

    _run(_verify())


# ---------------------------------------------------------------------------
# escalate_sos
# ---------------------------------------------------------------------------


def test_escalate_sos_nonexistent(db_session) -> None:
    from app.modules.safety.tasks import escalate_sos

    result = escalate_sos.delay(str(uuid.uuid4()))

    assert result.successful()


def test_escalate_sos_escalates(db_session) -> None:
    from app.modules.safety.tasks import escalate_sos
    from app.modules.safety.models import SOSAlert

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id, manual_intervention_needed=True)

    result = escalate_sos.delay(str(alert_id))

    assert result.successful()

    async def _verify() -> None:
        async with sm() as session:
            alert = (await session.execute(select(SOSAlert).where(SOSAlert.id == alert_id))).scalar_one()
            assert alert.escalation_flag is True

    _run(_verify())


def test_escalate_sos_skips_no_intervention(db_session) -> None:
    from app.modules.safety.tasks import escalate_sos
    from app.modules.safety.models import SOSAlert

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id, manual_intervention_needed=False)

    escalate_sos.delay(str(alert_id))

    async def _verify() -> None:
        async with sm() as session:
            alert = (await session.execute(select(SOSAlert).where(SOSAlert.id == alert_id))).scalar_one()
            assert alert.escalation_flag is False

    _run(_verify())


def test_escalate_sos_skips_already_escalated(db_session) -> None:
    from app.modules.safety.tasks import escalate_sos
    from app.modules.safety.models import SOSAlert

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id, manual_intervention_needed=True, escalation_flag=True)

    escalate_sos.delay(str(alert_id))

    async def _verify() -> None:
        async with sm() as session:
            alert = (await session.execute(select(SOSAlert).where(SOSAlert.id == alert_id))).scalar_one()
            assert alert.escalation_flag is True

    _run(_verify())


# ---------------------------------------------------------------------------
# send_sos_alerts
# ---------------------------------------------------------------------------


def test_send_sos_alerts_success(db_session) -> None:
    from app.modules.safety.tasks import send_sos_alerts
    from app.modules.safety.services import SafetyService

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id)

    with patch("app.integrations.twilio_client.TwilioClient"), patch("app.integrations.fcm_client.FCMClient"):
        with patch.object(SafetyService, "process_sos_notifications", AsyncMock()) as mock_process:
            result = send_sos_alerts.delay(str(alert_id))

    assert result.successful()
    assert result.result == str(alert_id)
    mock_process.assert_awaited_once_with(uuid.UUID(str(alert_id)))


def test_send_sos_alerts_retries_on_failure(db_session) -> None:
    from app.modules.safety.tasks import send_sos_alerts
    from app.modules.safety.services import SafetyService

    sm = db_session
    user_id = uuid.uuid4()
    alert_id = uuid.uuid4()
    _seed_user(sm, user_id)
    _seed_sos_alert(sm, user_id, alert_id)

    with patch("app.integrations.twilio_client.TwilioClient"), patch("app.integrations.fcm_client.FCMClient"):
        with patch.object(SafetyService, "process_sos_notifications", AsyncMock(side_effect=Exception("SMS failed"))):
            with pytest.raises(Exception, match="SMS failed"):
                send_sos_alerts.delay(str(alert_id))
