"""User service: profile CRUD, avatar, FCM, GDPR (plan 05)."""

from __future__ import annotations

import uuid
from datetime import UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import EncryptionService, make_user_salt
from app.modules.auth.models import User
from app.modules.users.exceptions import UserNotFoundError
from app.modules.users.models import AuditLog, UserConsent
from app.modules.users.schemas import (
    ConsentResponse,
    DataExportResponse,
    ProfileResponse,
    ProfileUpdate,
)


class UserService:
    def __init__(self, db: AsyncSession, encryption: EncryptionService) -> None:
        self.db = db
        self.encryption = encryption

    async def get_profile(self, user_id: uuid.UUID) -> User:
        stmt = select(User).where(User.id == user_id).where(User.is_active.is_(True))
        user = (await self.db.execute(stmt)).scalar_one_or_none()
        if user is None:
            raise UserNotFoundError("User not found")
        return user

    async def update_profile(self, user_id: uuid.UUID, updates: ProfileUpdate) -> User:
        user = await self.get_profile(user_id)
        update_data = updates.model_dump(exclude_unset=True)

        if "medical_notes" in update_data and update_data["medical_notes"] is not None:
            if user.encryption_key_salt is None:
                user.encryption_key_salt = make_user_salt()
            update_data["medical_notes"] = self.encryption.encrypt_for_user(
                update_data["medical_notes"], user.encryption_key_salt
            )

        for key, value in update_data.items():
            setattr(user, key, value)

        await self.db.commit()
        await self.db.refresh(user)

        await self._log_audit(user_id, "profile.updated", "user", str(user_id))
        return user

    async def soft_delete(self, user_id: uuid.UUID) -> None:
        user = await self.get_profile(user_id)
        user.is_active = False
        await self.db.commit()
        await self._log_audit(user_id, "user.deleted", "user", str(user_id))

    async def register_fcm_token(self, user_id: uuid.UUID, token: str) -> list[str]:
        user = await self.get_profile(user_id)
        tokens = list(user.fcm_tokens)
        if token not in tokens:
            tokens.append(token)
            user.fcm_tokens = tokens
            await self.db.commit()
        return tokens

    async def remove_fcm_token(self, user_id: uuid.UUID, token: str) -> list[str]:
        user = await self.get_profile(user_id)
        tokens = list(user.fcm_tokens)
        if token in tokens:
            tokens.remove(token)
            user.fcm_tokens = tokens
            await self.db.commit()
        return tokens

    async def list_fcm_tokens(self, user_id: uuid.UUID) -> list[str]:
        user = await self.get_profile(user_id)
        return list(user.fcm_tokens)

    async def record_consent(
        self, user_id: uuid.UUID, consent_type: str, version: str, granted: bool, ip_hash: str | None = None
    ) -> UserConsent:
        consent = UserConsent(
            user_id=user_id,
            consent_type=consent_type,
            version=version,
            granted=granted,
            ip_hash=ip_hash,
        )
        self.db.add(consent)
        await self.db.commit()
        await self.db.refresh(consent)
        return consent

    async def list_consents(self, user_id: uuid.UUID) -> list[UserConsent]:
        stmt = (
            select(UserConsent)
            .where(UserConsent.user_id == user_id)
            .order_by(UserConsent.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def export_user_data(self, user_id: uuid.UUID) -> DataExportResponse:
        from datetime import datetime

        from sqlalchemy import text

        user = await self.get_profile(user_id)

        profile = ProfileResponse.model_validate(user)

        async def _fetch(table: str, where_col: str = "user_id") -> list[dict]:
            stmt = text(f"SELECT * FROM {table} WHERE {where_col} = :uid ORDER BY created_at DESC")
            result = await self.db.execute(stmt, {"uid": user_id})
            cols = result.keys()
            return [dict(zip(cols, row, strict=True)) for row in result.fetchall()]

        journal_entries = await _fetch("journal_entries")
        mood_logs = await _fetch("mood_logs")
        cycle_entries = await _fetch("cycle_entries")
        sos_alerts = await _fetch("sos_alerts")
        emergency_contacts = await _fetch("emergency_contacts")

        consents = await self.list_consents(user_id)
        consent_data = [ConsentResponse.model_validate(c) for c in consents]

        stmt = text("SELECT * FROM pregnancy_profiles WHERE user_id = :uid")
        result = await self.db.execute(stmt, {"uid": user_id})
        cols = result.keys()
        pregnancy_profiles = [dict(zip(cols, row, strict=True)) for row in result.fetchall()]

        pregnancy_daily_logs: list[dict] = []
        for pp in pregnancy_profiles:
            stmt2 = text("SELECT * FROM pregnancy_daily_logs WHERE pregnancy_id = :pid ORDER BY log_date DESC")
            result2 = await self.db.execute(stmt2, {"pid": pp["id"]})
            cols2 = result2.keys()
            pregnancy_daily_logs.extend(dict(zip(cols2, row, strict=True)) for row in result2.fetchall())

        stmt = text("SELECT * FROM audit_logs WHERE user_id = :uid ORDER BY occurred_at DESC LIMIT 500")
        result = await self.db.execute(stmt, {"uid": user_id})
        cols = result.keys()
        audit_logs = [dict(zip(cols, row, strict=True)) for row in result.fetchall()]

        return DataExportResponse(
            generated_at=datetime.now(tz=UTC),
            user=profile,
            journal_entries=journal_entries,
            mood_logs=mood_logs,
            cycle_entries=cycle_entries,
            pregnancy_profiles=pregnancy_profiles,
            pregnancy_daily_logs=pregnancy_daily_logs,
            sos_alerts=sos_alerts,
            emergency_contacts=emergency_contacts,
            consents=consent_data,
            audit_logs=audit_logs,
        )

    async def _log_audit(
        self, user_id: uuid.UUID, action: str, resource: str, resource_id: str | None = None,
        ip_hash: str | None = None, payload: dict | None = None,
    ) -> None:
        self.db.add(
            AuditLog(
                user_id=user_id,
                action=action,
                resource=resource,
                resource_id=resource_id,
                ip_hash=ip_hash,
                payload=payload or {},
            )
        )
        await self.db.commit()
