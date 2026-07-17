# Compare: Settings Screen

**Design Spec File:** `mobile/UI_UX/Settings.md`
**Implemented File:** `mobile/src/screens/profile/SettingsScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Title | EB Garamond 24px "Settings" (line 11) | h1 "Settings" (Inter) (line 94) | Different font |
| Profile Summary card | Avatar (64px, 3px Blush Light border), Name (Inter 18px Bold), Email (Inter 12px Warm Gray), Personal Details link (lines 63-64) | Not implemented — "Personal Information" in "Account" section instead (line 98) | Missing — no avatar, no user name/email display |
| Group card background | Warm Cream #FFF8F0 (line 43) | Card with default surface color (line 68) | Different |
| Group card radius | 16px (radius.lg) (line 44) | Default Card radius | Depends on Card component |
| Dividers | Mauve #D4A5B5 at 0.25 opacity (line 46) | colors.border (gray, 100% opacity) (line 35) | Different — wrong color and opacity |
| Icons | Outlined stroke 1.5, Mauve #D4A5B5 (line 53) | No row icons at all | Missing entirely |
| Option text | Inter 15px Charcoal (line 54) | body variant (16px) (line 41) | Slightly different size |
| Toggle switches | Active thumb: Soft Blush #FF6B8A, Inactive: Warm Gray 0.2 opacity (line 55) | Active thumb: colors.primary, track: primaryMuted/border (lines 46-49) | Partially — spec says nothing about track colors |
| Navigation chevron | Right-aligned > in Mauve #D4A5B5 (line 56) | Right-aligned SVG arrow in textMuted (lines 52-56) | Different color |
| Notifications section | Custom toggles for cycle logging, wellness reminders, quiet hours with time picker (lines 66-68) | Push/Email/SMS toggles + Notification Preferences disclosure (lines 104-108) | Different — no quiet hours time picker |
| Security section | Biometric toggle, Export Data, Delete Account (red text, confirmation prompt) (lines 70-73) | Biometric Lock, Share Analytics, Export My Data, Delete Account (all present but no confirmation prompt) (lines 113-116) | Partially — missing confirmation on delete |
| Logout button | Ghost outline, 2px Soft Blush border, Inter 15px Bold, scale 0.96 on touch (lines 76-78) | Not implemented | Missing entirely |
| Row minimum height | 48px (line 47) | theme.minTouchTarget (44px) (line 35) | Different |

## Additional Issues

- The code includes many sections not in the spec: "AI & Models" (lines 119-125), "Support" (lines 134-140), "About" (lines 142-148). While these are additive, the spec's Profile Summary card with avatar is entirely absent.
- The toggle function (line 86-88) uses logger.info instead of actually persisting settings.
