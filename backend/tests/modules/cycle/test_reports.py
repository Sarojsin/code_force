"""Cycle report tests (Cycle_Report-as-a-Service plan).

Covers: aggregation (incl. no-PII guarantee), rule-based fallback, Groq path,
fallback on invalid LLM JSON, idempotency, and row isolation.
"""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")
# Keep Groq disabled by default so the deterministic path is the baseline.
os.environ.setdefault("GROQ__ENABLED", "false")

import json
import uuid
from collections.abc import AsyncIterator
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

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
from app.modules.auth.models import User
from app.modules.cycle.models import CycleDay, CycleEntry, CycleReport, DaySymptom, Symptom
from app.modules.cycle.schemas import CycleEntryCreate, ReportData
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
        email="cycle-report@test.com",
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


@pytest_asyncio.fixture
async def closed_entries(svc: CycleService, user: User) -> list[CycleEntry]:
    """Three closed cycles with 28-day spacing."""
    entries: list[CycleEntry] = []
    for i in range(3):
        start = date(2026, 5, 1) + timedelta(days=i * 28)
        entries.append(
            await svc.create_entry(
                user.id,
                CycleEntryCreate(
                    period_start_date=start,
                    period_end_date=start + timedelta(days=4),
                ),
            )
        )
    return entries


@pytest_asyncio.fixture
async def _seed_symptom(svc: CycleService) -> Symptom:
    symptom = Symptom(name="Cramps", category="pain")
    svc.db.add(symptom)
    await svc.db.commit()
    await svc.db.refresh(symptom)
    return symptom


# ---------------------------------------------------------------------------
# get_aggregated_stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aggregated_stats_no_pii(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    stats = await svc.get_aggregated_stats(user.id, closed_entries[-1])
    raw = json.dumps(stats)
    assert "2026-05" not in raw  # no raw dates
    assert "test.com" not in raw  # no PII
    assert stats["cycles_count"] == 3
    assert stats["avg_cycle_length_days"] == 28.0


@pytest.mark.asyncio
async def test_aggregated_stats_with_day_rows(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
    _seed_symptom: Symptom,
) -> None:
    anchor = closed_entries[0]  # 2026-05-01..05
    day = CycleDay(user_id=user.id, log_date=date(2026, 5, 2))
    day.mood = "happy"
    day.sleep_minutes = 420
    day.pain_level = 6
    day.energy_level = 2
    svc.db.add(day)
    await svc.db.flush()

    ds = DaySymptom(day_id=day.id, symptom_id=_seed_symptom.id, severity=3)
    svc.db.add(ds)
    await svc.db.commit()

    stats = await svc.get_aggregated_stats(user.id, anchor)
    assert stats["avg_sleep_hours"] == 7.0
    assert stats["avg_pain_level"] == 6.0
    assert stats["common_moods"][0]["mood"] == "happy"
    phase_symptoms = stats["symptoms_by_phase"]
    menstrual = phase_symptoms["menstrual"]
    assert any(s["symptom"] == "Cramps" for s in menstrual)


@pytest.mark.asyncio
async def test_aggregated_stats_single_entry(svc: CycleService, user: User) -> None:
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 6, 1)),
    )
    stats = await svc.get_aggregated_stats(user.id, entry)
    assert stats["cycles_count"] == 1
    assert stats["avg_cycle_length_days"] is None


# ---------------------------------------------------------------------------
# get_cycle_scoped_stats — one report per cycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cycle_scoped_stats_no_pii(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    stats = await svc.get_cycle_scoped_stats(user.id, closed_entries[-1])
    raw = json.dumps(stats)
    assert "2026-05" not in raw  # no raw dates
    assert "test.com" not in raw  # no PII
    assert stats["cycles_count"] == 3  # neighborhood up to this cycle
    assert stats["avg_cycle_length_days"] == 28.0


@pytest.mark.asyncio
async def test_cycle_scoped_stats_isolation(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
    _seed_symptom: Symptom,
) -> None:
    # Day data lives ONLY in the FIRST cycle's window. The oldest entry must
    # include it; a newer entry must NOT (reports are per-cycle).
    first = closed_entries[0]  # 2026-05-01..05
    day = CycleDay(user_id=user.id, log_date=date(2026, 5, 3))
    day.mood = "happy"
    day.sleep_minutes = 420
    day.pain_level = 6
    svc.db.add(day)
    await svc.db.flush()
    ds = DaySymptom(day_id=day.id, symptom_id=_seed_symptom.id, severity=3)
    svc.db.add(ds)
    await svc.db.commit()

    old_stats = await svc.get_cycle_scoped_stats(user.id, first)
    assert old_stats["avg_sleep_hours"] == 7.0
    assert old_stats["avg_pain_level"] == 6.0
    assert old_stats["common_moods"][0]["mood"] == "happy"
    assert any(
        s["symptom"] == "Cramps" for s in old_stats["symptoms_by_phase"]["menstrual"]
    )

    new_stats = await svc.get_cycle_scoped_stats(user.id, closed_entries[-1])
    assert new_stats["avg_sleep_hours"] is None
    assert new_stats["avg_pain_level"] is None
    assert new_stats["common_moods"] == []


