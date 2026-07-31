# Diary Module — Plan 10

> **Status:** Approved for build
> **Based on:** `journalrawplan.md` product spec, `diary_module/heritage_ledger/DESIGN.md` design system,
> `diary_module/diary_library/code.html`, `diary_module/diary_editor/code.html`,
> `diary_module/diary_page_read_mode/code.html`
> **Module name:** `diary` (backend) / `diary` (mobile screens)

---

## 1. Architecture Decision: Journal vs Diary

| Aspect | Journal (existing) | Diary (new) |
|--------|--------------------|-------------|
| Entry type | Text + mood + optional single image | Free-form canvas with memories: text, images, video, voice, tags, people, location, weather |
| Layout | Fixed: title, content, mood fields | Free placement anywhere on page |
| Content | Server-encrypted text | Text encrypted same pattern; media stored locally then synced to S3 in background |
| Pages | One entry = one record | One diary = many pages, each page = many objects |
| Sync unit | Full entry | Granular operations (move, resize, delete, add object) |
| Target user | Quick note / mood check | Rich scrapbook memory keeping |

**UX:** When user taps "+" in the journal section, they choose:
- "New Journal Entry" → existing text editor
- "New Memory Diary" → first time: download assets zip, then open diary canvas

---

## 2. Design System (from `heritage_ledger/DESIGN.md`)

### Concept: "Digital Heirlooms" — Tactile Neoclassicism

Evokes the weight of a physical leather-bound journal. Warm, low-contrast, paper-like surfaces. Content should never feel like a software interface — it should feel like a curated canvas.

### Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| **Primary** | `#410403` | Oxblood burgundy — "leather" of the diary. Primary buttons, active states, book covers |
| **Primary Container** | `#5e1914` | Rich burgundy for diary spine detail |
| **On Primary** | `#ffffff` | Text on primary surfaces |
| **On Primary Container** | `#e17e72` | Soft rose for text on container |
| **Secondary** | `#7d562d` | Tan/brass — decorative accents, dividers, memory chips, gold embossing |
| **Secondary Container** | `#ffca98` | Warm peach for chip backgrounds |
| **Tertiary** | `#0f2115` | Hunter green — secondary actions, nature tags |
| **Surface** | `#fbf9f1` | Cream cardstock — global background |
| **On Surface** | `#1b1c17` | Warm dark for typography (no pure black) |
| **On Surface Variant** | `#554240` | Muted brown for secondary text |
| **Outline** | `#88726f` | Warm gray borders |
| **Outline Variant** | `#dbc1bd` | Subtle dividers, dashed borders |

### Typography (3-font system + cursive)

| Role | Font | Size | Weight | Used For |
|------|------|------|--------|----------|
| Display / Headlines | **Libre Caslon Text** | 32px / 24px | 700 / 600 | Diary titles, page dates, screen headers — "published book" authority |
| Entry Body | **Literata** | 18px | 400 (regular + italic) | Diary entry text, long-form reading — ink on paper feel |
| UI Labels | **Work Sans** | 16px / 12px | 400 / 600 | Buttons, navigation, captions — neutral, functional |
| Handwriting | **Great Vibes** | 36px | 400 | Short cursive quotes on pages (optional, per user choice) |

### Layout

- **Grid:** Simple 4-column mobile layout, vertical stacking
- **Gutter margin:** 24px minimum — content never touches screen edge (mimics scrapbook border)
- **Spacing:** 8/16/32px vertical rhythm, 40px safe area bottom
- **Alignment:** Headlines centered (title page formality), body text left-aligned
- **Paper texture:** Global low-opacity noise grain on all neutral surfaces (`natural-paper.png`, `felt.png`, `stardust.png` overlays)

### Shapes & Elevation

- **Buttons / inputs:** 8px radius (well-handled, not bubbly)
- **Cards / sheets:** 24px radius (premium leather notebook corners)
- **Book spine:** 12px darker strip on left edge of diary cards
- **Shadows:** Soft ambient, multi-layered — `box-shadow: 0 10px 20px rgba(65,4,3,0.15)` for polaroid photos
- **Drop shadows:** `filter: drop-shadow(2px 4px 3px rgba(0,0,0,0.1))` for stickers

