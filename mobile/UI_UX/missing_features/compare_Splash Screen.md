# Compare: Splash Screen

**Design Spec File:** `mobile/UI_UX/Splash_Screen.md`
**Implemented File:** `mobile/src/screens/SplashScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Aurora colors | Soft Blush, Blush Light, Rose Quartz, Mauve, Lavender cycling (line 33) | #FF5C8A, #9B7BFF, #FFB7C8, #E8D5FF, #FFD5B8 (lines 96-100) | Different — Mauve #D4A5B5 and Rose Quartz #F7C5CC missing, replaced by purple and peach |
| Gradient animation | 6-second cycle: 135°→180°→135° (line 34) | Horizontal translate animation (6s, linear) (line 23-24) | Different approach — uses translate instead of rotating gradient angle |
| Glass circle size | 60% of device width, 1:1 aspect ratio (line 38) | Math.min(SCREEN_WIDTH * 0.5, 200) (line 15) | Different — 50% instead of 60% |
| Glass circle spec | backdrop-filter: blur(24px), bg: rgba(255,255,255,0.22), border: 1.5px solid rgba(255,255,255,0.45), border-radius: 50% (lines 40-44) | bg: rgba(255,255,255,0.15), borderWidth: 1.5, borderColor: rgba(255,255,255,0.3) (lines 162-164) | Close but different values — 0.15 vs 0.22, 0.3 vs 0.45 opacity |
| Pulse animation | Scale 1.03→1.0, 3-second breathing rhythm (line 46) | Scale 1.05→1.0 + opacity pulse, 3-second total cycle (lines 39-54) | Different amplitude — 1.05 instead of 1.03 |
| App name text | EB Garamond White 28px "SheCare" (line 21) | display variant (32px White) (line 128) | Different font + size |
| Tagline | Inter White 12px "Your wellness journey" (line 22) | body variant (16px White 0.8 opacity) (line 129) | Different size + opacity |
| Loading dots | 5 dots, 8px diameter, active: White 1.0, inactive: White 0.5, staggered bounce left→right, 1.5s loop (lines 50-53) | 5 dots, 8px, all start at 0.3 opacity, bounce independently with 400ms timing (lines 69-87, 133-139) | Different — all dots animate at once instead of staggered left→right wave |
| Display time | 1000ms–1500ms (line 7) | 2000ms (line 64) | Different — 500ms longer |
| Onboarding (referenced) | Soft gradient bg, Playfair Display header, hand-drawn illustrations, text field borders, progress dots, horizontal slide transitions (lines 57-69) | Onboarding screens exist separately but not reviewed for this comparison | Out of scope |

## Line-Specific Issues

- Lines 96-100: Aurora gradient colors omit spec's Mauve (#D4A5B5) and Rose Quartz (#F7C5CC).
- Line 23-24: Animation uses horizontal translate rather than rotating gradient angle.
- Line 15: Glass circle is 50% width instead of spec's 60%.
- Lines 162-164: Glass circle opacity and border opacity don't match spec values.
- Lines 39-54: Pulse animation amplitude is 1.05 instead of spec's 1.03.
- Line 128: App name uses display variant (32px) instead of spec's 28px EB Garamond.
- Line 129: Tagline uses body variant (16px) instead of spec's 12px.
- Lines 69-87, 133-139: Loading dots animate independently rather than in a staggered left→right wave.
