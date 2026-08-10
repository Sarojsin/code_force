# Full Symptom-Driven Recommendation Engine — PR 4 (Carousel Deep-Links + DayDetailSheet Wiring)

> Status: **Draft for review** — verify before any code.
> PR 4 of 5. Depends on: PR 3 (engine emits new actions). No backend changes.

---

## 1. Objective

Make the recommendation CTA actually do something:

- CTA becomes an interactive secondary button (>= 44pt) rendered under the card body.
- `'water'` -> increments the day's water-glasses chip live (writes through `obs`).
- `'breathing'` -> deep-links to Wellness tab → `BreathingList` (grep-verified).
- `'days-stretch'` / `'walk'` -> informational toast this round. NOTE 3 verified: there
  is NO `CompanionTab` in `MainTabs` (tabs are `Home/Calendar/Analytics/Wellness/Profile`);
  the only companion screen is `Profile:CompanionInstall` (Luna install). Neither is a
  stretch destination, so both emit a gentle toast until a destination exists.
- `'journal'` -> Wellness tab → `JournalList` (grep-verified).
- `'doctor'` -> no navigation — renders a gentle "discuss with your doctor" note
  (reserved for the future `seek_care` UI).
- `'mark-done'` / `null` -> unchanged checkbox behavior / no CTA button.

Icon map in the carousel grows to cover every icon the PR-3 engine can emit.

---

## 2. Current state (verified)

| Item | Path | Detail |
|---|---|---|
| Carousel | `mobile/src/components/ui/dayDetail/RecommendationCarousel.tsx` | CTA shown as static `<Text>` (`card.cta`), `ICON_BY_KEY` only `🔥🌿💧`; `onToggle(id)` checkbox |
| Sheet | `mobile/src/components/ui/DayDetailSheet.tsx` | calls `getRecommendations`, renders carousel when tier is recommendation; `obs.waterGlasses` state + `WaterChips` |
| Navigation | sibling screens | Wellness tab (Breathe list), Companion tab, Journal screen exist |
| BottomSheet | `mobile/src/components/ui/BottomSheet.tsx` | modal; must not block tab navigation programmatically |

---

## 3. Changes

### 3.1 `RecommendationCarousel.tsx`

**Props — additive:**

```ts
interface RecommendationCarouselProps {
  cards: RecommendationCard[];
  completed: string[];
  onToggle: (id: string) => void;
  /** Fired when a CTA button is pressed. Caller resolves navigation/side-effects. */
  onAction: (action: NonNullable<RecommendationCard['action']>, card: RecommendationCard) => void;
}
```

**CTA button render:** when `card.cta` exists and `card.action` is one of the actionable
set, render a second `Pressable` (minHeight 44) below the Mark-done row:

- label = `card.cta` (existing string), `accessibilityRole="button"`,
  `accessibilityHint` derived from action (e.g. "Open breathing exercise").
- onPress -> haptics light -> `onAction(card.action, card)`.
- Actions `null` or `'mark-done'` never render this button (Mark-done row covers them).

**Icon map — extend.** `ICON_BY_KEY` becomes a larger lookup covering at least the
existing `🔥 (Flame), 🌿 (Leaf), 💧 (Droplet)` plus the new engine emission set. Default
fallback: render the emoji string in `<Text>` (already implemented as unmapped fallback).

### 3.2 `DayDetailSheet.tsx`

- Add `useNavigation` access (already imported in sibling screens) and a `navigateTo`
  callback that handles each action:

```ts
const handleRecommendationAction = useCallback((action, card) => {
  switch (action) {
    case 'water':
      // Note 6: cap at 12; tolerate null/undefined glasses as 0.
      update({ waterGlasses: Math.min((obs.waterGlasses ?? 0) + 1, 12) });
      Toast.show({ type: 'info', text1: 'Water +1 logged for today' });
      break;
    case 'breathing':
      navigation.navigate('Wellness', { screen: 'BreathingList' });
      break;
    case 'days-stretch':
    case 'walk':
      // NOTE 3: no CompanionTab exists — both emit an informational toast.
      Toast.show({ type: 'info', text1: 'Take a gentle 10-minute walk when ready.' });
      break;
    case 'journal':
      navigation.navigate('Wellness', { screen: 'JournalList' });
      break;
    case 'doctor':
      Toast.show({ type: 'info', text1: 'Consider mentioning this at your next check-up.' });
      break;
    default:
      break;
  }
}, [obs.waterGlasses, update, navigation]);
```