### Components

| Component | Style |
|-----------|-------|
| **Journal Cover (Diary Card)** | Primary/tertiary background, leather texture overlay, gold embossed title, 12px spine strip, "X Pages Preserved" label |
| **Floating Toolbar** | Bottom-right FAB expands into vertical pill buttons. Frosted glass effect (`backdrop-blur`). Items: Mood, Voice, Sticker, Image, Text, Video |
| **Memory Chip** | Small metadata tag — `secondary`/`secondary-container` background, rotated slightly, like washi tape |
| **Scrapbook Photo** | White 8px border, slight rotation (2-3°), drop shadow, tape strip overlay across top |
| **Pressed Flower / Sticker** | Rotated, drop shadow, positioned freely on page |
| **Date Stamp** | Dashed border, rotated -2°, uppercase label-caps |
| **Mood Badge** | Circular, icon + label, positioned on page edge |
| **Vintage Stamp** | Dashed border, icon + location text, bottom corner |
| **Text Blocks** | Cursive (Great Vibes) for short quotes, Literata for body paragraphs |
| **Resize Handles** | 10px squares at all 4 corners of selected object |
| **Drag Handle** | 6-dot indicator on left side of selected text block |
| **Tool Overlay** | Horizontal pill above selected object: crop, filter, delete |

---

## 3. Backend: Module Structure

```
backend/app/modules/diary/
├── __init__.py
├── models.py          # SQLAlchemy: Diary, DiaryPage, DiaryPageObject, DiaryMedia
├── schemas.py         # Pydantic Create / Update / Response / InDB
├── services.py        # Business logic (no HTTP types)
├── routes.py          # Thin: parse, delegate, respond
├── dependencies.py    # FastAPI Depends (get_current_user, get_diary_service)
├── tasks.py           # Celery: background media upload, thumbnail generation
└── exceptions.py      # DiaryError, DiaryNotFound, DiaryPageNotFound
```

### 3.1 Models (`models.py`)

```python
import enum


class CanvasObjectType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    VOICE = "voice"
    MOOD = "mood"
    STICKER = "sticker"


class Diary(Base):
    __tablename__ = "diaries"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    cover_color: Mapped[str] = mapped_column(String(20), default="primary")  # "primary" | "secondary" | "tertiary"
    texture_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    font_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    lock_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "pin", "biometric"
    is_active: Mapped[bool] = mapped_column(default=True)

    # Base columns: id (UUID PK), created_at, updated_at (DateTime with tz)


class DiaryPage(Base):
    __tablename__ = "diary_pages"

    diary_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("diaries.id", ondelete="CASCADE"), index=True, nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    page_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Memory metadata — search dimensions, shown as memory chips on the page
    memory_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    memory_tags: Mapped[dict] = mapped_column(JSONB, default=list, nullable=False)
    memory_people: Mapped[dict] = mapped_column(JSONB, default=list, nullable=False)
    memory_location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    memory_weather: Mapped[str | None] = mapped_column(String(50), nullable=True)
    memory_mood: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Versioning for conflict recovery, undo, future version history
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Unique constraint: (diary_id, page_number)
    # Base columns


class DiaryPageObject(Base):
    __tablename__ = "diary_page_objects"

    page_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("diary_pages.id", ondelete="CASCADE"), index=True, nullable=False)
    object_type: Mapped[CanvasObjectType] = mapped_column(
        SQLAlchemyEnum(CanvasObjectType), nullable=False
    )

    # Typed columns — no single JSON blob. Enables search, analytics, AI summaries.
    # Text object fields
    text_content: Mapped[str | None] = mapped_column(String, nullable=True)
    font_family: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "Libre Caslon Text", "Literata", "Great Vibes", "Work Sans"
    font_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    text_alignment: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Image / Video / Voice fields
    media_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("diary_media.id", ondelete="SET NULL"), nullable=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Video
    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Sticker fields
    sticker_id: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "flower_pressed_001", "star_002"

    # JSON only for truly varying fields
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Layout — shared across all object types
    position_x: Mapped[float] = mapped_column(Float, nullable=False)
    position_y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    rotation: Mapped[float | None] = mapped_column(Float, default=0, nullable=True)  # degrees, e.g. -3, 2
    z_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Base columns (UUID PK)


class DiaryMedia(Base):
    __tablename__ = "diary_media"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)

    s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    upload_status: Mapped[str] = mapped_column(String(20), default="local")
        # "local" → "uploading" → "synced" → "failed"

    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    local_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Base columns
    # NOTE: No page_id or object_id FK. Objects reference media_id.
    # Allows same media to appear on multiple pages.
```

