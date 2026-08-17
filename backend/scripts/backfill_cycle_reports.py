import asyncio
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.modules.cycle.models import CycleEntry
from app.modules.cycle.services import CycleService
from app.modules.auth.models import User

async def main():
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(CycleEntry.user_id, func.count(CycleEntry.id))
            .where(CycleEntry.is_active.is_(True), CycleEntry.period_end_date.isnot(None))
            .group_by(CycleEntry.user_id)
        )).all()
        print("users with closed cycles:", rows)
        svc = CycleService(session)
        for user_id, _ in rows:
            entries = (await session.execute(
                select(CycleEntry)
                .where(CycleEntry.user_id == user_id, CycleEntry.is_active.is_(True), CycleEntry.period_end_date.isnot(None))
                .order_by(CycleEntry.period_start_date.desc())
            )).scalars().all()
            for e in entries:
                await svc.generate_report(user_id, e.id)
                print("report ready for cycle", e.period_start_date)

asyncio.run(main())
