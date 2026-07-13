# Architecture Phase 2: SOS Native SMS Fallback + Cycle/Period Features

**Priority:** High (2.5 days)
**Dependencies:** Phase 1 (offline queue infrastructure must be wired first)
**Files touched:** 5 (1 screen, 1 service, 1 ML file, 1 store, 1 query hook)

---

## 1. Objective

Make safety-critical SOS work offline via native SMS fallback, wire the cycle model downloader for offline prediction accuracy, and fix the broken period log entry (currently data-lost-on-navigation).

Three sub-tasks:

| Sub-task | Effort | Success Metric |
|----------|--------|----------------|
| 2a. Wire SOS SMS fallback into `SOSActiveScreen` | 4 hours | Offline SOS sends SMS via native app + queues for later API sync |
| 2b. Wire cycle model background downloader | 2 hours | New global model downloaded automatically on Wi-Fi |
| 2c. Fix `LogPeriodScreen` to actually submit data | 2 hours | Period entries persisted, visible offline, sync when online |

---

## 2. Current State (Before)

### 2.1 SOS: API-only, fails offline

```
User taps SOS (offline)
  → SOSActiveScreen triggers useTriggerSos mutation
  → POST /safety/sos/trigger — NetworkError
  → catch → navigation.goBack()
  → User sees nothing — SOS FAILED SILENTLY
```

`safetySyncQueue.ts` exists with a complete queue, priority sorting, retry logic, and EncryptedStorage persistence — but **`SOSActiveScreen.tsx` never imports or calls it**.

`sendSmsFallback()` exists in `safety.ts` — it opens the native SMS app with a pre-filled SOS message and Google Maps link. But **`SOSActiveScreen` never calls it**.

### 2.2 Global Model: Downloads on dashboard mount only

```
CycleDashboardScreen mounts
  → globalModelClient.ensureLatest() — checks version, downloads if stale
  → Works but only triggered by this one screen
  → No check when app is backgrounded or on Wi-Fi specifically
  → No user feedback if a new model was downloaded
```

The `modelUpdater.ts` already checks for wellness + minilm model updates on `useWellnessHydration()` — but the **cycle global model** uses a completely different mechanism (`globalModelClient.ensureLatest()` in the dashboard screen).

### 2.3 Period Log: UI only, data never submitted

```
LogPeriodScreen renders
  → User fills form (start date, end date, flow, symptoms, mood, energy)
  → Taps "Save period log"
  → onSubmit logs to console: logger.info('LogPeriodScreen.submit', {...})
  → navigation.goBack()
  → ALL DATA LOST
```

`useCreateCycleEntry` exists and is fully implemented — but **`LogPeriodScreen` never imports or calls it**.

---

## 3. Phase 2a: SOS Native SMS Fallback

### 3.1 Architecture Decision

SOS is the single most critical offline feature. The flow must be:

```
OFFLINE SOS TRIGGER:
  1. Try API POST /safety/sos/trigger (from Phase 1, already queued on error)
  2. If API fails (network error) → queue to safetySyncQueue
  3. ALSO → immediately open native SMS with pre-filled message to all contacts
  4. Show "SOS sent via SMS" confirmation
  5. When online → syncQueue() processes the queued SOS API call

ONLINE SOS TRIGGER:
  1. API succeeds → contacts notified via push/SMS server-side
  2. Normal flow
```

### 3.2 Files to Modify

#### `src/screens/safety/SOSActiveScreen.tsx`

