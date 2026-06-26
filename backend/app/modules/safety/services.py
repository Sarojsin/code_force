"""Safety service: emergency contacts, SOS trigger, retry, escalation (plan 11)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.event_bus import EventBus
from app.integrations.fcm_client import FCMClient
from app.integrations.twilio_client import TwilioClient
from app.modules.auth.models import User
from app.modules.safety.exceptions import (
    ActiveSOSExistsError,
    ContactLimitExceededError,
    ContactNotFoundError,
    DuplicateIdempotencyError,
    SMSRateLimitExceededError,
    SOSAlertNotFoundError,
    SOSAlreadyCancelledError,
)
from app.modules.safety.models import SOSAlert, SOSNotificationAttempt, TriggerSource
from app.modules.safety.schemas import EmergencyContactCreate, EmergencyContactUpdate
from app.modules.users.models import EmergencyContact


class SafetyService:
    def __init__(
        self,
        db: AsyncSession,
        twilio: TwilioClient,
        fcm: FCMClient,
        settings: Settings,
        event_bus: EventBus | None = None,
    ) -> None:
        self.db = db
        self.twilio = twilio
        self.fcm = fcm
        self.settings = settings
        self.event_bus = event_bus

    # ---- Emergency Contacts ----

    async def list_contacts(self, user_id: uuid.UUID) -> list[EmergencyContact]:
        stmt = (
            select(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
            .where(EmergencyContact.is_active.is_(True))
            .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.created_at)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_contact(self, user_id: uuid.UUID, data: EmergencyContactCreate) -> EmergencyContact:
        # Enforce max 5 contacts
        stmt = (
            select(func.count())
            .select_from(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
            .where(EmergencyContact.is_active.is_(True))
        )
        count = (await self.db.execute(stmt)).scalar()
        if count >= 5:
            raise ContactLimitExceededError("Maximum 5 emergency contacts allowed")

        if data.is_primary:
            await self._clear_primary(user_id)

        contact_user_id_raw = uuid.UUID(data.contact_user_id) if data.contact_user_id else None

        contact = EmergencyContact(
            user_id=user_id,
            name=data.name,
            phone_number=data.phone_number,
            relationship=data.relationship,
            is_primary=data.is_primary,
            contact_user_id=contact_user_id_raw,
            contact_user_id_linked_at=datetime.now(tz=UTC) if contact_user_id_raw else None,
        )
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def update_contact(
        self, contact_id: uuid.UUID, user_id: uuid.UUID, data: EmergencyContactUpdate,
    ) -> EmergencyContact:
        contact = await self._get_contact(contact_id, user_id)
        update_data = data.model_dump(exclude_unset=True)
        if update_data.get("is_primary"):
            await self._clear_primary(user_id)
        if "contact_user_id" in update_data:
            raw = update_data.pop("contact_user_id")
            contact.contact_user_id = uuid.UUID(raw) if raw else None
            contact.contact_user_id_linked_at = datetime.now(tz=UTC) if raw else None
        for key, value in update_data.items():
            setattr(contact, key, value)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def delete_contact(self, contact_id: uuid.UUID, user_id: uuid.UUID) -> None:
        contact = await self._get_contact(contact_id, user_id)
        contact.is_active = False
        await self.db.commit()

    async def _get_contact(self, contact_id: uuid.UUID, user_id: uuid.UUID) -> EmergencyContact:
        stmt = (
            select(EmergencyContact)
            .where(EmergencyContact.id == contact_id)
            .where(EmergencyContact.user_id == user_id)
            .where(EmergencyContact.is_active.is_(True))
        )
        contact = (await self.db.execute(stmt)).scalar_one_or_none()
        if contact is None:
            raise ContactNotFoundError("Emergency contact not found")
        return contact

    async def _clear_primary(self, user_id: uuid.UUID) -> None:
        stmt = (
            select(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
            .where(EmergencyContact.is_primary.is_(True))
        )
        current = (await self.db.execute(stmt)).scalar_one_or_none()
        if current:
            current.is_primary = False

    # ---- SOS ----

    async def trigger_sos(
        self,
        user_id: uuid.UUID,
        latitude: float,
        longitude: float,
        accuracy: int | None = None,
        idempotency_key: str | None = None,
        trigger_source: TriggerSource | None = None,
    ) -> SOSAlert:
        # Idempotency check: reject duplicate key within 24h
        if idempotency_key:
            stmt = (
                select(SOSAlert)
                .where(SOSAlert.idempotency_key == idempotency_key)
                .where(SOSAlert.user_id == user_id)
                .where(SOSAlert.triggered_at > datetime.now(tz=UTC) - timedelta(hours=24))
            )
            existing = (await self.db.execute(stmt)).scalar_one_or_none()
            if existing:
                raise DuplicateIdempotencyError("SOS with this idempotency key already processed within 24h")

        # Existing active alert check
        stmt = (
            select(SOSAlert)
            .where(SOSAlert.user_id == user_id)
            .where(SOSAlert.cancelled_at.is_(None))
            .where(SOSAlert.resolved_at.is_(None))
            .order_by(SOSAlert.triggered_at.desc())
            .limit(1)
        )
        active = (await self.db.execute(stmt)).scalar_one_or_none()
        if active:
            now = datetime.now(tz=UTC)
            triggered_at = active.triggered_at
            if triggered_at.tzinfo is None:
                triggered_at = triggered_at.replace(tzinfo=UTC)
            if (now - triggered_at).total_seconds() < 300:
                raise ActiveSOSExistsError("An active SOS alert already exists (within 5 min)")

        alert = SOSAlert(
            user_id=user_id,
            triggered_at=datetime.now(tz=UTC),
            latitude=latitude,
            longitude=longitude,
            location_accuracy_m=accuracy,
            idempotency_key=idempotency_key,
            trigger_source=trigger_source,
        )
        self.db.add(alert)
        await self.db.commit()
        await self.db.refresh(alert)

        if self.event_bus:
            await self.event_bus.emit("sos_triggered", user_id=str(user_id), alert_id=str(alert.id))

        from app.modules.safety.tasks import send_sos_alerts
        send_sos_alerts.apply_async(
            args=[str(alert.id)],
            queue="priority",
            task_id=f"sos_alert_{alert.id}",
        )
        return alert

    async def get_alert(self, alert_id: uuid.UUID, user_id: uuid.UUID) -> SOSAlert:
        stmt = (
            select(SOSAlert)
            .where(SOSAlert.id == alert_id)
            .where(SOSAlert.user_id == user_id)
        )
        alert = (await self.db.execute(stmt)).scalar_one_or_none()
        if alert is None:
            raise SOSAlertNotFoundError("SOS alert not found")
        return alert

    async def list_history(self, user_id: uuid.UUID) -> list[SOSAlert]:
        stmt = (
            select(SOSAlert)
            .where(SOSAlert.user_id == user_id)
            .order_by(SOSAlert.triggered_at.desc())
            .limit(50)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def cancel_alert(self, alert_id: uuid.UUID, user_id: uuid.UUID) -> SOSAlert:
        alert = await self.get_alert(alert_id, user_id)
        if alert.cancelled_at:
            raise SOSAlreadyCancelledError("SOS alert is already cancelled")
        alert.cancelled_at = datetime.now(tz=UTC)
        alert.resolved_at = datetime.now(tz=UTC)
        alert.false_alarm = True
        await self.db.commit()
        await self.db.refresh(alert)

        if self.event_bus:
            await self.event_bus.emit("sos_cancelled", user_id=str(user_id), alert_id=str(alert.id))

        # Notify all contacts that it was a false alarm
        if alert.contact_ids_notified:
            await self._notify_false_alarm(alert)

        return alert

    async def resolve_alert(self, alert_id: uuid.UUID, user_id: uuid.UUID) -> SOSAlert:
        """User confirms they are safe (resolves the alert without marking as false alarm)."""
        alert = await self.get_alert(alert_id, user_id)
        if alert.resolved_at:
            raise SOSAlreadyCancelledError("SOS alert is already resolved")
        alert.resolved_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(alert)

        if self.event_bus:
            await self.event_bus.emit("sos_resolved", user_id=str(user_id), alert_id=str(alert.id))

        return alert

    async def get_active_alert(self, user_id: uuid.UUID) -> SOSAlert | None:
        stmt = (
            select(SOSAlert)
            .where(SOSAlert.user_id == user_id)
            .where(SOSAlert.cancelled_at.is_(None))
            .where(SOSAlert.resolved_at.is_(None))
            .order_by(SOSAlert.triggered_at.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def _check_sms_rate_limit(self, user_id: uuid.UUID) -> None:
        """No more than 5 SMS per user per hour."""
        one_hour_ago = datetime.now(tz=UTC) - timedelta(hours=1)
        stmt = (
            select(func.count())
            .select_from(SOSNotificationAttempt)
            .join(SOSAlert, SOSNotificationAttempt.sos_alert_id == SOSAlert.id)
            .where(SOSAlert.user_id == user_id)
            .where(SOSNotificationAttempt.channel == "sms")
            .where(SOSNotificationAttempt.attempted_at > one_hour_ago)
        )
        count = (await self.db.execute(stmt)).scalar()
        if count >= 5:
            raise SMSRateLimitExceededError("SMS rate limit exceeded (5/hour)")

    async def _notify_false_alarm(self, alert: SOSAlert) -> None:
        """Send 'I'm safe' false-alarm notification to all notified contacts."""
        user_stmt = select(User).where(User.id == alert.user_id)
        user = (await self.db.execute(user_stmt)).scalar_one_or_none()
        if not user:
            return
        display_name = user.display_name or "Someone"
        body = f"{display_name} is safe! The SOS alert was a false alarm."

        import logging
        logger = logging.getLogger(__name__)

        for contact_id in alert.contact_ids_notified:
            contact_stmt = select(EmergencyContact).where(EmergencyContact.id == contact_id).where(EmergencyContact.is_active.is_(True))
            contact = (await self.db.execute(contact_stmt)).scalar_one_or_none()
            if not contact:
                continue

            # If contact has a linked user, send push
            if contact.contact_user_id:
                device_stmt = select(User).where(User.id == contact.contact_user_id)
                linked_user = (await self.db.execute(device_stmt)).scalar_one_or_none()
                if linked_user and linked_user.fcm_tokens:
                    for token in linked_user.fcm_tokens:
                        try:
                            await self.fcm.send_to_token(
                                token=token,
                                title="✅ I'm Safe",
                                body=body,
                                data={"type": "false_alarm", "alert_id": str(alert.id)},
                            )
                        except Exception as exc:
                            logger.warning("fcm.false_alarm_failed", extra={"error": str(exc)})

            # Always send false-alarm SMS as well
            try:
                await self.twilio.send_sms(contact.phone_number, f"SOS FALSE ALARM: {body}")
            except Exception as exc:
                logger.warning("sms.false_alarm_failed", extra={"error": str(exc)})

    async def process_sos_notifications(self, alert_id: uuid.UUID) -> None:
        """Called by Celery task. Sends push for linked contacts, SMS for others."""
        from sqlalchemy import select as sel
        stmt = sel(SOSAlert).where(SOSAlert.id == alert_id)
        alert = (await self.db.execute(stmt)).scalar_one_or_none()
        if alert is None or alert.cancelled_at or alert.resolved_at:
            return

        contacts = await self.list_contacts(alert.user_id)
        if not contacts:
            alert.manual_intervention_needed = True
            await self.db.commit()
            return

        # Enforce SMS rate limit
        await self._check_sms_rate_limit(alert.user_id)

        location_str = f"https://maps.google.com/maps?q={alert.latitude},{alert.longitude}"
        accuracy_note = ""
        if alert.location_accuracy_m and alert.location_accuracy_m > 500:
            accuracy_note = " Location approximate - please call user."

        user_stmt = sel(User).where(User.id == alert.user_id)
        user = (await self.db.execute(user_stmt)).scalar_one_or_none()
        display_name = user.display_name or "A user" if user else "A user"
        blood_group = user.blood_group or "" if user else ""

        all_failed = True
        notified_contact_ids: list[uuid.UUID] = []

        for contact in contacts:
            sms_body = (
                f"SOS: {contact.name}, {display_name} needs help! "
                f"Location: {location_str}"
            )
            if blood_group:
                sms_body += f" Blood group: {blood_group}"
            if accuracy_note:
                sms_body += accuracy_note

            push_sent = False

            # Push to linked user if they have an FCM token
            if contact.contact_user_id:
                linked_user_stmt = sel(User).where(User.id == contact.contact_user_id)
                linked_user = (await self.db.execute(linked_user_stmt)).scalar_one_or_none()
                if linked_user and linked_user.fcm_tokens:
                    for token_ in linked_user.fcm_tokens:
                        attempt = SOSNotificationAttempt(
                            sos_alert_id=alert.id,
                            contact_id=contact.id,
                            channel="push",
                            attempted_at=datetime.now(tz=UTC),
                            push_token=token_,
                        )
                        self.db.add(attempt)
                        try:
                            await self.fcm.send_to_token(
                                token=token_,
                                title="🚨 SOS Alert",
                                body=sms_body,
                                data={
                                    "type": "sos",
                                    "alert_id": str(alert.id),
                                    "latitude": str(alert.latitude),
                                    "longitude": str(alert.longitude),
                                },
                            )
                            attempt.status = "sent"
                            attempt.succeeded_at = datetime.now(tz=UTC)
                            push_sent = True
                            all_failed = False
                        except Exception as exc:
                            attempt.status = "failed"
                            attempt.error_message = str(exc)[:500]
                            attempt.retry_count = 1
                            logger = __import__("logging").getLogger(__name__)
                            logger.warning("push.contact_failed", extra={"contact_id": str(contact.id), "error": str(exc)})

            # SMS fallback: either no linked user or push failed
            if not push_sent:
                attempt = SOSNotificationAttempt(
                    sos_alert_id=alert.id,
                    contact_id=contact.id,
                    channel="sms",
                    attempted_at=datetime.now(tz=UTC),
                )
                self.db.add(attempt)

                try:
                    await self.twilio.send_sms(contact.phone_number, sms_body)
                    attempt.status = "sent"
                    attempt.succeeded_at = datetime.now(tz=UTC)
                    all_failed = False
                except Exception as exc:
                    attempt.status = "failed"
                    attempt.error_message = str(exc)[:500]
                    attempt.retry_count = 1

            notified_contact_ids.append(contact.id)

        if all_failed:
            alert.manual_intervention_needed = True
            alert.escalation_flag = True

        alert.contact_ids_notified = notified_contact_ids
        await self.db.commit()
