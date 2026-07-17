# Missing: Analytics Dashboard's Empty State

**Design Spec:** `mobile/UI_UX/Analytics.md` (lines 81-84)
**Implemented File:** `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx`

## Expected Behavior
- Hand-drawn illustration displayed in the empty state
- Headline text: "Patience is beautiful"
- Subtext: "Log at least 3 cycles"
- CTA button: "Log Today's Symptoms"

## Current Status
Not implemented. The screen does not render an empty state when there is insufficient data.

## Implementation Notes
Add an `EmptyState` component that appears when `MOCK_STATS` or real API data indicates no analytics are available yet. The illustration should be a hand-drawn SVG asset. The button should navigate to the symptom logging flow.
