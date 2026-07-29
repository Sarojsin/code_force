# uiplan3 — Bottom Navigation Redesign

> **Phase 3 — Global navigation.** Visible on nearly every screen.
> **Priority:** High
> **Files:** 1 to modify (`mobile/src/navigation/MainTabs.tsx`)
> **Depends on:** uiplan1 (theme tokens), uiplan2 (component patterns)

---

## 1. Tab Bar Container — `screenOptions.tabBarStyle`

| Property | Current | Target |
|---|---|---|
| `position` | `'absolute'` | ✅ Keep |
| `bottom` | `12` | ✅ Keep |
| `left` | `16` | ✅ Keep |
| `right` | `16` | ✅ Keep |
| `backgroundColor` | `rgba(255,255,255,0.85)` | `rgba(255,248,240,0.94)` (design's cream) |
| `borderTopWidth` | `0` | ✅ Keep (removes default line) |
| `borderTopColor` | — | Add: `rgba(247,197,204,0.4)` (roseQuartz) |
| `borderRadius` | `20` | ✅ Keep |
| `height` | `60` | Add safe-area bottom padding (+ 22px) |
| `paddingBottom` | `6` | `22` (floating spacing) |
| `shadowColor` | `#000` | `#D4A5B5` (rose-tinted) |
| `shadowOffset` | `{0,4}` | ✅ Keep |
| `shadowOpacity` | `0.1` | `0.16` |
| `shadowRadius` | `12` | `24` |
| `elevation` | `8` | ✅ Keep |

### Replacement code for `tabBarStyle`

```typescript
tabBarStyle: {
  position: 'absolute',
  bottom: 12,
  left: 16,
  right: 16,
  backgroundColor: 'rgba(255,248,240,0.94)',
  borderTopWidth: 0,
  borderTopColor: 'rgba(247,197,204,0.4)',
  borderRadius: 20,
  height: 60,
  paddingBottom: 22,
  paddingTop: 8,
  shadowColor: '#D4A5B5',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.16,
  shadowRadius: 24,
  elevation: 8,
}
```

---

## 2. Tab Label — `screenOptions.tabBarLabelStyle`

| Property | Current | Target |
|---|---|---|
| `fontSize` | `11` | `10` |
| `fontWeight` | `'600'` | `'500'` (inactive) |

Label color is controlled by `tabBarActiveTintColor` / `tabBarInactiveTintColor`:
- Active: `#FF6B8A` weight 800 (use custom label renderer)
- Inactive: `#C9A8B8` weight 500 (design's `lighter`)

**Action:** Replace `tabBarLabelStyle` with a custom `tabBarLabel` renderer to apply separate active/inactive weight styling.

---

## 3. Active Tab Indicator — Replace Icon Tint with Gradient Pill

### Current behavior
Active tab icon is tinted with `theme.colors.primary`, inactive with `theme.colors.textMuted`.

### Target behavior
Active tab has a **gradient pill** (42×32px) containing the icon in white. Inactive tab has no background, icon in `#C9A8B8`.

### Implementation

Replace the `tabBarIcon` renderer:

```typescript
tabBarIcon: ({ focused, color }) => {
  const iconName = route.name;
  const isActive = focused;

  return (
    <View style={{
      width: isActive ? 42 : 36,
      height: 32,
      borderRadius: 12,
      backgroundColor: isActive ? 'transparent' : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {isActive ? (
        <LinearGradient
          colors={['#FF6B8A', '#D4507A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 42,
            height: 32,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#FF6B8A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 14,
            elevation: 6,
          }}
        >
          <TabIcon name={route.name} focused={true} color="#FFFFFF" />
        </LinearGradient>
      ) : (
        <TabIcon name={route.name} focused={false} color="#C9A8B8" />
      )}
    </View>
  );
};
```

### TabIcon component — update stroke widths

```typescript
function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const strokeWidth = focused ? 2.5 : 1.8; // slightly thicker when active
  // ... SVG paths stay the same
}
```

---

## 4. Tab Order and Content

Keep the existing 5-tab structure:

| Tab | Current Screen | Preserve? |
|---|---|---|
| Home | `HomeStack` | ✅ Yes |
| Calendar | `CalendarStack` | ✅ Yes |
| Analytics | `AnalyticsStack` | ✅ Yes |
| AIChat | `AIChatStack` | ✅ Yes |
| Profile | `ProfileStack` | ✅ Yes |

**No navigation structure changes** — only visual restyling. The design spec file has tabs (Home, Cycle, Journal, Wellness, Profile) but the mobile app already has a well-established navigation tree. Restyling only, not restructuring.

---

## 5. Verify

1. Run app, navigate all 5 tabs
2. Verify active tab shows gradient pill with white icon
3. Verify inactive tab shows #C9A8B8 icon with no background
4. Verify floating glass appearance (blur, shadow, cream background)
5. Verify safe-area bottom padding (22px) doesn't overlap with tab content
6. Test on both iOS and Android simulators
