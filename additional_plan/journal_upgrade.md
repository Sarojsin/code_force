# Journal Upgrade — From "Journal" to "Memory Canvas"

## Core Concept

Rename the journal to a **Memory Canvas**: a free-form, block-based diary where every page is a personal scrapbook. Users place memories (photos, videos, text, stickers, voice notes) anywhere on a canvas, not in a fixed form.

**Positioning:** Not a text editor. Not social media. A private digital diary that feels like opening a real notebook.

---

## Why "Memory Canvas" Instead of "Journal"

| Aspect | Traditional Journal | Memory Canvas |
|--------|---------------------|---------------|
| Structure | Fixed form: Title → Text → Photo | Free canvas: drag/drop/resize blocks anywhere |
| Emotion | "Entry #27" | "🌸 First Day of College — July 26, 2026" |
| Media | One photo per entry | Multiple photos, videos, voice notes, stickers per page |
| Interaction | Swipe through list | Turn pages like a real book |
| Personalization | None | Themes, stickers, layouts, handwriting (future) |

---

## Block-Based Page Model

Each diary page is a canvas of independent, movable blocks.

### Supported Block Types (V1)

| Block Type | Description | Offline? |
|------------|-------------|----------|
| **Heading** | Title for the page or section | ✅ |
| **Text** | Rich text, captions, reflections | ✅ |
| **Photo** | Large or small image, drag anywhere | ✅ |
| **Video** | Embedded video, same behavior as photo | ✅ |
| **Voice Note** | Audio recording attached to page | ✅ |
| **Sticker/Emoji** | Decorative elements | ✅ |
| **Mood** | Mood tag with optional icon | ✅ |
| **Divider** | Visual separator between sections | ✅ |

### Block Data Structure

```json
{
  "id": "uuid",
  "type": "image",
  "x": 120,
  "y": 350,
  "width": 180,
  "height": 120,
  "rotation": 8,
  "zIndex": 5,
  "content": { /* type-specific payload */ }
}
```

**Storage:** Each page stores an array of blocks with position/transform properties. This is the same model used by Canva, Figma, and PowerPoint.

---

## Page & Book Metaphor

### The Notebook Experience

Instead of a feed, the user opens a **book**:

```
📖
───────────────
Monday
July 26
───────────────

[Canvas content...]
```

- **Swipe** → next page (page-turn animation)
- **Tap** → edit a block
- **Long press** → reorder/delete blocks

### Timeline Navigation

After one year, the user sees:

```
2026
├── January
├── February
├── March
├── ...
└── July
     └── July 26 → Book opens
```

**Search by tags:** Birthday, Exam, Vacation, Friends, Sad, Happy → find memories instantly.

---

## Luna Integration (Companion Cat)

Luna becomes the emotional bridge between the user and their memories.

### Opening Today's Diary

```
🐱 "What happened today?"
```

### Saving a Memory

```
🐱 "I'll treasure this memory with you. 🌸"
```

### Memory Replay (One Year Later)

```
🐱 "A year ago today, you wrote about your first day at college."
[Book opens to that page]
```

### Interactive Moments

- Luna walks across the page
- Luna sits on a photo (tap → she jumps away)
- Luna reacts to the mood of the entry

**Why this matters:** This creates emotional stickiness that no generic reminder system can match.

---

## Themes & Personalization

### Notebook Themes (V1)

| Theme | Visual |
|-------|--------|
| Notebook | 📒 Classic lined paper |
| Vintage | 📜 Aged parchment |
| Pink Diary | 🌸 Soft pink with flowers |
| Dark Diary | 🌙 Dark mode friendly |
| School Notebook | 📘 Grid/ruled |
| Travel Journal | ✈️ Map-inspired |

### Future: Custom Backgrounds
Users can upload their own background images.

---

## Privacy & Security

Since this is a **diary**, privacy must be first-class:

| Layer | Implementation |
|-------|----------------|
| **Local-first** | All pages stored in SQLite by default |
| **E2E Backup** | Optional encrypted backup (user-held key) |
| **App Lock** | PIN or biometric lock to open the diary |
| **Media Control** | User chooses whether photos/videos are backed up |
| **No Cloud by Default** | Zero data leaves device unless user opts in |

**Rule:** SheCare cannot read diary content. Even if backend stores encrypted blobs, the key never leaves the device.

---

## Technical Architecture

### Data Model

```
Diary
 └── Pages
      └── Blocks
           └── Properties (x, y, width, height, rotation, zIndex)
```

