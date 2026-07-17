# Missing: Menstrual Phases Parallax Effect

**Design Spec:** `mobile/UI_UX/Menstrual_Phases.md` (line 86)
**Implemented File:** `mobile/src/screens/cycle/MenstrualPhasesScreen.tsx`

## Expected Behavior
- Background moves at 30% slower rate than foreground text during swipe
- Creates depth illusion across phase cards

## Current Status
Not implemented. Standard paging scroll without parallax.

## Implementation Notes
Use `react-native-reanimated` `useAnimatedScrollHandler` to drive a `translateY` on the background layer at `scrollY.value * 0.3`.
