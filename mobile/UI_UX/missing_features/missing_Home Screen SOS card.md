# Missing: Home Screen SOS Card

**Design Spec:** `mobile/UI_UX/Global_Design_Prompt.md` (line 75)
**Implemented File:** `mobile/src/screens/home/HomeDashboardScreen.tsx`

## Expected Behavior
- Prominent SOS card on the dashboard
- Emergency action trigger
- High-visibility red styling per global spec

## Current Status
Not implemented. No SOS card exists on the Home screen.

## Implementation Notes
Add an `SOSCard` component as the first or last item in the dashboard grid. Use `danger` color tokens. Wire to the Safety module's emergency flow.
