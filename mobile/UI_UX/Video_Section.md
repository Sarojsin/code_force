# Educational Video Library — Modern Card UI

> Route: `MainTabs` → `Home` → `Videos` (also accessible from dashboard link)

## Layout & Aesthetics

An intuitive video resource library styled on an Off-White (`#FDF8F5`) canvas. It contains horizontal scroll filters, highlighted continue-watching banners, and a two-column grid layout for video thumbnails, utilizing Soft Blush and Mauve accents.

```
┌──────────────────────────────────────────┐
│  Videos                          [Search]│  <- Header: EB Garamond, search icon button
│  Learn & grow with expert content        │
├──────────────────────────────────────────┤
│  [ All ] [ Yoga ] [ Nutrition ] [ PCOS ] │  <- Category chips (Soft Blush active chips)
├──────────────────────────────────────────┤
│  ┌─ Continue Watching ────────────────┐  │
│  │  ┌───────────┐ Yoga for Period     │  │  <- Single item large card, Soft Blush progress bar
│  │  │  [Play]   │ Cramps Relief       │  │
│  │  │   12:34   │ Channel Name        │  │
│  │  └───────────┘                     │  │
│  │  ████████████░░░░░░░░░░ 60%        │  │  <- Progress indicator
│  └────────────────────────────────────┘  │
│                                          │
│  Recommended For You                     │  <- Heading: Inter, 18px
│  ┌──────────────┐  ┌───────────────┐     │
│  │ [Thumbnail]  │  │ [Thumbnail]   │     │  <- Two-column grid (rounded 16px thumbnails)
│  │ Title        │  │ Title         │     │
│  │ Views • Date │  │ Views • Date  │     │
│  └──────────────┘  └───────────────┘     │
└──────────────────────────────────────────┘
```

## Component Details

### 1. Category Chips
- **Aesthetic**: Horizontal scrollable FlatList.
- **Active State**: Solid Soft Blush (`#FF6B8A`) background with White text, `12px` rounded corners.
- **Inactive State**: Transparent background, 1.5px solid Mauve (`#D4A5B5`) border, and Charcoal (`#2D2D2D`) text.
- **Transition**: Soft spring scale bounce on tap.

### 2. Continue Watching Banner (Top row)
- **Background**: Warm Cream (`#FFF8F0`) panel, `16px` radius, `shadow.soft`.
- **Progress Track**: Active bar fill uses the Soft Blush gradient (`#FF6B8A → #FF5277`), while the empty track is Lavender (`#E8D5F5`).
- **Dismiss Interaction**: Users can swipe left on the card to dismiss/archive the watch state.

### 3. Video Thumbnail Card (Two-column Grid)
- **Aspect Ratio**: 16:9 widescreen format, with `16px` corner radius.
- **Play Indicator Overlay**: Centered translucent glass play circle (`background: rgba(255,255,255,0.4)` with 12px blur).
- **Duration Badge**: Floating on the bottom-right. Background is Blush Light (`#FFB3C6`) with Charcoal (`#2D2D2D`) text.
- **Text Styling**: Video title in Inter (14px, Bold, Charcoal `#2D2D2D`), views/date metadata in Inter (11px, Warm Gray `#8A8A8A`).

### 4. Search Bar
- **Border**: 1px solid Mauve (`#D4A5B5`) on an Off-White (`#FDF8F5`) text bar.
- **Corners**: Rounded `16px` (radius.lg).
- **Focus Glow**: Changes border to Soft Blush (`#FF6B8A`) and displays recent search recommendations in Blush Light chips.

---

## Screen States

| State | Behavior |
|-------|----------|
| **Loading** | Widescreen skeleton blocks shimmering in grid formation. |
| **Offline** | Previously watched/downloaded educational items remain active; online-only streams are grayed out with a small Mauve lock icon overlay. |
