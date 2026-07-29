# SheCare Mobile App — Adopt Design-Website UI/UX Prompt

> Use this prompt to bring the **SheCare_Mobile_App_Design** website's visual language, component patterns, and interaction design into the actual React Native mobile app (`/mobile`). It maps every design-system decision from the web demo to equivalent React Native implementations.

---

## 1. Brand & Visual Identity

### 1.1 Color Tokens (Exact Hex Values)

| Token | Hex | Usage in Design Website | Mobile Equivalent |
|-------|-----|------------------------|-------------------|
| `blush` | `#FF6B8A` | Primary actions, active tabs, hero gradients, accents | `colors.primary` |
| `blushLight` | `#FFB3C6` | Soft backgrounds, hover states, chip active fills | `colors.primaryLight` |
| `roseQuartz` | `#F7C5CC` | Subtle highlights, borders, card accents | `colors.accent` |
| `mauve` | `#D4A5B5` | Secondary chips, labels, muted decorative elements | `colors.accent` |
| `lavender` | `#E8D5F5` | Phase cards, wellness cards, gradient accents | `colors.accentLight` |
| `mint` | `#D4F0E0` | Success states, wellness metrics, positive indicators | `colors.success` |
| `cream` | `#FFF8F0` | Page background, card surfaces | `colors.background` |
| `dark` | `#2D1B26` | Primary text, headings | `colors.textPrimary` |
| `mid` | `#6B4D5A` | Secondary text, labels | `colors.textSecondary` |
| `soft` | `#A07888` | Helper text, timestamps, captions | `colors.textMuted` |
| `lighter` | `#C9A8B8` | Inactive nav labels, subtle dividers | `colors.textMuted` |
| `red` | `#EF4444` | SOS button, danger states | `colors.danger` |
| `redDark` | `#DC2626` | SOS active state, emergency actions | `colors.danger` |

**Rule:** Every mobile screen must use these tokens. No hardcoded colors outside theme tokens.

### 1.2 Typography Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 32 | 700 | 38 | Hero numbers, countdown timers |
| `h1` | 24–28 | 800 | 30–34 | Screen titles, greeting headers |
| `h2` | 20–22 | 700 | 26–28 | Card titles, section headers |
| `h3` | 17–18 | 600 | 24 | Subsection headers |
| `body` | 15–16 | 400 | 22–26 | Body text, form labels |
| `bodySmall` | 13–14 | 400 | 20 | Secondary text, captions |
| `caption` | 11–12 | 400 | 16 | Helper text, timestamps |
| `button` | 15–16 | 700 | 20 | Button labels |
| `tab` | 10–11 | 500 | 14 | Bottom tab labels |

**Fonts:**
- **Headings**: Playfair Display (serif) — use `fontFamily: 'Playfair Display'`
- **Body**: Inter (sans-serif) — use `fontFamily: 'Inter'`
- **Mono**: SF Mono or JetBrains Mono for data/versions

---

## 2. Component Design Specifications

### 2.1 Buttons

**Primary Button:**
- Background: `linear-gradient(135deg, #FF6B8A, #D4507A)`
- Height: 48–52pt, `borderRadius: 16`
- Text: white, 15–16px, weight 700
- Shadow: `0 8px 24px rgba(255,107,138,0.38)`
- Press state: `scale(0.96)` with spring animation (Reanimated `withSpring`)
- Disabled: opacity 0.5

**Ghost/Secondary Button:**
- Background: `rgba(255,255,255,0.6)` or transparent
- Border: `1.5px solid #F7C5CC`
- Text: `#FF6B8A`
- Height: 44–48pt, `borderRadius: 14–16`

**Chip/Pill:**
- Padding: `5px 13px`, `borderRadius: 100px`
- Text: 12–13px, weight 600
- Active state: filled `#FF6B8A` background, white text, `scale(1.05)`
- Inactive: white background with `borderColor` matching parent color

### 2.2 Cards

- **Standard card:** `borderRadius: 16–22`, padding 16–18px
- **Hero card** (e.g., cycle hero): `borderRadius: 26`, gradient background, decorative circles
- **Glass card:** `rgba(255,248,240,0.72)` background, `backdropFilter: 'blur(20px)'`, white border
- **Flat card:** no shadow, subtle border `1px solid rgba(247,197,204,0.5)`
- **Elevated card:** shadow `0 4px 20px rgba(212,165,181,0.18)` + inset white border
- Press state: `scale(0.96)` for interactive cards

