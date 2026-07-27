# Day 3 — CompanionStore (Zustand)

## Goal
Build the Zustand store that holds Luna's runtime state: XP, coins, level, outfit, memory, and UI flags. The store hydrates from SQLite on launch and persists changes back.

---

## 3.1 Create `src/stores/companionStore.ts`

```typescript
import { create } from 'zustand';
import { companionLocalService } from '../services/localDb';
import type { CompanionMetadata } from '../db/schema';

// ── Level / Title mapping ──
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Kitten',
  5: 'Explorer',
  10: 'Guardian',
  20: 'Best Friend',
  50: 'Legend',
};

export function getLevelTitle(level: number): string {
  // Find the highest title <= current level
  const sorted = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const lvl of sorted) {
    if (level >= lvl) return LEVEL_TITLES[lvl];
  }
  return LEVEL_TITLES[1];
}

export function xpToNextLevel(level: number): number {
  if (level < 5) return 500;
  if (level < 10) return 2000;
  if (level < 20) return 10000;
  if (level < 50) return 100000;
  return 0;
}

// ── XP reward constants ──
export const XP_REWARDS = {
  journal_saved: 10,
  mood_logged: 5,
  water_logged: 3,
  exercise_completed: 8,
  period_logged: 15,
  period_corrected: 5,
  daily_login: 2,
} as const;

export const COIN_REWARDS = {
  journal_saved: 2,
  mood_logged: 1,
  water_logged: 1,
  exercise_completed: 2,
  period_logged: 3,
  period_corrected: 1,
  daily_login: 1,
} as const;

// ── Store interface ──
interface CompanionState {
  // Data
  userId: string | null;
  xp: number;
  coins: number;
  level: number;
  currentOutfitId: string | null;
  ownedOutfits: string[];
  memory: Record<string, unknown>;

  // UI flags
  isHidden: boolean;
  reduceAnimations: boolean;
  muteSounds: boolean;
  lastActiveAt: string | null;

  // Derived
  levelTitle: string;
  xpToNext: number;

  // Hydration
  isHydrated: boolean;

  // Actions
  hydrate: (userId: string) => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  spendCoins: (amount: number) => Promise<boolean>;
  setOutfit: (outfitId: string | null) => Promise<void>;
  updateMemory: (key: string, value: unknown) => Promise<void>;
  setHidden: (hidden: boolean) => Promise<void>;
  setReduceAnimations: (reduce: boolean) => Promise<void>;
  setMuteSounds: (mute: boolean) => Promise<void>;
  reset: () => void;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  // Initial state
  userId: null,
  xp: 0,
  coins: 0,
  level: 1,
  currentOutfitId: null,
  ownedOutfits: [],
  memory: {},
  isHidden: false,
  reduceAnimations: false,
  muteSounds: false,
  lastActiveAt: null,
  levelTitle: 'Kitten',
  xpToNext: 500,
  isHydrated: false,

  hydrate: async (userId: string) => {
    try {
      const meta = await companionLocalService.getMetadata(userId);
      if (meta) {
        set({
          userId: meta.user_id,
          xp: meta.xp,
          coins: meta.coins,
          level: meta.level,
          currentOutfitId: meta.current_outfit_id,
          ownedOutfits: meta.owned_outfits ?? [],
          memory: (meta.memory as Record<string, unknown>) ?? {},
          isHidden: meta.is_hidden,
          reduceAnimations: meta.reduce_animations,
          muteSounds: meta.mute_sounds,
          lastActiveAt: meta.last_active_at,
          levelTitle: getLevelTitle(meta.level),
          xpToNext: xpToNextLevel(meta.level),
          isHydrated: true,
        });
      } else {
        // First time — create default row
        const now = new Date().toISOString();
        await companionLocalService.upsertMetadata({
          user_id: userId,
          xp: 0,
          coins: 0,
          level: 1,
          current_outfit_id: null,
          owned_outfits: [],
          memory: {},
          is_hidden: false,
          reduce_animations: false,
          mute_sounds: false,
          last_active_at: now,
          created_at: now,
          updated_at: now,
        });
        set({
          userId,
          xp: 0,
          coins: 0,
          level: 1,
          currentOutfitId: null,
          ownedOutfits: [],
          memory: {},
          isHidden: false,
          reduceAnimations: false,
          muteSounds: false,
          lastActiveAt: now,
          levelTitle: 'Kitten',
          xpToNext: 500,
          isHydrated: true,
        });
      }
    } catch (error) {
      console.error('[CompanionStore] hydrate failed', error);
      set({ isHydrated: true }); // Don't block UI on error
    }
  },

  addXP: async (amount: number) => {
    const { userId, xp, level } = get();
    if (!userId) return;
    const newXp = xp + amount;
    const newLevel = companionLocalService['calculateLevel'](newXp);
    await companionLocalService.addXP(userId, amount);
    set({
      xp: newXp,
      level: newLevel,
      levelTitle: getLevelTitle(newLevel),
      xpToNext: xpToNextLevel(newLevel),
      lastActiveAt: new Date().toISOString(),
    });
  },

  addCoins: async (amount: number) => {
    const { userId, coins } = get();
    if (!userId) return;
    const newCoins = coins + amount;
    await companionLocalService.addCoins(userId, amount);
    set({ coins: newCoins });
  },

  spendCoins: async (amount: number): Promise<boolean> => {
    const { userId, coins } = get();
    if (!userId || coins < amount) return false;
    const newCoins = coins - amount;
    // Direct DB update (addCoins only adds, so we write directly)
    const db = (await import('../../db/connection')).getDb();
    const { companionMetadata } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(companionMetadata).set({ coins: newCoins }).where(eq(companionMetadata.user_id, userId));
    set({ coins: newCoins });
    return true;
  },

  setOutfit: async (outfitId: string | null) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.upsertMetadata({
      user_id: userId,
      current_outfit_id: outfitId,
      updated_at: new Date().toISOString(),
    } as any);
    set({ currentOutfitId: outfitId });
  },

  updateMemory: async (key: string, value: unknown) => {
    const { userId, memory } = get();
    if (!userId) return;
    const updated = { ...memory, [key]: value };
    await companionLocalService.upsertMetadata({
      user_id: userId,
      memory: updated,
      updated_at: new Date().toISOString(),
    } as any);
    set({ memory: updated });
  },

  setHidden: async (hidden: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.updateSetting(userId, 'is_hidden', hidden);
    set({ isHidden: hidden });
  },

  setReduceAnimations: async (reduce: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.updateSetting(userId, 'reduce_animations', reduce);
    set({ reduceAnimations: reduce });
  },

  setMuteSounds: async (mute: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.updateSetting(userId, 'mute_sounds', mute);
    set({ muteSounds: mute });
  },

  reset: () => {
    set({
      userId: null,
      xp: 0,
      coins: 0,
      level: 1,
      currentOutfitId: null,
      ownedOutfits: [],
      memory: {},
      isHidden: false,
      reduceAnimations: false,
      muteSounds: false,
      lastActiveAt: null,
      levelTitle: 'Kitten',
      xpToNext: 500,
      isHydrated: false,
    });
  },
}));
```

