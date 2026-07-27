# Missing: Luna AI Header & Avatar Design

> Source: `SheCare_Mobile_App_Design/src/App.tsx:1628-1647`
> Current: `mobile/src/screens/chat/AIChatScreen.tsx:244-267`

## Gap

The Figma header has a softer gradient background with frosted effect and a more polished avatar with online status. The current header uses a solid background with no gradient.

## Spec (Figma)

### Header Area
```
background: linear-gradient(180deg, rgba(255,179,198,0.25) 0%, rgba(255,248,240,0) 100%), #FFF8F0
borderBottom: 1px solid rgba(247,197,204,0.33)  (C.rose55)
padding: 52px 18px 14px
```

### Avatar
```
size: 46px
background: linear-gradient(135deg, #FF6B8A, #E8D5F5)
border-radius: 50%
boxShadow: 0 4px 16px rgba(255,107,138,0.32)
position: relative
content: 🤖
fontSize: 24
```

### Online Dot
```
position: absolute
bottom: 0
right: 0
width: 12px
height: 12px
borderRadius: 50%
background: #3CC87A
border: 2px solid #fff
```

### Title Text
```
fontFamily: "Playfair Display", serif
fontSize: 19
fontWeight: 800
color: #2D1B26
```

### Subtitle Text
```
fontSize: 12
color: #1A6B45
fontWeight: 700
text: "Online · Cycle-aware · Always here"
```

## Current Implementation

```tsx
<View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
```

Solid background, no gradient, no online dot, uses theme token colors.

## Fix

1. Add gradient background to header: `linear-gradient(180deg, rgba(255,179,198,0.25) 0%, rgba(255,248,240,0) 100%), #FFF8F0`
2. Replace header border-bottom color with `#F7C5CC55`
3. Us `Playfair Display` font for the title "Luna AI" (or maintain current font but update name)
4. Replace SVG icon with gradient circle (46px, blush→lavender) containing 🤖 emoji
5. Add online status dot (12px green circle with 2px white border) positioned bottom-right of avatar
6. Update subtitle to "Online · Cycle-aware · Always here" with `#1A6B45` color
7. Remove voice recording button from header (move to input bar per Figma design)