### 2.3 Input Fields

- Height: 46–50pt
- `borderRadius: 14`
- Border: `1.5px solid #F7C5CC`
- Focus: border turns `#FF6B8A` + `boxShadow: 0 0 0 3px rgba(255,107,138,0.15)`
- Background: `rgba(255,255,255,0.75)`
- Font: Inter, 15px

### 2.4 Bottom Navigation

- Floating tab bar, `position: absolute`, bottom 0
- Height: 60pt + safe area bottom padding (24pt)
- Horizontal margins: 16pt each side
- `borderRadius: 20` at top corners
- Background: `rgba(255,248,240,0.94)` with `blur(24px)`
- Border top: `1px solid rgba(247,197,204,0.4)`
- Shadow: `0 -4px 24px rgba(212,165,181,0.16)`
- Active tab: 42×32px rounded rect, gradient `#FF6B8A`, shadow `0 4px 14px rgba(255,107,138,0.35)`
- Inactive tab: 36×32px, no background, `#C9A8B8` text

### 2.5 Status Bar Simulation

- Height: 48pt
- Time: 12px, weight 700, color `#2D1B26`
- Icons: 11–12px (battery, wifi, signal)

---

## 3. Screen-Specific Patterns

### 3.1 Onboarding Screens

- **Background:** Radial gradient per step (e.g., blush-tinted top-left, lavender-tinted bottom-right)
- **Step indicator:** Dot progress bar — active dot 24px wide, inactive 8px, `borderRadius: 4`, color `#FF6B8A`
- **Step counter:** "STEP X OF 6" in `#A07888`, 10–11px, weight 700, letter spacing 0.09em
- **Icons:** Square/circle container 100×100px, gradient background, shadow `0 16px 48px rgba(255,107,138,0.25)`, floating animation
- **Animation:** `springIn` on icon, `fadeUp` on text/content, staggered delays per child
- **CTA button:** Primary button with optional emoji icon (e.g., 🌸)
- **Skip button:** Text button, full width, `#A07888`, 13px

### 3.2 Home / Dashboard

**Hero Card:**
- Gradient background: `linear-gradient(135deg, #FF6B8A, #D4507A, #A83060)`
- Decorative circles: 180px and 100px white overlay circles at top-right and bottom-right
- Pills: `rgba(255,255,255,0.18)` background, rounded 20px, 4px left green dot indicator
- Cycle ring: SVG circle 78×78, stroke white, `strokeDasharray="201"`, animated `strokeDashoffset`

**Stats Strip:**
- 3-column grid, divider line `1px solid rgba(255,255,255,0.22)`
- Labels: 11px, `rgba(255,255,255,0.72)`; values: 15px, white, weight 800

**Quick Action Cards:**
- 2-column grid, `gap: 12`
- Icons: 44×44 rounded 14px, gradient bg, shadow `0 4px 14px rgba(255,107,138,0.28)`
- Chips inside cards: small pills with `borderRadius: 20`, `padding: 3px 8px`

**Analytics Bars:**
- Rounded top 8px, gradient fill from bottom
- Shadow: `0 4px 12px rgba(155,107,212,0.33)` for current month

### 3.3 Calendar

**Day Cells:**
- Size: 46×46pt, `borderRadius: 14`
- Selected: filled with phase accent color, shadow `0 4px 14px` in phase accent
- Today (not selected): 2px outline `#FF6B8A`
- Period days: filled pink, predicted: outlined pink
- Fertile window: tinted `#E8D5F5` background

**Phase Legend:**
- Horizontal row of small pills per phase
- Each pill: emoji + label, `padding: 5px 10px`, `borderRadius: 20`

**Day Detail Card:**
- Phase badge: `padding: 4px 12px`, `borderRadius: 20`, phase-fg text, phase-accent `18` background

### 3.4 Journal

**Mood Grid:**
- 3 columns
- Buttons: 60–68pt height, `borderRadius: 18`
- Selected: filled mood color, shadow `0 6px 18px ${mood.color}55`, `scale(1.06)`
- Unselected: mood bg `#FFE8EF` style, `border: 1.5px solid ${color}33`

