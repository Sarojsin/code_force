# Missing: Settings Logout Button

**Design Spec:** `mobile/UI_UX/Settings.md` (lines 76-78)
**Implemented File:** `mobile/src/screens/profile/SettingsScreen.tsx`

## Expected Behavior
- Ghost outline style with 2px Soft Blush border
- Inter 15px Bold text
- Scale to 0.96 on touch (spring animation)
- Full-width at bottom of screen

## Current Status
Not implemented. No dedicated logout button exists.

## Implementation Notes
Add a full-width `Button` at the bottom of the Settings screen with `variant="outline"`. Apply `withSpring(0.96)` on press using Reanimated. Clear auth tokens and navigate to the login screen on confirmation.