```typescript
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safetyService, sendSmsFallback } from 'src/services/api/safety';
import { enqueueSos } from 'src/services/safetySyncQueue';
import { useEmergencyContacts } from 'src/services/queries';
import { useAuthStore } from 'src/stores/authStore';

const LAST_LOCATION_KEY = 'shecare.last_known_location';

async function getLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
    });
    // Cache for future offline SOS
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location.coords)).catch(() => {});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  } catch {
    // GPS failed — try cached location
    try {
      const cached = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      if (cached) {
        const coords = JSON.parse(cached);
        return { ...coords, accuracy: null };
      }
    } catch {}
    return null;
  }
}

export function SOSActiveScreen() {
  // ... existing code ...
  const { data: contacts } = useEmergencyContacts();
  const user = useAuthStore(state => state.user);

  const handleTriggerSos = async () => {
    const idempotencyKey = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const location = await getLocation();
    const data = {
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      location_accuracy_m: location?.accuracy ?? null,
      trigger_source: 'button' as const,
    };
    const userName = user?.display_name || user?.email || 'Someone';

    try {
      // 1. Attempt API call (from Phase 1, already handles offline via enqueue)
      await triggerMutation.mutateAsync({ data, idempotencyKey });
      setPhase('active');
    } catch (err) {
      // 2. Queue for later API sync
      await enqueueSos(data).catch(() => {});

      // 3. Native SMS fallback with real data
      if (contacts && contacts.length > 0) {
        const phoneNumbers = contacts.map(c => c.phone_number);
        sendSmsFallback(
          phoneNumbers,
          userName,
          location ?? undefined,
        );
      }

      // 4. Show confirmation to user
      Toast.show({
        type: 'success',
        text1: 'SOS sent via SMS to your emergency contacts',
      });
      setPhase('active');
    }
  };
```


  const handleImSafe = async () => {
    if (!activeAlert) return;
    try {
      await resolveMutation.mutateAsync(activeAlert.id);
      setPhase('resolved');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      // NEW: Queue the resolve for later sync — prevents infinite check-in notifications
      await enqueueResolve(activeAlert.id).catch(() => {});
      Toast.show({
        type: 'info',
        text1: "We'll sync when online. You're marked as safe locally.",
      });
      setPhase('resolved');
      setTimeout(() => navigation.goBack(), 1500);
    }
  };

  const handleCancelSos = async () => {
    if (!activeAlert) return;
    try {
      await cancelMutation.mutateAsync(activeAlert.id);
      navigation.goBack();
    } catch (err) {
      // NEW: Queue the cancel for later sync
      await enqueueCancel(activeAlert.id).catch(() => {});
      Toast.show({
        type: 'info',
        text1: 'Cancel will sync when online.',
      });
      navigation.goBack();
    }
  };
}
```

#### `src/services/safetySyncQueue.ts` — Add resolve/cancel + wire to online sync

```typescript
import { generateId } from 'src/services/utils/generateId';
import { safetyService, SosTriggerRequest } from 'src/services/api';
import NetInfo from '@react-native-community/netinfo';
import { EncryptedStorage } from 'src/services/storage';

const QUEUE_KEY = 'shecare.safety.offlineQueue';

// --- Existing getQueue, saveQueue, enqueueSos stay unchanged ---

export interface QueuedSafetyOp {
  id: string;
  type: 'safety/sos/trigger' | 'safety/sos/resolve' | 'safety/sos/cancel';
  endpoint: string;
  data: Record<string, unknown>;
  tempId: string;
  idempotencyKey: string;
  clientUpdatedAt: string;
  priority: string;
  createdAt: string;
  retryCount: number;
}

// NEW: Queue an SOS resolve operation for offline
export async function enqueueResolve(sosId: string): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'safety/sos/resolve',
    endpoint: `/api/v1/safety/sos/${sosId}/resolve`,
    data: { sos_id: sosId },
    tempId: generateId(),
    idempotencyKey: generateId(),
    clientUpdatedAt: new Date().toISOString(),
    priority: 'high',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
}

// NEW: Queue an SOS cancel operation for offline
export async function enqueueCancel(sosId: string): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'safety/sos/cancel',
    endpoint: `/api/v1/safety/sos/${sosId}/cancel`,
    data: { sos_id: sosId, false_alarm: true },
    tempId: generateId(),
    idempotencyKey: generateId(),
    clientUpdatedAt: new Date().toISOString(),
    priority: 'high',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
}

// Updated syncQueue — dispatches by type
export async function syncQueue(): Promise<void> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining: typeof queue = [];
  for (const item of queue) {
    try {
      if (item.type === 'safety/sos/trigger') {
        await safetyService.triggerSos(item.data as SosTriggerRequest, item.idempotencyKey);
      } else if (item.type === 'safety/sos/resolve') {
        await safetyService.resolveSos(item.data.sos_id as string);
      } else if (item.type === 'safety/sos/cancel') {
        await safetyService.cancelSos(item.data.sos_id as string);
      }
    } catch (err) {
      item.retryCount += 1;
      if (item.retryCount < 5) remaining.push(item);
    }
  }
  await saveQueue(remaining);
}

