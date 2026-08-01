"""Day-code correctness tests for the calendar (cycleplan 1 & 3).

Covers:
  - C / B: follicular ``Fl``/``fl`` and prediction-window ``pw`` bands
  - D1: ovulation day renders ``O``/``o`` (not ``F``/``f``)
  - F1: confirmed beats predicted
  - IR-1: fallback window only when std > 3.5 (aligned with the global path)
  - IR-2: widened std-dev filter [15, 60] captures outlier cycles
  - IR-4: scaled check-in window with ``prediction_window_days``
  - IR-5: dynamic auto-link window ``max(config, prediction_window_days)``
"""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from collections.abc import AsyncIterator
from datetime import date, timedelta
from statistics import stdev

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base
from app.integrations.prediction_engine import fallback_prediction
from app.modules.auth.models import User
from app.modules.cycle.models import CycleEntry
from app.modules.cycle.schemas import CycleEntryCreate
from app.modules.cycle.services import CycleService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.cycle import models as _cycle_models  # noqa: F401
        from app.modules.onboarding import models as _onboard_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(
        email="cycle-codes@test.com",
        provider="local",
        user_secret_key="c" * 64,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> CycleService:
    return CycleService(db=db_session)


def _iso(d: date) -> str:
    return d.isoformat()


async def _create_entry(svc: CycleService, user: User, start: date, end: date | None) -> CycleEntry:
    return await svc.create_entry(
        user.id, CycleEntryCreate(period_start_date=start, period_end_date=end)
    )


async def _set_std(svc: CycleService, user: User, std: float | None) -> None:
    user.cycle_length_std_dev = std
    await svc.db.commit()


# ---- Confirmed phases: follicular + O-override (C, D1, A) ----

@pytest.mark.asyncio
async def test_confirmed_phases_emit_follicular_and_ovulation(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))

    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    days = cal["days"]

    assert days.get(_iso(start)) == "P"                        # confirmed period
    assert days.get(_iso(start + timedelta(days=4))) == "P"
    assert days.get(_iso(start + timedelta(days=5))) == "Fl"   # follicular begins day after period
    assert days.get(_iso(start + timedelta(days=9))) == "Fl"   # follicular end = fertile_start - 1
    assert days.get(_iso(start + timedelta(days=10))) == "F"   # fertile start (ov - 4)
    assert days.get(_iso(start + timedelta(days=13))) == "F"   # day before ovulation
    assert days.get(_iso(start + timedelta(days=14))) == "O"   # D1: ovulation overrides fertile
    assert days.get(_iso(start + timedelta(days=15))) == "L"   # luteal begins day after ovulation


# ---- Predicted phases: pw band, fl, o-override, confirmed-beats-predicted ----

@pytest.mark.asyncio
async def test_predicted_phases_with_window_band(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 6.0)

    pred = await svc.compute_predictions(user.id)
    assert pred.prediction_window_days == 6

    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    days = cal["days"]

    pred_start = pred.predicted_next_period_start

    assert days.get(_iso(pred_start)) == "p"
    assert days.get(_iso(pred_start + timedelta(days=3))) == "p"
    # Lead pw band sits inside the CONFIRMED luteal phase (L beats pw per ladder),
    # so the confirmed code wins on those days.
    assert days.get(_iso(pred_start - timedelta(days=6))) == "L"
    assert days.get(_iso(pred_start - timedelta(days=1))) == "L"
    # Trail pw band wins over predicted follicular/fertile (pw > fl > f ladder).
    assert days.get(_iso(pred_start + timedelta(days=6))) == "pw"
    assert days.get(_iso(pred_start + timedelta(days=10))) == "pw"
    # D1: ovulation day (outside the trail band) overrides predicted fertile.
    assert days.get(_iso(pred_start + timedelta(days=14))) == "o"
    assert "pw" in days.values()  # band does render somewhere


@pytest.mark.asyncio
async def test_regular_prediction_has_no_window_band(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 2.0)

    pred = await svc.compute_predictions(user.id)
    assert pred.prediction_window_days is None

    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    days = cal["days"]
    pred_start = pred.predicted_next_period_start
    assert "pw" not in days.values()
    assert days.get(_iso(pred_start)) == "p"


