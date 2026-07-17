# Missing: Mood Analysis Trend SVG Graph

**Design Spec:** `mobile/UI_UX/Mood Analysis.md` (lines 79-81)
**Implemented File:** `mobile/src/screens/wellness/MoodLogScreen.tsx`

## Expected Behavior
- SVG Bezier curve line in Soft Blush
- Circles at each data point
- Y-axis: emoji labels, X-axis: 7-day labels
- Smooth curve connecting daily mood scores

## Current Status
Not implemented. No trend visualization exists.

## Implementation Notes
Create a `MoodTrendGraph` component using `react-native-svg`. Map 7 days of mood data to a smooth path. Add emoji labels on the Y-axis at min, mid, and max values.
