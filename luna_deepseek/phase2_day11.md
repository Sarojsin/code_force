# Phase 2 Day 11 — Backend health_tips + API Endpoint

## Goal
Create the `health_tips` database table, seed it with 100+ static tips, and expose a `GET /api/v1/wellness/health-tips` endpoint. This is a lightweight CRUD endpoint — no AI generation for Phase 2.

---

## 11.1 Backend Database Table

**File:** `backend/app/modules/wellness/models.py`

```python
import uuid
from sqlalchemy import Column, String, Boolean, Integer, Text
from app.core.database import Base

class HealthTip(Base):
    __tablename__ = "health_tips"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_type = Column(String(20), nullable=False, index=True)  # sleep, water, food, exercise, medication
    tip = Column(Text, nullable=False)
    priority = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
```

**File:** `backend/app/modules/wellness/schemas.py`

```python
from pydantic import BaseModel
from typing import Optional

class HealthTipResponse(BaseModel):
    id: str
    metric_type: str
    tip: str
    priority: int

class HealthTipListResponse(BaseModel):
    data: list[HealthTipResponse]
    total: int
```

---

## 11.2 Seed Data

**File:** `backend/app/modules/wellness/seed.py`

```python
"""
Seed 100+ static health tips. Run once via CLI or Alembic data migration.
"""

SEED_TIPS = [
    # ── Sleep ──
    ("sleep", "Consistent sleep schedule improves your cycle regularity."),
    ("sleep", "Blue light before bed disrupts melatonin production."),
    ("sleep", "7-9 hours of sleep helps regulate stress hormones."),
    ("sleep", "A cool bedroom (18-20°C) promotes deeper sleep."),
    ("sleep", "Avoid caffeine 6 hours before bedtime."),
    ("sleep", "Sleep deprivation can worsen PMS symptoms."),
    ("sleep", "Create a bedtime ritual: read, stretch, or meditate."),
    ("sleep", "Your body repairs tissues while you sleep."),
    ("sleep", "Irregular sleep patterns can affect ovulation."),
    ("sleep", "Magnesium before bed can improve sleep quality."),
    ("sleep", "Limit screen time 30 minutes before bed."),
    ("sleep", "A warm bath before bed aids sleep onset."),
    ("sleep", "Sleep debt accumulates — catch up on weekends."),
    ("sleep", "Napping after 3 PM can disrupt night sleep."),
    ("sleep", "Exercise earlier in the day for better sleep."),

    # ── Water ──
    ("water", "Water helps reduce menstrual bloating."),
    ("water", "Staying hydrated reduces fatigue during periods."),
    ("water", "Drinking water before meals aids digestion."),
    ("water", "Aim for 8 glasses (2L) of water daily."),
    ("water", "Hydration improves skin elasticity and glow."),
    ("water", "Dehydration can trigger headaches."),
    ("water", "Herbal teas count toward your daily fluid intake."),
    ("water", "Drink a glass of water when you wake up."),
    ("water", "Water helps flush toxins from your body."),
    ("water", "Keep a water bottle on your desk as a reminder."),
    ("water", "Coconut water is great for electrolyte balance."),
    ("water", "Urine color is a good hydration indicator."),
    ("water", "Hydration supports kidney function."),
    ("water", "Drink more water on days you exercise."),
    ("water", "Set hourly water reminders during your cycle."),

    # ── Food ──
    ("food", "Iron-rich foods help combat period fatigue."),
    ("food", "Calcium supports bone health during menstrual cycles."),
    ("food", "Omega-3 fatty acids can reduce period pain."),
    ("food", "Eat protein with every meal for stable energy."),
    ("food", "Fiber helps regulate digestion during your cycle."),
    ("food", "Dark leafy greens are packed with iron and folate."),
    ("food", "Vitamin C helps absorb iron from plant sources."),
    ("food", "Avoid excessive salt to reduce bloating."),
    ("food", "Complex carbs provide steady energy release."),
    ("food", "Probiotics support gut health and immunity."),
    ("food", "Magnesium-rich foods (bananas, almonds) ease cramps."),
    ("food", "Eat smaller, more frequent meals during your period."),
    ("food", "B vitamin complex helps with energy metabolism."),
    ("food", "Reduce sugar intake to stabilize mood swings."),
    ("food", "Stay balanced: protein, healthy fats, complex carbs."),

    # ── Exercise ──
    ("exercise", "Gentle walking reduces period pain."),
    ("exercise", "Yoga helps relieve menstrual cramps."),
    ("exercise", "Exercise releases endorphins — natural mood lifters."),
    ("exercise", "Strength training builds bone density."),
    ("exercise", "Stretching improves flexibility and reduces tension."),
    ("exercise", "Swimming is a low-impact full-body workout."),
    ("exercise", "Pelvic floor exercises support reproductive health."),
    ("exercise", "Listen to your body — rest when you need to."),
    ("exercise", "Aim for 150 minutes of moderate exercise weekly."),
    ("exercise", "Exercise improves sleep quality."),
    ("exercise", "Morning exercise can boost metabolism all day."),
    ("exercise", "Dancing is a fun way to stay active."),
    ("exercise", "Cycling builds cardiovascular endurance."),
    ("exercise", "Tai chi combines movement with mindfulness."),
    ("exercise", "Consistency matters more than intensity."),

    # ── Medication ──
    ("medication", "Track your medication schedule for consistency."),
    ("medication", "Set daily reminders to never miss a dose."),
    ("medication", "Consult your doctor before starting supplements."),
    ("medication", "Store medications in a cool, dry place."),
    ("medication", "Check expiration dates regularly."),
    ("medication", "Iron supplements are best taken with vitamin C."),
    ("medication", "Some medications work best with food."),
    ("medication", "Keep a list of all medications you take."),
    ("medication", "Talk to your pharmacist about side effects."),
    ("medication", "Don't double up if you miss a dose — ask your doctor."),
    ("medication", "Use a pill organizer to track daily doses."),
    ("medication", "Refill prescriptions before you run out."),
    ("medication", "Travel with medications in your carry-on."),
    ("medication", "Share your medication list with emergency contacts."),
    ("medication", "Review your medications with your doctor annually."),

    # ── General / Motivational ──
    ("general", "Small consistent steps lead to big health changes."),
    ("general", "Self-care is not selfish — it's necessary."),
    ("general", "Your health journey is unique. Progress, not perfection."),
    ("general", "Celebrate every win, no matter how small."),
    ("general", "Rest is productive. Recovery matters."),
    ("general", "You are the CEO of your own health."),
    ("general", "Listen to your body — it knows what it needs."),
    ("general", "Every healthy choice adds up over time."),
    ("general", "Be kind to yourself on difficult days."),
    ("general", "You're doing better than you think."),
]


async def seed_health_tips(db_session):
    """Insert seed tips if the table is empty."""
    from app.modules.wellness.models import HealthTip
    from sqlalchemy import select, func

    existing = await db_session.execute(select(func.count()).select_from(HealthTip))
    if existing.scalar() > 0:
        return  # Already seeded

    for metric_type, tip_text in SEED_TIPS:
        db_session.add(HealthTip(metric_type=metric_type, tip=tip_text))
    await db_session.commit()
```