**Energy Level:**
- 5 buttons in row, filled active gradient, unselected `rgba(247,197,204,0.35)` bg

**Symptom Pills:**
- Same as Chip spec, `flexWrap: 'wrap'`, `gap: 7–8`

**Journal Textarea:**
- No border, transparent bg
- Placeholder: italic, `#A07888`, 15px
- Sentiment badge: 10px pill, colored bg

### 3.5 Wellness

**Tabs:**
- Segmented control, `borderRadius: 18`, `padding: 4`
- Active: gradient `#FF6B8A → #D4507A`, shadow `0 4px 14px rgba(255,107,138,0.28)`

**Breathing Cards:**
- Icon box: 56×56 rounded 18px, white with shadow
- Chip: `⏱ 5 min` styled pill

### 3.6 SOS

- Button: 180×180 full circle, gradient `#FF4444 → #DC2626`
- Active pulsing rings: `0 0 0 0 rgba(239,68,68,0.6)` expanding outward over 2s
- Countdown: 54px bold, "Sending…" label
- Cancel: outlined button with blush text
- Active state: full-screen red gradient background

### 3.7 Settings

**Toggle Switch:**
- Track: 50×28px, `borderRadius: 14`
- On: linear gradient `#FF6B8A` → `#D4507A`
- Off: `rgba(160,120,136,0.20)`
- Thumb: 22×22 white circle, shadow `0 2px 6px rgba(0,0,0,0.18)`
- Transition: `left 0.28s cubic-bezier(0.34,1.56,0.64,1)` (springy)

**Settings Row:**
- Icon: 38×38 rounded 11px, `rgba(255,107,138,0.10)` bg
- Label: 14px, weight 700, `#2D1B26`
- Sub: 12px, `#A07888`
- Divider: `1px solid rgba(247,197,204,0.27)`

### 3.8 Pregnancy Mode

**Home:**
- Header: "You're pregnant 💗" 12px soft + "Week X" 27px Playfair Display
- Trimester badge: small gradient pill
- Baby size: emoji + name (Raspberry, Lime, Banana, Coconut…)
- Hero gradient: `linear-gradient(135deg, #FFB3C6, #FF6B8A)`

**Calendar:**
- Week selector horizontal scroll, active gradient pill `#FF6B8A`
- Milestones: numbered rounded squares with gradient

---

## 4. Animation & Motion Design

### 4.1 CSS Keyframes to Reanimated Mapping

| Design Website Class | Mobile Equivalent | Duration | Easing |
|---------------------|-------------------|----------|--------|
| `springUp` | `withSpring(0, { damping: 14 })` | 500ms | spring |
| `fadeUp` | `withTiming(1, { duration: 350 })` | 350ms | ease |
| `float` | `withRepeat(withSequence(withTiming(-6), withTiming(0)), -1, true)` | 4s loop | ease-in-out |
| `breathe` | `withRepeat(withSequence(withTiming(1.08), withTiming(1)), -1, true)` | 3s loop | ease-in-out |
| `lunaIdle` | `withRepeat(withSequence(withTiming(-6), withTiming(0), withTiming(1.04)), -1, true)` | 3s | ease-in-out |
| `lunaWalkRight` | TranslateX loop from -160 to 0 | 7s linear | linear |
| `lunaBounce` | Bounce sequence: 0 → -14 → 0 | 900ms ease-in-out | ease-in-out |
| `progressFill` | Width transition | 800ms | spring |
| `chip` press | `withSpring(0.95)` | 200ms | spring |
| `btn-press` | `withSpring(0.96)` | 140ms | spring |

### 4.2 Interaction Patterns

- **All pressable elements:** `scale(0.96)` with spring on `onPressIn`, `scale(1)` on `onPressOut`
- **Screen transitions:** Default React Navigation `cardStyleInterpolator`
- **Stagger entrance:** `withDelay(index * 50)` per card on mount
- **Refresh:** Reanimated pull-to-refresh with haptic feedback on threshold

---

## 5. Layout Rules

### 5.1 Spacing Grid

- Base unit: 4px
- Scale: `xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48`
- Card padding: 16–18px
- Screen horizontal padding: 18–20px
- Minimum touch target: 44×44pt

### 5.2 Card Layouts