### 3.2 Schemas (`schemas.py`)

```
DiaryCreate           title, cover_color, texture_id, font_id
DiaryUpdate           title, cover_color, texture_id, font_id, is_locked, lock_type
DiaryResponse         id, title, cover_color, texture_id, font_id, page_count, is_locked, created_at, updated_at

DiaryPageCreate           diary_id, page_date, memory_title, memory_tags[], memory_people[],
                          memory_location, memory_weather, memory_mood
DiaryPageUpdate           memory_title, memory_tags, memory_people, memory_location,
                          memory_weather, memory_mood, is_favorite
DiaryPageResponse         id, diary_id, page_number, page_date, version, memory_title,
                          memory_tags, memory_people, memory_location, memory_weather,
                          memory_mood, is_favorite, objects[], created_at, updated_at

DiaryPageObjectCreate     object_type (enum), text_content, font_family, font_size, color,
                          text_alignment, media_id, caption, thumbnail_s3_key,
                          video_duration_sec, sticker_id, metadata,
                          position_x, position_y, width, height, rotation, z_index
DiaryPageObjectUpdate     Same as Create (all optional)
DiaryPageObjectResponse   id, page_id, object_type, text_content, font_family, font_size,
                          color, text_alignment, media_id, caption, thumbnail_s3_key,
                          video_duration_sec, sticker_id, metadata,
                          position_x, position_y, width, height, rotation, z_index

DiaryMediaCreate          media_type, file_size_bytes, mime_type, local_file_path
DiaryMediaResponse        id, media_type, file_size_bytes, mime_type, upload_status,
                          duration_sec, width, height, created_at
```

### 3.3 Routes (`routes.py`)

All under `prefix="/diary"` → `"/api/v1/diary/...`

```
  POST   /diaries                        → Create diary
  GET    /diaries                         → List user's diaries
  GET    /diaries/{diary_id}              → Get diary with pages summary
  PATCH  /diaries/{diary_id}              → Update diary settings
  DELETE /diaries/{diary_id}              → Soft-delete diary

  POST   /diaries/{diary_id}/pages        → Add page
  GET    /diaries/{diary_id}/pages        → List pages (cursor-based)
  GET    /diaries/{diary_id}/pages/{page_id}       → Get page with objects
  PATCH  /diaries/{diary_id}/pages/{page_id}       → Update page (bumps version)
  DELETE /diaries/{diary_id}/pages/{page_id}       → Soft-delete page

  POST   /pages/{page_id}/objects         → Add object
  PUT    /pages/{page_id}/objects/{obj_id}         → Update object
  DELETE /pages/{page_id}/objects/{obj_id}         → Delete object

  POST   /pages/{page_id}/operations      → Batch submit queued operations
  GET    /pages/{page_id}/operations      → Get operation history

  POST   /media                           → Register media
  PATCH  /media/{media_id}                → Update upload_status, s3_key
  GET    /media/{media_id}                → Get media + download URL
  DELETE /media/{media_id}                → Delete media

  GET    /diaries/search?q=&date=&tag=&person=&location=&weather=&mood=
  GET    /diaries/timeline?year=&month=
```

### 3.4 Pluggable registration

In `app/main.py`, add to `MODULE_INITS`:
```
"app.modules.diary.routes:init_module",
```

### 3.5 Encryption

- **Text content** (`text_content`) — encrypted server-side using `core/encryption.py` Fernet + per-user key.
- **Memory metadata** (title, tags, people, location, weather, mood) — plaintext (search dimensions).
- **Media files** — stored locally first, uploaded to S3 in background. SSE-S3 at rest.

---

## 4. Mobile: Screens & Components

