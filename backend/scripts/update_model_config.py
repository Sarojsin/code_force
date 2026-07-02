import asyncio
import sys
import os
sys.path.insert(0, r"E:\her_care\backend")
os.chdir(r"E:\her_care\backend")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine("postgresql+asyncpg://shecare:shecare@localhost:5432/shecare")
    async with engine.begin() as conn:
        await conn.execute(text("""
            INSERT INTO system_config (key, value) VALUES ('global_model_version', '1')
            ON CONFLICT (key) DO UPDATE SET value = '1'
        """))
        await conn.execute(text("""
            INSERT INTO system_config (key, value) VALUES ('global_model_path', 'global_model_v1.json')
            ON CONFLICT (key) DO UPDATE SET value = 'global_model_v1.json'
        """))
        print("system_config updated")
    await engine.dispose()

asyncio.run(main())
