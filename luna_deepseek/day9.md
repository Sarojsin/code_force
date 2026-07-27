# Day 9 — Settings Toggles

## Goal
Add Luna's settings toggles to the Settings screen: Hide Companion, Reduce Animations, Mute Sounds. Wire them to the companion store + SQLite persistence.

---

## 9.0 Asset-Aware Settings Changes

Since Luna is now a downloadable feature, the Settings screen must respect the installation state:

- **Before download:** Show "Download Luna" prompt (disabled — handled via Install Screen)
- **After download:** Show all toggles (hide, reduce animations, mute)
- **Uninstall:** Remove the downloaded assets folder from file system

### Add import for asset uninstall

```typescript
import { uninstallLuna } from '../../services/assetDownloader';
import { useDownloadStore } from '../../stores/downloadStore';
```

### Add install status to companion state reads

```typescript
const installStatus = useCompanionStore((s) => s.installStatus);
const assetsVersion = useCompanionStore((s) => s.assetsVersion);
const downloadState = useDownloadStore((s) => s.state);
```

---

## 9.1 Add Luna Section to SettingsScreen

Modify `src/screens/profile/SettingsScreen.tsx` to include a "Companion" section with three toggles.

### Import the store

```typescript
import { useCompanionStore } from '../../stores/companionStore';
```

### Add companion state

Inside the `SettingsScreen` component, after other state declarations:

```typescript
const companionHidden = useCompanionStore((s) => s.isHidden);
const companionReduceAnimations = useCompanionStore((s) => s.reduceAnimations);
const companionMuteSounds = useCompanionStore((s) => s.muteSounds);
const companionLevel = useCompanionStore((s) => s.level);
const companionTitle = useCompanionStore((s) => s.levelTitle);
const companionXp = useCompanionStore((s) => s.xp);
const companionHydrated = useCompanionStore((s) => s.isHydrated);
```

### Add uninstall handler

```typescript
const handleLunaUninstall = () => {
  Alert.alert(
    'Uninstall Luna',
    'This removes Luna\'s sprites, sounds, and dialogues from your device (~4.5 MB). Your XP and level are saved.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Uninstall',
        style: 'destructive',
        onPress: async () => {
          const user = useAuthStore.getState().user;
          if (user) await uninstallLuna(user.id);
          useCompanionStore.getState().reset();
        },
      },
    ]
  );
};
```

### Add toggle handlers

```typescript
const handleLunaToggle = (key: 'isHidden' | 'reduceAnimations' | 'muteSounds') => async (value: boolean) => {
  const store = useCompanionStore.getState();
  switch (key) {
    case 'isHidden':
      await store.setHidden(value);
      if (value) {
        logger.info('Luna hidden');
      } else {
        logger.info('Luna shown');
      }
      break;
    case 'reduceAnimations':
      await store.setReduceAnimations(value);
      logger.info('Luna reduceAnimations:', value);
      break;
    case 'muteSounds':
      await store.setMuteSounds(value);
      logger.info('Luna muteSounds:', value);
      break;
  }
};
```

### Add the Companion section in the JSX

Insert this after the "Appearance" section (or wherever appropriate based on UX hierarchy):

```tsx
{/* Companion */}
<SettingsSection title="Companion">
  {/* Install status / version info */}
  {companionHydrated && installStatus === 'ready' && (
    <View style={[styles.companionStatus, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D4A5B540' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontSize: 24, marginRight: 10 }}>🐱</Text>
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall" weight="600">Luna — {companionTitle}</Text>
          <Text variant="caption" color="muted">
            Level {companionLevel} · {companionXp} XP
            {assetsVersion && ` · v${assetsVersion}`}
          </Text>
        </View>
      </View>
    </View>
  )}

  {/* Install / Uninstall entry */}
  <SettingRow
    label={installStatus === 'ready' ? 'Uninstall Luna' : 'Download Luna'}
    description={
      installStatus === 'ready'
        ? 'Remove assets (XP saved)'
        : 'Download sprites, sounds (~4.5 MB)'
    }
    destructive={installStatus === 'ready'}
    showDisclosure
    onPress={() => {
      if (installStatus === 'ready') {
        handleLunaUninstall();
      } else {
        // Navigate to install screen
        navigation.navigate('CompanionInstall');
      }
    }}
    accessibilityLabel="Luna install or uninstall"
  />

  {/* These toggles only show when Luna is installed */}
  {installStatus === 'ready' && (
    <>
      <SettingRow
        label="Hide Companion"
        description="Luna disappears from the dashboard"
        value={companionHidden}
        onToggle={handleLunaToggle('isHidden')}
        accessibilityLabel="Toggle hide Luna companion"
      />
      <SettingRow
        label="Reduce Animations"
        description="Static cat only (no movement)"
        value={companionReduceAnimations}
        onToggle={handleLunaToggle('reduceAnimations')}
        accessibilityLabel="Toggle reduce Luna animations"
      />
      <SettingRow
        label="Mute Sounds"
        description="Disable meows and purrs"
        value={companionMuteSounds}
        onToggle={handleLunaToggle('muteSounds')}
        accessibilityLabel="Toggle mute Luna sounds"
      />
    </>
  )}
</SettingsSection>
```