// Called from App.tsx on reconnect
export function initSafetyQueueListener(): () => void {
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue().catch(() => {});
    }
  });
  return unsub;
}
```

### 3.3 SMS Fallback User Flow

```
User triggers SOS offline:
  1. 2-second countdown (existing)
  2. Get GPS location (async — ~1-3s) + fallback to cached location
  3. API call fails (network error)
  4. Toast: "SOS sent via SMS to your contacts"
  5. Native SMS app opens with pre-filled message:

     WITH GPS:
     ┌──────────────────────────────────────────┐
     │ [SOS ALERT] Sarah needs help!              │
     │ Location: maps.google.com/?q=37.7749,-122.4194│
     │ Sent via SheCare                           │
     │ To: Mom, Dr. Smith                         │
     └──────────────────────────────────────────┘

     WITHOUT GPS (no permission / timeout):
     ┌──────────────────────────────────┐
     │ [SOS ALERT] Sarah needs help!      │
     │ Location unavailable — please call │
     │ Sarah directly.                    │
     │ Sent via SheCare                   │
     │ To: Mom, Dr. Smith                 │
     └──────────────────────────────────┘

  6. User can tap Send manually
  7. SOSActive screen shows "ACTIVE" state
  8. When online later, SOS API call syncs
```

### 3.4 Validation Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Offline + SOS trigger | Native SMS app opens with pre-filled message |
| 2 | Offline + SOS trigger | "SOS sent via SMS" toast shown |
| 3 | Offline + SOS trigger | Screen shows "SOS ACTIVE" state |
| 4 | Online + SOS trigger | API call succeeds, push notifications sent |
| 5 | Online + SOS trigger | SMS app NOT opened (API path works) |
| 6 | Offline SOS → go online | Queue processes, server gets SOS record |
| 7 | Offline SOS with location permission granted | SMS contains actual GPS coordinates |
| 8 | Offline SOS without location permission | SMS contains "Location unavailable — please call user" |
| 9 | Offline SOS with location timeout | SMS uses cached last known location |
| 10 | SOS SMS displays user's real name | Contact sees "[User's Name] needs help" (not "User") |

---

### 🟡 3.5 Critical Gap: Hardcoded GPS Coordinates — Must Fix

**The Problem:**

The original code used `latitude: 0, longitude: 0` (Null Island). Sending emergency contacts to `0,0` is **dangerous** — rescue services would go to the middle of the Atlantic Ocean.

```typescript
// ❌ DANGEROUS — sends contacts to Null Island
const data = {
  latitude: 0,
  longitude: 0,
};
```

**The Fix:** The `getLocation()` function in §3.2 handles three cases:

| Case | Behavior |
|------|----------|
| GPS permission granted + lock acquired | Returns precise coordinates, caches them for future use |
| GPS permission denied | Returns `null` |
| GPS times out (>5s) | Falls back to `AsyncStorage` cached location from last app foreground |

**SMS message varies by location availability:**

```
GPS available:  "Location: maps.google.com/?q=37.7749,-122.4194"
No GPS:         "Location unavailable — please call Sarah directly."
```

**Why this matters:** Sending `0,0` makes the SOS feature worse than useless in an emergency. A null location with "please call them" is infinitely safer — the contact will call the user to check in.

---

### 🟡 3.6 Critical Gap: Hardcoded User Name — Must Fix

**The Problem:**

```typescript
// ❌ Hardcoded 'User' — contact sees "SOS Alert from User. ..."
sendSmsFallback(phoneNumbers, 'User', location);
```

The contact receiving "SOS from User" may:
- Ignore it as spam
- Not recognize the sender
- Delay responding while figuring out who "User" is

**The Fix:** Use the authenticated user's real display name from the auth store:

```typescript
const user = useAuthStore(state => state.user);
const userName = user?.display_name || user?.email || 'Someone';
sendSmsFallback(phoneNumbers, userName, location);
```

Priority: `display_name` → `email` → `'Someone'`. This ensures the SMS always has a recognizable name.

**Why this matters:** An emergency SMS saying "Sarah needs help" triggers an immediate response. "User needs help" triggers confusion and delay.

---

### 🟢 3.7 Optional Enhancement: Last Known Location Cache

**The Problem:** GPS acquisition takes 1-5 seconds. In a panic situation, the user needs the SOS sent **now**, not after waiting for a GPS lock.

**The Fix:** Maintain a persistent "last known location" in AsyncStorage that updates on every app foreground and background GPS check.

**App startup updater** (add to `src/app/App.tsx`):

```typescript
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_LOCATION_KEY = 'shecare.last_known_location';

