# Compare: Calendar Screen

**Design Spec File:** `mobile/UI_UX/Calendar.md`
**Implemented File:** `mobile/src/screens/calendar/CalendarScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Header: EB Garamond | ◀ September 2026 ▶ [Today] with EB Garamond font | Calendar (h1, line 196) + Today button + month nav (lines 207-227) | Partially — no EB Garamond, no left/right arrows with the month name inline per spec |
| Phase color coding | Menstrual #FF6B8A, Follicular #FFDAB9, Ovulation #D4F0E0, Luteal #E8D5F5 (lines 38-42) | Menstrual #FF5252, Follicular #FFD54F, Ovulation #4CAF50, Luteal #42A5F5 (lines 48-53) | Completely different — uses bright Material colors instead of soft pastels |
| Predicted Period style | Blush Light #FFB3C6, outlined/striped pattern (line 42) | Not implemented | Missing |
| Selected day animation | 2px Soft Blush border + spring bounce (scale 1.15 ➔ 1.0) (line 44) | Background fill + scale 1.1 (line 277) | Different — spec says border + spring, code uses background fill |
| Today indicator | Muted gray circle with Soft Blush text (line 45) | Primary color text on transparent background (lines 259-260) | Different |
| Log Indicators | Small Mauve dot for symptoms, tiny emoji for mood below day number (lines 47-48) | Not implemented | Missing — no sub-day-cell indicators |
| Bottom Sheet | Draggable, 3 snap points (30%, 65%, 90%), drag handle: Mauve pill 32×4px (lines 52-53) | Non-draggable animated view (lines 79-138), only one position, no snap points | Different — no BottomSheet component used, no gesture-driven drag, no snap points |
| Bottom sheet background | Warm Cream #FFF8F0, 20px radius (line 52) | White surface (line 95), radius.xl (24px) | Different color/radius |
| Mood selector chips in sheet | Horizontal emoji chips, selected = Blush Light bg, unselected = transparent + Mauve border (line 58) | Simple text chips ['😊 Happy', '😴 Tired', ...] with standard border (lines 116-121) | Different — no emoji-only chips, no two-state styling per spec |
| Symptom tag grid | Tappable badges: active = Blush Light bg, inactive = Off-White + Mauve border (line 59) | Simple text chips with standard bg/border (lines 125-129) | Different — missing active/inactive toggle state |
| Notes field | Expansive text area, 1px Mauve border on Off-White canvas (line 60) | Not implemented in sheet | Missing |
| Action buttons | Primary: pill with Soft Blush gradient; Secondary: ghost with Blush border (lines 62-63) | "Log Period" primary button + "View Details" outline button (lines 133-134) | Partially — no gradient on primary, outline uses theme default |
| Phase Summary heading | Playfair Display 18px with colored status dot (line 57) | h3 variant (Inter) with phase badge (lines 102, 110) | Different — wrong font, no status dot |
| Loading state | 28 shimmering circular grids (line 68) | Not implemented | Missing |
| Offline state | Local log + encrypted storage + sync toast (line 69) | Not implemented | Missing |

## Line-Specific Issues

- Lines 48-53: `PHASE_COLORS` object uses colors that don't match the spec's soft palette.
- Line 188: Falls back to 'menstrual' for unknown phases — spec doesn't define this fallback.
- Lines 79-138: `SelectedDaySheet` is implemented as a custom animated view, not using a reusable BottomSheet component. It has no drag gesture handling.
