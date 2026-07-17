# Missing: Home Screen Error State

**Design Spec:** `mobile/UI_UX/Home_Screen.md` (line 90)
**Implemented File:** `mobile/src/screens/home/HomeDashboardScreen.tsx`

## Expected Behavior
- Alert text: "Could not reload dashboard"
- Retry button to refetch data
- Friendly error presentation

## Current Status
Not implemented. Only `console.warn` is used on error.

## Implementation Notes
Add an error boundary or error state variable. Render a retryable alert banner when the dashboard fetch fails. Use `react-native-toast-message` or an inline alert component.