### Storage Strategy

| Data | Storage | Sync |
|------|---------|------|
| Page structure + blocks | SQLite (local) | Optional E2E encrypted backup |
| Photos/Videos | Filesystem | User opt-in only |
| Luna interactions | SQLite (companion table) | Local only |
| Themes/preferences | SQLite | Local only |

### Rendering

- Each block renders as an independent component
- Position/transform applied via `react-native-reanimated`
- Gestures: `react-native-gesture-handler` for drag, pinch-to-resize, rotate
- Performance: Virtualize pages; only render visible blocks

### Gesture System (V1 Scope)

| Gesture | Supported? |
|---------|-----------|
| Drag block | ✅ V1 |
| Resize block | ✅ V1 |
| Rotate block | ❌ V2 |
| Layer ordering | ❌ V2 |
| Undo/redo | ❌ V2 |

---

## Implementation Phases

### V1: Core Memory Canvas (MVP)

**Goal:** Users can create pages with draggable/resizable text, photos, and videos.

| Feature | Description |
|---------|-------------|
| Block-based editor | Add, drag, resize text/image/video blocks |
| Page system | Create multiple pages, swipe between them |
| Basic themes | Notebook, Vintage, Pink Diary, Dark Diary |
| Luna integration | Opening/saving reactions |
| Local storage | SQLite + filesystem |
| Privacy lock | PIN/biometric lock on diary |

### V2: Rich Expression

| Feature | Description |
|---------|-------------|
| Rotation | Rotate blocks freely |
| Stickers & emojis | Decorative elements |
| Shapes | Rectangles, circles, arrows, hearts |
| Voice notes | Audio blocks |
| Layer ordering | Bring forward/send backward |
| Undo/redo | Editing safety net |

### V3: Social & Memory Features

| Feature | Description |
|---------|-------------|
| Memory Replay | Luna shows "2 years ago today" |
| Timeline view | Year/month browser |
| Search by tag/tags | Find memories instantly |
| Templates | Pre-designed page layouts |
| Handwriting | Future: stylus support |

---

## Migration Path

**Existing journal entries** must survive the transition.

| Option | Approach |
|--------|----------|
| **Auto-convert** | Each old journal entry becomes one page with: Title block, Text block, Photo block (if any) |
| **Preserve IDs** | Old entry IDs become page IDs for continuity |
| **Dual-read** | App reads both old and new formats during transition period |
| **User choice** | After migration, user can keep old entries as "Classic" template or convert to canvas |

---

## Performance Constraints (Low-End Devices)

| Constraint | Rule |
|------------|------|
| **Max blocks per page** | 20 blocks (hard limit) |
| **Max media per page** | 1 video, 5 photos |
| **Image downscaling** | Max 2048px on either dimension |
| **Video compression** | Auto-compress to 720p, 2 Mbps |
| **Page virtualization** | Only render current page + 1 adjacent |
| **Memory cleanup** | Unload media blocks > 1 page away |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Scope creep** | Lock V1 to 3 block types, 4 themes, no rotation/stickers |
| **Storage bloat** | Hard quotas per page + auto-cleanup of old media |
| **Sync complexity** | V1 is local-only; sync deferred to V3 |
| **Gesture conflicts** | Use distinct gesture recognizers; test on low-end devices early |
| **Migration bugs** | Keep old journal tables untouched; add new tables alongside |

---

## Validation Checklist

- [ ] Create a page with text, photo, and video blocks
- [ ] Drag blocks to arbitrary positions
- [ ] Resize blocks without distortion
- [ ] Swipe between multiple pages
- [ ] Switch themes
- [ ] Lock/unlock diary with PIN/biometric
- [ ] Luna appears and reacts when opening/saving
- [ ] Old journal entries auto-convert to canvas pages
- [ ] App remains stable with 20 blocks + 5 photos on 2GB RAM device
- [ ] No data leaves device without explicit user action

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| **Name** | Memory Canvas (not Journal) |
| **Data model** | Block-based canvas with x/y/width/height/rotation/zIndex |
| **V1 scope** | Drag/resize text, photo, video; 4 themes; Luna integration; local-only |
| **Rotation/stickers** | Deferred to V2 |
| **Sync** | Deferred to V3; local-first with optional E2E backup |
| **Migration** | Auto-convert old entries to single-page canvas |
| **Privacy** | Local storage default; E2E backup optional; app lock mandatory |
