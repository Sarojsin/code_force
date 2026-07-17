# Missing: Video Library's "Continue Watching" Banner

**Design Spec:** `mobile/UI_UX/Video_Section.md` (lines 42-44)
**Implemented File:** `mobile/src/screens/home/VideoLibraryScreen.tsx`

## Expected Behavior
- Warm Cream panel with 16px border radius
- Soft Blush gradient progress bar
- Lavender empty track
- Swipe-to-dismiss gesture

## Current Status
Not implemented. The banner is entirely absent from the video list.

## Implementation Notes
Add a horizontally scrollable banner at the top of the video list. Track watch progress via the API. Implement swipe-to-dismiss using `react-native-gesture-handler`.