- 2-column grids: `gap: 12`
- Vertical stacks: `gap: 10–14`
- Section headers: bottom margin 12–14px

### 5.3 Bento Grid

- Use for dashboard quick stats
- Uneven spans allowed: first item can be full-width (hero), remainder 2-column
- `borderRadius: 22` for bento containers

---

## 6. Luna Overlay Specification

### 6.1 Design Website Behavior (current)

- Position: absolute inside phone frame, `bottom: 96px`, `right: 14px`, `zIndex: 1000`
- Collapsed: 60×60px circle, gradient `linear-gradient(135deg, #FFB3C6, #FF6B8A)`, `borderRadius: 50%`
- Expanded: 210px wide bubble, `backdropFilter: 'blur(20px)'`, rounded 22px
- Bubble tail: small rotated square with white bg and border
- Float animation: `translateY` 3s loop

### 6.2 Mobile Equivalent

```tsx
// Use Reanimated + PanResponder for drag
// Absolute position over Home dashboard, above Tab Bar
// zIndex: 1000
// Wrap in react-native-reanimated's Animated.View

// Avatar: 60×60 circle with gradient border
// Bubble: 210px wide max, glass bg (rgba(255,248,240,0.94) + blur)
// Tail: SVG or rotated square
// Dismiss button: 26×26 top-right

// Data flow: lift lunaContext from App, pass to overlay
// Update bubble text when data changes
```

---

## 7. Implementation Checklist for Mobile

### High Priority

- [ ] **Apply color tokens:** Replace any hardcoded `#FF6B8A` etc. with `colors.primary`
- [ ] **Overhaul button components:** Update to match gradient + shadow + press scale spec
- [ ] **Update Card component:** Match glass specs, `borderRadius`, shadow values
- [ ] **Update Calendar cells:** Apply 46×46pt size, selected/day styling
- [ ] **Update BottomNav:** Floating glass bar with active gradient pill
- [ ] **Add Playfair Display font:** Include in `app.json` or via `expo-font`

### Medium Priority

- [ ] **Add Luna overlay to Home:** Drag + expand/collapse bubble
- [ ] **Add spring animations:** Install `react-native-reanimated` if not present, apply press + entrance animations
- [ ] **Add progression animations:** Stagger card entrance with `withDelay`
- [ ] **Add SOS pulse:** Reanimated looping scale/shadow animation
- [ ] **Update Onboarding:** Apply dot progress, spring icon, radial gradients

### Low Priority

- [ ] **Add shimmer skeletons:** For loading states
- [ ] **Dark mode audit:** Ensure all tokens have dark equivalents
- [ ] **Accessibility audit:** `accessibilityLabel`, `accessibilityRole`, contrast ratios

---

## 8. Anti-Patterns to Avoid

- ❌ No plain `StyleSheet.create` without theme tokens
- ❌ No hardcoded colors in components
- ❌ No legacy `Animated.API` for complex animations
- ❌ No inline styles for reusable components
- ❌ No hardcoded font sizes outside typography scale
- ❌ No hardcoded spacing outside 4px grid
- ❌ No plain `AsyncStorage` for Luna state
- ❌ No `ScrollView` for lists > 5 items (use `FlashList` or `FlatList`)

---

## 9. Reference Files

- Design website: `/SheCare_Mobile_App_Design/src/App.tsx`
- Design tokens: `/SheCare_Mobile_App_Design/src/index.css`
- Luna overlay: inline in `App.tsx` near top
- Pregnancy mode: `PregnancyHomeScreen` + `PregnancyCalendarScreen` inline in `App.tsx`
- Mobile app: `/mobile/`
- Existing UI prompt: `/mobile/docs/prompt_uiux.md`

---

## 10. Success Criteria

1. Every screen uses semantic color tokens from theme
2. Buttons match gradient/shadow/radius spec
3. Cards have correct glass/shadow variants
4. Bottom nav is floating glass with active gradient pill
5. All pressable elements have spring-scale feedback
6. Typography follows scale: Playfair Display headings + Inter body
7. Calendar cells, phase badges, streak pills match design website exactly
8. Luna overlay appears on Home with same visual treatment
9. Pregnancy mode toggle + screens visually match design website specs
10. `vite build` equivalent: app compiles with zero TS errors
