from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base, get_db
from app.core.security import create_access_token


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


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


class FakeEventBus:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def emit(self, event: str, **kwargs: Any) -> None:
        self.events.append({"event": event, **kwargs})

    def subscribe(self, event: str) -> Any:
        return lambda fn: fn


class _NoopRevocation:
    async def revoke(self, jti: str, ttl_seconds: int) -> None:
        return None

    async def is_revoked(self, jti: str) -> bool:
        return False


_TEST_USER_SECRET = "test-user-secret-for-jwt-32characters!!"

_TEST_PHONE = "+14155552671"


@pytest_asyncio.fixture
async def app_client() -> AsyncIterator[AsyncClient]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        from app.modules.safety import models as safety_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_db():
        async with Session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    async with Session() as session:
        from app.modules.auth.models import User

        user = User(
            email="safety@shecare.example",
            display_name="Safety Tester",
            role="user",
            user_secret_key=_TEST_USER_SECRET,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        from app.core.config import get_settings

        settings = get_settings()
        access_token, _, _ = create_access_token(
            user_id=user.id,
            email=user.email or "",
            role=user.role,
            user_secret_key=_TEST_USER_SECRET,
            settings=settings.jwt,
        )

    fake_twilio = FakeTwilio()
    fake_fcm = FakeFCM()
    fake_bus = FakeEventBus()

    async def _override_async_twilio():
        return fake_twilio

    async def _override_fcm():
        return fake_fcm

    async def _override_event_bus():
        return fake_bus

    from contextlib import asynccontextmanager

    from fastapi import FastAPI

    @asynccontextmanager
    async def _noop_lifespan(_app):
        yield

    app = FastAPI(title="SheCare API (safety test)", lifespan=_noop_lifespan)

    from app.modules.safety.routes import init_module as safety_init
    safety_init(app, None)

    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    from app.core.exceptions import (
        RateLimitError,
        SheCareError,
        http_exception_handler,
        shecare_exception_handler,
        validation_exception_handler,
    )

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db

    import app.modules.safety.dependencies as safety_deps

    app.dependency_overrides[safety_deps.get_twilio_client] = _override_async_twilio
    app.dependency_overrides[safety_deps.get_fcm_client] = _override_fcm
    app.dependency_overrides[safety_deps.get_event_bus] = _override_event_bus

    from app.core import security as core_security

    app.dependency_overrides[core_security.get_token_revocation_store] = lambda: _NoopRevocation()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {access_token}"
        client.fake_twilio = fake_twilio  # type: ignore[attr-defined]
        client.fake_fcm = fake_fcm  # type: ignore[attr-defined]
        client.fake_bus = fake_bus  # type: ignore[attr-defined]
        yield client

    await engine.dispose()


# ---- Emergency Contacts ----


@pytest.mark.asyncio
async def test_create_contact(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/safety/emergency-contacts",
        json={"name": "Mom", "phone_number": _TEST_PHONE, "relationship": "mother", "is_primary": True},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Mom"
    assert body["phone_number"] == _TEST_PHONE
    assert body["relationship"] == "mother"
    assert body["is_primary"] is True
    assert "id" in body
    assert "user_id" in body


@pytest.mark.asyncio
async def test_list_contacts(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/safety/emergency-contacts",
        json={"name": "Dad", "phone_number": "+14155552672"},
    )
    resp = await app_client.get("/api/v1/safety/emergency-contacts")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["name"] == "Dad"


@pytest.mark.asyncio
async def test_update_contact(app_client: AsyncClient) -> None:
    create_resp = await app_client.post(
        "/api/v1/safety/emergency-contacts",
        json={"name": "Sister", "phone_number": "+14155552673"},
    )
    contact_id = create_resp.json()["id"]

    resp = await app_client.put(
        f"/api/v1/safety/emergency-contacts/{contact_id}",
        json={"name": "Brother"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Brother"


@pytest.mark.asyncio
async def test_delete_contact(app_client: AsyncClient) -> None:
    create_resp = await app_client.post(
        "/api/v1/safety/emergency-contacts",
        json={"name": "Friend", "phone_number": "+14155552674"},
    )
    contact_id = create_resp.json()["id"]

    resp = await app_client.delete(f"/api/v1/safety/emergency-contacts/{contact_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_update_contact_not_found(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        f"/api/v1/safety/emergency-contacts/{uuid.uuid4()}",
        json={"name": "Ghost"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_contact_not_found(app_client: AsyncClient) -> None:
    resp = await app_client.delete(f"/api/v1/safety/emergency-contacts/{uuid.uuid4()}")
    assert resp.status_code == 404


# ---- SOS ----


@pytest.mark.asyncio
async def test_trigger_sos(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.7128, "longitude": -74.0060},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["id"] is not None
    assert body["latitude"] == 40.7128
    assert body["longitude"] == -74.0060
    assert body["cancelled_at"] is None
    assert body["resolved_at"] is None


@pytest.mark.asyncio
async def test_trigger_sos_with_all_fields(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={
            "latitude": 34.0522,
            "longitude": -118.2437,
            "location_accuracy_m": 50,
            "trigger_source": "button",
        },
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["latitude"] == 34.0522
    assert body["location_accuracy_m"] == 50
    assert body["trigger_source"] == "button"


@pytest.mark.asyncio
async def test_trigger_sos_idempotency(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
        headers={"Idempotency-Key": "test-ip-key-1"},
    )
    assert resp.status_code == 202

    resp2 = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
        headers={"Idempotency-Key": "test-ip-key-1"},
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_trigger_sos_rate_limit(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_trigger_sos_validation_error(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 200, "longitude": -74.0},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_trigger_sos_with_accuracy(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0, "location_accuracy_m": 100},
    )
    assert resp.status_code == 202
    assert resp.json()["location_accuracy_m"] == 100


@pytest.mark.asyncio
async def test_sos_history(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    resp = await app_client.get("/api/v1/safety/sos/history")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1


@pytest.mark.asyncio
async def test_sos_history_empty(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/safety/sos/history")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_active_sos_returns_alert(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    resp = await app_client.get("/api/v1/safety/sos/active")
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert body["cancelled_at"] is None
    assert body["resolved_at"] is None


@pytest.mark.asyncio
async def test_active_sos_returns_none_when_no_alert(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/safety/sos/active")
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.asyncio
async def test_safety_status(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/safety/emergency-contacts",
        json={"name": "Mom", "phone_number": _TEST_PHONE},
    )
    await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    resp = await app_client.get("/api/v1/safety/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["active_sos"] is not None
    assert len(body["emergency_contacts"]) == 1
    assert body["sos_enabled"] is True


@pytest.mark.asyncio
async def test_safety_status_no_alert(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/safety/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["active_sos"] is None
    assert body["emergency_contacts"] == []


@pytest.mark.asyncio
async def test_cancel_sos(app_client: AsyncClient) -> None:
    trigger_resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    alert_id = trigger_resp.json()["id"]

    resp = await app_client.post(f"/api/v1/safety/sos/{alert_id}/cancel")
    assert resp.status_code == 200
    body = resp.json()
    assert body["false_alarm"] is True
    assert body["contacts_notified_of_false_alarm"] is False


@pytest.mark.asyncio
async def test_resolve_sos(app_client: AsyncClient) -> None:
    trigger_resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    alert_id = trigger_resp.json()["id"]

    resp = await app_client.post(f"/api/v1/safety/sos/{alert_id}/resolve")
    assert resp.status_code == 200
    body = resp.json()
    assert body["resolved_at"] is not None
    assert body["id"] == alert_id


@pytest.mark.asyncio
async def test_cancel_non_existent_sos(app_client: AsyncClient) -> None:
    resp = await app_client.post(f"/api/v1/safety/sos/{uuid.uuid4()}/cancel")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resolve_non_existent_sos(app_client: AsyncClient) -> None:
    resp = await app_client.post(f"/api/v1/safety/sos/{uuid.uuid4()}/resolve")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_double_cancel_sos(app_client: AsyncClient) -> None:
    trigger_resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    alert_id = trigger_resp.json()["id"]
    await app_client.post(f"/api/v1/safety/sos/{alert_id}/cancel")
    resp = await app_client.post(f"/api/v1/safety/sos/{alert_id}/cancel")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_resolve_already_resolved_sos(app_client: AsyncClient) -> None:
    trigger_resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    alert_id = trigger_resp.json()["id"]
    await app_client.post(f"/api/v1/safety/sos/{alert_id}/resolve")
    resp = await app_client.post(f"/api/v1/safety/sos/{alert_id}/resolve")
    assert resp.status_code == 400


# ---- Error scenarios ----


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/safety/emergency-contacts")
    assert resp.status_code == 401
    body = resp.json()
    assert "error" in body


@pytest.mark.asyncio
async def test_unauthenticated_sos_trigger_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.post(
        "/api/v1/safety/sos/trigger",
        json={"latitude": 40.0, "longitude": -74.0},
    )
    assert resp.status_code == 401
