# Fix 3: Add `freezeOnBlur` to tab navigator

**Problem:** Bottom tab screens remount on every tab switch because `freezeOnBlur` is not configured. This causes unnecessary re-renders and data fetching when switching tabs.

**File:** `mobile/src/navigation/MainTabs.tsx`

**Change — Add freezeOnBlur to screenOptions (after line 95, `headerShown: false`):**
```
OLD:
        headerShown: false,
      })}

NEW:
        headerShown: false,
        freezeOnBlur: true,
      })}
```

**Effect:** Tab screens are frozen (not unmounted) when user switches to another tab. No remount cost on tab switch. This is a React Navigation 7 feature — `@react-navigation/bottom-tabs` supports it natively.

**Note:** `detachInactiveScreens` requires `@react-navigation/native-stack` which the project doesn't use (uses JS-based `@react-navigation/stack`). Not adding it.

**Verification:** Tab switching is instantaneous. Screens don't re-mount.
