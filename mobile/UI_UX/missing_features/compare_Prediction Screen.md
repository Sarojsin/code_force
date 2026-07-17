# Compare: Prediction Screen

**Design Spec File:** `mobile/UI_UX/Prediction Screen.md`
**Implemented Files:** `mobile/src/screens/cycle/CyclePredictionsScreen.tsx`, `mobile/src/components/ui/PredictionDetailCard.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Header | EB Garamond "Predictions" + share icon (line 11) | h1 "Predictions" (line 79) — no share icon | Missing share icon |
| Large Glass Card (top) | backdrop-filter: blur(24px), bg: linear-gradient(135deg, rgba(255,107,138,0.12), rgba(232,213,245,0.12)), border: 1.5px solid rgba(255,255,255,0.45), border-radius: 28px (lines 50-54) | Semi-transparent white bg, border, radius.xl (24px) (line 93) | Different — no gradient background, no blur, different radius |
| Circular progress | SVG path, Soft Blush active, Lavender inactive, Inter 24px Bold Charcoal center text (line 56) | SVG circle, gradient active (primary→accent), border inactive, h2 center text (lines 22-61) | Partially — different colors, smaller font |
| Data Quality Meter | 5 horizontal dots, color-coded by level: Red→Peach→Lavender→Mint→Mint with glow (lines 57-62) | Text-based quality banner with colored left border (lines 19-24, 83-86) | Completely different — no dot meter at all |
| Next Events List | Event list with colored dots: Period (Soft Blush), Fertile (Mint), Ovulation (Peach), countdown in Warm Gray (lines 65-69) | Only "Next period" shown in countdown card (lines 90-101) | Partially — missing fertile window and ovulation events |
| Cycle Phase Timeline | 4 colored segments: Menstrual (Soft Blush), Follicular (Peach), Ovulation (Mint), Luteal (Lavender). Marker = Soft Blush leaf icon with "You are here" label (lines 72-77) | Timeline bar implemented with different colors (menopausal red, follicular yellow, ovulation green, luteal blue). Marker present but no "You are here" label (lines 63-85) | Partially — wrong colors, missing label |
| Prediction History Table | Month / Predicted / Actual comparison table, color-coded rows (lines 79-83) | Not implemented | Missing entirely |
| Empty state | Hand-drawn calendar book illustration, "Your cycle story begins here", "Log Period Start" button (lines 97-100) | Simple text: "No predictions available yet. Log your first period to get started." (line 119-121) | Missing — no illustration, no button |
| Loading state | Full-screen glass card + list shimmer (line 91) | Skeleton placeholders (lines 64-71) | Partially implemented |
| Error state | Shows local data, Warm Gray warning bar "Tap to refresh" (line 92) | Not implemented | Missing |

## Line-Specific Issues in PredictionDetailCard.tsx

- Line 65: Timeline colors (menstrual: '#FF5252', follicular: '#FFD54F', ovulation: '#4CAF50', luteal: '#42A5F5') don't match spec's soft pastels (#FF6B8A, #FFDAB9, #D4F0E0, #E8D5F5).
- Line 74: Timeline labels are made-up abbreviations (D1, D6, D14, D17) — spec doesn't specify these.
- Line 132: AI insight is a generic string rather than a personalized reflection as spec describes.