async function updateLastKnownLocation(): Promise<void> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // Low power — okay for caching
      timeInterval: 60000,             // 1 min max age
    });
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc.coords));
  } catch {
    // Silent — not critical
  }
}

// In App component:
useEffect(() => {
  // Update location on app foreground
  const sub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      updateLastKnownLocation();
    }
  });
  // Initial fetch
  updateLastKnownLocation();
  return () => sub.remove();
}, []);
```

**In SOS trigger** (already handled by the `getLocation()` function in §3.2 — it falls back to cached location on GPS failure):

```typescript
// getLocation() already does:
// 1. Try fresh GPS lock (5s timeout)
// 2. If fails → read AsyncStorage cached location
// 3. If no cache → return null
```

**Why this matters:** The user triggers SOS → SMS opens instantly with the last known location (even if stale). Zero seconds of waiting. In an emergency, every second counts.

---

### 🟡 3.8 Critical Gap: handleImSafe and handleCancelSos Not Queued Offline

**The Problem:**

When the user resolves or cancels an SOS while offline, the current code shows a toast but **never enqueues the operation**:

```typescript
// Current (broken — offline data loss)
const handleImSafe = async () => {
  try {
    await resolveMutation.mutateAsync(activeAlert.id);
    setPhase('resolved');
  } catch (err) {
    // ❌ Shows toast, navigates back — SERVER NEVER KNOWS IT WAS RESOLVED
    Toast.show({ type: 'info', text1: 'Will sync when online' });
    navigation.goBack();
  }
};
```

**The Scenario:**
1. User triggers SOS offline → queued `safety/sos/trigger` → SMS sent to contacts
2. SOS is now in `ACTIVE` state on the server (when it eventually syncs)
3. User resolves the emergency (taps "I'm Safe") — still offline
4. API call fails (offline)
5. Toast says "Will sync when online" → navigates back
6. **The resolve operation is never queued.** The server only has an ACTIVE SOS with no resolution.
7. The 15-minute check-in Celery task keeps re-sending notifications to contacts, **scaring them unnecessarily**

**The Fix:** The code in §3.2 now explicitly queues resolve and cancel operations:

```typescript
const handleImSafe = async () => {
  if (!activeAlert) return;
  try {
    await resolveMutation.mutateAsync(activeAlert.id);
    setPhase('resolved');
    setTimeout(() => navigation.goBack(), 1500);
  } catch (err) {
    // ✅ Queue the resolve for later sync
    await enqueueResolve(activeAlert.id).catch(() => {});
    Toast.show({
      type: 'info',
      text1: "We'll sync when online. You're marked as safe locally.",
    });
    setPhase('resolved');
    setTimeout(() => navigation.goBack(), 1500);
  }
};

