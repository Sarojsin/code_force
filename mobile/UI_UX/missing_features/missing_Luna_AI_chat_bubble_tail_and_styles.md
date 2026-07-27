# Missing: Luna AI Chat Bubble Tail & Color Styling

> Source: `SheCare_Mobile_App_Design/src/App.tsx:1660-1668`
> Current: `mobile/src/screens/chat/AIChatScreen.tsx:225-232`

## Gap

The Figma prototype uses specific bubble border-radius with **asymmetric tails** and distinct color values. The current implementation uses generic theme colors and different radius values.

## Spec (Figma)

### AI Bubble (left-aligned)
```
borderRadius:       18px 18px 18px 5px   ← tail on bottom-right (sender side)
background:         rgba(255,255,255,0.90)
color:              #2D1B26  (C.dark)
border:             1px solid rgba(247,197,204,0.33)  (C.rose55)
boxShadow:          0 2px 12px rgba(212,165,181,0.14)
maxWidth:           78%
padding:            11px 15px
fontSize:           14px
lineHeight:         1.65
```

### User Bubble (right-aligned)
```
borderRadius:       18px 18px 5px 18px   ← tail on bottom-left (sender side)
background:         linear-gradient(135deg, #FF6B8A, #D4507A)
color:              #FFFFFF
border:             none
boxShadow:          0 4px 16px rgba(255,107,138,0.30)
maxWidth:           78%
padding:            11px 15px
fontSize:           14px
lineHeight:         1.65
```

## Current Implementation

```tsx
// AI bubble
{ backgroundColor: '#F5F5F5', borderTopLeftRadius: 4, borderRadius: 20 }
// User bubble
{ backgroundColor: theme.colors.primary, borderTopRightRadius: 4, borderRadius: 20 }
```

### Differences

| Property | Spec | Current |
|----------|------|---------|
| **AI bubble bg** | `rgba(255,255,255,0.90)` | `#F5F5F5` |
| **AI bubble radius** | `18px 18px 18px 5px` | `20px` + `borderTopLeftRadius: 4` |
| **AI bubble border** | `1px solid #F7C5CC55` | None |
| **AI bubble shadow** | `0 2px 12px rgba(212,165,181,0.14)` | None |
| **User bubble bg** | `linear-gradient(135deg, #FF6B8A, #D4507A)` | `theme.colors.primary` solid |
| **User bubble radius** | `18px 18px 5px 18px` | `20px` + `borderTopRightRadius: 4` |
| **User bubble shadow** | `0 4px 16px rgba(255,107,138,0.30)` | None |

## Fix

1. Update AI bubble background to `rgba(255,255,255,0.90)` (warm cream white)
2. Change AI bubble border-radius to `18px 18px 18px 5px` (tail on bottom-right)
3. Add `1px solid #F7C5CC55` border to AI bubble
4. Add shadow: `0 2px 12px` at `rgba(212,165,181,0.14)` to AI bubble
5. Change user bubble background to `linear-gradient(135deg, #FF6B8A, #D4507A)`
6. Change user bubble border-radius to `18px 18px 5px 18px` (tail on bottom-left)
7. Add shadow: `0 4px 16px` at `rgba(255,107,138,0.30)` to user bubble