@pytest.mark.asyncio
async def test_confirmed_period_beats_predicted(svc: CycleService, user: User) -> None:
    # Overlap a logged period with a predicted day: confirmed P must win.
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 2.0)
    pred = await svc.compute_predictions(user.id)
    pred_start = pred.predicted_next_period_start

    overlap = pred_start + timedelta(days=1)
    await _create_entry(svc, user, overlap, overlap + timedelta(days=2))

    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    days = cal["days"]
    assert days.get(_iso(overlap)) == "P"


# ---- IR-1: fallback window aligned to std > 3.5 ----

def test_fallback_window_none_when_regular_samples() -> None:
    _, _, window = fallback_prediction([28, 29, 27])
    assert window is None


def test_fallback_window_from_irregular_samples() -> None:
    _, _, window = fallback_prediction([28, 22, 34])
    assert window is not None


def test_fallback_window_uses_stored_std() -> None:
    _, _, window = fallback_prediction([28, 29, 27], user_std=6.2)
    assert window == 6


def test_fallback_window_none_when_stored_std_low() -> None:
    _, _, window = fallback_prediction([28, 29, 27], user_std=2.0)
    assert window is None


# ---- IR-2: widened std-dev filter [15, 60] ----

@pytest.mark.asyncio
async def test_widened_std_captures_outlier_cycle(svc: CycleService, user: User) -> None:
    # 4 base entries with an out-of-[20,45] gap (48): old filter would drop it.
    starts = [date.today() - timedelta(days=d) for d in (120, 96, 48, 22)]
    for s in starts:
        await _create_entry(svc, user, s, s + timedelta(days=4))

    await _set_std(svc, user, 3.0)
    pred = await svc.compute_predictions(user.id)

    # Correction entry inside the auto-link window triggers metric recompute.
    link = pred.predicted_next_period_start + timedelta(days=1)
    entry = await _create_entry(svc, user, link, link + timedelta(days=3))

    assert entry.is_correction is True
    # The correction entry adds a 4th gap (29d) to the interval set, so the
    # widened [15, 60] filter now captures all of [24, 48, 26, 29] → std 11.0
    # (the 48 outlier would have been dropped by the old [20, 45] filter).
    assert user.cycle_length_std_dev == round(stdev([24, 48, 26, 29]), 1)
    assert user.cycle_length_std_dev > 3.5  # wide enough to earn a pw band


# ---- IR-4: scaled check-in window ----

@pytest.mark.asyncio
async def test_checkin_window_scales_with_prediction_window(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 6.0)
    pred = await svc.compute_predictions(user.id)
    assert pred.prediction_window_days == 6

    # scaled window = [pred - max(3,6), pred + max(6,7)] = [pred-6, pred+7]
    ref = pred.predicted_next_period_start - timedelta(days=5)
    # pred-5 is OUTSIDE the unscaled [pred-3, pred+6] window.
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3, today=ref)
    assert cal["needs_checkin"] is True


@pytest.mark.asyncio
async def test_checkin_window_default_when_regular(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 2.0)
    pred = await svc.compute_predictions(user.id)
    assert pred.prediction_window_days is None

    # unscaled window = [pred-3, pred+6]; pred-5 falls outside.
    ref = pred.predicted_next_period_start - timedelta(days=5)
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3, today=ref)
    assert cal["needs_checkin"] is False


# ---- IR-5: dynamic auto-link window ----

@pytest.mark.asyncio
async def test_auto_link_uses_wider_prediction_window(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 6.0)
    pred = await svc.compute_predictions(user.id)
    assert pred.prediction_window_days == 6

    # diff = 5 days: beyond the default config window (3) but within max(3, 6).
    link = pred.predicted_next_period_start + timedelta(days=5)
    entry = await _create_entry(svc, user, link, link + timedelta(days=3))
    assert entry.is_correction is True
    assert entry.corrected_prediction_id == pred.id


@pytest.mark.asyncio
async def test_auto_link_default_window_for_regular(svc: CycleService, user: User) -> None:
    start = date.today() - timedelta(days=40)
    await _create_entry(svc, user, start, start + timedelta(days=4))
    await _set_std(svc, user, 2.0)
    pred = await svc.compute_predictions(user.id)
    assert pred.prediction_window_days is None

    # diff = 4 days: outside the default window (3) and no wider window to lean on.
    link = pred.predicted_next_period_start + timedelta(days=4)
    entry = await _create_entry(svc, user, link, link + timedelta(days=3))
    assert entry.is_correction is False