const handleCancelSos = async () => {
  if (!activeAlert) return;
  try {
    await cancelMutation.mutateAsync(activeAlert.id);
    navigation.goBack();
  } catch (err) {
    // ✅ Queue the cancel for later sync
    await enqueueCancel(activeAlert.id).catch(() => {});
    Toast.show({
      type: 'info',
      text1: 'Cancel will sync when online.',
    });
    navigation.goBack();
  }
};
```

**New safetySyncQueue functions** (added in §3.2):

| Function | Type | Endpoint | Priority |
|----------|------|----------|----------|
| `enqueueResolve(sosId)` | `safety/sos/resolve` | `POST /safety/sos/{id}/resolve` | high |
| `enqueueCancel(sosId)` | `safety/sos/cancel` | `POST /safety/sos/{id}/cancel` | high |

**Why this matters:** Without queuing, the server will never know the SOS was resolved. The 15-minute check-in Celery task keeps re-notifying contacts, causing repeated false alarms. This is **safety-critical**. Fixing it ensures the check-in task is automatically stopped when the resolve syncs online.

**Updated validation tests to add to §3.4:**

| # | Test | Expected |
|---|------|----------|
| 11 | Offline SOS → tap "I'm Safe" while offline | Resolve queued. Toast: "We'll sync when online." No further contact notifications. |
| 12 | Offline SOS → tap "Cancel (false alarm)" while offline | Cancel queued. Toast: "Cancel will sync when online." |
| 13 | Offline resolve → go online → sync | Server SOS marked as resolved. Check-in task stops. |
| 14 | Offline cancel → go online → sync | Server SOS cancelled. Contacts notified of false alarm. |

---

### 🟢 3.9 Minor Refinement: Network Detection Order

The SOS flow currently attempts API first, and only on network failure falls back to SMS. This is the correct order for an offline-first app — always try the optimal path first.

**Edge case to be aware of:**

What if the API call **succeeds** (HTTP 200) but the server fails to deliver push/SMS notifications (e.g., FCM token expired, Twilio API down)? The user sees "SOS ACTIVE" and assumes contacts are being notified — but they're not.

**Recommendation (Optional — not blocking):**

For critical SOS, consider always opening the SMS app as a **belt-and-suspenders** backup, even on the success path:

```typescript
try {
  await triggerMutation.mutateAsync({ data, idempotencyKey });
  // API succeeded, but ALSO send SMS as backup confirmation
  if (contacts && contacts.length > 0) {
    sendSmsFallback(phoneNumbers, userName, location ?? undefined);
  }
  setPhase('active');
} catch (err) {
  // ... offline fallback ...
}
```

**Trade-off:** This may annoy users with reliable connectivity (double notification: push + SMS). 

**Our stance:** The current flow (API-first, SMS-on-failure) is acceptable for Phase 2. Revisit this if users report "SOS was active but contacts weren't notified." The SMS backup path exists and is well-tested — it's just one less `if` check away from being always-on.

---

## 4. Phase 2b: Wire Cycle Model Background Downloader

### 4.1 Current vs. Future Design

| Aspect | Current | Future |
|--------|---------|--------|
| Trigger | Only when `CycleDashboardScreen` mounts | On app start + on Wi-Fi connect |
| Feedback | Silently downloads, no user indication | Toast: "Cycle prediction model updated" |
| Retry | No retry on failure | Retries on next online check |
| Scope | Cycle model only (separate from wellness) | Unified with wellness model updater |

### 4.2 Implementation

**File:** `src/screens/cycle/CycleDashboardScreen.tsx`

```typescript
import { useNetworkStatus } from 'src/services/sync';
import { modelUpdater } from 'src/services/ml';

export function CycleDashboardScreen() {
  const { isConnected } = useNetworkStatus();

  // Existing: ensureLatest on mount
  useEffect(() => {
    globalModelClient.ensureLatest().catch(() => null);
  }, []);

  // NEW: Check for model updates on mount when on Wi-Fi
  useEffect(() => {
    if (isConnected) {
      modelUpdater.checkForUpdate().then((result) => {
        if (result.wellness || result.minilm) {
          Toast.show({
            type: 'success',
            text1: 'Wellness model updated — predictions improved',
          });
        }
      }).catch(() => {
        // Silently fail — model can use heuristic fallback
      });
    }
  }, [isConnected]);
}
```

**File:** `src/services/ml/globalModel.ts` — Add model update check

The `globalModelClient.ensureLatest()` already handles:
- Checking current version against server
- Downloading if stale
- Caching to EncryptedStorage
- Bundled fallback if download fails

No changes needed to the core download logic — only the trigger needs to be added to the dashboard `useEffect`.

### 4.3 Background Download Strategy

```
App launch
  → useWellnessHydration() checks wellness + minilm models (existing)
  → CycleDashboardScreen mounts
    → globalModelClient.ensureLatest() (existing)
    → modelUpdater.checkForUpdate() (NEW — only on Wi-Fi)

On Wi-Fi connect (NetInfo event):
  → modelUpdater.checkForUpdate()
  → globalModelClient.ensureLatest()
