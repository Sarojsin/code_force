# Missing: Analytics Filter Dropdown

**Design Spec:** `mobile/UI_UX/Analytics.md` (line 11)
**Implemented File:** `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx`

## Expected Behavior
- Filter button in header
- Dropdown to select time range (e.g., 3 months, 6 months, 1 year)
- Updates chart data on selection

## Current Status
Not implemented. No filter control exists in the header.

## Implementation Notes
Add a `Button` with a dropdown chevron in the header. Use a `Modal` or `BottomSheet` for the filter options. Refetch analytics data with the selected time range parameter.
