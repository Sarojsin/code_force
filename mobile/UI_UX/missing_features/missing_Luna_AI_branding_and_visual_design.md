# Missing: Luna AI Branding & Visual Design Personality

> Source: `SheCare_Mobile_App_Design/src/App.tsx:1596-1717` (Figma Make prototype)
> Current: `mobile/src/screens/chat/AIChatScreen.tsx`

## Gap

The Figma prototype brands the AI companion as **"Luna AI"** with a warm, personality-driven identity. The current implementation uses the generic label **"SheCare AI"** with a clinical tone.

## Spec (Figma)

| Attribute | Spec Value | Current |
|-----------|------------|---------|
| **Chat name** | "Luna AI" | "SheCare AI" |
| **Subtitle** | "Online · Cycle-aware · Always here" | "Health Assistant" |
| **Avatar icon** | 🤖 emoji in gradient circle (blush→lavender) | SVG brain/chat icon |
| **Avatar gradient** | `linear-gradient(135deg, #FF6B8A, #E8D5F5)` | `theme.colors.accentMuted` solid |
| **Online indicator** | Green dot (12px, `#3CC87A`) with white border | None |
| **Avatar shadow** | `0 4px 16px rgba(255,107,138,0.32)` | None |
| **Tone** | Warm, personal: "Hi Sofia! 🌸 I'm Luna" | Clinical: "Hello! I'm your SheCare health assistant" |
| **Personality** | Uses emojis, phase-aware, calls user by name | Generic, no personalisation |

## Fix

1. Rename "SheCare AI" → "Luna AI" in header and welcome message
2. Replace SVG brain icon with a gradient circle + 🤖 emoji
3. Add green online indicator dot (12px, `#3CC87A`, white `2px` border) on avatar
4. Update subtitle to "Online · Cycle-aware · Always here"
5. Add avatar shadow: `0 4px 16px` at `rgba(255,107,138,0.32)`
6. Rewrite welcome message to match Luna's warm, personal tone with emojis
7. Ensure AI responses reference the user's cycle phase and use emojis naturally