```
src/screens/diary/
├── DiaryLibraryScreen.tsx        # Leather-bound book cards, "Start a New Volume" FAB
├── DiaryScreen.tsx               # Page overview grid for a single diary
├── DiaryPageScreen.tsx           # Read mode: scrapbook canvas, page turning
├── DiaryEditorScreen.tsx         # Edit mode: FAB toolbar, resize/drag handles
├── DiaryTimelineScreen.tsx       # Calendar timeline with memory dots
├── DiarySearchScreen.tsx         # Search powered by SQLite FTS
└── components/
    ├── LeatherBookCard.tsx        # Diary library card — oxblood/green cover, gold emboss, spine
    ├── ScrapbookCanvas.tsx        # The free-placement canvas (shared read/edit)
    ├── CanvasObject.tsx           # Single object: text, photo, video, voice, mood, sticker
    ├── ResizeHandles.tsx          # 4-corner resize squares + left drag handle
    ├── ObjectToolOverlay.tsx      # Pill above selected: crop, filter, delete
    ├── MemoryChip.tsx             # Location/tag washi tape label (e.g. "Lake District, 1994")
    ├── DateStamp.tsx              # Rotated dashed-border date badge
    ├── PolaroidFrame.tsx          # White border + tape strip for photos
    ├── StickerView.tsx            # Rotated, drop-shadowed sticker
    ├── MoodBadge.tsx              # Circular icon + label
    ├── VintageStamp.tsx           # Dashed border stamp (e.g. "PEAK DISTRICT")
    ├── FloatingToolbar.tsx        # FAB → 6 vertical pills: Mood, Voice, Sticker, Image, Text, Video
    ├── PageTurningView.tsx        # Swipe-based with page dot indicators
    ├── StickerPicker.tsx          # Bottom sheet grid
    └── BottomNavBar.tsx           # Library | Timeline | Search | Settings
```

### 4.1 Screen Details

**DiaryLibraryScreen**
- Top bar: hamburger + "Digital Heirlooms" title + search + avatar
- "My Memories" section heading with decorative divider
- Grid of `LeatherBookCard` components:
  - Cover color matches diary setting (primary/secondary/tertiary)
  - Leather texture pattern overlay
  - Gold embossed title (`color: #d4af37` with dual text-shadow)
  - 12px spine strip on left edge (darker shade)
  - "Last entry: X days ago", "Y Pages Preserved" labels
  - "Start a New Volume" dashed card with "+" icon
- Bottom nav: Library (active/book icon), Timeline, Search, Settings
- FAB: Edit/pencil button (bottom-right)

**DiaryPageScreen (Read Mode)**
- Top bar: back arrow + page date title + Edit (pencil) button
- `ScrapbookCanvas`:
  - Paper texture background (cream)
  - `DateStamp` — top-right, rotated -2deg
  - Objects rendered in read-only, placed by position_x/y with rotation
  - Photos in `PolaroidFrame` — tap to view fullscreen
  - `MemoryChip` — location tag, rotated slightly, bottom-right of photo
  - Text in Literata (body) or cursive (quotes)
  - `StickerView` — positioned, rotated, drop-shadowed
  - `MoodBadge` — circular with icon "CALM" label
  - `VintageStamp` — bottom corner, dashed border
  - **Micro-interaction:** Photos tilt subtly following touch (mouse on web)
- Bottom bar: prev chevron | "Page X of Y" + dot indicators | next chevron

**DiaryEditorScreen (Edit Mode)**
- Top bar: undo arrow + "Editing Entry" + autosave status (pulsing dot) + checkmark
- `ScrapbookCanvas` in edit mode:
  - Tap object → `ResizeHandles` appear (4 corners)
  - Drag from left `drag handle` → move
  - Selected object shows `ObjectToolOverlay` above: crop, filter, delete
  - Text objects editable inline (font family, size, color, alignment via modal)
  - Photo toolbar: Replace, Crop, Filter, Delete
  - Dashed "Add layer" zone at bottom
- `FloatingToolbar`:
  - Main FAB: `+`/`✕` toggle with rotate animation
  - Expanded: 6 vertical pill buttons (Mood, Voice, Sticker, Image, Text, Video)
  - Frosted glass background, right-aligned above FAB
- Bottom status pill: "Changes saved to vault" with cloud icon

### 4.2 Navigation

