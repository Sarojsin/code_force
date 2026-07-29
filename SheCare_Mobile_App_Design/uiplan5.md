# uiplan5 — Screen Visual Overhauls

> **Phase 4 (core screens) + Phase 6 (pregnancy mode).** Largest phase.
> **Priority:** High/Medium
> **Files:** ~18 to modify, 1 to create

---

## 1. HomeDashboard — `mobile/src/screens/home/HomeDashboardScreen.tsx`

### 1.1 Background
- Change `#FFF8FB` → `#FFF8F0`
- Add top gradient: `radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,107,138,0.22) 0%, transparent 65%)` — use `expo-linear-gradient`

### 1.2 Replace header section

**Before:** Current header card with avatar and bell icon.  
**After:** Design header block:

```
┌──────────────────────────────────────┐
│ Sunday, 27 July                 🆘 [A]│  ← date (12px soft), SOS button (44px red bg), Avatar 44px
│ Good morning, Sofia ✨              │  ← 27px Playfair Display weight 800
└──────────────────────────────────────┘
```

### 1.3 NEW — Hero cycle card

Gradient card (borderRadius 26):
```
┌──────────────────────────────────────┐
│ ● CYCLE DAY 14 · OVULATION          │  ← pill: rgba(255,255,255,0.18) bg, 11px white, green dot
│                                     │
│  🌟 Ovulation Phase                 │  ← 24px Playfair Display
│  Peak vitality. Magnetic energy.    │  ← 13px white 88%
│                                     │
│                     ┌──────┐       │
│                     │  14  │       │  ← SVG ring 78×78, stroke white, animated offset
│                     │ / 28 │       │
│                     └──────┘       │
│ ─────────────────────────────────── │  ← 1px white 22% divider
│  Next period  │ Cycle avg │ Streak │  ← 3-column grid
│  14 days      │ 28 days   │ 3 mo   │
└──────────────────────────────────────┘
```

**Decorative circles:** Two absolutely-positioned circles (180px and 100px) with `rgba(255,255,255,0.07)` background at top-right and bottom-right of the hero.

### 1.4 Quick stats row — 2-column grid

| Left Card (lavender bg) | Right Card (mint bg) |
|---|---|
| Label: "NEXT PERIOD" | Label: "TODAY'S MOOD" |
| "14" days (36px Playfair) | Mood emoji 36px |
| Progress bar 50% | "Tap to log" |
| "Aug 10 · Predicted" | Green status dot + "Log feeling" |

### 1.5 NEW — Phase timeline strip

4 horizontal cards (menstrual, follicular, ovulation, luteal). Active phase gets accent background + white text + colored shadow.

### 1.6 AI Prediction card — restyle

Gradient bg (lavender → blush), AI icon 48×48 rounded 16 with lavender-purple gradient, "Next period predicted **Aug 10**" text, confidence badges ("● 94% CONFIDENCE", "● ON TRACK").

### 1.7 Quick action bento row — 2-column grid

| Card 1: AI Chat | Card 2: Journal |
|---|---|
| 44×44 icon with blush-lavender gradient + shadow | 44×44 icon with mint-green gradient + shadow |
| "Luna AI" title | "Journal" title |
| "Ask me anything about your health" | "Log symptoms & feelings" |

### 1.8 Analytics section — 3-month bar chart

3 bars (May, Jun, Jul) with cycle-day count and mood emoji. Current month bar gets blush gradient fill. Bottom: "📈 Average cycle: 28 days · Regularity score: 92%" green badge.

### 1.9 NEW — Wellness Videos carousel

Horizontal `ScrollView` with 4 cards: Cycle Nutrition (8min), Yoga for Cramps (15min), Better Sleep (6min), Mindful Eating (10min). Each card has 48×48 emoji icon, title, duration, phase badge.

---

## 2. Calendar — `mobile/src/screens/calendar/CalendarScreen.tsx`

### 2.1 Background
- `#FFF8F0` with `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,213,245,0.35) 0%, transparent 60%)`

### 2.2 Header restyle
```
‹    July 2025    ›    ← chevron buttons (44×44)
     Cycle Day 14 · Ovulation    ← 12px soft text
```

