# Missing: Video Library "Recommended For You" Heading

**Design Spec:** `mobile/UI_UX/Video_Section.md` (line 24)
**Implemented File:** `mobile/src/screens/home/VideoLibraryScreen.tsx`

## Expected Behavior
- Section heading: "Recommended For You"
- Inter 18px font weight
- Separates curated recommendations from general list

## Current Status
Not explicitly rendered. Videos are shown in a flat list without section headers.

## Implementation Notes
Add a section header above the recommended videos subset. Filter videos by recommendation score from the API. Use `h3` typography variant.
