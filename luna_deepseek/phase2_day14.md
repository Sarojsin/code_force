# Phase 2 Day 14 — Polish + Validation Checklist

## Goal
Final pass on all Phase 2 features: edge case handling, error states, TypeScript cleanup, and walking the complete validation checklist.

---

## 14.1 Edge Case Audit

### Health Hub
- [ ] Empty state: user opens Health Hub with no metrics logged — shows "Let's start tracking today!"
- [ ] Partial state: user logs 2/5 metrics — progress bar shows 40%
- [ ] All done: user logs all 5 — progress bar shows 100%, Luna says "You've logged X/5!"
- [ ] Midnight rollover: metrics from yesterday don't appear in today's view
- [ ] Rapid logging: tapping log 3 times quickly doesn't cause duplicate streaks
- [ ] Deep link: no Health Hub deep link registered yet — add a placeholder note for Phase 3

### Sound Engine
- [ ] Sounds not downloaded yet (v1.0.0): `SoundEngine.loadAssets()` silently skips
- [ ] `muteSounds: true`: no playback even if files exist
- [ ] `reduceAnimations: true + muteSounds: false`: sounds play, no animation
- [ ] Sound file corruption: catch error in `loadAsync`, skip that sound

### Emotion System
- [ ] First 2 mood logs: trend is 'stable' (need 3+ data points)
- [ ] Single mood shift: trend calculation correct with 3+ entries
- [ ] Reset: `moodManager.reset()` clears history — useful for testing
- [ ] Concurrent mood logs: MoodManager is synchronous, no race conditions

### Achievement System
- [ ] Already-unlocked achievements: never re-trigger popup
- [ ] Popup overlap: achievement popup shows, auto-dismisses, next one can show
- [ ] Multiple achievements unlocked at once: first achievement shows popup, second is stored but doesn't show (single popup slot). Consider a queue for Phase 3.
- [ ] Achievement persist across app restarts (stored in `companionStore.memory.achievements`)
- [ ] Fresh install: no achievements unlocked initially

### Recommendations
- [ ] Backend offline: shows bundled fallback tip
- [ ] All tips exhausted (unlikely with 100+): fallback still has bundled JSON
- [ ] Metric type with no tip: falls back to 'general' category

---

## 14.2 Code Cleanup

### Extract duplicate achievement check in `EventEngine.ts`

The `handleEvent` function has the same achievement-check microtask in two places (recommendation path + standard path). Extract it and also fix the `emotionEngine` to use `createEmotionEngine()` with persisted history:

```typescript
// In EventEngine.ts — add helper inside initEventEngine:
const checkAchievements = (eventName: string, payload: any) => {
  const store = useCompanionStore.getState();
  const userId = payload.userId || store.userId;
  if (!userId) return;

  queueMicrotask(async () => {
    try {
      const newAchievements = await achievementEngine.checkAchievements(userId, eventName);
      for (const achievement of newAchievements) {
        const existing = (store.memory?.achievements as string[]) || [];
        if (!existing.includes(achievement.id)) {
          await store.updateMemory('achievements', [
            ...existing,
            achievement.id,
          ]);
          showAchievementPopup?.(achievement);
        }
      }
    } catch {
      // Silent fail
    }
  });
};
```

Then call `checkAchievements(eventName, payload)` once at the end of `handleEvent`, after the bubble show + early return check. This eliminates duplication.

### Remove unused imports

Run `tsc --noEmit` and fix any "declared but never read" errors in new Phase 2 files.

### Verify theme token usage

Scan HealthHubScreen, HealthMetricCard, StreakBadge, AchievementBadge, AchievementPopup for hardcoded colors. Replace with `theme.colors.*` tokens.

---

## 14.3 Navigation Edge Cases

- [ ] Health Hub accessed via both WellnessStack entry AND Luna long-press
- [ ] Back navigation from Health Hub returns to previous screen correctly
- [ ] Deep linking from notification not implemented — add to Phase 3 notes

---

## 14.4 Update `plans/30-mobile-api-contract.md`

Add the new endpoint:

