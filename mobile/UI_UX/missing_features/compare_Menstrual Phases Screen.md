# Compare: Menstrual Phases Screen

**Design Spec File:** `mobile/UI_UX/Menstrual_Phases.md`
**Implemented File:** `mobile/src/screens/cycle/MenstrualPhasesScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Menstrual gradient | Soft Blush to Vivid Rose (#FF6B8A → #FF5277) | Red to Pink (#D63B3B → #FF5C8A) (line 48) | Different — too dark/red |
| Follicular gradient | Soft Peach to Off-White (#FFDAB9 → #FDF8F5) | Amber to Yellow (#FFB74D → #FFD54F) (line 65) | Different |
| Ovulation gradient | Mint to Warm Cream (#D4F0E0 → #FFF8F0) | Green to Light Green (#4CAF50 → #81C784) (line 82) | Different |
| Luteal gradient | Lavender to Warm Cream (#E8D5F5 → #FFF8F0) | Purple to Medium Purple (#7E57C2 → #9B7BFF) (line 99) | Different |
| Glassmorphic info panel | backdrop-filter: blur(12px), bg: rgba(255,255,255,0.25), border: 1px solid rgba(255,255,255,0.35), Charcoal text, 20px radius (lines 74-79) | backgroundColor: 'rgba(255,255,255,0.1)', no backdrop blur, white text (lines 148, 268-270) | Different — missing backdrop blur, different opacity, white text instead of Charcoal |
| Hormone display | Estrogen ⬇, Progesterone ⬇ (text + arrows) (line 43) | Dot-based bar visualization (lines 168-177) | Different representation |
| Energy/Mood rating | Floral glyphs (🌸🌸░ ░ ░) with Soft Blush active dots (lines 19-20, 44) | Rectangle bars (StarRating) in white (lines 114-122, 157-162) | Different — uses bars instead of floral glyphs |
| Common symptoms | Blush Light #FFB3C6 chips (line 45) | White translucent chips (line 193) | Different |
| Symptom chips - Menstrual | Cramps, Fatigue, Back Pain (line 45) | Cramps, Fatigue, Bloating, Headache (line 59) | Different — Bloating/Headache instead of Back Pain |
| Nutrition | Iron-rich leafy greens, Warm herbal infusions (lines 23-24) | Iron-rich foods, Vitamin C, Stay hydrated, Warm meals (line 57) | Different — different items |
| Exercise | Gentle restorative yoga, Restful walks (lines 27-28) | Gentle yoga, Light walking, Avoid high intensity (line 58) | Partially |
| Page indicator dots | Active: Soft Blush, scale 1.25x; Inactive: Mauve (line 84) | Active: White, width 24px; Inactive: white 0.4 opacity (line 249-250) | Different — wrong colors, uses width change instead of scale |
| Parallax effect | Background 30% slower than text (line 86) | Not implemented | Missing |
| Header | EB Garamond "Cycle Phase Guide" + Close text link (line 11) | Uses navigation title (line 216) | Different |
| Background | Off-White #FDF8F5 (line 7) | Dark #1A1D26 (line 220) | Completely different |
| Swipe transition | damping: 20, stiffness: 150 (line 85) | Uses standard pagingEnabled + snapToInterval | Different approach — no gesture handler-based snapping |
| GestureHandlerRootView | Swipeable horizontal paging | Wrapped in GestureHandlerRootView but gestures not actually used for paging (line 221) | Partially — ScrollView handles paging, gesture handlers unused |

## Additional Issues

- The spec says each card should have content on a glassmorphic overlay. The code applies the overlay to the entire card content, losing the visual separation between the header area and info panel.
- The Follicular card spec says header text should be Charcoal (#2D2D2D) (line 49), but the code uses white for all cards.
- The spec calls for icons: water droplet (Menstrual), sprout (Follicular), sparkle (Ovulation), moon (Luteal). The code uses emoji icons (🩸, 🌱, ✨, 🌙) which is acceptable but different from the outlined SVG styles described.
