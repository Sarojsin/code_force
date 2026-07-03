# Splash Screen — Aurora Gradient

> Route: Root (shown on cold start while auth state is determined)

## Layout

Full-screen animated aurora gradient with app logo and minimal loading. Shown for 800ms–1500ms, then transitions to Auth or Main based on login state.

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│         ┌───────────────┐           │
│         │  ┌─────────┐  │           │  <- Glowing glass circle
│         │  │  🌸      │  │           │     (60% of screen width)
│         │  │  Logo    │  │           │
│         │  │  Mark    │  │           │
│         │  └─────────┘  │           │
│         │  Glassmorphic │           │
│         │  Circle       │           │
│         └───────────────┘           │
│                                     │
│         SheCare                     │  <- App name below logo
│        Your wellness journey        │
│                                     │
│                                     │
│         ● ● ● ● ●                  │  <- 5-dot loading animation
│         (pulsing dots)              │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

## Aurora Gradient Background

```
Animated gradient cycling between:
- #FF5C8A (pink, 0%)
- #9B7BFF (purple, 25%)
- #FFB7C8 (light pink, 50%)
- #E8D5FF (lavender, 75%)
- #FFD5B8 (peach, 100%)

Colors shift positions in a slow 6-second loop using animated SVG or
react-native-linear-gradient with animated stops.
```

### Implementation approach

Use `react-native-svg` with `<Defs><LinearGradient>` and `react-native-reanimated` to animate the stop positions, or use `expo-linear-gradient` with `Animated` API to interpolate between color arrays.

**Animation timeline:**
- `0s-3s`: colors shift left-to-right
- `3s-6s`: colors shift right-to-left
- Loop infinitely

## Glowing Glass Circle

```
position: center 38% from top
width: 60% of screen width
aspect-ratio: 1:1 (perfect circle)

backdrop-filter: blur(24px)
background: rgba(255, 255, 255, 0.2)
border: 1.5px solid rgba(255, 255, 255, 0.4)
border-radius: 50%
```

### Glow animation
- Outer glow: pulsing box-shadow (iOS) / elevation (Android)
- Scale animation: 1.0 → 1.03 → 1.0 over 3 seconds (loop)
- Inner logo icon centered in the circle

### App Icon (inside glass circle)
- Custom SheCare icon: stylized flower/leaf in white
- SVG path with smooth curves
- Size: approximately 40% of the circle diameter

## Loading Animation

5 dots at the bottom of the screen, horizontally spaced:
- Dots animate in sequence: scale up → scale down → next dot
- Dot size: 8px diameter, 12px spacing
- Color: white with 0.6 opacity (inactive), 1.0 (active)
- Looping animation cycle: 2 seconds total

## Transition

- After auth check completes:
  - **Authenticated + onboarded**: fade out splash → MainTabs (cross-fade, 400ms)
  - **Authenticated, not onboarded**: fade out splash → Onboarding stack
  - **Not authenticated**: fade out splash → Auth stack (Login screen)
- Splash screen is NOT a route in the navigator — it overlays the root view

## States

| State | Behavior |
|-------|----------|
| **Cold start** | Show full splash with animation |
| **Auth check in progress** | Splash persists (max 2 seconds) |
| **Auth resolved** | Transition to appropriate stack |
| **Minimal time** | Splash shown for at least 800ms to avoid flash |
