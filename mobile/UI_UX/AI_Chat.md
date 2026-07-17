# AI Health Assistant Chat — Modern Girlish Style

> Route: `MainTabs` → `AI Chat` tab (4th tab)

## Layout & Vibe

A full-screen interactive interface with a warm, conversational AI health companion. The chat interface is set against a soft Off-White (`#FDF8F5`) background with a delicate decorative floral SVG overlay in the top-right corner.

```
┌──────────────────────────────────────────┐
│  ◀ SheCare AI Companion           [Menu]  │  <- Header: EB Garamond, floral icon accent
├──────────────────────────────────────────┤
│  ┌────────────────────────┐              │
│  │  Hello, love! I'm here  │              │
│  │  to support your cycle │              │  <- AI message: Left-aligned, Warm Cream background
│  │  and wellness. How can │              │
│  │  I help you today?     │              │
│  │               10:30 AM │              │
│  └────────────────────────┘              │
│            ┌──────────────────────────┐  │
│            │ I'm feeling a bit tired  │  │  <- User message: Right-aligned, Soft Blush bubble
│            │ and bloated today.       │  │
│            │                 10:31 AM │  │
│            └──────────────────────────┘  │
│  ┌────────────────────────┐              │
│  │  🌸 I hear you. That is │              │
│  │  quite common during the│              │  <- AI response with suggestions
│  │  luteal phase. Let's    │              │
│  │  try a quick breathing  │              │
│  │  exercise?              │              │
│  │               10:31 AM  │              │
│  └────────────────────────┘              │
│  ⚕️ AI-generated, not medical advice      │  <- Muted medical disclaimer caption
│                                          │
│  [ Yoga Tips ]   [ Period log ]          │  <- Suggestion chips (Blush Light background)
│  [ Stress Relief ] [ Sleep hygiene ]     │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────┐  [🎤]  │  <- Input bar with send/mic buttons
│  │ Type your heart out...       │  [🔼]  │
│  └──────────────────────────────┘        │
└──────────────────────────────────────────┘
```

## Chat Bubble Specifications

| Property | AI Bubble | User Bubble |
|----------|-----------|-------------|
| **Alignment** | Left-aligned | Right-aligned |
| **Background** | Warm Cream (`#FFF8F0`) | Soft Blush gradient (`#FF6B8A → #FF5277`) |
| **Text Color** | Charcoal (`#2D2D2D`) | White (`#FFFFFF`) |
| **Max Width** | 85% of screen width | 85% of screen width |
| **Border Radius**| 20px (top-left corner: 4px for tail) | 20px (top-right corner: 4px for tail) |
| **Shadow** | `shadow.soft` (`rgba(0,0,0,0.04)`) | None |
| **Avatar** | Small circle (36px) with leaf/flower icon in Lavender (`#E8D5F5`) background | None (right edge aligned) |

## Features & UI Components

### 1. Suggestion Chips
- **Aesthetic**: Background is Blush Light (`#FFB3C6`) with Charcoal (`#2D2D2D`) text, structured as 12px rounded pill chips.
- **Interaction**: Scroll horizontally with a spring hover effect. Tapping a chip sends the text instantly and plays a subtle haptic pop.

### 2. Input Bar
- **Border**: 1px solid `#D4A5B5` (Mauve) on an Off-White (`#FDF8F5`) text-input canvas.
- **Corners**: Rounded `16px` (radius.lg).
- **Send Button**: Small circular button (`#FF6B8A`) with a white arrow. Active only when text is entered.
- **Voice/Microphone Button**: Lavender (`#E8D5F5`) background circle. When recording, it displays a pulsating red ring overlay (`#FF0000` with 0.3 opacity) using a slow 1-second pulse.

### 3. Medical Disclaimer
- **Text**: `⚕️ I'm AI-powered and not a substitute for professional medical advice.`
- **Style**: Warm Gray (`#8A8A8A`), `12px` Inter font, center-aligned below the daily opening AI block.

### 4. Typing Indicator
- Three small Lavender (`#E8D5F5`) dots that cycle vertically using a staggered spring bounce animation.

## Screen States

| State | Behavior |
|-------|----------|
| **Streaming** | Typing indicator fades out and incremental words slide in from bottom (+2px Y translation). |
| **Offline** | Input field remains enabled but displays a thin Mauve notification banner: *"Offline mode: messages will sync when you reconnect."* |
| **Error** | Fails with a friendly bubble: *"Oops! I couldn't reach the server. Let's try again?"* accompanied by a Soft Blush retry icon. |
