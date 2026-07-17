# Missing: Calendar Offline State

**Design Spec:** `mobile/UI_UX/Calendar.md` (line 69)
**Implemented File:** `mobile/src/screens/calendar/CalendarScreen.tsx`

## Expected Behavior
- Local log displayed from encrypted storage
- Sync toast notification when connection resumes
- Offline banner indicator

## Current Status
Not implemented. No offline handling exists.

## Implementation Notes
Use `@react-native-community/netinfo` to detect connectivity. Store logs in `react-native-encrypted-storage`. Show a toast when sync completes. Queue mutations for later sync.
