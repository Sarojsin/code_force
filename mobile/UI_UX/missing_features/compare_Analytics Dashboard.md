# Compare: Analytics Dashboard

**Design Spec File:** `mobile/UI_UX/Analytics.md`
**Implemented File:** `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Header | EB Garamond "Analytics" + filter dropdown (line 11) | h1 "Analytics" + subtitle (line 116) | Partially — no filter dropdown button |
| Avg Cycle card | Warm Cream #FFF8F0, 20px radius, Inter 12px title, EB Garamond 28px value, trend indicator (lines 46-48) | Card with h2 value and caption label (lines 121-123) | Different — wrong font sizes, no trend indicator, wrong card style |
| Avg Period card | Same style as avg cycle with trend indicator | Only number + label (lines 125-127) | Missing trend indicator |
| Cycle Length chart | SVG Bezier curve, Soft Blush 3px line, Blush Light gradient fill 0.3→0 opacity, gray grid lines, dashed Mauve average (lines 51-53) | Line path + gradient fill implemented (lines 62-76), but no grid lines, no dashed average baseline | Partially — missing grid lines and average baseline |
| Prediction Accuracy | Lavender #E8D5F5 inactive track, Soft Blush gradient active arc (line 56) | Border color for inactive (line 90), primary color for active (line 92) | Different — uses colors.border (gray) instead of Lavender for inactive track |
| Mood Trend card | Lavender #E8D5F5 background panel, dominant emoji in circular avatar, 7-day mini sparkline (lines 60-61) | Standard white Card with emoji text and avg score (lines 142-146) | Different — no lavender background, no sparkline, no circular avatar |
| Symptoms bar chart | Mauve #D4A5B5 to Blush Light #FFB3C6 gradient fill, Off-White #FDF8F5 track (lines 64-65) | 5 different BAR_COLORS (line 38), standard border color for track (line 155) | Different — uses multiple colors instead of single gradient |
| Sleep & Stress | Mint #D4F0E0 for sleep bar, Mauve #D4A5B5 for stress bar, muted lavender moon icon, soft gold lightning bolt (lines 68-69) | Sleep: accent color (line 169), Stress: warning color (line 176) | Different colors — no icons used |
| Stat Card value font | EB Garamond 28px Charcoal (line 47) | h2 (Inter 20px) with color: 'primary' (line 122) | Different — wrong font family and color |
| Empty state | Hand-drawn illustration, "Patience is beautiful" headline, "Log at least 3 cycles" subtext, "Log Today's Symptoms" button (lines 81-84) | Not implemented | Missing |
| Loading state | Staggered shimmer placeholders (line 75) | Not implemented | Missing |
| Filter dropdown | Filter button in header (line 11) | Not implemented | Missing |
| Data source | Real data from API | All mock data (MOCK_STATS, MOCK_CYCLE_DATA, MOCK_SYMPTOMS, etc.) (lines 17-36) | Entirely mocked |

## Line-Specific Issues

- Line 18: `moodScore: 7.2` but the spec says average mood should be shown as 7.2/10 with a sparkline (line 27). The sparkline is missing.
- Line 185: `paddingHorizontal: 24` but the chart component uses `SCREEN_WIDTH - 64` which accounts for 32px padding, creating a mismatch.
