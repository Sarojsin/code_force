# Feature "Download & Install" Plan — The Game DLC Model for SheCare

**Target:** Low-end mobile devices (2GB RAM, 32GB storage, 2G/3G networks)

**Goal:** Users can browse, download, and activate optional health features (e.g., Nutrition, Meditation, Telemedicine) just like installing DLC maps in a game.

**Philosophy:** "Ship the Framework, Download the Content."

---

## 1. The Core Decision: How to Deliver the Features?

Since you are targeting low-end mobiles with slow networks, do **NOT** download the actual JavaScript code over 2G/3G for V1.

| Option | Approach | Low-End Safe? |
|--------|----------|---------------|
| Pre-Bundled + Lazy (V1) | Ship ALL optional feature code inside the APK/IPA, but hide it behind flags and lazy-load it at runtime. | ✅ YES (No network wait, but APK is larger). |
| OTA Download (V2) | Ship only the core app. Download optional features via EAS/CodePush over Wi-Fi. | ⚠️ PARTIAL (Must enforce Wi-Fi + background download). |

The Plan splits into two phases:

- **Phase 1 (Immediate):** Pre-bundle all features, hide them, and lazily load them (`React.lazy`). This gives instant "Install" feedback (just toggles a flag).
- **Phase 2 (Post-Launch):** Move optional features to downloadable OTA bundles to shrink the initial APK size.

---

## 2. Phase 1: The Foundation (Feature Registry & Entitlements)

### 2.1 Backend: The "Feature Catalog"

Create a system that lists what features exist and who can access them.

**Database Table: `feature_catalog`**

| Column | Description |
|--------|-------------|
| `id` | Primary key |
| `key` | e.g., `nutrition` |
| `display_name` | Human-readable name |
| `description` | Short description |
| `icon_url` | Icon URL |
| `size_mb` | Feature size in MB |
| `is_premium` | boolean |

**Database Table: `user_features`**

| Column | Description |
|--------|-------------|
| `user_id` | Foreign key to user |
| `feature_key` | Feature identifier |
| `installed_at` | Timestamp |
| `is_active` | boolean |

**API Endpoints:**

- `GET /api/v1/features/catalog` → Returns all available features.
- `GET /api/v1/features/my` → Returns installed features for the current user.
- `POST /api/v1/features/install` → Adds the feature to the user's account (validates premium status).
- `POST /api/v1/features/uninstall` → Removes the feature from the user's account.

### 2.2 Mobile Store: The "Feature Flags" (SQLite)

You already have `FeatureFlagLocalService.ts`. Extend it to sync with the backend.

**Schema:** Add `features` table (or use `user_meta` JSON) to store:

| Column | Description |
|--------|-------------|
| `feature_key` | Primary Key |
| `installed` | boolean |
| `downloaded_at` | timestamp |

**Installation Logic (Instant):**

When the user taps "Install" on a pre-bundled feature:

1. App calls `POST /features/install` to update the server.
2. App writes `installed = true` to SQLite (local `FeatureFlagService`).
3. UI instantly updates to show the new screen.

---

## 3. Phase 2: The "Feature Store" (User Interface)

### 3.1 Screen Architecture

Create a new screen called **"Feature Marketplace"** accessible from the Profile/Settings tab.

**UI Layout:**

```
┌──────────────────────────────────────┐
│  📦 Feature Store                     │
│  [ Search / Filter ]                  │
├──────────────────────────────────────┤
│  ⭐ Premium Picks                     │
│  ┌──────────────────────────────────┐ │
│  │ 🥗 Nutrition Tracker             │ │
│  │ Track meals & hydration          │ │
│  │ [  Free  ] [ Install ]          │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │ 🧘 Meditation Guide              │ │
│  │ Guided breathing exercises       │ │
│  │ [ Premium ] [ 5.2 MB  ]        │ │
│  └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  [ My Features ] (takes you to list) │
│  🥗 Nutrition [ Active ]             │
│  🩺 Telemedicine [ Not Active ]      │
└──────────────────────────────────────┘
```

### 3.2 The "Install" Flow (The User Journey)

| Step | UI Action | System Behavior |
|------|-----------|-----------------|
| 1. Browse | User sees the catalog fetched from `/catalog`. | Displays name, description, and "Install" button. Shows "Premium" badge for paid features. |
| 2. Click "Install" | User taps the button. | Check Internet: If offline, show "Connect to Wi-Fi to install." If online, proceed. |
| 3. Server Validation | App sends `POST /features/install`. | Backend checks if user has permission (premium). If not, returns 403. If yes, updates `user_features` table. |
| 4. Local Activation | App receives 200 OK. | Writes to SQLite `feature_installed = true`. |
| 5. UI Update | The button changes to "Installed ✅". The navigation stack rebuilds. | The new tab/screen appears immediately. |

