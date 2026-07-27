# Luna Companion Cat — Architecture Document

## Overview
Luna is a virtual companion cat that lives on the user's device.
She reacts to app events (journal saved, mood logged, period logged)
with animations, speech bubbles, and XP rewards.

## Key Design Decisions
1. **Not an AI chatbot** — Luna uses pre-written dialogue rules.
   No network calls, no hallucinations, no privacy risk.
2. **Offline-first** — Everything runs locally. SQLite for persistence.
3. **Event-driven** — Luna subscribes to a typed event bus.
   Zero coupling between modules.

## Architecture

### Data Flow
User Action -> Local Service -> eventBus.emit() -> EventEngine
  -> DialogueEngine.get() + AnimationEngine.play() + companionStore.addXP()
  -> LunaOverlay renders speech bubble + animation

### Storage
Table: companion_metadata (SQLite, purely local, no sync)

### Event Bus
Typed pub/sub in src/services/eventBus.ts.
Events: journal_saved, mood_logged, period_logged, water_logged,
exercise_completed, sleep_logged, period_approaching, app_foregrounded

### XP System
Actions award XP based on constants in companionStore.ts.
Level thresholds: 1 (0), 5 (500), 10 (2000), 20 (10000), 50 (100000).

### Asset Download (Game DLC)
- Code is pre-bundled (~200 KB)
- Assets (sprites, sounds, dialogues) downloaded as ~4.5 MB zip
- SHA-256 checksum verification prevents corrupted installs
- expo-file-system createDownloadResumable for automatic resume
- Cellular data warning via NetInfo + Alert
- Uninstall removes assets folder but preserves XP/coins/level in SQLite

## Performance
- All animations use Reanimated (UI thread)
- Idle cycle: blink (4s) -> look around (20s) -> stretch (30s) -> sleep (40s)
- Sleep mode after 30s inactivity (zero CPU animation work)
- SVG sprite ~3KB placeholder; PNG spritesheet target <2MB
- Total memory footprint < 5MB
- Bundle size impact < 200 KB

## Files

### Services
- `src/services/companion/AnimationEngine.ts` — Reanimated state machine
- `src/services/companion/DialogueEngine.ts` — FS-loaded rule-based dialogue
- `src/services/companion/EventEngine.ts` — Event subscribers
- `src/services/companion/LunaSprite.tsx` — FS spritesheet + SVG fallback
- `src/services/companion/assetPaths.ts` — File system path resolver
- `src/services/eventBus.ts` — Lightweight pub/sub (18 typed events)
- `src/services/assetDownloader.ts` — Game DLC download pipeline
- `src/services/localDb/CompanionLocalService.ts` — SQLite CRUD

### Stores
- `src/stores/companionStore.ts` — Zustand (XP, coins, level, settings)
- `src/stores/downloadStore.ts` — Download progress tracking

### Screens
- `src/screens/companion/LunaOverlay.tsx` — Floating overlay
- `src/screens/companion/LunaInstallScreen.tsx` — Download/install UI

### Schema
- `src/db/schema.ts` — companion_metadata table (20th table)

### Backend
- `backend/app/modules/luna/routes.py` — GET /api/v1/features/luna/metadata

## Phase 2 (Next)
- Pet House screen
- Outfit system + shop
- 200+ quote database
- Friendship level titles
- Sound effects (meow, purr, celebrate)
