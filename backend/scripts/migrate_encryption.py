"""Migration helper: backfill encryption keys for existing users.

Usage: python -m scripts.migrate_encryption

This script:
1. Finds all users without encryption_key_salt set
2. Generates a salt for each
3. Re-encrypts any plaintext fields (medical_notes, journal content) with the new salt

Run this after deployment if there are existing users whose data is in plaintext.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.encryption import EncryptionService, get_encryption_service, make_user_salt
from app.modules.auth.models import User
from app.modules.wellness.models import JournalEntry


async def backfill_encryption_keys() -> dict[str, int]:
    get_settings()
    encryption: EncryptionService = get_encryption_service()
    stats = {"users_backfilled": 0, "journals_reencrypted": 0, "errors": 0}

    async with AsyncSessionLocal() as db:
        users = (
            await db.execute(
                select(User).where(User.encryption_key_salt.is_(None)).where(User.is_active.is_(True))
            )
        ).scalars().all()

        for user in users:
            try:
                salt = make_user_salt()
                user.encryption_key_salt = salt

                if user.medical_notes:
                    user.medical_notes = encryption.encrypt_for_user(user.medical_notes, salt)

                stats["users_backfilled"] += 1
            except Exception as e:
                print(f"Error backfilling user {user.id}: {e}")
                stats["errors"] += 1

        journals = (
            await db.execute(
                select(JournalEntry).where(JournalEntry.content.isnot(None))
            )
        ).scalars().all()

        for entry in journals:
            try:
                user = next((u for u in users if u.id == entry.user_id), None)
                if user and user.encryption_key_salt:
                    entry.content = encryption.encrypt_for_user(entry.content, user.encryption_key_salt)
                    stats["journals_reencrypted"] += 1
            except Exception as e:
                print(f"Error reencrypting journal {entry.id}: {e}")
                stats["errors"] += 1

        await db.commit()
    return stats


def main() -> None:
    result = asyncio.run(backfill_encryption_keys())
    print(f"Migration complete: {result}")


if __name__ == "__main__":
    main()
