# Missing: Video Library Offline State

**Design Spec:** `mobile/UI_UX/Video_Section.md` (line 63)
**Implemented File:** `mobile/src/screens/home/VideoLibraryScreen.tsx`

## Expected Behavior
- Previously watched videos remain active
- Online-only videos grayed out with lock icon
- Offline banner indicator

## Current Status
Not implemented. No offline handling exists.

## Implementation Notes
Track watch history locally. Use NetInfo to determine connectivity. Gray out unavailable videos and show a lock icon overlay.
