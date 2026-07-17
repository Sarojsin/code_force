# Settings & Profile — Grouped Soft Cards Design

> Route: `MainTabs` → `Profile` → `Settings`

## Layout & Aesthetics

A grouped card menu layout based on an Off-White (`#FDF8F5`) canvas. Option groups are gathered into rounded, Warm Cream (`#FFF8F0`) panels with soft drop shadows, minimal outlined icons, and clear text hierarchies.

```
┌──────────────────────────────────────────┐
│  Settings                                │  <- Title: EB Garamond, 24px
├──────────────────────────────────────────┤
│  ┌─ Profile Summary ──────────────────┐  │  <- Profile summary grouped card
│  │  [Avatar]  [Name]                  │  │     (Avatar with Blush Light border)
│  │            you@email.com           │  │
│  │  ────────────────────────────────  │  │
│  │  > Personal Details                │  │  <- Option item indicator (>)
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ Notifications & Reminders ────────┐  │
│  │  Push Notifications          [toggle]│  │  <- Toggles switch uses Soft Blush when active
│  │  Quiet Hours (10PM - 6AM)     [toggle]│  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ Security & Data ──────────────────┐  │
│  │  Biometric Lock (FaceID)     [toggle]│  │
│  │  > Export Health Data              │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ Device Configuration ─────────────┐  │
│  │  Dark Mode                   [toggle]│  │
│  │  App Language            > English │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │          [ Log Out ]               │  │  <- Ghost outline button (Soft Blush)
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Section Card & Row Specifications

- **Group Card Background**: Warm Cream (`#FFF8F0`)
- **Group Card Corner Radius**: `16px` (radius.lg)
- **Group Card Shadow**: `shadow.soft` (`0 4px 16px rgba(0,0,0,0.06)`)
- **Dividers**: Muted hairline divider in Mauve (`#D4A5B5` at 0.25 opacity) separating individual rows.
- **Row Minimum Height**: 48px to satisfy target sizing requirements.

---

## Option Row Component Specs

- **Icons**: Outlined stroke width 1.5 icons in Mauve (`#D4A5B5`).
- **Option Text**: Inter (15px, Charcoal `#2D2D2D`).
- **Boolean Switches (Toggles)**: Active thumb background is Soft Blush (`#FF6B8A`), inactive background is Warm Gray (`#8A8A8A` at 0.2 opacity).
- **Navigation Indicators (Disclosure)**: A right-aligned chevron `>` colored in Mauve (`#D4A5B5`).

---

## Screen-Specific Features

### 1. Profile Summary Card (Top Row)
- **User Avatar**: Rounded circle (`64px` diameter) with a `3px` solid Blush Light (`#FFB3C6`) border.
- **UserInfo**: Username in Inter (18px, Bold, Charcoal) and email address in Inter (12px, Warm Gray).

### 2. Notifications & Reminders
- Custom toggle switches for cycle logging prompts and wellness reminders.
- Granular quiet hours setting (opens a native bottom time picker).

### 3. Privacy & Security
- **Biometric Toggle**: Connects to native FaceID/Fingerprint sensor API.
- **Export Data**: Triggers secure download script.
- **Delete Account Row**: Font colored in SOS Red (`#FF0000`) with a confirmation prompt: *"Are you sure? This action is permanent."*

### 4. Logout Action
- **Style**: Ghost outline button at the bottom of the screen.
- **Border**: `2px solid #FF6B8A` (Soft Blush).
- **Text**: Inter (15px, Bold, Soft Blush `#FF6B8A`).
- **Interaction**: Trigger spring scale `0.96` on touch. Clears secure Zustand states and local caches on confirmation.