### Add companion status style

```typescript
companionStatus: {
  // No extra styles needed — reuse settingRow padding
}
```

Or extend the `styles` object:

```typescript
companionStatus: {
  flexDirection: 'row',
  alignItems: 'center',
},
```

---

## 9.2 Create Companion Preview in Settings

Add a small preview area showing Luna's current state when the companion section is expanded:

```tsx
{companionHydrated && !companionHidden && (
  <View style={{ alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D4A5B540' }}>
    <LunaSprite size={60} />
    <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
      {companionReduceAnimations ? 'Static mode' : 'Animations enabled'}
    </Text>
  </View>
)}
```

Import `LunaSprite`:

```typescript
import { LunaSprite } from '../../services/companion';
```

---

## 9.3 Full SettingsScreen Diff Summary

Here is the complete list of changes to `src/screens/profile/SettingsScreen.tsx`:

| Change | Location |
|--------|----------|
| Add import: `useCompanionStore` | Top of file |
| Add import: `LunaSprite` | Top of file |
| Add state reads from `useCompanionStore` | Inside component |
| Add `handleLunaToggle` function | Inside component |
| Add `<SettingsSection title="Companion">` | After Appearance section (before Support) |
| Add `companionStatus` style | In `styles` object |

---

## 9.4 Test Settings Toggles

### Pre-download state:
1. Open Settings → Companion section
2. See "Download Luna" row with description "Download sprites, sounds (~4.5 MB)"
3. Only one row visible (download prompt)
4. Tap it → navigates to LunaInstallScreen

### Post-download state:
1. Open Settings → Companion section
2. See Luna's current level, title, XP, and version displayed
3. Toggle "Hide Companion" → Luna disappears from Home Dashboard
4. Toggle "Reduce Animations" → Luna becomes static on Home Dashboard
5. Toggle "Mute Sounds" → No audio played (when sounds are implemented in Phase 2)
6. See "Uninstall Luna" row (red/destructive style)
7. Close and reopen app → Toggles persist

### Uninstall flow:
1. Tap "Uninstall Luna" → confirmation dialog appears
2. "Cancel" → nothing happens
3. "Uninstall" → assets folder deleted, store resets, Luna disappears
4. Companion section reverts to pre-download state (shows "Download Luna")

---

## 9.5 Verify SQLite Persistence

After toggling any setting, verify the value is written to SQLite:

```typescript
// Check the DB directly (via debug query):
const meta = await companionLocalService.getMetadata(userId);
console.log('Companion settings:', {
  isHidden: meta?.is_hidden,
  reduceAnimations: meta?.reduce_animations,
  muteSounds: meta?.mute_sounds,
});
```

---

## ✅ Day 9 Validation

- [ ] "Companion" section added to SettingsScreen
- [ ] Pre-download state: only "Download Luna" row visible
- [ ] Post-download state: status card + all toggles visible
- [ ] Luna status card shows level, title, XP, and asset version
- [ ] "Hide Companion" toggle reads/writes `isHidden`
- [ ] "Reduce Animations" toggle reads/writes `reduceAnimations`
- [ ] "Mute Sounds" toggle reads/writes `muteSounds`
- [ ] Toggles persist across app restart (SQLite-backed)
- [ ] Uninstall confirmation dialog shown before removal
- [ ] Uninstall removes `companion/` folder from file system
- [ ] Luna preview renders when companion is active and not hidden
- [ ] All toggles have proper `accessibilityLabel`
- [ ] App builds without TypeScript errors
- [ ] No visual regressions in existing settings sections
