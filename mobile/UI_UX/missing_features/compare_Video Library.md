# Compare: Video Library

**Design Spec File:** `mobile/UI_UX/Video_Section.md`
**Implemented File:** `mobile/src/screens/home/VideoLibraryScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Header | EB Garamond "Videos" + search icon (line 11) | h1 "Videos" + subtitle (line 90) | Partially — search icon in header is missing, search is inline below |
| Category chips - active | Solid Soft Blush #FF6B8A bg, white text (line 37) | Primary color bg, white text (lines 124-130) | OK (color is close enough) |
| Category chips - inactive | Transparent, 1.5px Mauve #D4A5B5 border, Charcoal text (line 38) | Surface bg, border colors.border, textPrimary (lines 124-130) | Different — wrong border color |
| Continue Watching banner | Warm Cream panel, 16px radius, Soft Blush gradient progress bar, Lavender empty track, swipe to dismiss (lines 42-44) | Not implemented | Missing entirely |
| Thumbnail 16:9 | 16:9 aspect ratio, 16px corner radius (lines 47-48) | 16:9 via aspectRatio: 16/9, radius.lg (16px) (line 59, 163) | Implemented |
| Play indicator | Centered translucent glass play circle with 12px blur (line 48-49) | Plain play triangle SVG icon (line 59-61) | Different — no glass blur effect |
| Duration badge | Blush Light #FFB3C6 bg, Charcoal text, floating on bottom-right (line 49) | Dark translucent rgba(0,0,0,0.7) bg, white text (line 62-64) | Different — entirely different styling |
| Search bar | 1px Mauve border, Off-White bg, Focus: Soft Blush border + recent searches (lines 53-55) | Surface bg, colors.border, no focus glow, no recent searches (lines 95-103) | Different — missing Mauve border and focus behavior |
| Video title | Inter 14px Bold Charcoal (line 50) | bodySmall (14px, fontWeight: '600') (line 66) | Close |
| Views/Date metadata | Inter 11px Warm Gray (line 50) | caption (12px) + muted color (lines 67-68) | Slightly different size |
| Loading state | Widescreen skeleton blocks shimmering (line 62) | Not implemented | Missing |
| Offline state | Previously watched active; online-only grayed + lock icon (line 63) | Not implemented | Missing |
| Recommended For You heading | Inter 18px (line 24 of spec) | Not explicitly rendered (videos show all) | Missing |

## Line-Specific Issues

- Line 7: The spec says the route is MainTabs → Home → Videos, but the VideoLibraryScreen is in `mobile/src/screens/home/` and is navigated to from the HomeStack. This is correct.
- Lines 31-41: All video data is hardcoded mock data.