---

## 4. Phase 3: Mobile Navigation (Dynamic Route Building)

To support modular features without hardcoding them, dynamically build your `MainTabs` or `HomeStack` based on the installed features.

**The Rule:** Don't declare screens in one giant static array. Build the route array at runtime.

**The Logic:**

```
1. Read `installed_features` from SQLite (synchronous).
2. Define a Base Map:
   - Core Routes: [Home, Calendar, Profile] (Always visible).
   - Optional Routes: { 'nutrition': NutritionScreen, 'meditation': MeditationScreen, ... }
3. Filter the Optional Routes: Keep only those where `installed_features` has the key.
4. Combine Core + Filtered Optional Routes.
5. Render the Stack/Tab navigator with this dynamic array.
```

**Offline Behavior:** Since the "install" flag is stored in SQLite, the features remain visible even if the user is offline. This is critical for your offline-first promise.

---

## 5. Phase 4: Uninstallation & Cleanup (The "Unsubscribe" Flow)

If a user wants to remove a feature (to save storage or declutter the UI):

**User Action:** Taps "Uninstall" in the Feature Store or Settings.

**App Action:**

1. Calls `POST /features/uninstall` (deletes the server record).
2. Deletes the local SQLite record (`installed = false`).

**Warning:** What about the user's historical data (e.g., past nutrition logs)?

**Decision:** Soft Archive. Keep the data in the `nutrition_entries` table, but hide the UI. If the user re-installs later, the data reappears instantly. This prevents data loss.

**UI:** The tab disappears instantly.

---

## 6. Phase 5: Low-End Mobile Optimization Strategy

To prevent crashes and lag on 2GB RAM devices, enforce these strict rules:

| Constraint | Rule | Why |
|------------|------|-----|
| Download Gate | Features must be pre-bundled in V1. No download over cellular. For V2, enforce "Wi-Fi only" for OTA downloads. | Prevents app from freezing during downloads on 2G/3G. |
| Lazy Loading | ALL optional feature screens MUST use `React.lazy()` + `<Suspense>`. | Reduces the initial JavaScript heap size. The app only parses the Nutrition code when the user actually taps the Nutrition tab. |
| RAM Throttle | If a feature uses heavy animations (like Lottie), pre-warm the animation on a background thread or use `InteractionManager`. | Prevents UI thread blocking. |
| Storage Check | Before installing an OTA feature, check `FileSystem.getFreeDiskStorage()`. If < 100 MB free, show "Storage full" and block installation. | Prevents OS-level app crashes due to `SQLITE_FULL` (Scenario 45). |

---

## 7. Phase 6: The "Game DLC" Download (Future V2)

For V2, when you want to truly reduce APK size:

**Build Features as Standalone Bundles:**

- Use `react-native-bundle-visualizer` to split your code.
- Use EAS Updates with channel targeting (e.g., `nutrition-channel`).

**Delivery Mechanism:**

1. The app checks `GET /features/catalog` to see if a new version exists.
2. If the user is on Wi-Fi and Battery > 50%, the app silently downloads the bundle in the background using `expo-updates` (via a silent update).
3. When the download finishes, the app shows a notification: "New feature ready! Restart to use."

**Fallback:** If the download fails, the app retries on the next Wi-Fi connection. The old version of the app remains functional.

---

## 8. Validation Checklist (QA)

Before deploying the Feature Store:

- [ ] **Install (Online):** User taps "Install". Feature appears instantly.
- [ ] **Install (Offline):** User taps "Install" while offline. The app shows "No internet." Does not crash.
- [ ] **Premium Lock:** Free user tries to install a "Premium" feature. Server returns 403. App shows "Upgrade to unlock."
- [ ] **Uninstall:** User taps "Uninstall." Tab disappears. Re-install: Data reappears.
- [ ] **Lazy Load:** Open the app. The Nutrition code should NOT be loaded until you navigate to the Nutrition tab. Check via network/console logs.
- [ ] **Storage Full:** Simulate a full disk. Attempt to download/activate. The app shows a toast and does not crash.
- [ ] **Multi-Device Sync:** Install a feature on Device A. Open Device B. The feature should be installed there too (via `GET /features/my`).

---

## 9. Summary Roadmap

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| Week 1 | Backend & Schema | `feature_catalog` + `user_features` tables. API endpoints. |
| Week 2 | Mobile Store UI | The "Feature Marketplace" screen. Displaying catalog. Install/Uninstall logic. |
| Week 3 | Navigation Logic | Dynamic rendering of MainTabs. React.lazy integration. SQLite flags. |
| Week 4 | Optimization & Testing | Wi-Fi gate, RAM monitoring, edge-case testing. |

This plan gives you a complete "Game DLC" experience for your health app, optimized for low-end devices. 🚀🌸📦
