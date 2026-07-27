# Missing: Luna AI Floral Decorative Overlay & Screen Atmosphere

> Source: `SheCare_Mobile_App_Design/src/App.tsx:1622-1626` (header gradient)
> Also referenced in: `mobile/UI_UX/AI_Chat.md:7`

## Gap

The Figma prototype and the UI/UX spec both describe a **delicate decorative floral SVG overlay** in the top-right corner of the chat screen. This overlay is missing from the current implementation.

## Spec

### From AI_Chat.md (line 7):
> "The chat interface is set against a soft Off-White (`#FDF8F5`) background with a delicate decorative floral SVG overlay in the top-right corner."

### From Figma:
- The header has a subtle `linear-gradient(180deg, rgba(255,179,198,0.25) 0%, rgba(255,248,240,0) 100%)` overlay
- The entire screen background is `#FFF8F0` (cream)
- No harsh colors — everything is warm and muted

## Current Implementation

```tsx
// Line 242
<SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]} edges={['top']}>
```

Uses `#FFF8FB` (slightly pinker) instead of `#FFF8F0` (warm cream). No floral overlay exists.

## Fix

1. Change screen background from `#FFF8FB` to `#FFF8F0` (warm cream)
2. Add a decorative floral SVG overlay (positioned absolute, top-right, ~120×120px, opacity ~0.08–0.12, no pointer events)
3. The floral SVG should use the existing blush/rose color palette — a simple line-art flower or leaf pattern with `stroke="#FF6B8A"` and `strokeWidth="1"` at low opacity
4. Ensure the overlay does not interfere with scroll or tap interactions (`pointerEvents="none"`)