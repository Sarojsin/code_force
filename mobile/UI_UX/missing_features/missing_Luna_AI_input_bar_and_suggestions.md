# Missing: Luna AI Input Bar & Suggestion Chips Styling

> Source: `SheCare_Mobile_App_Design/src/App.tsx:1677-1714`
> Current: `mobile/src/screens/chat/AIChatScreen.tsx:281-315`

## Gap

The Figma input bar uses frosted glass (`backdrop-filter`) with specific border/color values. The suggestion chips have a different visual style. The current implementation uses solid backgrounds and theme tokens.

## Spec (Figma)

### Input Bar Container
```
background: rgba(255,248,240,0.96)
backdropFilter: blur(16px)
borderTop: 1px solid rgba(247,197,204,0.33)  (C.rose55)
padding: 8px 16px 28px  (28px for home indicator clearance)
```

### Text Input
```
height: 46px
borderRadius: 16px
border: 1.5px solid #F7C5CC  (C.rose)
background: rgba(255,255,255,0.85)
padding: 0 16px
fontSize: 14px
color: #2D1B26
fontFamily: Inter, sans-serif
```

### Send Button
```
width: 46px
height: 46px
borderRadius: 14px
background: linear-gradient(135deg, #FF6B8A, #D4507A)
boxShadow: 0 4px 16px rgba(255,107,138,0.35)
content: "↑" arrow
fontSize: 20px
color: #fff
```

### Suggestion Chips
```
whiteSpace: nowrap
padding: 7px 13px
borderRadius: 20px
border: 1.5px solid #F7C5CC  (C.rose)
background: rgba(255,255,255,0.75)
color: #FF6B8A  (C.blush)
fontSize: 12px
fontWeight: 700
minHeight: 34px
```

### Voice Button (in input bar area)
```
positioned to left of send button
Lavender (#E8D5F5) background when idle
Pulsating red ring when recording
```

## Current Implementation

```tsx
// Input bar — solid background, different border
// Send button — uses theme.colors.primary
// Suggestions — inline styles with theme tokens
```

## Fix

1. Add `backdrop-filter: blur(16px)` to input bar container
2. Update input bar background to `rgba(255,248,240,0.96)`
3. Change input field border to `1.5px solid #F7C5CC` with `rgba(255,255,255,0.85)` background
4. Update send button to blush gradient (`#FF6B8A → #D4507A`) with arrow ↑ icon
5. Restyle suggestion chips: `1.5px solid #F7C5CC` border, `rgba(255,255,255,0.75)` bg, blush text
6. Move voice/mic button from header into input bar area
7. Ensure bottom padding is 28px for iOS home indicator