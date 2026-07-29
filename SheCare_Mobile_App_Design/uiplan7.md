# uiplan7 — Tab Swap (AI Chat → Wellness) & ProfileHome Flesh-out

> **Priority:** High
> **Files:** `navigation/types.ts`, `navigation/MainTabs.tsx`, `screens/profile/ProfileHomeScreen.tsx`

---

## 1. AI Chat → Wellness tab

### 1.1 Rationale

The bottom tab currently labelled **AI Chat** is redundant — the AI chat (Luna) is already accessible from the Home dashboard's AI Prediction card and quick-action bento. A **Wellness** tab (mood tracking, journal, breathing, insights) is more aligned with the app's core flow and directly serves the Wellness screen already built in `WellnessHomeScreen.tsx`.

### 1.2 Changes

| File | What |
|---|---|
| `navigation/types.ts` | `MainTabParamList`: rename `AIChat` key to `Wellness`, value → `NavigatorScreenParams<WellnessStackParamList>` |
| `navigation/MainTabs.tsx` | Import `WellnessStack` instead of `AIChatStack`; add Wellness SVG icon (leaf/spa) in `TabIcon` switch; change the `Tabs.Screen` name to `Wellness`, label to `'Wellness'` |

### 1.3 Icon

Use a simple leaf/spa SVG path in the `TabIcon` component:

```tsx
case 'Wellness':
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C12 2 6 7 6 13c0 3.31 2.69 6 6 6s6-2.69 6-6c0-6-6-11-6-11z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 22v-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
```

---

## 2. ProfileHomeScreen — Full Implementation

### 2.1 Current state

`ProfileHomeScreen.tsx:49` is a stub: heading, subtitle, a card reading `"Plan 05 fills this in."`, and a Logout button.

### 2.2 Target state

A full profile landing screen matching the SheCare design language:

```
┌──────────────────────────────┐
│   ╭───  ← Back (hidden in   │
│   │      tab context)        │
│   │                          │
│   │  ┌────────────────────┐  │
│   │  │   👤  Sofia         │  │
│   │  │        Adeyemi      │  │
│   │  │   sofia@shecare.app │  │
│   │  │   ✨ Premium        │  │
│   │  │   🔥 3-month streak│  │
│   │  └────────────────────┘  │
│   │                          │
│   │  EDIT PROFILE         ›  │
│   │  ──────────────────────  │
│   │  SETTINGS             ›  │
│   │  ──────────────────────  │
│   │  LINKED FAMILY        ›  │
│   │  ──────────────────────  │
│   │  CHANGE PASSWORD      ›  │
│   │  ──────────────────────  │
│   │  COMPANION SETUP      ›  │
│   │                          │
│   │       [  Sign Out  ]     │
│   └──────────────────────────┘
```

### 2.3 Components

**Profile hero card** — `LinearGradient` (135°, `theme.colors.primary` → `'#D4507A'` → `'#A83060'`), `borderRadius: 26`:
- Two decorative circles (white at 6% / 8% opacity)
- Edit button (pencil emoji, `rgba(255,255,255,0.25)` bg)
- Avatar circle (60×60, `rgba(255,255,255,0.2)` bg, initial letter)
- Name (`theme.colors.textInverse`, 21px, 800 weight)
- Email (`rgba(255,255,255,0.82)`, 13px)
- Two pills: `✨ Premium` and `🔥 3-month streak` (`rgba(255,255,255,0.22)` bg)

**Menu rows** — `Pressable` list, each with:
- Icon container (36×36, `borderRadius: 10`, `theme.colors.primary + '14'` bg)
- SVG icon (18×18, `theme.colors.primary`)
- Label
- Chevron (`›`) in `theme.colors.mauve`
- `borderBottomColor: theme.colors.border`

Sections:
1. `Edit Profile` → `navigation.navigate('EditProfile')`
2. `Settings` → `navigation.navigate('Settings')`
3. `Linked Family` → `navigation.navigate('LinkedFamily')`
4. `Change Password` → `navigation.navigate('ChangePassword')`
5. `Companion Setup` → `navigation.navigate('CompanionInstall')`

**Sign Out button** — already exists, preserve it with current behavior.

### 2.4 Accessibility

| Element | `accessibilityLabel` | `accessibilityRole` |
|---|---|---|
| Edit button | `"Edit profile"` | `"button"` |
| Each menu row | `"Navigate to {label}"` | `"button"` |
| Sign Out button | `"Sign out"` | `"button"` |

### 2.5 Assertions

- [ ] Profile tab is no longer empty — shows avatar, name, email
- [ ] Each menu row navigates to the correct stack screen
- [ ] Gradient hero matches SettingsScreen style
- [ ] `npx tsc --noEmit` — zero new errors
- [ ] Wellness tab icon renders correctly in bottom bar
- [ ] AIChat screen still accessible via HomeStack's `AIChat` route (deep link preserved)

---

## 3. Test plan

```bash
npx tsc --noEmit          # zero new errors
npx eslint src/           # no new violations
# Visual: tab bar shows "Wellness" with leaf icon
# Visual: Profile tab shows gradient hero + menu rows
```
