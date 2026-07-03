# Global Design System — SheCare

> Use this as the single source of truth for every screen. Any screen-level override must reference this doc explicitly.

## Brand Identity

Modern, elegant, calming, and trustworthy — a premium healthcare application for women's health and menstrual cycle tracking. Soft feminine aesthetic without appearing childish. Minimal clutter, maximum clarity.

## Color Palette (Semantic Tokens)

| Token | HEX | Usage |
|-------|-----|-------|
| `brand.primary` | `#FF5C8A` | Primary buttons, active tabs, key accents |
| `brand.primaryMuted` | `#FFB7C8` | Light fills, selected states, calendar highlights |
| `brand.accent` | `#9B7BFF` | Secondary CTAs, AI features, pregnancy highlights |
| `brand.success` | `#4CAF50` | Positive health indicators, ovulation, fertile window |
| `brand.warning` | `#F4A93C` | Warnings, luteal phase markers |
| `brand.danger` | `#D63B3B` | SOS, alerts, menstrual phase |
| `bg.primary` | `#FFF8FB` | Main screen backgrounds |
| `bg.surface` | `#FFFFFF` | Cards, modals, elevated surfaces |
| `text.primary` | `#1A1D26` | Headings, primary content |
| `text.secondary` | `#3B4151` | Body text, descriptions |
| `text.muted` | `#7B8194` | Captions, timestamps, hints |
| `text.inverse` | `#FFFFFF` | Text on brand-colored backgrounds |

## Gradients

- **Aurora background** (splash): `linear-gradient(135deg, #FF5C8A, #9B7BFF, #FFB7C8, #E8D5FF)`
- **Menstrual card**: `linear-gradient(180deg, #D63B3B, #FF5C8A)`
- **Follicular card**: `linear-gradient(180deg, #FFB74D, #FFD54F)`
- **Ovulation card**: `linear-gradient(180deg, #4CAF50, #81C784)`
- **Luteal card**: `linear-gradient(180deg, #7E57C2, #9B7BFF)`

## Typography

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 32px | Bold (700) | 38px | Greeting, splash title |
| `h1` | 24px | Bold (700) | 30px | Screen titles |
| `h2` | 20px | Semi-bold (600) | 26px | Section headers, card titles |
| `h3` | 18px | Semi-bold (600) | 24px | Card subtitles |
| `body` | 16px | Regular (400) | 22px | Primary reading text |
| `bodySmall` | 14px | Regular (400) | 20px | Secondary text, labels |
| `caption` | 12px | Regular (400) | 16px | Metadata, timestamps |
| `button` | 16px | Semi-bold (600) | 20px | All button labels |

Font stack: `SF Pro Display` (iOS), `Inter` (Android), system sans-serif fallback.

## Spacing (4px Grid)

`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`, `xxxl: 48`

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius.sm` | 8px | Inputs, small elements |
| `radius.md` | 12px | Buttons, chips |
| `radius.lg` | 16px | Standard cards |
| `radius.xl` | 20–28px | Feature cards, modals, bottom sheets |
| `radius.pill` | 999px | Avatars, badges, toggle handles |

## Shadows

| Token | iOS | Android (elevation) | Usage |
|-------|-----|---------------------|-------|
| `shadow.sm` | `0 1px 2px rgba(0,0,0,0.05)` | 1 | Subtle, card stacks |
| `shadow.md` | `0 2px 6px rgba(0,0,0,0.08)` | 3 | Default card elevation |
| `shadow.lg` | `0 4px 12px rgba(0,0,0,0.12)` | 6 | Modals, FABs, prediction cards |

## Glassmorphism (Cards & Overlays)

```
backdrop-filter: blur(12px)
background: rgba(255, 255, 255, 0.7)
border: 1px solid rgba(255, 255, 255, 0.3)
border-radius: 24px
```

Use only where appropriate (dashboards, prediction cards). Not on every card.

## Animations & Micro-interactions

- Button press: scale to **0.96** with spring (`damping: 15, stiffness: 200`)
- Card tap: scale to **0.98** with spring
- Tab switch: cross-fade with opacity
- Selected day: spring scale bounce
- Bottom sheet: smooth slide-up with drag handle
- Skeleton loading: shimmer gradient animation
- Pull-to-refresh: haptic feedback
- Phase cards: horizontal swipe with snap
- Splash: aurora gradient animation, logo glow pulse (3s cycle)

## Icons

Rounded outline style (e.g., Feather or Phosphor icon set). Minimum 24×24pt.
Touch targets minimum **44×44pt** (Apple HIG).

## Navigation (Bottom Tabs)

```
Home | Calendar | Analytics | AI Chat | Profile
```

Each tab icon should be outlined when inactive, filled when active. Active tint: `brand.primary`.

## Accessibility

- `accessibilityLabel` on every interactive element
- `accessibilityRole` set appropriately (button, tab, header, text)
- Dynamic type / font scaling supported
- Contrast ratio ≥ 4.5:1 normal text, 3:1 large text
- `accessibilityLiveRegion="polite"` for dynamic updates (SOS, predictions)
- Honor `useReducedMotion()` — disable non-essential animations

## Dark Mode

Dark mode variants for every color token. No layout shifts when switching modes.
Use `useColorScheme()` from React Native.

## Platform Guidelines

- **iOS**: Large titles, rounded corners, spring animations, safe area insets
- **Android**: Material Design elevation, ripple effects, back navigation, status bar theming
- Both platforms share the same component library; platform-specific code only where necessary (date pickers, haptics, SafeAreaView)
