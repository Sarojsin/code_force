# Global Design System — SheCare (Modern Girlish Design)

> Use this as the single source of truth for every screen. Any screen-level override must reference this doc explicitly.

## Brand Identity

Transform SheCare into a modern, feminine, emotionally warm design language that resonates with women aged 16–40. The design must feel soft, empowering, trustworthy, and delightful — like a cozy café with warm lighting and a best friend who always has your back. "You are safe, understood, and celebrated here."

## Color Palette (Soft & Warm)

| Token | HEX | Usage |
|-------|-----|-------|
| `brand.primary` | `#FF6B8A` | Soft Blush: Primary buttons, active tabs, headers, active states |
| `brand.primaryMuted` | `#FFB3C6` | Blush Light: Secondary buttons, badges, selection highlights |
| `brand.accent` | `#D4A5B5` | Mauve: Accents, dividers, subtle highlights |
| `brand.success` | `#D4F0E0` | Mint: Cycle tracking, positive health stats |
| `brand.warning` | `#FFDAB9` | Soft Peach: Onboarding elements, welcome screens |
| `brand.danger` | `#FF0000` | SOS: Emergency alert primary states |
| `brand.wellness` | `#E8D5F5` | Lavender: Wellness/sentiment cards, calming elements |
| `bg.primary` | `#FDF8F5` | Off-White: Main screen background |
| `bg.surface` | `#FFF8F0` | Warm Cream: Cards, panels, input fields (alternative background) |
| `text.primary` | `#2D2D2D` | Charcoal: Primary text |
| `text.secondary` | `#8A8A8A` | Warm Gray: Secondary text, placeholders |
| `text.muted` | `#8A8A8A` | Warm Gray: Captions, timestamps, hints |
| `text.inverse` | `#FFFFFF` | Text on brand-colored backgrounds |

## Gradients

- **Onboarding/Splash Aurora**: `linear-gradient(135deg, #FFB3C6, #FFF8F0)` (Fades from light blush to warm cream)
- **Primary Action Gradient**: `linear-gradient(135deg, #FF6B8A, #FF5277)` (Soft blush to vivid rose)
- **SOS Emergency**: `linear-gradient(135deg, #FF0000, #CC0000)` (Vivid red to deep dark red)
- **Wellness Pulse**: `linear-gradient(135deg, #E8D5F5, #FFF8F0)` (Lavender to warm cream)

## Typography

Playfair Display (or EB Garamond) is used sparingly for headers and logos to add a touch of elegance. Inter is used for body, labels, and all metadata to maintain high readability.

| Token | Font Family | Size | Weight | Line Height | Usage |
|-------|-------------|------|--------|-------------|-------|
| `display.logo` | Playfair Display (EB Garamond) | 28px | Bold (700) | 34px | App Logo / Mark |
| `display.title` | Playfair Display (EB Garamond) | 24px | Semi-bold (600) | 30px | Screen Titles |
| `h2` | Inter | 18px | Semi-bold (600) | 24px | Section headers |
| `body` | Inter | 15px | Regular (400) | 22px | Primary reading, body text |
| `bodySmall` | Inter | 12px | Regular (400) | 16px | Small text, metadata, captions |
| `button` | Inter | 15px | Semi-bold (600) | 20px | Button labels |
| `tab` | Inter | 11px | Medium (500) | 14px | Tab bar labels |
| `display.countdown`| Inter | 48px | Bold (700) | 56px | Haptic countdown numbers |

## Spacing (4px Grid)

