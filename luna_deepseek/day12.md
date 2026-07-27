# Day 12 — Phase 1 Validation Checklist Testing

## Goal
Systematically verify every item in the Phase 1 validation checklist. Fix any bugs found during testing.

---

## 12.1 Validation Checklist

Run through each item and mark pass/fail. Fix any failures immediately.

### 12.1.1 Core Functionality

| # | Test Case | Expected Result | Pass Criteria |
|---|-----------|-----------------|---------------|
| 1 | Download Luna from Settings (Wi-Fi) | Progress bar appears, download starts | ✅ |
| 2 | Download on cellular | Warning dialog appears: "Download over Wi-Fi?" | ✅ |
| 3 | Download completes successfully | Assets extracted, Luna appears on Dashboard | ✅ |
| 4 | Checksum verification passes | "Verifying download..." shown, no error | ✅ |
| 5 | Morning greeting (7–11 AM) | Luna says a morning dialogue | ✅ |
| 6 | Evening greeting (6–10 PM) | Luna says an evening dialogue | ✅ |
| 7 | Log a journal entry | Luna says one of 5 journal dialogues + 10 XP | ✅ |
| 8 | Log a happy mood | Luna dances + happy dialogue | ✅ |
| 9 | Log a sad mood | Luna sits calmly + comforting dialogue | ✅ |
| 10 | Log an anxious mood | Luna suggests breathing + calming dialogue | ✅ |
| 11 | Log a period | Luna celebrates (jump) + "You did it!" dialogue | ✅ |
| 12 | Tap Luna | Pet animation + heart + "Thank you!" | ✅ |
| 13 | Hide Companion toggle | Luna disappears completely | ✅ |
| 14 | Reduce Animations toggle | Luna becomes static (no movement) | ✅ |
| 15 | XP increments correctly | 10 for journal, 5 for mood, 15 for period, etc. | ✅ |
| 16 | Level progression | 500 XP → Level 5 "Explorer" | ✅ |
| 17 | SQLite persistence | Close & reopen app → Luna's state intact | ✅ |

### 12.1.2 Edge Cases

| # | Test Case | Expected Result | Pass Criteria |
|---|-----------|-----------------|---------------|
| 18 | Reload app (not close) | Luna state preserved | ✅ |
| 19 | Kill app and reopen | Luna state loaded from SQLite | ✅ |
| 20 | Rapid event firing (5 journals in 1 min) | Each awards XP; speech bubbles may overlap | ✅ |
| 21 | No internet after download | Luna works fine (no network calls, assets local) | ✅ |
| 22 | Switch tabs and come back | Luna still visible on Home tab | ✅ |
| 23 | Phone in dark mode | Luna visible (uses theme tokens) | ✅ |
| 24 | Logout → Login as different user | Luna resets for new user | ✅ |
| 25 | Uninstall → Reinstall | Assets re-downloaded; XP and level retained | ✅ |
| 26 | Very long journal (>10K chars) | EventEngine handles it, Luna reacts normally | ✅ |
| 27 | App backgrounded for 1 hour | Luna shows welcome back on foreground | ✅ |
| 28 | Download interrupted (airplane mode) | Resume on reconnection or retry button | ✅ |
| 29 | Corrupted download (checksum mismatch) | Error shown, zip deleted, retry available | ✅ |
| 30 | Storage full during download | Error message with "Free up space" prompt | ✅ |
| 31 | Cellular data warning | Alert dialog with Wi-Fi only / Download anyway | ✅ |

### 12.1.3 Performance

| # | Test Case | Expected Result | Pass Criteria |
|---|-----------|-----------------|---------------|
| 32 | CPU usage with Luna idle | < 2% extra CPU (no constant animation) | ✅ |
| 33 | Memory usage | < 20 MB additional memory | ✅ |
| 34 | App startup time | Luna adds < 50ms to startup (async hydrate) | ✅ |
| 35 | Animation during ScrollView scroll | No jank (Reanimated runs on UI thread) | ✅ |
| 36 | Battery drain over 1 hour idle | < 1% extra battery drain | ✅ |
| 37 | Download progress bar smoothness | Updates smoothly without jank | ✅ |
| 38 | Asset load time on app start | < 100ms to load dialogues from file system | ✅ |

---

## 12.2 Automated Test Suite

### Update existing test files and add new ones

**File:** `src/__tests__/companion/CompanionLocalService.test.ts`