---

## 11.3 Backend Service Layer

**File:** `backend/app/modules/wellness/services.py`

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.wellness.models import HealthTip

class WellnessService:
    async def get_health_tips(
        self,
        db: AsyncSession,
        metric_type: str | None = None,
        limit: int = 3,
    ) -> list[HealthTip]:
        query = select(HealthTip).where(HealthTip.is_active == True)

        if metric_type:
            query = query.where(HealthTip.metric_type == metric_type)

        query = query.order_by(HealthTip.priority).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_random_tip(
        self,
        db: AsyncSession,
        metric_type: str | None = None,
    ) -> HealthTip | None:
        query = select(HealthTip).where(HealthTip.is_active == True)
        if metric_type:
            query = query.where(HealthTip.metric_type == metric_type)
        query = query.order_by(func.random()).limit(1)
        result = await db.execute(query)
        return result.scalar_one_or_none()


wellness_service = WellnessService()
```

---

## 11.4 Backend Routes

**File:** `backend/app/modules/wellness/routes.py`

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.modules.wellness.services import wellness_service
from app.modules.wellness.schemas import HealthTipListResponse, HealthTipResponse

router = APIRouter(prefix="/api/v1/wellness", tags=["wellness"])


@router.get("/health-tips", response_model=HealthTipListResponse)
async def get_health_tips(
    metric_type: str | None = Query(None, description="Filter by metric type"),
    limit: int = Query(3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    tips = await wellness_service.get_health_tips(db, metric_type, limit)
    return HealthTipListResponse(
        data=[
            HealthTipResponse(
                id=t.id,
                metric_type=t.metric_type,
                tip=t.tip,
                priority=t.priority,
            )
            for t in tips
        ],
        total=len(tips),
    )
```