- Entry point: Inside journal section, "New Memory Diary" choice
- First tap: trigger asset download overlay
- After download: push to `DiaryLibraryScreen`
- Deep link: `diary/{diary_id}/page/{page_id}`

### 4.3 Query hooks

```
src/services/queries/diary.ts
  useDiaries()                → GET /api/v1/diary/diaries
  useDiary(id)                → GET /api/v1/diary/diaries/{id}
  useDiaryPages(diaryId)      → GET /api/v1/diary/diaries/{diaryId}/pages
  useDiaryPage(pageId)        → GET /api/v1/diary/diaries/.../pages/{pageId}
  useDiarySearch(params)      → GET /api/v1/diary/diaries/search
  useDiaryTimeline(year, month) → GET /api/v1/diary/diaries/timeline
  useDiaryAssetsMetadata()    → GET /features/diary/metadata
```

### 4.4 Local DB

```
mobile/src/db/schema.ts — new tables:
  diaries, diary_pages, diary_page_objects, diary_media

  + diary_fts — SQLite FTS virtual table
    Columns: memory_title, memory_tags, memory_people, memory_location,
             memory_weather, text_content, caption

mobile/src/services/localDb/
  DiaryLocalService.ts
  DiaryPageLocalService.ts
  DiaryPageObjectLocalService.ts
  DiaryMediaLocalService.ts
  DiarySearchLocalService.ts     # FTS wrapper
  DiarySyncService.ts            # Granular operation queue
```

### 4.5 Asset Download

**Single zip** (~18 MB based on prototype, up from 7-15 MB estimate) on first "Create Diary":
- Stickers (50 PNGs — pressed flowers, stars, hearts, butterflies, ribbons)
- Paper textures (felt, natural-paper, stardust)
- Fonts: Libre Caslon Text, Literata, Work Sans, Great Vibes
- Sticker preview thumbnails
- Page-turn SFX, save chime
- **manifest.json** — `minimum_app_version`, `asset_version`, `compatible_versions[]`

Reuses `assetDownloader.ts` pipeline:
1. `GET /features/diary/metadata` → `{ version, size_mb, checksum_sha256, download_url }`
2. Download zip, verify SHA-256, extract
3. Read `manifest.json` — reject if `minimum_app_version` > current
4. Store install status

---

## 5. Canvas: Object Behaviors

| Object | Move | Resize | Rotate | Edit | Delete | Duplicate | Notes |
|--------|------|--------|--------|------|--------|-----------|-------|
| Text | ✅ | ✅ | — | ✅ | ✅ | ✅ | Font family (4 options), size, color, alignment |
| Photo | ✅ | ✅ | ✅ | — | ✅ | ✅ | Polaroid border, tape strip overlay. Crop/filter via tool overlay |
| Video | ✅ | ✅ | — | — | ✅ | — | Film strip perforations, play overlay, thumbnail |
| Voice | ✅ | — | — | — | ✅ | ✅ | Waveform widget, play button, duration |
| Mood | ✅ | — | — | ✅ | ✅ | ✅ | Circular badge, icon + label, tap to change |
| Sticker | ✅ | ✅ | ✅ | — | ✅ | ✅ | Drop shadow, optional rotation, from bundled pack |

### 5.1 Two Modes

**Read Mode (default):**
- Clean scrapbook view — no selection borders, no handles
- Swipe page turning with dot indicators ("Page 12 of 48")
- Tap photo → fullscreen with pinch-to-zoom
- Tap video → play inline
- Tap voice → play audio
- **Micro-interactions:** Photo tilt follows touch

**Edit Mode** (pencil icon in header):
- Tap object → `ResizeHandles` at 4 corners + `drag handle` left side
- `ObjectToolOverlay` above selected item
- `FloatingToolbar` FAB expands with 6 pill options
- Auto-save: "Autosaved 12:45 PM" with pulsing green dot
- Bottom pill: "Changes saved to vault"

---

## 6. Auto-Save & Media Flow

### 6.1 Granular operations

```
User moves text object
  → Local: { op: "UPDATE_OBJECT", object_id, position_x, position_y, version: 15 }
  → SQLite upsert → "Autosaved" indicator
  → Enqueue to offline queue
  → Sync engine pushes operation
  → Server applies, bumps page to v16
```