@pytest.mark.asyncio
async def test_generate_report_distinct_per_cycle(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
    _seed_symptom: Symptom,
) -> None:
    """Two cycles with different observations yield DIFFERENT stored reports."""
    first = closed_entries[0]
    day = CycleDay(user_id=user.id, log_date=date(2026, 5, 3))
    day.mood = "happy"
    day.sleep_minutes = 420
    day.pain_level = 6
    svc.db.add(day)
    await svc.db.commit()

    old_report = await svc.generate_report(user.id, first.id)
    new_report = await svc.generate_report(user.id, closed_entries[-1].id)

    assert old_report.cycle_entry_id != new_report.cycle_entry_id
    assert old_report.report_data != new_report.report_data
    old_summary = old_report.report_data.get("summary", "")
    new_summary = new_report.report_data.get("summary", "")
    assert old_summary != new_summary


@pytest.mark.asyncio
async def test_cycle_scoped_stats_own_period_and_cycle_length(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    target = closed_entries[1]  # 2026-05-29..06-02
    stats = await svc.get_cycle_scoped_stats(user.id, target)
    assert stats["avg_period_length_days"] == 5.0  # this cycle's own window
    assert stats["avg_cycle_length_days"] == 28.0  # 05-01 -> 05-29

    last = closed_entries[-1]  # 2026-06-26
    last_stats = await svc.get_cycle_scoped_stats(user.id, last)
    assert last_stats["cycles_count"] == 3
    assert last_stats["avg_cycle_length_days"] == 28.0
    assert last_stats["cycle_length_std_dev_days"] == 0.0  # 28, 28 neighborhood


@pytest.mark.asyncio
async def test_cycle_scoped_stats_single_entry(svc: CycleService, user: User) -> None:
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 6, 1)),
    )
    stats = await svc.get_cycle_scoped_stats(user.id, entry)
    assert stats["cycles_count"] == 1
    assert stats["avg_cycle_length_days"] is None


# ---------------------------------------------------------------------------
# rule-based report
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rule_based_report_shape(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    stats = await svc.get_aggregated_stats(user.id, closed_entries[-1])
    report = await svc.build_rule_based_report(stats)
    assert isinstance(report, ReportData)
    assert 0 <= report.regularity_score <= 100
    assert isinstance(report.summary, str)
    assert report.correlation_found
    assert isinstance(report.top_symptoms, list)


@pytest.mark.asyncio
async def test_rule_based_report_empty_user(svc: CycleService, user: User) -> None:
    # A synthetic empty stats blob == what we'd get with 0 data.
    stats = {
        "cycles_count": 0,
        "avg_cycle_length_days": None,
        "avg_period_length_days": None,
        "avg_sleep_hours": None,
        "avg_pain_level": None,
        "avg_energy_level": None,
        "common_moods": [],
        "symptoms_by_phase": {},
        "cycle_length_std_dev_days": None,
    }
    report = await svc.build_rule_based_report(stats)
    assert report.regularity_score == 0
    assert "Not enough cycle data" in report.summary


# ---------------------------------------------------------------------------
# generate_report — Groq path + fallback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_report_uses_groq(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    fake_json = json.dumps(
        {
            "summary": "Cycles are regular.",
            "regularity_score": 85,
            "top_symptoms": ["Cramps"],
            "correlation_found": "Low sleep with higher pain.",
            "doctor_note": "Consider BBT tracking.",
        }
    )
    with patch(
        "app.modules.cycle.services.GroqClient",
        return_value=AsyncMock(generate_report=AsyncMock(return_value=fake_json)),
    ) as mock_cls:
        report = await svc.generate_report(user.id, entry.id)

    mock_cls.assert_called_once()
    assert report.status == "ready"
    assert report.report_data["regularity_score"] == 85
    assert report.report_data["summary"] == "Cycles are regular."


