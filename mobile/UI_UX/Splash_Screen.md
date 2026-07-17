# Splash Screen & Onboarding Layouts

> Route: Root (shown on cold start while determining auth and onboarding state)

## Splash Screen Layout

A full-screen animated aurora gradient with a central glassmorphic app emblem and minimal loading indicators. Displays for 1000ms–1500ms before routing to Auth, Onboarding, or MainStacks.

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│           ┌──────────────────┐           │
│           │   ┌──────────┐   │           │  <- Centered glowing glass circle
│           │   │  🌸      │   │           │     (60% of screen width)
│           │   │  Logo    │   │           │
│           │   └──────────┘   │           │
│           │   Glassmorphic   │           │
│           └──────────────────┘           │
│                                          │
│                 SheCare                  │  <- App name: EB Garamond (White, 28px)
│          Your wellness journey           │  <- Tagline: Inter (White, 12px)
│                                          │
│                                          │
│               ●  ●  ●  ●  ●              │  <- 5-dot loading sequence (active dot: white)
│                                          │
└──────────────────────────────────────────┘
```

## Aurora Background & Animation Spec

The background is a dynamic linear gradient cycling slowly (6-second cycle) between the brand colors to establish a calm, welcoming entrance:
- **Color Stops**: Soft Blush (`#FF6B8A`), Blush Light (`#FFB3C6`), Rose Quartz (`#F7C5CC`), Mauve (`#D4A5B5`), and Lavender (`#E8D5F5`).
- **Animation Details**: Gradient angles rotate slowly (`0s to 3s`: 135deg to 180deg; `3s to 6s`: 180deg back to 135deg) using reanimated state properties to create a moving, liquid appearance.

## Central Glassmorphic Logo Container

- **Sizing**: 60% of device width, 1:1 aspect ratio.
- **Glass Spec**:
  ```css
  backdrop-filter: blur(24px);
  background: rgba(255, 255, 255, 0.22);
  border: 1.5px solid rgba(255, 255, 255, 0.45);
  border-radius: 50%;
  ```
- **Pulse Animation**: Scales up to `1.03` and back to `1.0` in a smooth 3-second breathing rhythm.

## Loading Sequence

- **Indicator**: 5 horizontal dots, each `8px` diameter.
- **Active State**: White (`#FFFFFF`) with 1.0 opacity.
- **Inactive State**: White with 0.5 opacity.
- **Sequence**: Staggered bounce wave from left to right (duration: 1.5s total loop).

---

## Onboarding Screen Layouts (Onboarding Stack)

Once the splash screen transitions, first-time users land on the Onboarding flow.

- **Background**: Solid soft gradient from Blush Light to Warm Cream (`#FFB3C6 → #FFF8F0`).
- **Header**: Playfair Display (24px, Charcoal `#2D2D2D`): *"Tell us about your cycle"*
- **Body**: Inter (15px, Warm Gray `#8A8A8A`) for instructions and input explanations.
- **Illustration**: Large hand-drawn graphic representing a woman meditating or journaling in soft peach/blush tones.
- **Inputs**: Text fields use standard borders (`#D4A5B5` Mauve) with Off-White backgrounds.
- **Navigation Controls**:
  - *Next Button*: Primary pill button (`#FF6B8A` gradient) at full width.
  - *Progress Indicator Dots*: Located at the bottom. Filled Soft Blush (`#FF6B8A`) for the current step, Blush Light (`#FFB3C6`) for completed, and Mauve (`#D4A5B5`) for upcoming steps.
- **Transitions**: Horizontal slide-in from right to left (`300ms`, easeOut).
