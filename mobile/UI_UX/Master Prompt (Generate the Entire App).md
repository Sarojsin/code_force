# SheCare — Complete App Specification

> Reference architecture tying together all UI_UX design files.

## Application Overview

AI-powered women's health and menstrual cycle tracking application built with React Native (TypeScript). Offline-first, premium feminine branding featuring a modern, soft design language.

## Screen Inventory (12 Screens)

| # | Screen | Route | Design File | Status |
|---|--------|-------|-------------|--------|
| 1 | Splash | (root → Auth/Main) | `Splash_Screen.md` | ✅ Updated |
| 2 | Authentication (Login/Register/Phone/OTP) | `Auth` stack | *(Global Design)* | ✅ Updated |
| 3 | Home Dashboard (Bento Grid) | `Main` → `Home` tab | `Home_Screen.md` | ✅ Updated |
| 4 | Calendar | `Main` → `Calendar` tab | `Calendar.md` | ✅ Updated |
| 5 | Menstrual Phases | `Cycle` → `PhaseDetail` | `Menstrual_Phases.md` | ✅ Updated |
| 6 | Analytics Dashboard | `Main` → `Analytics` tab | `Analytics.md` | ✅ Updated |
| 7 | AI Health Chat | `Main` → `AI Chat` tab | `AI_Chat.md` | ✅ Updated |
| 8 | Educational Videos | `Wellness` → `Videos` | `Video_Section.md` | ✅ Updated |
| 9 | Mood Tracking | `Wellness` → `MoodLog` | `Mood_Analysis.md` | ✅ Updated |
| 10 | AI Prediction | `Cycle` → `Predictions` | `Prediction_Screen.md` | ✅ Updated |
| 11 | Profile & Settings | `Main` → `Profile` tab | `Settings.md` | ✅ Updated |
| 12 | Onboarding | `Onboarding` stack | *(Splash_Screen.md)* | ✅ Updated |

## Navigation Architecture

```
RootNavigator
├── SplashScreen (conditional, first launch only)
├── AuthStack (unauthenticated)
│   ├── Login
│   ├── Register
│   ├── PhoneVerify
│   └── OTP
├── OnboardingStack (first login)
│   ├── Welcome
│   ├── PersonalInfo
│   ├── Lifestyle
│   └── CycleHistory
└── MainTabs (authenticated + onboarded)
    ├── Home Tab (Bento Dashboard)
    ├── Calendar Tab
    ├── Analytics Tab
    ├── AIChat Tab
    └── Profile Tab
        ├── ProfileHome
        └── Settings
```

## Key Architectural Decisions

1. **Bottom tabs** (5): Home, Calendar, Analytics, AI Chat, Profile
2. **State**: Zustand (app), TanStack Query (server), Encrypted AsyncStorage (persistent)
3. **Forms**: react-hook-form + zod validation (shared schemas with backend)
4. **Animations**: Reanimated 3 + react-native-gesture-handler
5. **Styling**: Theme tokens from `Global_Design_Prompt.md` — no hardcoded values
6. **Offline**: TanStack Query persist + offline action queue with background sync
7. **API**: All requests under `/api/v1/...`, response envelope `{ data, message }`

## Design Principles (Modern Girlish Design)

- **Layout Structure**: Bento grid layout for dashboards, glassmorphic panel details, and soft drop shadows on warm-cream surfaces.
- **Backgrounds**: Soft gradients cycling or fading between Blush Light and Warm Cream (`#FFB3C6 → #FFF8F0`).
- **Shapes & Rounded Corners**: Fully rounded buttons (`24px` radius), cards with `20px` radius, and input text fields with `16px` radius.
- **Visual Identity**: Warm, gentle, and emotionally supportive visual palettes:
  - Primary colors: Soft Blush (`#FF6B8A`), Blush Light (`#FFB3C6`), Rose Quartz (`#F7C5CC`), and Mauve (`#D4A5B5`).
  - Calming colors: Lavender (`#E8D5F5`), Mint (`#D4F0E0`), Warm Cream (`#FFF8F0`), and Soft Peach (`#FFDAB9`).
  - Neutrals: Charcoal (`#2D2D2D` for high contrast text) and Off-White (`#FDF8F5` for primary background).
- **Typography Hierarchy**: Elegant serifs (EB Garamond or Playfair Display) for titles and app logs; Inter for all reading text, labels, and small metadata.
- **Interactions**: Staggered cards entrance fade-up transitions and 150ms spring push-down interactions (scale `0.96`) on button clicks.
- **Accessibility Guidelines**: Minimum contrast ratio of 4.5:1 on text elements, full accessibility tags, and system type scaling.