```typescript
import { companionLocalService } from '../../services/localDb/CompanionLocalService';

// These tests require a running SQLite instance.
// Mark as integration tests and skip in unit test runs if no DB.

describe('CompanionLocalService (integration)', () => {
  const USER_ID = 'test-user-companion';

  beforeEach(async () => {
    // Clean up
    try {
      const db = (await import('../../db/connection')).getDb();
      const { companionMetadata } = await import('../../db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(companionMetadata).where(eq(companionMetadata.user_id, USER_ID));
    } catch {}
  });

  it('creates metadata on first upsert', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER_ID,
      xp: 0,
      coins: 0,
      level: 1,
      owned_outfits: [],
      memory: {},
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta).not.toBeNull();
    expect(meta?.xp).toBe(0);
  });

  it('addXP increments XP', async () => {
    await companionLocalService.addXP(USER_ID, 10);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.xp).toBe(10);
    // Level should still be 1 (10 < 500)
    expect(meta?.level).toBe(1);
  });

  it('addXP triggers level up at threshold', async () => {
    await companionLocalService.addXP(USER_ID, 500);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.level).toBe(5);
  });

  it('addCoins increments coins', async () => {
    await companionLocalService.addCoins(USER_ID, 5);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.coins).toBe(5);
  });

  it('updateSetting persists changes', async () => {
    await companionLocalService.updateSetting(USER_ID, 'is_hidden', true);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.is_hidden).toBe(true);
  });
});
```

### Add end-to-end smoke test

**File:** `src/__tests__/companion/eventFlow.test.ts`

```typescript
/**
 * End-to-end smoke test for the full Luna event flow:
 *   event → EventEngine → XP award → dialogue → speech bubble
 */

import { eventBus } from '../../services/eventBus';
import { initEventEngine } from '../../services/companion/EventEngine';
import { useCompanionStore } from '../../stores/companionStore';

describe('Luna Event Flow (smoke)', () => {
  let cleanup: (() => void) | null = null;
  const showBubbleMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useCompanionStore.setState({
      userId: 'smoke-test-user',
      xp: 100,
      coins: 50,
      level: 1,
      isHidden: false,
      isHydrated: true,
    });
    // Mock async actions
    useCompanionStore.getState().addXP = jest.fn().mockResolvedValue(undefined);
    useCompanionStore.getState().addCoins = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup?.();
    eventBus.clear();
  });

  it('full flow: journal_saved triggers XP + dialogue + bubble', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('journal_saved', {
      userId: 'smoke-test-user',
      journalId: 'j-smoke-1',
    });

    expect(useCompanionStore.getState().addXP).toHaveBeenCalledWith(10);
    expect(showBubbleMock).toHaveBeenCalledWith(
      expect.any(String),
      'happy',
      3000
    );
  });

  it('full flow: period_logged triggers XP + celebration + bubble', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('period_logged', {
      userId: 'smoke-test-user',
      cycleEntryId: 'c-smoke-1',
      date: '2026-07-25',
    });

    expect(useCompanionStore.getState().addXP).toHaveBeenCalledWith(15);
    expect(showBubbleMock).toHaveBeenCalledWith(
      expect.any(String),
      'celebrate',
      4000
    );
  });

  it('full flow: mood_logged sad → sad animation', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('mood_logged', {
      userId: 'smoke-test-user',
      moodLogId: 'm-smoke-1',
      mood: 'sad',
      intensity: 4,
    });

    expect(useCompanionStore.getState().addXP).toHaveBeenCalledWith(5);
    expect(showBubbleMock).toHaveBeenCalledWith(
      expect.any(String),
      'sad',
      3500
    );
  });
});
```

---

## 12.3 Test on Physical Device

Run the full checklist on a low-end physical device:

```bash
# Build and install on Android
cd mobile
npx expo run:android --device

# Or for iOS
npx expo run:ios --device
```

### Low-end device testing (2GB RAM):

1. Open app → Dashboard loads with Luna
2. Rapidly tap Luna 10 times → No lag, animations smooth
3. Log 5 moods in quick succession → All processed
4. Navigate entire app → Luna persists
5. Leave app open for 5 minutes → Luna falls asleep, battery drain minimal
6. Close all other apps → Luna runs smoothly

---

## 12.4 Bug Tracking

Create a bug log for any failures found:

| Bug ID | Description | Severity | Fix |
|--------|-------------|----------|-----|
| LUN-001 | XP bar doesn't update after level up | Medium | Add `xpToNext` recalculation in `addXP` store action |
| LUN-002 | Speech bubble overlaps with tab bar on small screens | Low | Reduce BUBBLE_MAX_WIDTH on small screens |
| LUN-003 | Pet cooldown doesn't persist across app restart | Low | Persist `lastPetTime` in memory store |
| LUN-004 | Event engine subscribes twice if HomeDashboard re-mounts | Medium | Fix `lunaInitialized` ref check |

---

## ✅ Day 12 Validation

- [ ] All 29 validation checklist items tested
- [ ] All bugs found are logged and fixed
- [ ] `CompanionLocalService` integration tests pass
- [ ] `eventFlow` smoke tests pass
- [ ] Tested on physical low-end device (2GB RAM)
- [ ] Performance benchmarks meet criteria (CPU < 2%, RAM < 20MB)
- [ ] No console errors or warnings during testing
- [ ] All tests pass: `npx jest src/__tests__/companion/`
