# Day 2 — Event Bus System

## Goal
Build a lightweight, typed event bus that modules can emit events to and subscribe to. This is the communication backbone that Luna uses to "hear" what the user does.

---

## 2.1 Why a Custom Event Bus

React Native has no built-in global event system beyond `DeviceEventEmitter` (deprecated) and `NativeEventEmitter` (native modules only). We need a simple pub/sub that:

- Runs 100% in JS (no native bridge)
- Supports typed event names + payloads
- Allows multiple subscribers per event
- Provides `unsubscribe` cleanup
- Is testable without mocks

---

## 2.2 Create `src/services/eventBus.ts`

```typescript
/**
 * Lightweight typed event bus — Luna's ears.
 *
 * Usage:
 *   import { eventBus } from 'src/services/eventBus';
 *
 *   // Emit
 *   eventBus.emit('journal_saved', { journalId: 'abc', userId: 'xyz' });
 *
 *   // Subscribe
 *   const unsub = eventBus.on('journal_saved', (data) => { ... });
 *   // later: unsub();
 *
 *   // Subscribe once
 *   eventBus.once('period_approaching', (data) => { ... });
 *
 *   // Remove all listeners for an event
 *   eventBus.off('mood_logged');
 */

type EventMap = {
  // ── Cycle events ──
  period_logged: { userId: string; cycleEntryId: string; date: string };
  period_corrected: { userId: string; cycleEntryId: string; correction: unknown };
  period_approaching: { userId: string; daysUntil: number };
  period_end_marked: { userId: string; cycleEntryId: string };

  // ── Wellness events ──
  journal_saved: { userId: string; journalId: string; sentiment?: string };
  mood_logged: { userId: string; moodLogId: string; mood: string; intensity: number };
  water_logged: { userId: string; amount: number };
  exercise_completed: { userId: string; type: string; duration: number };
  sleep_logged: { userId: string; hours: number };

  // ── Safety events ──
  sos_triggered: { userId: string; sosId: string };

  // ── Companion-specific events ──
  luna_petted: { userId: string };
  luna_outfit_changed: { userId: string; outfitId: string | null };
  luna_installed: { userId: string };
  luna_uninstalled: { userId: string };

  // ── App lifecycle ──
  app_foregrounded: {};
  app_backgrounded: {};
  onboarding_completed: { userId: string };
};

type EventName = keyof EventMap;
type EventPayload<N extends EventName> = EventMap[N];
type Listener<N extends EventName> = (payload: EventPayload<N>) => void;

class EventBus {
  private listeners = new Map<EventName, Set<Listener<any>>>();

  on<N extends EventName>(event: N, listener: Listener<N>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  once<N extends EventName>(event: N, listener: Listener<N>): () => void {
    const wrapper: Listener<N> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off<N extends EventName>(event: N, listener?: Listener<N>): void {
    if (listener) {
      this.listeners.get(event)?.delete(listener);
    } else {
      this.listeners.delete(event);
    }
  }

  emit<N extends EventName>(event: N, payload: EventPayload<N>): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[EventBus] Error in listener for "${event}":`, error);
      }
    });
  }

  /** Remove all listeners across all events (useful in tests) */
  clear(): void {
    this.listeners.clear();
  }

  /** Number of listeners for a given event */
  listenerCount<N extends EventName>(event: N): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const eventBus = new EventBus();
export type { EventMap, EventName, EventPayload, Listener };
```

---

## 2.3 Integration Points — Wiring Existing Services

For Luna to "hear" events, the existing local services must emit them. Here is where to add `eventBus.emit()` calls:

### `src/services/localDb/JournalLocalService.ts`
After a successful upsert, add:
```typescript
import { eventBus } from '../../services/eventBus';
// inside upsert method, after successful write:
eventBus.emit('journal_saved', {
  userId: record.user_id,
  journalId: record.id,
  sentiment: record.sentiment_label,
});
```

### `src/services/localDb/MoodLocalService.ts`
After upsert:
```typescript
eventBus.emit('mood_logged', {
  userId: record.user_id,
  moodLogId: record.id,
  mood: record.mood,
  intensity: record.intensity,
});
```

### `src/services/localDb/CycleLocalService.ts`
After inserting a period entry:
```typescript
eventBus.emit('period_logged', {
  userId: record.user_id,
  cycleEntryId: record.id,
  date: record.period_start_date,
});
```

### Water, Exercise, Sleep events
These may not have dedicated local services yet. For now, add a generic emit helper:

```typescript
// In the relevant screen or service after the action completes:
eventBus.emit('water_logged', { userId: currentUser.id, amount: 250 });
eventBus.emit('exercise_completed', { userId: currentUser.id, type: 'walking', duration: 20 });
eventBus.emit('sleep_logged', { userId: currentUser.id, hours: 7.5 });
```

---

## 2.4 Testing the Event Bus

**File:** `src/__tests__/eventBus.test.ts`

```typescript
import { eventBus } from '../services/eventBus';

describe('EventBus', () => {
  beforeEach(() => eventBus.clear());

  it('emits and receives an event', () => {
    const listener = jest.fn();
    eventBus.on('journal_saved', listener);
    eventBus.emit('journal_saved', { userId: 'u1', journalId: 'j1' });
    expect(listener).toHaveBeenCalledWith({ userId: 'u1', journalId: 'j1' });
  });

  it('supports multiple listeners on same event', () => {
    const a = jest.fn();
    const b = jest.fn();
    eventBus.on('mood_logged', a);
    eventBus.on('mood_logged', b);
    eventBus.emit('mood_logged', { userId: 'u1', moodLogId: 'm1', mood: 'happy', intensity: 3 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes specific listener', () => {
    const a = jest.fn();
    const unsub = eventBus.on('period_logged', a);
    unsub();
    eventBus.emit('period_logged', { userId: 'u1', cycleEntryId: 'c1', date: '2026-07-25' });
    expect(a).not.toHaveBeenCalled();
  });

  it('once fires only once', () => {
    const listener = jest.fn();
    eventBus.once('period_approaching', listener);
    eventBus.emit('period_approaching', { userId: 'u1', daysUntil: 3 });
    eventBus.emit('period_approaching', { userId: 'u1', daysUntil: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clear removes all listeners', () => {
    eventBus.on('journal_saved', jest.fn());
    eventBus.on('mood_logged', jest.fn());
    eventBus.clear();
    expect(eventBus.listenerCount('journal_saved')).toBe(0);
    expect(eventBus.listenerCount('mood_logged')).toBe(0);
  });
});
```

---

## ✅ Day 2 Validation

- [ ] `src/services/eventBus.ts` created with `on`, `once`, `off`, `emit`, `clear`, `listenerCount`
- [ ] EventMap typed with all event names and payload shapes
- [ ] `journal_saved` emitted from JournalLocalService
- [ ] `mood_logged` emitted from MoodLocalService
- [ ] `period_logged` emitted from CycleLocalService
- [ ] Placeholder emit calls added for water, exercise, sleep
- [ ] Unit tests pass (`npx jest src/__tests__/eventBus.test.ts`)
- [ ] App builds without TypeScript errors
