# Missing: Home Screen Analytics Card

**Design Spec:** `mobile/UI_UX/Home_Screen.md` (lines 36-38)
**Implemented File:** `mobile/src/screens/home/HomeDashboardScreen.tsx`

## Expected Behavior
- "Analytics Trend" card in row 3
- Mini SVG sparkline chart showing cycle trend
- Positioned alongside AI Chat and Videos cards

## Current Status
Not implemented. The analytics card is replaced by a "Wellness Hub" chip row.

## Implementation Notes
Replace the Wellness Hub row with an Analytics Trend card. Use `react-native-svg` to render a mini sparkline. Fetch recent cycle data from the API.