`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `xxl: 24`, `xxxl: 32`, `container-margin: 20`

## Border Radius

- `radius.sm`: 8px (Toggles, checkboxes, small indicators)
- `radius.md`: 12px (Symptom selector chips)
- `radius.lg`: 16px (Text inputs, date pickers)
- `radius.xl`: 20px (Standard bento cards, wellness panels)
- `radius.pill`: 24px (Buttons, active status pills)
- `radius.circle`: 999px (Avatars, floating action buttons)

## Shadows

- `shadow.soft`: `0 4px 16px rgba(0,0,0,0.06)` (Used for standard elevated cards)
- `shadow.primary`: `0 4px 12px rgba(255,107,138,0.4)` (For primary Soft Blush buttons)
- `shadow.secondary`: `0 2px 8px rgba(255,179,198,0.3)` (For secondary Blush Light buttons)
- `shadow.sos`: `0 6px 20px rgba(255,0,0,0.5)` (For SOS emergency controls)
- `shadow.wellness`: `0 4px 16px rgba(232,213,245,0.4)` (For Lavender wellness cards)

## Card & Panels Design

- **Standard Card**: Background: White or Warm Cream (`#FFF8F0`), Radius: 20px, Shadow: `shadow.soft`, Padding: 20px. Used for: predictions, stats, insights.
- **Highlight Card**: Background: Blush Light (`#FFB3C6`), Radius: 20px, Shadow: `shadow.secondary`, Padding: 20px. Used for: daily focus, promotions, mood log prompts.
- **SOS Card**: Background: SOS Emergency Gradient, Radius: 20px, Shadow: `shadow.sos`, Padding: 24px. Used for: critical safety actions.
- **Wellness Card**: Background: Lavender (`#E8D5F5`), Radius: 20px, Shadow: `shadow.wellness`, Padding: 20px. Used for: breathing guides, sentiment summaries.

## Input & Form Elements

- **Text Fields**: Border: 1px solid `#D4A5B5` (Mauve), Radius: 16px, Background: `#FDF8F5`, Height: 56px.
  - *Focus state*: Border transition to `#FF6B8A`, Shadow glow: `0 0 0 3px rgba(255,107,138,0.2)`.
- **Checkbox / Toggle**: Outline color `#D4A5B5`, Background when active `#FF6B8A`. Trigger light haptic vibration on state change.
- **Symptom Selectors (Multi-select)**: Border: 1px solid `#D4A5B5` (Mauve), Radius: 12px. Background: `#FFF` when selected (tinted to `#FFB3C6` Blush Light), `#FDF8F5` when inactive.

## Icons & Illustrations

- **Icons**: Outlined stroke-style icons (stroke width 1.5) using Feather or Phosphor sets. Touch target size min **44×44pt**.
  - *Active icon*: `#FF6B8A`
  - *Inactive icon*: `#D4A5B5`
  - *SOS icon*: `#FF0000`
  - *Wellness icon*: `#8A6E9B` (muted lavender)
- **Illustrations**: Hand-drawn style (e.g. Blush or Open Peeps library) on onboarding, empty states, and dashboard welcome cards.
- **Emojis**: Native emojis allowed for mood selectors, symptom tags, and custom notes to add warmth.
- **Floral Accents**: Subtle decorative floral SVG vectors overlaid in corners of page headers, splash, and transition screens.

## Micro-Interactions & Animations

- **Button Press**: Scale down to `0.96` on touch start, spring back to `1.0` on release (duration: 150ms).
- **Card Entrance**: Staggered fade-up with translation (+4px Y-axis) to keep layout responsive (duration: 300ms, easeOut).
- **Tab Switch**: Cross-fade transition with 8px horizontal slide (duration: 250ms, easeInOut).
- **SOS Countdown**: Continuous circular progress animation (duration: 2000ms, linear).
- **Save Success**: Scale bounce spring animation with a checkmark reveal (duration: 400ms).

## Accessibility (WCAG 2.1 AA)

- Minimum contrast ratio: **4.5:1** for body text (using Charcoal on Off-White), **3:1** for large title text.
- Use native accessibility elements: `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint`.
- Ensure font sizes scale dynamically using `allowFontScaling`.
- Color is never the sole conveyor of information (always supplement cycle status with icon or text descriptor).
