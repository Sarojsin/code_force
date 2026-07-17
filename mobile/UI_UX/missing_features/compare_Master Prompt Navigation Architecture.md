# Compare: Master Prompt / Navigation Architecture

**Design Spec File:** `mobile/UI_UX/Master Prompt (Generate the Entire App).md`
**Implemented Files:** `mobile/src/navigation/MainTabs.tsx`, `mobile/src/navigation/types.ts`, `mobile/src/navigation/RootNavigator.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Bottom tabs (5) | Home, Calendar, Analytics, AI Chat, Profile (line 53) | Home, Calendar, Analytics, AIChat, Profile (lines 89-113) | Implemented — names match |
| Tab bar style | Glassmorphic floating navigation (line 40 of Home_Screen.md) | Solid surface background with top border (lines 77-84 of MainTabs.tsx) | Different — no glassmorphism, no floating effect |
| Active tab icon | #FF6B8A (Global spec line 87) | theme.colors.primary (#FF5C8A) (line 75) | Close |
| Inactive tab icon | #D4A5B5 (Global spec line 88) | theme.colors.textMuted (#7B8194) (line 76) | Different — gray instead of mauve |
| Tab bar label font | Inter 11px Medium 500 (line 46 of Global) | fontSize 11, fontWeight '600' (line 85) | Different weight — 600 instead of 500 |
| Tab icons | Outlined stroke-style (stroke width 1.5) (Global spec line 86) | strokeWidth: 1.8 (inactive) / 2.2 (active) (line 24) | Different |
| Splash navigator flow | Splash → Auth/Onboarding/Main (line 30) | Splash → Auth/Onboarding/Main (RootNavigator.tsx lines 47-68) | Implemented correctly |
| Auth screens | Login, Register, PhoneVerify, OTP (line 33) | Login, Register, Phone, Otp, Mfa (types.ts lines 4-9) | Close — extra Mfa screen |
| Onboarding screens | Welcome, PersonalInfo, Lifestyle, CycleHistory (line 37) | Welcome, PersonalInfo, Lifestyle, CurrentCycle, PastCycle1-3, Complete (types.ts lines 93-102) | More screens — implementation has 8 screens vs 4 spec'd |
| SOS tab | Referenced as part of bottom tabs in some plans, but not in Master Prompt's 5-tab list | Safety stack exists in types (SafetyStackParamList) but not as a tab | Missing tab |
| Pregnancy tab | Referenced in frontend rules but not in Master Prompt's 5-tab list | Pregnancy stack exists in types but not as a tab | Not a tab (as per spec) |
| Navigation type for PhaseDetail | Route: Cycle → PhaseDetail (Menstrual_Phases spec line 3) | PhaseDetail accessible from both CalendarStack and HomeStack (types.ts lines 61, 76) | Implemented |
| Route for Videos | Route: Wellness → Videos (Video_Section spec line 3) | Videos accessible from HomeStack (types.ts line 64) | Different — from Home, not Wellness |
| Route for Mood Log | Route: Wellness → MoodLog (Mood Analysis spec line 3) | MoodLog accessible from HomeStack + WellnessStack (types.ts lines 15, 62) | Different — from Home, not Wellness |
| Route for Predictions | Route: Cycle → Predictions (Prediction Screen spec line 3) | CyclePredictions accessible from HomeStack + CalendarStack (types.ts lines 63, 80) | Different — from Home, not Cycle |
| Staggered card entrance | 60ms delay between cards (Master spec line 71) | Delays: 0, 50, 100, 150, 200, 250, 300, 350ms | Different delays |