```markdown
## Health Tips

### `GET /api/v1/wellness/health-tips`

**Query params:**
- `metric_type` (optional): `sleep` | `water` | `food` | `exercise` | `medication`
- `limit` (optional, default 3, max 10)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "metric_type": "sleep",
      "tip": "Consistent sleep schedule...",
      "priority": 1
    }
  ],
  "total": 1
}
```
```

---

## 14.5 Update `AGENTS.md` Progress Section

Add Phase 2 progress to the agent operating instructions so the next session knows what's been built.

---

## 14.6 Final Validation Checklist

### Phase 2 Validation Checklist

- [ ] 200+ quotes in `dialogues.json` with 7 new health categories
- [ ] `DialogueEngine.get('sleep')` returns `health_sleep` quote
- [ ] `health_metrics` table exists in schema + migration applied
- [ ] `HealthMetricsLocalService.logMetric()` inserts and emits event
- [ ] `HealthMetricsLocalService.getToday()` returns only today's entries
- [ ] `HealthMetricsLocalService.getStreak()` returns correct count
- [ ] `HealthHubScreen` shows 5 metric cards in 2-column grid
- [ ] Tapping a card logs the metric and updates the UI
- [ ] Today's progress bar reflects X/5 completion
- [ ] StreakBadge shows non-zero streaks
- [ ] `SoundEngine.loadAssets()` loads sounds from `SOUNDS_DIR`
- [ ] Happy animation → meow sound
- [ ] Celebrate animation → celebrate sound
- [ ] Pet interaction → purr sound
- [ ] Sleep animation → yawn sound
- [ ] `muteSounds: true` disables all sounds
- [ ] `MoodManager` tracks trend (improving/declining/stable/volatile)
- [ ] `EmotionEngine` adjusts animation based on mood trend
- [ ] Recommendation bubble appears for sad/anxious/angry moods
- [ ] `AchievementEngine.checkAchievements()` returns newly unlocked only
- [ ] Achievement popup appears when condition is first met
- [ ] Unlocked achievements persist in SQLite (via `companionStore.memory`)
- [ ] `GET /api/v1/wellness/health-tips` returns tips
- [ ] Mobile falls back to `health_tips_fallback.json` when offline
- [ ] Health Hub shows health tips section
- [ ] App builds without TypeScript errors
- [ ] All tests pass (existing + new Phase 2 tests)

### Critical fixes verification

- [ ] Navigation from LunaOverlay long-press uses `navigation.navigate('HealthHub')` (correct stack)
- [ ] `healthMetricsStore.logMetric` uses `refreshAll()` for atomic state update (no race condition)
- [ ] Cross-platform log modal works on both iOS and Android (no `Alert.prompt`)
- [ ] `MoodManager` is user-scoped (accepts initial history, persists to `companionStore.memory.moodHistory`)
- [ ] `VOLATILITY_THRESHOLD` imported from `constants/companion.ts` (not hardcoded)
- [ ] `installLuna` checks `SOUNDS_DIR` existence before calling `soundEngine.loadAssets()`
- [ ] `AchievementBadge` icon has fallback: `{achievement.icon || '🏆'}`
- [ ] `queueMicrotask` used (available RN 0.70+); fallback to `setTimeout` documented
- [ ] Asset version incremented to `1.1.0` in backend metadata endpoint
- [ ] Version comparison logic in `assetDownloader.ts` triggers re-download for existing users

### Bug check (Luna-specific)

- [ ] XP awarded for health events (water: 3, food: 5, exercise: 8, medication: 4)
- [ ] Coins awarded for health events
- [ ] EventEngine handles health events without breaking existing reactions
- [ ] Luna long-press opens Health Hub
- [ ] `generateUUID()` works on both iOS and Android

---

## 14.7 Phase 3 Notes (for future planning)

| Topic | Notes |
|-------|-------|
| Cloud Backup | Manual export/import — generate all Luna data as JSON |
| AI Recommendations | Replace static tips with HuggingFace-generated personalized tips |
| Popup Queue | Queue multiple achievements unlocked at once |
| Android Logging | Replace `Alert.prompt` (iOS-only) with modal/bottom sheet |
| Deep Linking | Register Health Hub deep link for notification navigation |
| Sound Assets | Add more sounds (purr variations, chirps, stretch) |
| Health Hub Charts | Weekly/monthly trend charts for each metric |
| Medication Schedule | Add reminder notifications for medication times |
