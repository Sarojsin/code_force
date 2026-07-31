"""Diary business logic (backend_rules §1.2: services are HTTP-free)."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select, func, and_, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.s3_client import S3Client
from app.modules.diary.exceptions import (
    DiaryNotFoundError,
    DiaryPageNotFoundError,
    DiaryPageObjectNotFoundError,
    DiaryMediaNotFoundError,
    DiaryVersionConflictError,
)
from app.modules.diary.models import Diary, DiaryPage, DiaryPageObject, DiaryMedia


class DiaryService:
    def __init__(self, db: AsyncSession, s3: S3Client):
        self.db = db
        self.s3 = s3

    # ─── Diary CRUD ─────────────────────────────────────────────────────

    async def create_diary(self, user_id: uuid.UUID, title: str, cover_color: str = "primary",
                           texture_id: str | None = None, font_id: str | None = None) -> Diary:
        diary = Diary(
            user_id=user_id,
            title=title,
            cover_color=cover_color,
            texture_id=texture_id,
            font_id=font_id,
        )
        self.db.add(diary)
        await self.db.flush()
        return diary

    async def list_diaries(self, user_id: uuid.UUID) -> list[Diary]:
        result = await self.db.execute(
            select(Diary).where(and_(Diary.user_id == user_id, Diary.is_active == True))
            .order_by(Diary.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_diary(self, diary_id: uuid.UUID, user_id: uuid.UUID) -> Diary:
        result = await self.db.execute(
            select(Diary).where(and_(Diary.id == diary_id, Diary.user_id == user_id, Diary.is_active == True))
        )
        diary = result.scalar_one_or_none()
        if not diary:
            raise DiaryNotFoundError(f"Diary {diary_id} not found")
        return diary

    async def update_diary(self, diary_id: uuid.UUID, user_id: uuid.UUID,
                           updates: dict) -> Diary:
        diary = await self.get_diary(diary_id, user_id)
        for key, value in updates.items():
            if value is not None and hasattr(diary, key):
                setattr(diary, key, value)
        await self.db.flush()
        return diary

    async def delete_diary(self, diary_id: uuid.UUID, user_id: uuid.UUID) -> None:
        diary = await self.get_diary(diary_id, user_id)
        diary.is_active = False
        await self.db.flush()

    # ─── Page CRUD ──────────────────────────────────────────────────────

    async def create_page(self, diary_id: uuid.UUID, user_id: uuid.UUID,
                          page_date: date, **memory_kwargs) -> DiaryPage:
        diary = await self.get_diary(diary_id, user_id)

        result = await self.db.execute(
            select(func.coalesce(func.max(DiaryPage.page_number), 0))
            .where(and_(DiaryPage.diary_id == diary_id, DiaryPage.is_active == True))
        )
        max_page = result.scalar() or 0

        page = DiaryPage(
            diary_id=diary_id,
            page_number=max_page + 1,
            page_date=page_date,
            memory_title=memory_kwargs.get("memory_title"),
            memory_tags=memory_kwargs.get("memory_tags", []),
            memory_people=memory_kwargs.get("memory_people", []),
            memory_location=memory_kwargs.get("memory_location"),
            memory_weather=memory_kwargs.get("memory_weather"),
            memory_mood=memory_kwargs.get("memory_mood"),
        )
        self.db.add(page)

        diary.page_count = (diary.page_count or 0) + 1
        await self.db.flush()
        return page

    async def list_pages(self, diary_id: uuid.UUID, user_id: uuid.UUID,
                         limit: int = 50, offset: int = 0) -> list[DiaryPage]:
        await self.get_diary(diary_id, user_id)
        result = await self.db.execute(
            select(DiaryPage)
            .where(and_(DiaryPage.diary_id == diary_id, DiaryPage.is_active == True))
            .order_by(DiaryPage.page_number.asc())
            .offset(offset).limit(limit)
        )
        return list(result.scalars().all())

    async def get_page(self, page_id: uuid.UUID, user_id: uuid.UUID) -> DiaryPage:
        result = await self.db.execute(
            select(DiaryPage)
            .options(selectinload(DiaryPage.objects))
            .where(and_(DiaryPage.id == page_id, DiaryPage.is_active == True))
        )
        page = result.scalar_one_or_none()
        if not page:
            raise DiaryPageNotFoundError(f"Page {page_id} not found")
        diary = await self.get_diary(page.diary_id, user_id)
        return page

    async def update_page(self, page_id: uuid.UUID, user_id: uuid.UUID,
                          updates: dict) -> DiaryPage:
        page = await self.get_page(page_id, user_id)
        for key, value in updates.items():
            if value is not None and hasattr(page, key):
                setattr(page, key, value)
        page.version += 1
        await self.db.flush()
        return page

    async def delete_page(self, page_id: uuid.UUID, user_id: uuid.UUID) -> None:
        page = await self.get_page(page_id, user_id)
        page.is_active = False
        diary = await self.get_diary(page.diary_id, user_id)
        diary.page_count = max(0, (diary.page_count or 0) - 1)
        await self.db.flush()

    # ─── Object CRUD ────────────────────────────────────────────────────

    async def create_object(self, page_id: uuid.UUID, user_id: uuid.UUID,
                            obj_data: dict) -> DiaryPageObject:
        page = await self.get_page(page_id, user_id)
        obj = DiaryPageObject(page_id=page_id, **obj_data)
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def update_object(self, obj_id: uuid.UUID, page_id: uuid.UUID,
                            user_id: uuid.UUID, updates: dict) -> DiaryPageObject:
        await self.get_page(page_id, user_id)
        result = await self.db.execute(
            select(DiaryPageObject).where(
                and_(DiaryPageObject.id == obj_id, DiaryPageObject.page_id == page_id,
                     DiaryPageObject.is_active == True)
            )
        )
        obj = result.scalar_one_or_none()
        if not obj:
            raise DiaryPageObjectNotFoundError(f"Object {obj_id} not found")
        for key, value in updates.items():
            if value is not None and hasattr(obj, key):
                setattr(obj, key, value)
        await self.db.flush()
        return obj

    async def delete_object(self, obj_id: uuid.UUID, page_id: uuid.UUID,
                            user_id: uuid.UUID) -> None:
        await self.get_page(page_id, user_id)
        result = await self.db.execute(
            select(DiaryPageObject).where(
                and_(DiaryPageObject.id == obj_id, DiaryPageObject.page_id == page_id,
                     DiaryPageObject.is_active == True)
            )
        )
        obj = result.scalar_one_or_none()
        if not obj:
            raise DiaryPageObjectNotFoundError(f"Object {obj_id} not found")
        obj.is_active = False
        await self.db.flush()

    # ─── Operations ─────────────────────────────────────────────────────

    async def apply_operations(self, page_id: uuid.UUID, user_id: uuid.UUID,
                               operations: list[dict]) -> DiaryPage:
        page = await self.get_page(page_id, user_id)
        for op in operations:
            if page.version != op.get("page_version"):
                raise DiaryVersionConflictError(
                    f"Page version mismatch: expected {page.version}, got {op.get('page_version')}"
                )
            op_type = op.get("op_type")
            data = op.get("data", {})
            if op_type == "MOVE_OBJECT":
                await self._apply_move(data)
            elif op_type == "RESIZE_OBJECT":
                await self._apply_resize(data)
            elif op_type == "UPDATE_OBJECT":
                await self._apply_update_object(data)
            elif op_type == "DELETE_OBJECT":
                await self._apply_delete_object(data)
            elif op_type == "ADD_OBJECT":
                await self._apply_add_object(page_id, data)
            page.version += 1
        await self.db.flush()
        return page

    async def _apply_move(self, data: dict) -> None:
        obj_id = data.get("object_id")
        result = await self.db.execute(
            select(DiaryPageObject).where(DiaryPageObject.id == obj_id)
        )
        obj = result.scalar_one_or_none()
        if obj:
            obj.position_x = data.get("position_x", obj.position_x)
            obj.position_y = data.get("position_y", obj.position_y)

    async def _apply_resize(self, data: dict) -> None:
        obj_id = data.get("object_id")
        result = await self.db.execute(
            select(DiaryPageObject).where(DiaryPageObject.id == obj_id)
        )
        obj = result.scalar_one_or_none()
        if obj:
            obj.width = data.get("width", obj.width)
            obj.height = data.get("height", obj.height)

    async def _apply_update_object(self, data: dict) -> None:
        obj_id = data.get("object_id")
        result = await self.db.execute(
            select(DiaryPageObject).where(DiaryPageObject.id == obj_id)
        )
        obj = result.scalar_one_or_none()
        if obj:
            for key in ("text_content", "font_family", "font_size", "color", "rotation"):
                if key in data:
                    setattr(obj, key, data[key])

    async def _apply_delete_object(self, data: dict) -> None:
        obj_id = data.get("object_id")
        result = await self.db.execute(
            select(DiaryPageObject).where(DiaryPageObject.id == obj_id)
        )
        obj = result.scalar_one_or_none()
        if obj:
            obj.is_active = False

    async def _apply_add_object(self, page_id: uuid.UUID, data: dict) -> None:
        obj = DiaryPageObject(page_id=page_id, **data)
        self.db.add(obj)

    # ─── Media ──────────────────────────────────────────────────────────

    async def create_media(self, user_id: uuid.UUID, media_type: str,
                           file_size_bytes: int, mime_type: str,
                           local_file_path: str | None = None) -> DiaryMedia:
        media = DiaryMedia(
            user_id=user_id,
            media_type=media_type,
            file_size_bytes=file_size_bytes,
            mime_type=mime_type,
            local_file_path=local_file_path,
        )
        self.db.add(media)
        await self.db.flush()
        return media

    async def update_media(self, media_id: uuid.UUID, user_id: uuid.UUID,
                           updates: dict) -> DiaryMedia:
        result = await self.db.execute(
            select(DiaryMedia).where(
                and_(DiaryMedia.id == media_id, DiaryMedia.user_id == user_id,
                     DiaryMedia.is_active == True)
            )
        )
        media = result.scalar_one_or_none()
        if not media:
            raise DiaryMediaNotFoundError(f"Media {media_id} not found")
        for key, value in updates.items():
            if value is not None and hasattr(media, key):
                setattr(media, key, value)
        await self.db.flush()
        return media

    async def get_media(self, media_id: uuid.UUID, user_id: uuid.UUID) -> DiaryMedia:
        result = await self.db.execute(
            select(DiaryMedia).where(
                and_(DiaryMedia.id == media_id, DiaryMedia.user_id == user_id,
                     DiaryMedia.is_active == True)
            )
        )
        media = result.scalar_one_or_none()
        if not media:
            raise DiaryMediaNotFoundError(f"Media {media_id} not found")
        return media

    async def delete_media(self, media_id: uuid.UUID, user_id: uuid.UUID) -> None:
        media = await self.get_media(media_id, user_id)
        if media.s3_key:
            await self.s3.delete_file(media.s3_key)
        if media.thumbnail_s3_key:
            await self.s3.delete_file(media.thumbnail_s3_key)
        media.is_active = False
        await self.db.flush()

    # ─── Presigned Upload URL ───────────────────────────────────────────

    async def get_presigned_upload_url(self, user_id: uuid.UUID, media_id: uuid.UUID,
                                        content_type: str = "application/octet-stream") -> dict:
        key = f"diary/{user_id}/{media_id}/{uuid.uuid4()}.bin"
        url = self.s3.presigned_upload_url(
            bucket="shecare-diary-media",
            key=key,
            content_type=content_type,
        )
        return {"url": url, "key": key}

    # ─── Search ─────────────────────────────────────────────────────────

    async def search(self, user_id: uuid.UUID, q: str | None = None,
                     date: date | None = None, tag: str | None = None,
                     person: str | None = None, location: str | None = None,
                     weather: str | None = None, mood: str | None = None,
                     limit: int = 50, offset: int = 0) -> list[DiaryPage]:
        conditions = [DiaryPage.is_active == True]
        subquery = select(Diary.id).where(
            and_(Diary.user_id == user_id, Diary.is_active == True)
        )
        conditions.append(DiaryPage.diary_id.in_(subquery))

        if q:
            conditions.append(
                DiaryPage.memory_title.ilike(f"%{q}%")
            )
        if date:
            conditions.append(DiaryPage.page_date == date)
        if tag:
            conditions.append(DiaryPage.memory_tags.has_any([tag]))
        if person:
            conditions.append(DiaryPage.memory_people.has_any([person]))
        if location:
            conditions.append(DiaryPage.memory_location.ilike(f"%{location}%"))
        if weather:
            conditions.append(DiaryPage.memory_weather == weather)
        if mood:
            conditions.append(DiaryPage.memory_mood == mood)

        result = await self.db.execute(
            select(DiaryPage)
            .where(and_(*conditions))
            .order_by(DiaryPage.page_date.desc())
            .offset(offset).limit(limit)
        )
        return list(result.scalars().all())

    # ─── Timeline ───────────────────────────────────────────────────────

    async def get_timeline(self, user_id: uuid.UUID, year: int, month: int) -> list[dict]:
        subquery = select(Diary.id).where(
            and_(Diary.user_id == user_id, Diary.is_active == True)
        )
        result = await self.db.execute(
            select(
                DiaryPage.page_date,
                func.count(DiaryPage.id).label("page_count"),
                func.array_agg(DiaryPage.id).label("page_ids"),
            )
            .where(
                and_(
                    DiaryPage.diary_id.in_(subquery),
                    DiaryPage.is_active == True,
                    func.extract("year", DiaryPage.page_date) == year,
                    func.extract("month", DiaryPage.page_date) == month,
                )
            )
            .group_by(DiaryPage.page_date)
            .order_by(DiaryPage.page_date)
        )
        rows = result.all()
        return [
            {"date": str(row.page_date), "count": row.page_count, "page_ids": row.page_ids}
            for row in rows
        ]
