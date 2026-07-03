# Educational Video Library — YouTube-inspired Card UI

> Route: `MainTabs` → `Home` → `Videos` (or accessible from Home dashboard card)

## Layout

Health education video library with search, categories, and personalized recommendations.

```
┌─────────────────────────────────────┐
│  Videos                    🔍      │  <- Search icon (toggles search bar)
│  Learn & grow with expert content   │
├─────────────────────────────────────┤
│  [All] [Yoga] [Nutrition] [PCOS]    │  <- Horizontal scrollable chips
│  [Mental Health] [Exercise] [Sleep] │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ ┌───────┐                     │  │
│  │ │ ▶️    │  Yoga for Period    │  │  <- Continue Watching (large, with
│  │ │       │  Cramps Relief      │  │     progress bar overlay)
│  │ │ 12:34 │  Channel Name        │  │
│  │ └───────┘                      │  │
│  │ ████████████░░░░░░░ 60%        │  │  <- Progress bar
│  └───────────────────────────────┘  │
│                                     │
│  Recommended For You                │  <- Section header
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ ▶️  │ │ ▶️  │ │ ▶️  │ │ ▶️  │      │  <- 2-column grid thumbnails
│  │ Thm │ │ Thm │ │ Thm │ │ Thm │      │
│  │ Title│ │Title│ │Title│ │Title│      │
│  │ Views│ │Views│ │Views│ │Views│      │
│  └────┘ └────┘ └────┘ └────┘      │
│                                     │
│  Popular This Week                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ ▶️  │ │ ▶️  │ │ ▶️  │ │ ▶️  │      │
│  └────┘ └────┘ └────┘ └────┘      │
└─────────────────────────────────────┘
```

## Video Card Spec

| Property | Value |
|----------|-------|
| Width | 2-column grid (`48%` each) |
| Thumbnail ratio | 16:9 |
| Border radius | 16px |
| Play button overlay | Icon centered on thumbnail |
| Duration badge | Bottom-right of thumbnail: `12:34` |
| Title | 2 lines max, `bodySmall` semibold |
| Channel | 1 line, `caption` muted |
| Views + date | 1 line, `caption` muted |

## Category Chips

- Horizontal `FlatList` with snap
- Active chip: filled brand primary, white text
- Inactive chip: outlined border, muted text
- Spring animation on selection
- Chips: All (default), Yoga, Nutrition, PCOS, Mental Health, Exercise, Sleep, Pregnancy

## Search

- Animated search bar that expands on tap
- Debounced search (300ms)
- Results: filtered video grid with "No results" empty state
- Recent searches displayed below search bar

## Continue Watching

- Top section, single large card
- Shows progress bar overlay on thumbnail
- 1-3 items max (horizontal scroll if >1)
- "Resume" CTA
- Dismissible (swipe to remove)

## Sections

1. **Continue Watching** (if any videos in progress)
2. **Recommended For You** (AI-personalized based on cycle phase + interests)
3. **Popular This Week** (community-wide trending)
4. **New Releases** (most recently added)
5. **By Category** (when a specific chip is selected)

## Video Detail (on tap)

Navigates to a detail screen with:
- Full-screen video player (Expo Video)
- Title, description, channel info
- Related videos below

## States

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton grid with 6 thumbnail placeholders |
| **Empty search** | "No videos found" illustration + suggestion to try different keywords |
| **No category matches** | Empty section with "More coming soon" |
| **Error** | Toast + retry; cached data shown |
| **Offline** | Previously watched videos shown; new videos grayed with "Available online" |