### 2.3 Phase legend
Horizontal row of 4 emoji pills (same design as home's phase timeline).

### 2.4 Day cells
- 46×46pt, borderRadius 14
- Selected: filled with phase accent color + shadow `0 4px 14px phaseAccent55`
- Today-not-selected: 2px `#FF6B8A` outline + 4px red dot below number
- Phase-colored background for each day

### 2.5 NEW — Day detail card (below grid)

When a day is selected, show:

```
┌──────────────────────────────┐
│  July 27     🌟 Ovulation   │  ← phase badge pill
│                              │
│  Peak vitality. Magnetic     │
│  energy.                     │
│                              │
│ [Log symptoms] [Add note]    │  ← action chips
│ [Log mood]                   │
└──────────────────────────────┘
```

### 2.6 NEW — Phase overview section (below detail)

4 cards, one per phase: emoji + phase name + date range badge + description. Background uses phase-specific bg color.

---

## 3. Wellness — `mobile/src/screens/wellness/WellnessHomeScreen.tsx`

### 3.1 Segmented tabs
- Rounded segmented control (borderRadius 18, padding 4)
- 3 tabs: "✨ Insights", "🌸 Mood", "🧘 Breathe"
- Active tab: gradient `#FF6B8A → #D4507A`, white text, shadow
- Inactive tab: no background, #A07888 text

### 3.2 Insights tab
- Luna quote card: lavender-rose gradient bg, italic Playfair Display quote, "Luna's Daily Insight" label
- 2×2 wellness metrics grid: Sleep (7.2h ↑), Hydration (6/8), Active Days (4/7 ↑), Stress Score (3.2/5 ↓)
- Recommendations card: 3 rows with emoji + description + category badge

### 3.3 Mood tab
- Weekly bar chart: 7 bars with mood emoji above, gradient fill for today
- Mood insight card: italic Playfair insight + chip counts ("✨ Radiant 3×", "🌸 Calm 2×")

### 3.4 Breathing tab
Replace list with design cards: 56×56 rounded icon, name, description, duration chip (⏱ 5 min), play button.

---

## 4. Journal Entry — `mobile/src/screens/wellness/JournalEntryScreen.tsx`

### 4.1 Header
- "SUNDAY · JULY 27, 2025" label (11px, 700, letter-spacing)
- "Today's Entry" title (28px Playfair Display)

### 4.2 Mood selector
Replace with design's 3-column mood grid (see uiplan2 §3).

### 4.3 Energy level
NEW row: 5 emoji buttons (🪫😴😊⚡🚀) in a row. Active gets gradient fill `#FF6B8A → #D4507A`, scale 1.08, shadow.

### 4.4 Symptom pills
Use updated `SymptomGrid` component. Show "3 symptoms logged" count below.

### 4.5 Journal textarea
- No border, transparent bg
- Placeholder: italic, 15px, `#A07888`
- Auto sentiment badge at top-right: "🤖 Positive vibes ✨" or "Neutral tone"
- Character count bottom-left
- Photo/Voice attachment buttons bottom-right

### 4.6 Save button
"💾 Save Entry" primary button + "📖 View Past Entries" ghost button below.

---

## 5. SOS — `mobile/src/screens/safety/SafetyHomeScreen.tsx` + `SOSActiveScreen.tsx`

### 5.1 SafetyHomeScreen

| Aspect | Current | Target |
|---|---|---|
| SOS button | RN `Button` label | 180×180 circle, gradient #FF4444→#DC2626 |
| Pulsing rings | none | 2 expanding rings (Reanimated loop) |
| Button content | "SOS — Emergency Alert" | "🆘" 42px + "SOS" 22px weight 900 |
| Contacts | Card with text | 3 contact rows with gradient circle avatars, phone call button |
| Add contact | Outline button | Dashed border button "+ Add Contact" |
| Background | `theme.colors.background` | Radial gradient blush tint at top |
| Header | "Safety" h1 | "Safety Centre" 28px Playfair + subtitle "You are safe..." |

### 5.2 SOSActiveScreen — countdown phase

| Aspect | Current | Target |
|---|---|---|
| Countdown display | 96px bold | 54px bold, conic SVG ring |
| Background | `theme.colors.danger` | Full red gradient `#7F0000 → #C0392B → #8B1A1A` |
| Animation | Standard countdown | Conic progress ring with stroke-dashoffset |

### 5.3 SOSActiveScreen — active phase

| Aspect | Current | Target |
|---|---|---|
| Background | `theme.colors.danger` | Red gradient |
| Contact rows | Text-based | 3 contacts: circle avatar, name, relationship, "Notified ✓" |
| Buttons | Standard `Button` | "I'm Safe — Cancel Alert" (outline white) + "📞 Call Emergency Services" (white bg, red text) |
| SOS label | "SOS ACTIVE" | "SOS Alert Sent" + 🚨 emoji 72px |

---

## 6. Settings — `mobile/src/screens/profile/SettingsScreen.tsx`

### 6.1 Profile hero card

```
┌──────────────────────────────────┐
│  ┌────┐                          │
│  │  S │ ✏️                    │  ← Avatar 60px + edit button
│  └────┘                          │
│  Sofia Adeyemi                   │  ← 21px Playfair Display
│  sofia@shecare.app               │  ← 13px 82% opacity
│  ✨ Premium    🔥 3-month streak │  ← pills: rgba(255,255,255,0.22) bg
└──────────────────────────────────┘
```

Gradient bg: `linear-gradient(135deg, #FF6B8A, #D4507A, #A83060)`, decorative circle, borderRadius 26.

### 6.2 Section groups

Replace plain card with sectioned layout:

```
NOTIFICATIONS  ← 10px weight 800 letter-spacing label
┌──────────────────────────────┐
│ 🔔 Push Notifications   [≡]│  ← 14px weight 700 label
│     All alerts and reminders│  ← 12px soft sub
│──────────────────────────────│
│ 📅 Period Reminders     [≡]│
│     3 days before predicted │
│──────────────────────────────│
│ 🤖 Luna AI Insights     [≡]│
│     Daily at 8:00 AM        │
│──────────────────────────────│
│ 🤰 Pregnancy Mode       [≡]│  ← conditionally shown
│     Track trimester...      │
└──────────────────────────────┘
```

### 6.3 Toggle switches

Replace `Switch` with custom `Toggle` component from uiplan2.

### 6.4 Sign out button
- Border: `1.5px solid rgba(239,68,68,0.28)`
- Background: `rgba(239,68,68,0.06)`
- Text: `#EF4444`, weight 700
- BorderRadius: 16

---

## 7. Pregnancy Home — `mobile/src/screens/pregnancy/PregnancyHomeScreen.tsx`

**Replace placeholder** with full implementation:

### 7.1 Header
- "You're pregnant 💗" (12px soft)
- "Week {X}" (27px Playfair Display)
- 52×52 circle with 🤰 emoji

### 7.2 Hero card
- Gradient: `#FFB3C6 → #FF6B8A`
- "TRIMESTER {N}" pill
- "Baby is the size of a {fruit} 🍓"
- Description text

### 7.3 Quick actions — 2×2 grid
Kick Counter 🦶, Log Symptoms 📝, Checkups 📅, Milestones 📚 — each as colored Card with icon.

### 7.4 Week progress card
- "WEEK PROGRESS" label
- Progress bar (week/40)
- "Prev week" / "Next week" buttons

### 7.5 Trimester info card
Dynamic description based on trimester.

---

## 8. Onboarding Screens — `mobile/src/screens/onboarding/*.tsx`

### 8.1 Shared visual changes (all 6 screens)

| Aspect | Current | Target |
|---|---|---|
| Background | Solid color | Per-step radial gradients (from design) |
| Progress | `ProgressDots` | Updated component with "STEP X OF 6" label |
| Icon | Inline emoji | 100×100 rounded gradient container with shadow + floating animation |
| Title font | `h2` or `h1` | 28px Playfair Display weight 800 |
| Animation | None | Spring in on icon, staggered fade-up on content |

### 8.2 WelcomeScreen — step 0

Add feature highlight cards:
```
┌─────────────────────────────┐
│ 🔒 Encrypted & private       │
│    Your data never leaves... │
├─────────────────────────────┤
│ 🤖 AI-powered predictions    │
│    Learns your unique...     │
├─────────────────────────────┤
│ 🆘 Emergency SOS             │
│    One tap alerts...         │
├─────────────────────────────┤
│ 🌿 Holistic wellness          │
│    Cycle, mood, sleep...     │
└─────────────────────────────┘
```

CTA: "🌸 Get Started" button. "Already have an account? **Sign in**" link.

### 8.3 PersonalInfo — step 1

- Fields: Age (number), Height/Weight (2-column grid)
- Add "CONTRACEPTION" chip group: None, Pill, IUD, Implant, Other

### 8.4 Lifestyle — step 2

- Stress: 4 emoji buttons (🧘😌😤🌋) with labels, selected = gradient fill
- Exercise: Slider 0–7 with tick marks below, label "EXERCISE DAYS / WEEK — 3"
- Sleep: Chip group: <5h, 5–6h, 6–7h, 7–8h, >8h

### 8.5 CurrentCycle — step 3

- "YOUR CYCLE" section title
- 2-column: Cycle Length (days) + Period Length (days)
- "LAST PERIOD START DATE" input
- "COMMON SYMPTOMS" chip grid

### 8.6 PastCycle — step 4

3 past cycle cards: month name, length (days), flow chip, pain level. Use `anim-up anim-d1..3` staggered entrance.

### 8.7 Complete — step 5

- 110×110 circle with 3-color gradient (blush → lavender → mint), "✨" emoji, breathing animation
- 4 checkmark cards: ✓ Cycle tracking ready, ✓ AI insights activated, ✓ Safety features enabled, ✓ Wellness journal open
- CTA: "Enter SheCare ✨"

---

## 9. Verify

1. Home: hero card renders with animated cycle ring, stats strip appears, widgets match design
2. Calendar: day cells 46×46, phase pills render, day detail card appears on selection
3. Wellness: segmented tabs work, insights/mood/breathing tabs match design layout
4. Journal: mood grid is 3-column with per-mood colors, sentiment badge works
5. SOS: 180px pulsing button, countdown conic ring, active red gradient state
6. Settings: profile hero with gradient, toggles are custom components, pregnancy mode toggle
7. Pregnancy: week selector works, baby size updates with week, hero card renders
8. Onboarding: all 6 steps render with correct backgrounds, icons, stagger entrance
9. `npx tsc --noEmit` — zero errors
