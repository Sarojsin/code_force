# SheCare — Complete App Specification

> Reference architecture tying together all 12 UI_UX design files.

## Application Overview

AI-powered women's health and menstrual cycle tracking application built with React Native (TypeScript). Offline-first, premium healthcare branding.

## Screen Inventory (12 Screens)

| # | Screen | Route | Design File | Status |
|---|--------|-------|-------------|--------|
| 1 | Splash | (root → Auth/Main) | `Splash_Screen.md` | ❌ Missing |
| 2 | Authentication (Login/Register/Phone/OTP) | `Auth` stack | *(Global Design)* | ✅ Partial |
| 3 | Home Dashboard (Bento + Glassmorphism) | `Main` → `Home` tab | `Home_Screen.md` | ❌ Missing |
| 4 | Calendar | `Main` → `Calendar` tab | `Calendar.md` | ⚠️ Partial |
| 5 | Menstrual Phases | `Cycle` → `PhaseDetail` | `Menstrual_Phases.md` | ❌ Missing |
| 6 | Analytics Dashboard | `Main` → `Analytics` tab | `Analytics.md` | ⚠️ Partial |
| 7 | AI Health Chat | `Main` → `AI Chat` tab | `AI_Chat.md` | ❌ Missing |
| 8 | Educational Videos | `Wellness` → `Videos` | `Video_Section.md` | ❌ Missing |
| 9 | Mood Tracking | `Wellness` → `MoodLog` | `Mood_Analysis.md` | ⚠️ Partial |
| 10 | AI Prediction | `Cycle` → `Predictions` | `Prediction_Screen.md` | ⚠️ Partial |
| 11 | Profile & Settings | `Main` → `Profile` tab | `Settings.md` | ⚠️ Partial |
| 12 | Onboarding | `Onboarding` stack | *(Global Design)* | ✅ Partial |

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

## Design Principles

- Bento grid layout for dashboards, glassmorphism for feature cards
- Rounded corners (20–28px) on premium elements
- Soft pink, lavender, peach, mint color palette from design tokens
- Generous whitespace, minimal clutter
- Smooth spring animations on all interactions
- Accessible typography with dynamic type support
- Dark mode without layout shifts