---

## 11.5 Module Registration

**File:** `backend/app/modules/wellness/__init__.py`

```python
from fastapi import FastAPI
from app.core.event_bus import EventBus


def init_module(app: FastAPI, event_bus: EventBus) -> None:
    from app.modules.wellness.routes import router
    app.include_router(router)
```

Ensure the module is imported in `backend/app/main.py`:

```python
from app.modules.wellness import init_module as init_wellness

def create_app() -> FastAPI:
    app = FastAPI(title="SheCare API", version="1.0.0")
    event_bus = EventBus()

    # ... existing modules ...
    init_wellness(app, event_bus)

    return app
```

---

## 11.6 Increment Luna Asset Version to 1.1.0

**File:** `backend/app/modules/luna/routes.py`

```python
@router.get("/metadata")
async def get_luna_metadata():
    return {
        "version": "1.1.0",         # ← Incremented from 1.0.0 (sounds added)
        "size_mb": 5.0,             # Sounds add ~0.5 MB to the zip
        "checksum_sha256": "<placeholder>",  # Recalculate for v1.1.0 zip
        "download_url": "https://cdn.shecare.app/luna_assets_v1.1.0.zip",
    }
```

**File:** `src/services/assetDownloader.ts` — Ensure version comparison triggers re-download:

```typescript
// Inside checkForUpdate:
// remoteVersion e.g. "1.1.0" > localVersion e.g. "1.0.0" → re-download
function shouldUpdate(remote: string | null, local: string | null): boolean {
  if (!remote) return false;
  if (!local) return true; // fresh install
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rn = r[i] || 0;
    const ln = l[i] || 0;
    if (rn > ln) return true;
    if (rn < ln) return false;
  }
  return false;
}
```

## 11.7 Alembic Migration

```bash
cd backend
alembic revision --autogenerate -m "add_health_tips_table"
alembic upgrade head
```

Then seed the data:

```bash
# Through a CLI command or startup script
python -c "import asyncio; from app.core.database import SessionLocal; from app.modules.wellness.seed import seed_health_tips; asyncio.run(seed_health_tips(SessionLocal()))"
```

---

## 11.7 Validation

- [ ] `health_tips` table created with migration
- [ ] 100+ seed tips inserted (count with `SELECT COUNT(*) FROM health_tips`)
- [ ] `GET /api/v1/wellness/health-tips` returns 3 random tips
- [ ] `GET /api/v1/wellness/health-tips?metric_type=sleep` returns sleep tips only
- [ ] `GET /api/v1/wellness/health-tips?metric_type=invalid` returns empty list
- [ ] Endpoint respects `limit` parameter
- [ ] TypeScript-like: response structure `{ data: [...], total: N }`
- [ ] `tsc --noEmit` passes (backend CI equivalent: `mypy`, `ruff`)