---

## 3.2 Fix `CompanionLocalService.calculateLevel` Access

In `companionStore.ts` line referencing `companionLocalService['calculateLevel'](newXp)` — this accesses a private method. Either make it public or extract the level calculation into a shared utility.

**Recommended:** Move `calculateLevel` to a shared function in the store file:

```typescript
export function calculateLevel(xp: number): number {
  if (xp >= 100000) return 50;
  if (xp >= 10000) return 20;
  if (xp >= 2000) return 10;
  if (xp >= 500) return 5;
  return 1;
}
```

Then export it and use it both in `CompanionLocalService.ts` and `companionStore.ts`.

---

## 3.3 Export from `src/stores/index.ts`

```typescript
export { useCompanionStore } from './companionStore';
export type { CompanionState } from './companionStore';
```

---

## 3.4 Test the Store

**File:** `src/stores/__tests__/companionStore.test.ts`

```typescript
import { useCompanionStore, calculateLevel, getLevelTitle, xpToNextLevel } from '../companionStore';

describe('CompanionStore', () => {
  beforeEach(() => {
    useCompanionStore.getState().reset();
  });

  it('initializes with defaults', () => {
    const s = useCompanionStore.getState();
    expect(s.xp).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.level).toBe(1);
    expect(s.isHidden).toBe(false);
    expect(s.isHydrated).toBe(false);
  });

  it('calculateLevel returns correct levels', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(500)).toBe(5);
    expect(calculateLevel(2000)).toBe(10);
    expect(calculateLevel(10000)).toBe(20);
    expect(calculateLevel(100000)).toBe(50);
  });

  it('getLevelTitle returns correct titles', () => {
    expect(getLevelTitle(1)).toBe('Kitten');
    expect(getLevelTitle(5)).toBe('Explorer');
    expect(getLevelTitle(10)).toBe('Guardian');
    expect(getLevelTitle(20)).toBe('Best Friend');
    expect(getLevelTitle(50)).toBe('Legend');
  });

  it('xpToNextLevel returns correct thresholds', () => {
    expect(xpToNextLevel(1)).toBe(500);
    expect(xpToNextLevel(5)).toBe(2000);
    expect(xpToNextLevel(10)).toBe(10000);
    expect(xpToNextLevel(20)).toBe(100000);
    expect(xpToNextLevel(50)).toBe(0);
  });

  it('addXP updates xp and level', async () => {
    // Mock the local service to avoid DB
    jest.spyOn(require('../../services/localDb'), 'companionLocalService')
      .mockImplementation({ addXP: jest.fn() });

    useCompanionStore.getState().hydrate = jest.fn().mockResolvedValue(undefined);
    useCompanionStore.setState({ userId: 'test-user', xp: 0, level: 1 });

    await useCompanionStore.getState().addXP(500);
    const s = useCompanionStore.getState();
    expect(s.xp).toBe(500);
    expect(s.level).toBe(5);
    expect(s.levelTitle).toBe('Explorer');
  });

  it('spendCoins returns false when insufficient', async () => {
    useCompanionStore.setState({ userId: 'test-user', coins: 10 });
    const result = await useCompanionStore.getState().spendCoins(50);
    expect(result).toBe(false);
  });
});
```

---

## ✅ Day 3 Validation

- [ ] `src/stores/companionStore.ts` created with all state + actions
- [ ] XP/coin reward constants defined
- [ ] Level title mapping defined
- [ ] `calculateLevel` shared utility extracted
- [ ] Store hydrates from SQLite on launch
- [ ] Store creates default row on first launch
- [ ] `addXP`, `addCoins`, `spendCoins` work correctly
- [ ] `setHidden`, `setReduceAnimations`, `setMuteSounds` persist to DB
- [ ] `reset` clears all state
- [ ] Exported from `src/stores/index.ts`
- [ ] Unit tests pass
- [ ] App builds without TypeScript errors
