# Missing: Prediction Screen's History Comparison Table

**Design Spec:** `mobile/UI_UX/Prediction Screen.md` (lines 79-83)
**Implemented File:** `mobile/src/screens/cycle/CyclePredictionsScreen.tsx`

## Expected Behavior
- A comparison table showing Month, Predicted date, and Actual date
- Color-coded rows indicating prediction accuracy
- Historical view of past predictions vs actual cycle starts

## Current Status
Not implemented. Only the next period countdown is shown; no history table exists.

## Implementation Notes
Create a `PredictionHistoryTable` component that fetches past predictions from the API and renders a three-column table. Color rows green for accurate predictions, amber for close predictions, and red for significant deviations.
