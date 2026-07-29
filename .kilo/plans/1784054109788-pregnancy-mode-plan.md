# Luna Screen-Aware Behavior & Walking Animation Plan

## Goal
Add screen-contextual movement and speech to Luna: walking across the phone frame, reacting to live data from the active screen, and changing posture/emotion based on that data.

## Current State
- `LunaOverlay` is purely visual: fixed bottom-right avatar with click-to-expand bubble.
- Bubble text is static by mode (`LUNA_MESSAGES`), not bound to screen data.
- The only animation is `luna-float` (gentle vertical bob). No walking or state changes.
- Assets: one bundled static PNG (`luna_cat_avatar.png`). `luna1.png` spritesheet exists; no spritesheet wiring yet.

## Approach
Extend `LunaOverlay` with behavior driven from `App.tsx` without a full state-management refactor:
1. Add a small `lunaContext` object in `App` that maps `screen` + key screen metrics to `{ animation, message, action }`.
2. Pass `lunaContext` into `LunaOverlay`.
3. In `LunaOverlay`, map `lunaContext.animation` to CSS classes and interpolate `lunaContext.message`.

## Data Mapping per Screen
| Screen | Luna Message Source | Default Message | Animation |
|---|---|---|---|
| home | `currentPhase`, cycle day | "Cycle day {day} · {phase} phase" | `idle` |
| calendar | selected date + phase | "{date} · {phase} emoji" | `walk-right` |
| journal | selected mood + energy | "Feeling {mood} · energy {energy}" | `bounce` |
| wellness | active tab, top metric | "{tab}: {metric}" | `walk-left` |
| chat | last AI topic | "Ask about: {topic}" | `idle` |
| settings | `lunaEnabled`, `pregnancyMode` | "Insights {enabled}, pregnancy {enabled}" | `idle` |
| sos | contacts ready | "{contacts} contacts ready 🆘" | `bounce` |
| pregnancy | week, trimester | "Week {week} · {trimester}" | `walk-right` |

## Implementation Details
### 1. CSS animations
- Add to `index.css`:
  - `luna-walk-right` — translateX from left-inset to right-inset, 6–8s infinite
  - `luna-walk-left` — reverse of above
  - `luna-idle` — scale(1) breathing on Y axis, 3s
  - `luna-bounce` — up/down translateY with squash-stretch, 0.8s
- Add `transition: left ...` alternatives if walking should start from a hidden off-screen edge.

### 2. `App.tsx` `getLunaContext`
- New helper:
  ```ts
  type LunaAnimation = 'idle' | 'walk-right' | 'walk-left' | 'bounce'
  interface LunaContext {
    animation: LunaAnimation
    message: string
    actionLabel?: string
  }

  function getLunaContext(screen, lunaEnabled, ...): LunaContext { ... }
  ```
- Derive context from screen-specific state already held in `App` (e.g. `pregnancyMode`, `lunaEnabled`) and inject known defaults where internal screen state is unreachable.
- Prefer lifting the one key metric each screen already owns into `App`:
  - Home: add `currentPhase` prop.
  - Calendar: add `selectedDate` prop.
  - Journal: add `mood` and `energy` props.
  - Wellness: add `tab` prop.
  - Chat: expose `lastTopic`.
  - SOS: expose `contactsReady`.

### 3. `LunaOverlay` signature
```ts
function LunaOverlay({
  screen,
  pregnancyMode,
  lunaEnabled,
  lunaContext,
}: props)
```

### 4. Behavior rules
- When screen changes → new `lunaContext.animation` class immediately applies.
- When data within same screen changes (`mood`, `week`, etc.) → `getLunaContext` recomputes message.
- Walking class only starts when `animation` is `walk-right` or `walk-left`. Otherwise `luna-idle`.
- Bubble auto-updates on context change; user can still tap to expand/collapse.
- Keep bottom offset logic (`bottom: screen === 'chat' ? 20 : 96`) unchanged.

## Validation
- `vite build` compiles.
- Visual checks:
  - Luna walks on Calendar/Wellness/Pregnancy Home.
  - Bubble message updates when switching tabs or toggling `pregnancyMode`.
  - No overlay breach of bottom nav/z-index.
  - Accessibility label updates from context.

## Out of Scope
- Full body IK/sprite sheet animation (requires new asset pipeline).
- Real-internet weather/gps data for context (demo only).
- Persisting Luna context to backend.
