# Missing: Home Screen Empty State

**Design Spec:** `mobile/UI_UX/Home_Screen.md` (line 91)
**Implemented File:** `mobile/src/screens/home/HomeDashboardScreen.tsx`

## Expected Behavior
- "Welcome to SheCare" onboarding banner
- "Start Log" primary button
- Displayed when no cycle data exists

## Current Status
Not implemented. No onboarding or empty state banner exists.

## Implementation Notes
Add an `EmptyDashboardState` component above the card grid. Trigger it when the API returns no period logs. Navigate to period logging on button press.
