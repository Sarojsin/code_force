# Compare: Home Screen (Dashboard)

**Design Spec File:** `mobile/UI_UX/Home_Screen.md`
**Implemented File:** `mobile/src/screens/home/HomeDashboardScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Gradient background | Soft Blush→Warm Cream (#FFB3C6 → #FFF8F0) | Solid #FFF8FB color (line 118) | Missing — no gradient background |
| Header: EB Garamond logo | 🌸 SheCare with notification bell + avatar (lines 11-12) | Just "Good morning" text with bell + avatar (lines 121-145) | Different — no "SheCare" branding text, no floral emoji |
| Greeting line | EB Garamond "Good morning, [Name]" (line 13) | "Good morning" without user's name (line 124) | Missing name — plain greeting |
| Next Period Card | Primary brand gradient (#FF6B8A to #FF5277), Playfair Display 24px, "Next Period in 12 days" | Solid theme.colors.primary background, display variant, just "Next Period" + days count (lines 171-181) | Partially implemented — missing gradient, wrong font, uses inline Pressable rather than the GlassCard pattern |
| Mood Card | Soft Lavender (#E8D5F5) background (line 60) | White glass card with yellow icon background #FEF3C7 (line 209) | Different — spec calls for full lavender card, code uses standard glass card |
| AI Prediction Snapshot | 3 circular progress indicators with thin-stroke arcs (Soft Blush active, Mauve inactive) (lines 65-69) | Simple text badges with percentage labels (lines 196-200) | Different — no circular progress animation, just text |
| Analytics Card (Row 3) | "Analytics Trend" with mini SVG sparkline chart (line 36-38) | Entirely missing — replaced by "Wellness Hub" chip row (lines 268-292) | Missing |
| Videos Card | Play button overlay, thumbnail preview, "3 new" badge (lines 76-79) | Basic video icon + "Explore" text + "3 new" badge (lines 218-236) | Partially implemented — no thumbnail preview |
| Bento layout structure | "Today's Cycle" + "Mood" in row 1; AI Prediction full-width in row 2; AI Chat + Videos in row 3; Analytics in row 4 (lines 15-38) | "Today's Cycle" + "Next Period" in row 1; AI Prediction in row 2; Mood + Videos in row 3; Journal + AI Chat in row 4; Wellness Hub in row 5 | Different layout — cards in different positions, Analytics missing, Journal added |
| Staggered card entrance | 60ms delay between cards (line 96) | delay prop implemented on GlassCard (lines 47-49): 0, 50, 100, 150, 200, 250, 300, 350 | Implemented but with different delays |
| Press scaling | Scale to 0.96 with spring (line 97) | Scale to 0.96 with withSpring (lines 62-63) | Implemented correctly |
| Header bell rotation | 15-degree rotation shake (line 98) | No animation on bell press (line 131-136) | Missing |
| Empty state | "Welcome to SheCare" onboarding banner with "Start Log" button (line 91) | Not implemented | Missing |
| Error state | "Could not reload dashboard" alert with retry (line 90) | console.warn only (line 104) | Missing — no UI error state |
| SOS card | Defined in Global Design spec (line 75) but referenced as present on Home screen | Not present | Missing |

## Line-Specific Issues

- Line 166: `Day ${... % 28 + 1}` uses a hardcoded modulo calculation rather than actual cycle day data from API.
- Line 167: Shows "Log symptoms" as a static caption, but spec says it should be a tappable link (line 56).
- Lines 170-181: The "Next Period" card wraps a GlassCard but then overrides its background entirely with `backgroundColor: theme.colors.primary` — this loses the glassmorphism effect.