- Pass `onAction={handleRecommendationAction}` to `RecommendationCarousel`.
- Guard: when the day's tier changes away from recommendation, carousel unmounts — any
  in-flight navigation is still valid (react-navigation handles it).

### 3.3 Accessibility & interaction guard

- The CTA button must not be confused with Mark-done for screen readers: distinct
  `accessibilityLabel` (use `card.cta`) and a `accessibilityHint` describing the action.
- Haptics: `impactAsync(Light)` on CTA press (matches Mark-done behavior).
- Touch target: minHeight 44 (AGENTS 2.4).
- **Toast accessibility (Note 7):** the `react-native-toast-message` Toast is rendered in a
  portal and is NOT focusable by screen readers by default. Verify — and if needed wrap the
  toast content in an `accessible` container — that an accessibility-context change is
  announced (`accessibilityLiveRegion="polite"` on Android, `UIAccessibilityNotification` /
  `announceForAccessibility` on iOS) when the CTA toast appears. Add a manual a11y check to
  the test notes (§4).

---

## 4. Tests

- Extend `mobile/src/components/ui/__tests__/` carousel test (new or existing):
  - CTA button renders only for actionable actions (water/breathing/walk/stretch/journal/doctor)
    and not for null/mark-done.
  - Pressing CTA fires `onAction` with the correct action + card.
  - Water action: `onAction('water')` → handler writes `Math.min((0 ?? 0)+1, 12) = 1`;
    re-press up to 12 caps (Note 6).
  - Accessibility: button has label + hint; role `button`; CTA toast announcement (Note 7).
- Optional hook-level test for `handleRecommendationAction` (water bumps + Toast) if a
  test harness for `DayDetailSheet` exists; else cover via carousel test only.

---

## 5. Files changed (summary)

| File | Change | Risk |
|---|---|---|
| `mobile/src/components/ui/dayDetail/RecommendationCarousel.tsx` | CTA button + icon map + `onAction` prop | Medium |
| `mobile/src/components/ui/DayDetailSheet.tsx` | `handleRecommendationAction` + pass `onAction` | Medium |
| `mobile/src/components/ui/__tests__/` (carousel test) | Extend | Low |

> Navigation names verified by grep (Note 3): tabs are `Home`, `Calendar`, `Analytics`,
> `Wellness`, `Profile`; Wellness stack screens are `WellnessHome`, `JournalList`,
> `JournalEntry`, `BreathingList`, etc. **There is no `CompanionTab`** — only
> `Profile:CompanionInstall` (Luna install). Deep-links use:
> `navigation.navigate('Wellness', { screen: 'BreathingList' })` and
> `navigation.navigate('Wellness', { screen: 'JournalList' })`.

---

## 6. Mobile gates

```
cd mobile
npx tsc --noEmit
npx jest src/components/ui/__tests__
npx eslint src/components/ui/dayDetail/RecommendationCarousel.tsx src/components/ui/DayDetailSheet.tsx
```

---

## 7. Open questions (resolve before coding)

1. **Route names** — grep-verified during implementation: `Wellness` tab + `BreathingList`
   / `JournalList` screens; doc updated to match (Note 3).
2. **`walk` / `days-stretch` destination** — both informational toast this round. There is
   no map/summary screen and no Companion tab; `Profile:CompanionInstall` is just the Luna
   install screen. Confirmed acceptable.
3. **`doctor`** — toast ("Consider mentioning this at your next check-up"). A future
   `seek_care` PR will replace with a proper nudge card.

---

## 8. AGENTS checklist (mobile)

- [ ] CTA button is an interactive Pressable, minHeight 44, role button + hint
- [ ] Water action mutates `obs.waterGlasses` bounded at 12, null-tolerant (Note 6)
- [x] Navigation deep-links wired to real route names (grep-verified: `Wellness` / `BreathingList` / `JournalList`; days-stretch/walk → toast since no Companion tab)
- [ ] Toast a11y announcement handled (Note 7)
- [ ] Icon map covers the full engine emission set; emoji fallback intact
- [ ] No inline colors/spacing; theme tokens used; no new hardcoded values
- [ ] tsc + jest + eslint green