Operation types: `MOVE_OBJECT`, `RESIZE_OBJECT`, `ROTATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `ADD_OBJECT`, `UPDATE_PAGE`

### 6.2 Deferred media upload

```
User picks photo
  → 1. Compress locally (80% quality, max 1920px)
  → 2. Save to {documentDirectory}diary_media/{uuid}.jpg
  → 3. Create DiaryMedia (upload_status: "local")
  → 4. Create DiaryPageObject referencing media_id
  → 5. Show on canvas immediately (PolaroidFrame)

User closes editor
  → Background: if WiFi → upload to S3 → PATCH /media/{id}
  → Delete local cached copy on success
```

---

## 7. Search

**Local (instant):** SQLite FTS across memory metadata + text content + captions
**Server:** PostgreSQL GIN indexes on `memory_tags`, `memory_people`, `memory_location`, `memory_title`, `memory_weather`, `page_date`

---

## 8. Sync Queue

Granular operations with UUID dedup:

```json
{
  "op_id": "uuid",
  "op_type": "MOVE_OBJECT",
  "page_id": "uuid",
  "page_version": 15,
  "data": { "object_id": "uuid", "position_x": 120.5, "position_y": 340.0 }
}
```

Conflict: 409 → client rebases ops on server state, bumps version, retries.

---

## 9. Luna Event Hooks

```
event_bus.emit("diary_page_created",   { user_id, diary_id, page_id, page_date })
event_bus.emit("diary_photo_added",    { user_id, diary_id, page_id, media_id })
event_bus.emit("diary_page_saved",     { user_id, diary_id, page_id, version })
event_bus.emit("diary_opened",         { user_id, diary_id })
event_bus.emit("diary_media_synced",   { user_id, media_id, s3_key })
```

---

## 10. V1 Feature Checklist

| Feature | Status |
|---------|--------|
| Free placement: text, photo, video, voice, mood, sticker | ✅ V1 |
| Text with font family (4 options), size, color, alignment | ✅ V1 |
| Photo with polaroid border + tape strip overlay | ✅ V1 |
| Photo tool overlay (crop, filter, delete) | ✅ V1 |
| Video (≤30s) with film strip design | ✅ V1 |
| Voice note waveform widget | ✅ V1 |
| Stickers (50 bundled — flowers, stars, hearts, etc.) | ✅ V1 |
| Object resize handles (4 corners) + drag handle | ✅ V1 |
| Object rotation | ✅ V1 |
| Memory metadata: title, tags, people, location, weather, mood | ✅ V1 |
| Memory chips (washi tape style location/tag labels) | ✅ V1 |
| Date stamp component | ✅ V1 |
| Mood badge (circular icon + label) | ✅ V1 |
| Vintage stamp component | ✅ V1 |
| Leather-bound book library cards with gold emboss | ✅ V1 |
| Design system: oxblood/tan/green palette, 3 fonts + cursive | ✅ V1 |
| Paper grain textures on all surfaces | ✅ V1 |
| FAB toolbar → 6 vertical pills (Mood, Voice, Sticker, Image, Text, Video) | ✅ V1 |
| Auto-save (granular operations) | ✅ V1 |
| Local FTS + server GIN search | ✅ V1 |
| Calendar timeline | ✅ V1 |
| Page turning animation + dot indicators | ✅ V1 |
| Read/Edit mode toggle | ✅ V1 |
| Diary lock (PIN/biometric) | ✅ V1 |
| Deferred background media sync (local → WiFi → S3) | ✅ V1 |
| Versioned pages for conflict recovery | ✅ V1 |
| Asset manifest with compatibility checks | ✅ V1 |
| Luna event hooks (no-op in V1) | ✅ V1 |
| Drawing | ❌ Future |
| Layer ordering | ❌ Future |
| Pre-made templates | ❌ Future |
| Export / backup | ❌ Future |

---

## 11. S3 Bucket

New bucket: `shecare-diary-media`
Max file size: image 10 MB, video 50 MB (≤30s), voice 10 MB

---

## 12. Migration Plan

1. Build backend `app/modules/diary/` with models, schemas, services, routes
2. Register in `app/main.py`
3. Add S3 bucket config
4. Run Alembic migration: `diary_add_tables.py`
5. Build mobile screens + all scrapbook components (LeatherBookCard, PolaroidFrame, ResizeHandles, MemoryChip, FloatingToolbar, etc.)
6. Apply design system tokens as theme values (colors, fonts, spacing, shadows, textures)
7. Add query hooks + local DB services
8. Add SQLite FTS virtual table
9. Implement asset download with manifest compatibility check
10. Implement deferred background media upload
11. Implement granular operation sync queue
12. Add entry point in journal section (Journal vs Diary choice)
13. Add Luna event hooks
14. Update API contract at `plans/30-mobile-api-contract.md`

---

## 13. File Changes

### Backend (new)
```
backend/app/modules/diary/__init__.py
backend/app/modules/diary/models.py
backend/app/modules/diary/schemas.py
backend/app/modules/diary/services.py
backend/app/modules/diary/routes.py
backend/app/modules/diary/dependencies.py
backend/app/modules/diary/tasks.py
backend/app/modules/diary/exceptions.py
```

### Backend (modified)
```
backend/app/main.py                    # MODULE_INITS entry
backend/app/core/config.py             # diary_media_bucket
```

### Mobile (new screens)
```
src/screens/diary/DiaryLibraryScreen.tsx      # Leather book library
src/screens/diary/DiaryScreen.tsx             # Page overview grid
src/screens/diary/DiaryPageScreen.tsx         # Read mode scrapbook
src/screens/diary/DiaryEditorScreen.tsx       # Edit mode canvas
src/screens/diary/DiaryTimelineScreen.tsx     # Calendar timeline
src/screens/diary/DiarySearchScreen.tsx       # FTS search
```

### Mobile (new components)
```
src/screens/diary/components/LeatherBookCard.tsx
src/screens/diary/components/ScrapbookCanvas.tsx
src/screens/diary/components/CanvasObject.tsx
src/screens/diary/components/ResizeHandles.tsx
src/screens/diary/components/DragHandle.tsx
src/screens/diary/components/ObjectToolOverlay.tsx
src/screens/diary/components/MemoryChip.tsx
src/screens/diary/components/DateStamp.tsx
src/screens/diary/components/PolaroidFrame.tsx
src/screens/diary/components/StickerView.tsx
src/screens/diary/components/MoodBadge.tsx
src/screens/diary/components/VintageStamp.tsx
src/screens/diary/components/FloatingToolbar.tsx
src/screens/diary/components/PageTurningView.tsx
src/screens/diary/components/StickerPicker.tsx
src/screens/diary/components/BottomNavBar.tsx
```

### Mobile (new services)
```
src/services/queries/diary.ts
src/services/localDb/DiaryLocalService.ts
src/services/localDb/DiaryPageLocalService.ts
src/services/localDb/DiaryPageObjectLocalService.ts
src/services/localDb/DiaryMediaLocalService.ts
src/services/localDb/DiarySearchLocalService.ts
src/services/localDb/DiarySyncService.ts
src/services/diaryAssetDownloader.ts
```

### Mobile (modified)
```
src/db/schema.ts                        # Add diary tables + FTS
src/services/queries/index.ts           # Export diary
src/services/localDb/index.ts           # Export diary services
src/screens/wellness/                   # Entry point
src/constants/config.ts
mobile/src/theme/                       # Add design system tokens
```

---

## 14. Storage Summary

| Area | Size |
|------|------|
| Assets zip download | ~18 MB (one-time per user) |
| App bundle increase | None (downloaded) |
| DB per diary page | ~1-3 KB PostgreSQL |
| DB per object | ~300-800 B |
| S3 per photo | ~200-500 KB |
| S3 per video (30s) | ~5-15 MB |
| S3 per voice note | ~1-2 MB |
| Local SQLite + FTS | ~10-20% overhead on data |

---

## 15. Out of Scope (V2+)

- Drawing / sketch tool
- Layer ordering (V2)
- Pre-made templates
- Export / backup
- Collaboration
- GIF / animated stickers
- Luna reactive animations (hooks ready)
- Voice transcription
- Page version history browser (version field ready)
