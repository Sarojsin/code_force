# Missing: Settings Profile Summary Card

**Design Spec:** `mobile/UI_UX/Settings.md` (lines 63-64)
**Implemented File:** `mobile/src/screens/profile/SettingsScreen.tsx`

## Expected Behavior
- 64px avatar with 3px Blush Light border
- Name in Inter 18px Bold
- Email in Inter 12px Warm Gray
- "Personal Details" link

## Current Status
Not implemented. No profile summary card exists at the top of the Settings screen.

## Implementation Notes
Add a `ProfileSummaryCard` component at the top of the Settings screen. Fetch user profile data from the API and display it with the specified typography and spacing.