```

### 4.4 Validation Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Open dashboard on Wi-Fi | Model versions checked, download if stale |
| 2 | Open dashboard on cellular | Models NOT downloaded (conserves data) |
| 3 | New model available on server | Downloaded, cached, ONNX session reloaded |
| 4 | Download fails | Bundled fallback used, no crash |
| 5 | Toast shown on successful update | User notified |

---

## 5. Phase 2c: Fix Period Log Entry

### 5.1 Implementation

**File:** `src/screens/cycle/LogPeriodScreen.tsx`

Replace the current `onSubmit` (which only logs to console) with a real mutation call:

```typescript
import { useCreateCycleEntry } from 'src/services/queries';
import Toast from 'react-native-toast-message';

export function LogPeriodScreen() {
  // ... existing hooks ...
  const { mutate: createEntry, isPending } = useCreateCycleEntry();

  const onSubmit = async (data: LogPeriodForm) => {
    createEntry(
      {
        period_start_date: data.startDate,
        period_end_date: data.endDate || undefined,
        flow_intensity: selectedFlow,
        symptoms: selectedSymptoms,
        mood_tags: selectedMoods,
        energy_level: energyLevel,
        notes: data.notes,
      },
      {
        onSuccess: () => {
          navigation.goBack();
        },
        onError: (error) => {
          // Phase 1 already handles offline queuing
          // Phase 1's onError in the hook handles offline toast
        },
      },
    );
  };
}
```

**Also update the UI to disable the button while submitting:**

```typescript
<Button
  label={isPending ? 'Saving...' : 'Save period log'}
  onPress={handleSubmit(onSubmit)}
  disabled={!formState.isValid || isPending}
  fullWidth
/>
```

### 5.2 Data Mapping

| LogPeriodScreen field | API field (`POST /cycle/entries`) |
|-----------------------|-----------------------------------|
| `data.startDate` | `period_start_date` |
| `data.endDate` | `period_end_date` |
| `selectedFlow` | `flow_intensity` (Light/Medium/Heavy/Very Heavy) |
| `selectedSymptoms` | `symptoms` (string[]) |
| `selectedMoods` | `mood_tags` (string[]) |
| `energyLevel` | `energy_level` (1-10) |
| `data.notes` | `notes` |

### 5.3 Validation Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Log period entry (online) | POST succeeded, calendar updates |
| 2 | Log period entry (offline) | Queued, "Saved offline" toast, calendar shows entry |
| 3 | Offline → online | Entry syncs, calendar shows server data |
| 4 | App restart with queued entry | Phase 1 persistence → entry still visible |
| 5 | Log period with all fields | Flow, symptoms, mood, energy all stored |

---

## 6. Dependency Map

```
Phase 1 (foundation)
  ├── offlineStore.enqueue() wired in mutation hooks
  └── React Query cache persisted
       │
Phase 2 (this phase)
  ├── SOSActiveScreen uses enqueue + SMS fallback
  │     └── depends on: useTriggerSos error handling (Phase 1)
  ├── CycleDashboardScreen triggers model updates
  │     └── depends on: modelUpdater (existing)
  └── LogPeriodScreen calls useCreateCycleEntry
        └── depends on: useCreateCycleEntry offline queue (Phase 1)
```

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SMS fallback opens wrong contact | Low | High | Only send to verified emergency contacts from API |
| User dismisses SMS without sending | Medium | Medium | Show persistent "SOS pending SMS" indicator |
| Duplicate SOS entries on server | Medium | Medium | Idempotency-Key header prevents duplicates |
| Model download on cellular data | Low | Medium | `modelUpdater` already checks for Wi-Fi only |
| Period entry duplicates on reconnect | Low | Low | Idempotency-Key + server-side dedup |
| GPS sends null island (0,0) | **High** | **Critical** | **Fixed in §3.5** — `getLocation()` returns null on failure, SMS falls back to "Location unavailable" |
| GPS timeout delays SOS send | Medium | Medium | AsyncStorage cached location used as instant fallback (§3.7) |
| User name 'User' causes contact to ignore SMS | **High** | **High** | **Fixed in §3.6** — uses `display_name` from auth store with `'Someone'` fallback |
| Location permission never granted | High | Low | SMS still fires — just without coordinates + instruction to call user |

---

## 8. Deploy Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
npx eslint src/screens/safety/SOSActiveScreen.tsx src/screens/cycle/LogPeriodScreen.tsx
```

Plus manual verification of all validation checklists above.
