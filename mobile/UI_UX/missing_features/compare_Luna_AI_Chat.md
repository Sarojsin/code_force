# Luna AI Chat — Figma Prototype vs Current Implementation

> Comparison between `SheCare_Mobile_App_Design/src/App.tsx` (Figma Make prototype) and `mobile/src/screens/chat/AIChatScreen.tsx`

## Visual Comparison Table

| Element | Figma Prototype (Luna AI) | Current Implementation | Status |
|---------|--------------------------|----------------------|--------|
| **Brand name** | "Luna AI" | "SheCare AI" | ❌ Missing |
| **Avatar** | 🤖 emoji in blush→lavender gradient circle (46px) | SVG brain/chat icon in accentMuted bg | ❌ Missing |
| **Online dot** | 12px green `#3CC87A` with 2px white border | None | ❌ Missing |
| **Avatar shadow** | `0 4px 16px rgba(255,107,138,0.32)` | None | ❌ Missing |
| **Header subtitle** | "Online · Cycle-aware · Always here" | "Health Assistant" | ❌ Missing |
| **Header bg** | `linear-gradient(180deg, rgba(255,179,198,0.25) 0%, transparent 100%), #FFF8F0` | Solid theme color | ❌ Missing |
| **Screen bg** | `#FFF8F0` (warm cream) | `#FFF8FB` (pinker) | ⚠️ Partial |
| **Floral SVG overlay** | Delicate decorative floral in top-right | None | ❌ Missing |
| **AI bubble bg** | `rgba(255,255,255,0.90)` | `#F5F5F5` | ❌ Missing |
| **AI bubble radius** | `18px 18px 18px 5px` (tail) | `20px` + `borderTopLeftRadius: 4` | ❌ Missing |
| **AI bubble border** | `1px solid #F7C5CC55` | None | ❌ Missing |
| **AI bubble shadow** | `0 2px 12px rgba(212,165,181,0.14)` | None | ❌ Missing |
| **User bubble bg** | `linear-gradient(135deg, #FF6B8A, #D4507A)` | `theme.colors.primary` solid | ❌ Missing |
| **User bubble radius** | `18px 18px 5px 18px` (tail) | `20px` + `borderTopRightRadius: 4` | ❌ Missing |
| **User bubble shadow** | `0 4px 16px rgba(255,107,138,0.30)` | None | ❌ Missing |
| **Input bar bg** | `rgba(255,248,240,0.96)` with `backdrop-filter: blur(16px)` | Solid background | ❌ Missing |
| **Input border** | `1.5px solid #F7C5CC` | Theme border color | ❌ Missing |
| **Send button** | Blush gradient with ↑ arrow, 46px circle | Theme-colored button | ❌ Missing |
| **Suggestion chips** | Rose border, white bg, blush text | Different inline styles | ❌ Missing |
| **Voice button** | In input bar area, lavender when idle | In header area | ❌ Wrong position |
| **Typing dots** | ✓ (lavender dots) | ✓ (3 dots, spring animation) | ✅ Present |
| **Pulse ring** | Red pulse on mic recording | ✓ Red pulse ring | ✅ Present |
| **Streaming text** | Incremental word reveal | ✓ `StreamText` component | ✅ Present |
| **Offline banner** | Thin mauve notification banner | ✓ Warning banner | ✅ Present |
| **Medical disclaimer** | Below first AI message | ✓ In every AI response | ⚠️ Over-shown |
| **Welcome text** | "Hi Sofia! 🌸 I'm Luna..." | "Hello! I'm your SheCare health assistant..." | ❌ Missing tone |

## Feature Comparison

| Feature | Figma | Current | Gap |
|---------|-------|---------|-----|
| Chat bubble tails | Asymmetric (18px:5px) | Asymmetric (20px:4px) | Value mismatch |
| Glassmorphism input | ✓ | ✗ | ❌ Missing |
| Floral decoration | ✓ | ✗ | ❌ Missing |
| Phase-aware persona | ✓ (uses cycle phase) | ✗ | ❌ Missing |
| Voice button location | Input bar | Header | Wrong position |
| Suggestion chips | Rose/bordered style | Different style | Style mismatch |
| online indicator | ✓ | ✗ | ❌ Missing |
| Brand identity | "Luna AI" | "SheCare AI" | Name mismatch |
| Background color | `#FFF8F0` | `#FFF8FB` | Minor mismatch |

## Files to Modify

| File | Change |
|------|--------|
| `src/screens/chat/AIChatScreen.tsx` | Rebrand to Luna AI, update all visual styling |
| `src/services/companion/dialogues.json` | Add Luna AI dialogue rules (if unifying with Luna cat) |
| `src/theme/tokens.ts` | Add Luna-specific shadow tokens if needed |

## Priority

**High** — The AI chat is the 4th bottom tab and a flagship feature. Its current clinical appearance undermines the warm, supportive brand identity shown in the Figma prototype.