@pytest.mark.asyncio
async def test_generate_report_falls_back_on_invalid_llm_json(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    with patch(
        "app.modules.cycle.services.GroqClient",
        return_value=AsyncMock(generate_report=AsyncMock(return_value="{NOT VALID JSON")),
    ):
        report = await svc.generate_report(user.id, entry.id)

    assert report.status == "ready"
    # Must be a valid ReportData (rule-based fallback was used).
    ReportData.model_validate(report.report_data)


@pytest.mark.asyncio
async def test_generate_report_disabled_groq_uses_fallback(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    # GROQ__ENABLED=false (file default) => client returns "" => rule-based.
    with patch(
        "app.modules.cycle.services.GroqClient",
        return_value=AsyncMock(generate_report=AsyncMock(return_value="")),
    ):
        report = await svc.generate_report(user.id, entry.id)
    assert report.status == "ready"
    ReportData.model_validate(report.report_data)


@pytest.mark.asyncio
async def test_generate_report_groq_error_falls_back(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    from app.integrations.groq_client import GroqError

    class _Boom:
        async def generate_report(self, prompt: str) -> str:
            raise GroqError("boom")

    with patch("app.modules.cycle.services.GroqClient", return_value=_Boom()):
        report = await svc.generate_report(user.id, entry.id)
    assert report.status == "ready"
    ReportData.model_validate(report.report_data)


# ---------------------------------------------------------------------------
# idempotency + latest + isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_report_idempotent(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    with patch(
        "app.modules.cycle.services.GroqClient",
        return_value=AsyncMock(generate_report=AsyncMock(return_value="{}")),
    ):
        # {} fails ReportData validation -> rule-based fallback, still ready.
        await svc.generate_report(user.id, entry.id)
        await svc.generate_report(user.id, entry.id)
    rows = (
        await svc.db.execute(
            __import__("sqlalchemy").select(CycleReport).where(CycleReport.user_id == user.id)
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_get_latest_report_and_isolation(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
    db_session: AsyncSession,
) -> None:
    entry = closed_entries[-1]
    await svc.generate_report(user.id, entry.id)

    latest = await svc.get_latest_report(user.id)
    assert latest is not None
    assert latest.status == "ready"
    assert latest.user_id == user.id

    other = await svc.get_latest_report(uuid.uuid4())
    assert other is None


# ---------------------------------------------------------------------------
# Enriched ReportData (Richer Analytics + Per-Cycle Report History plan)
# ---------------------------------------------------------------------------


def test_report_data_accepts_legacy_payload() -> None:
    """5-field payloads (pre-enrichment) remain valid."""
    data = ReportData(
        summary="Cycles are regular.",
        regularity_score=85,
        top_symptoms=["Cramps"],
        correlation_found="Low sleep with higher pain.",
        doctor_note="Consider BBT tracking.",
    )
    assert data.avg_period_length_days is None
    assert data.common_moods == []


def test_report_data_accepts_enriched_payload() -> None:
    data = ReportData(
        summary="Cycles are regular.",
        regularity_score=85,
        top_symptoms=["Cramps"],
        correlation_found="Low sleep with higher pain.",
        doctor_note="Consider BBT tracking.",
        avg_cycle_length_days=28.0,
        avg_period_length_days=5.0,
        avg_sleep_hours=7.0,
        avg_pain_level=6.0,
        common_moods=[{"mood": "happy", "count": 3}],
    )
    assert data.avg_period_length_days == 5.0
    assert data.common_moods[0]["mood"] == "happy"


@pytest.mark.asyncio
async def test_rule_based_report_fills_optional_metrics(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
    _seed_symptom: Symptom,
) -> None:
    anchor = closed_entries[0]
    day = CycleDay(user_id=user.id, log_date=date(2026, 5, 2))
    day.mood = "happy"
    day.sleep_minutes = 420
    day.pain_level = 6
    svc.db.add(day)
    await svc.db.commit()

    stats = await svc.get_aggregated_stats(user.id, anchor)
    report = await svc.build_rule_based_report(stats)
    assert report.avg_sleep_hours == 7.0
    assert report.avg_pain_level == 6.0
    assert report.avg_period_length_days is not None
    assert any(m["mood"] == "happy" for m in report.common_moods)


@pytest.mark.asyncio
async def test_get_analytics_returns_enriched_fields(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    analytics = await svc.get_analytics(user.id)
    assert analytics["avg_period_length_days"] == 5.0
    assert analytics["cycle_length_std_dev_days"] is not None
    assert analytics["avg_ovulation_day"] == 14.0
    assert analytics["avg_sleep_hours"] is None
    assert analytics["avg_pain_level"] is None
    assert analytics["avg_energy_level"] is None


@pytest.mark.asyncio
async def test_get_analytics_empty_user(svc: CycleService, user: User) -> None:
    analytics = await svc.get_analytics(user.id)
    assert analytics["total_entries"] == 0
    assert analytics["avg_period_length_days"] is None
    assert analytics["avg_sleep_hours"] is None


@pytest.mark.asyncio
async def test_get_analytics_aggregates_day_rows(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    day = CycleDay(user_id=user.id, log_date=date(2026, 5, 2))
    day.mood = "calm"
    day.sleep_minutes = 450
    day.pain_level = 3
    day.energy_level = 2
    svc.db.add(day)
    await svc.db.commit()
    analytics = await svc.get_analytics(user.id)
    assert analytics["avg_sleep_hours"] == 7.5
    assert analytics["avg_pain_level"] == 3.0
    assert analytics["avg_energy_level"] == 2.0


# ---------------------------------------------------------------------------
# DB-first per-entry read + synchronous generation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_report_for_entry_db_only(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    await svc.generate_report(user.id, entry.id)

    report = await svc.get_report_for_entry(user.id, entry.id)
    assert report is not None
    assert report.status == "ready"
    assert report.cycle_entry_id == entry.id

    missing = await svc.get_report_for_entry(user.id, closed_entries[0].id)
    assert missing is None


@pytest.mark.asyncio
async def test_get_report_for_entry_row_isolation(
    svc: CycleService,
    user: User,
    closed_entries: list[CycleEntry],
) -> None:
    entry = closed_entries[-1]
    await svc.generate_report(user.id, entry.id)
    other = await svc.get_report_for_entry(uuid.uuid4(), entry.id)
    assert other is None
