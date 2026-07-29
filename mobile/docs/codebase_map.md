# SheCare Mobile Codebase Map

> All `.ts` and `.tsx` files under `mobile/src/` with a short description of what each file contains.

---

## `app/`

**`App.tsx`** — Root React component. Wires providers, navigator, and global overlays. Runs SQLite migrations before UI renders. Registers background sync task, network reconnect listener, AppState foreground/background handlers, location updates, and notification deep-link listener.

**`providers.tsx`** — Provider tree: `GestureHandlerRootView` → `SafeAreaProvider` → `QueryClientProvider` → `ThemeProvider`. Creates the shared TanStack Query client with `offlineFirst` network mode, retry rules, stale times, and gc times.

---

## `components/ui/`

Shared atomic/molecular UI components reused across screens.

| File | Description |
|------|-------------|
| `AchievementBadge.tsx` | Badge component for Luna achievement unlocks |
| `AchievementPopup.tsx` | Popup overlay shown when Luna unlocks an achievement |
| `BackfillCard.tsx` | Card UI for backfill/sync status items |
| `BottomSheet.tsx` | Reusable bottom sheet modal |
| `BreathingListScreen` | Screen listing breathing exercises with completion tracking |
| `Calendar.tsx` | Custom calendar grid UI for cycle tracking |
| `Card.tsx` | Elevated card container with theme-aware styling |
| `CelebrationAnimation.tsx` | Lottie/animated celebration effect for milestones |
| `ConnectivityBanner.tsx` | Top banner shown when device is offline |
| `DatePickerField.tsx` | Native date picker wrapper with theme styling |
| `EndDatePromptCard.tsx` | Card prompting user to mark period end date |
| `ErrorBoundary.tsx` | Global error boundary with restart fallback |
| `ErrorState.tsx` | Reusable error state component with retry action |
| `FormField.tsx` | Themed form input wrapper with label and validation |
| `HealthMetricCard.tsx` | Card displaying a single Luna health metric |
| `Index.ts` | Barrel export for all UI components |
| `KeyboardAvoidingWrapper.tsx` | Keyboard-avoiding scroll wrapper for forms |
| `Loader.tsx` | Loading spinner overlay |
| `MarkEndDateModal.tsx` | Modal for selecting period end date |
| `Modal.tsx` | Reusable centered modal dialog |
| `MoodPicker.tsx` | Grid selector for mood entries |
| `PickerField.tsx` | Generic picker/dropdown field |
| `PickerField.web.tsx` | Web-specific picker implementation |
| `PredictionDetailCard.tsx` | Card showing cycle prediction detail |
| `ProgressBar.tsx` | Linear progress bar |
| `ProgressDots.tsx` | Dot indicator for carousels/steppers |
| `ScreenLayout.tsx` | Standard screen wrapper with safe area and padding |
| `Skeleton.tsx` | Shimmer skeleton placeholder for loading states |
| `StickyCard.tsx` | Card that sticks to top on scroll |
| `StreakBadge.tsx` | Badge showing streak count |
| `SymptomGrid.tsx` | Grid selector for cycle symptoms |
| `Text.tsx` | Themed text component with variant and color props |

---

## `screens/`

Feature screens (React Native components).

### `auth/`
| File | Description |
|------|-------------|
| `LoginScreen.tsx` | Email/password login form with validation |
| `OtpScreen.tsx` | OTP verification screen |
| `PhoneScreen.tsx` | Phone number input for OTP flow |
| `RegisterScreen.tsx` | Account creation form (email, password, display name) |

### `onboarding/`
| File | Description |
|------|-------------|
| `CompleteScreen.tsx` | Onboarding completion confirmation |
| `CurrentCycleScreen.tsx` | Collects current cycle start date and length |
| `LifestyleScreen.tsx` | Collects exercise, sleep, diet, stress data |
| `PastCycleScreen.tsx` | Collects historical cycle data for backfill |
| `PersonalInfoScreen.tsx` | Collects age, height, weight, display name |
| `WelcomeScreen.tsx` | Onboarding welcome/landing screen |

### `cycle/`
| File | Description |
|------|-------------|
| `CycleAnalyticsScreen.tsx` | Displays cycle length trends, top symptoms/moods with charts |
| `CycleDashboardScreen.tsx` | Main cycle dashboard with prediction summary and quick actions |
| `CycleHistoryScreen.tsx` | History of past period entries |
| `CyclePredictionsScreen.tsx` | Shows next predicted period, fertile window, confidence |
| `LogPeriodScreen.tsx` | Form to log a new period entry with symptoms, mood, flow |
| `MenstrualPhasesScreen.tsx` | Educational screen showing cycle phases |

### `wellness/`
| File | Description |
|------|-------------|
| `BreathingListScreen.tsx` | Lists available breathing exercises |
| `InsightsScreen.tsx` | Weekly wellness insights and recommendations |
| `JournalEntryScreen.tsx` | Create/edit journal entry with mood selector |
| `JournalListScreen.tsx` | List of journal entries with metadata |
| `MoodHistoryScreen.tsx` | Mood log history with date range |
| `MoodLogScreen.tsx` | Quick mood logging form |
| `WellnessHomeScreen.tsx` | Wellness home with journal, mood, breathing quick actions |

### `pregnancy/`
| File | Description |
|------|-------------|
| `PregnancyDailyLogScreen.tsx` | Log daily pregnancy symptoms, cravings, mood, BP |
| `PregnancyHomeScreen.tsx` | Pregnancy home dashboard with current week summary |
| `PregnancyMilestonesScreen.tsx` | Lists pregnancy milestones by week |
| `PregnancyProfileScreen.tsx` | View/edit pregnancy profile (LMP, due date, trimester) |
| `PregnancyRecommendationsScreen.tsx` | Personalized diet/exercise tips by trimester |

### `safety/`
| File | Description |
|------|-------------|
| `EmergencyContactEditScreen.tsx` | Add/edit emergency contact form |
| `EmergencyContactsScreen.tsx` | List of emergency contacts |
| `SafetyHomeScreen.tsx` | Safety home with SOS trigger and contacts summary |
| `SOSActiveScreen.tsx` | Active SOS alert screen with cancel/resolve actions |
| `SosHistoryScreen.tsx` | History of past SOS alerts |

### `family/`
| File | Description |
|------|-------------|
| `FamilyHomeScreen.tsx` | Lists linked family members and permissions |
| `InviteFamilyScreen.tsx` | Generate and share family invite link |

### `chat/`
| File | Description |
|------|-------------|
| `AIChatScreen.tsx` | AI chat interface with message list and input |
| `ChatHomeScreen.tsx` | Chat rooms list |
| `ChatRoomScreen.tsx` | Individual chat room with messages |

### `admin/`
| File | Description |
|------|-------------|
| `AdminDashboardScreen.tsx` | Admin dashboard with platform stats (mock data) |
| `UserManagementScreen.tsx` | User list with role filtering and management (mock data) |

### `profile/`
| File | Description |
|------|-------------|
| `ChangePasswordScreen.tsx` | Password change form with old password verification |
| `EditProfileScreen.tsx` | Edit name, DOB, blood group, medical notes |
| `LinkedFamilyScreen.tsx` | View linked family members and permissions |
| `ProfileHomeScreen.tsx` | Profile home with avatar, stats, quick settings |
| `SettingsScreen.tsx` | App settings: Luna toggle, notifications, privacy |

### `voice/`
| File | Description |
|------|-------------|
| `VoiceJournalScreen.tsx` | Voice journal recording interface |
| `VoiceHistoryScreen.tsx` | List of past voice journal entries |

### `companion/`
| File | Description |
|------|-------------|
| `HealthHubScreen.tsx` | Luna health hub with daily metrics and achievements |
| `LunaInstallScreen.tsx` | Luna install/uninstall flow with download progress |
| `LunaOverlay.tsx` | Draggable Luna cat overlay on home dashboard |

### `home/`
| File | Description |
|------|-------------|
| `HomeDashboardScreen.tsx` | Main home dashboard with predictions, quick actions, Luna overlay |
| `VideoLibraryScreen.tsx` | Video library with categories, search, continue watching |

### `analytics/`
| File | Description |
|------|-------------|
| `AnalyticsDashboardScreen.tsx` | Cross-cycle analytics with charts (cycle length, symptoms, moods) |

### `dev/`
| File | Description |
|------|-------------|
| `OfflineDashboardScreen.tsx` | Dev screen showing offline queue and sync metrics |

### Root
| File | Description |
|------|-------------|
| `SplashScreen.tsx` | Splash screen shown during auth hydration and migrations |

---

## `navigation/`

React Navigation setup.

| File | Description |
|------|-------------|
| `AuthStack.tsx` | Stack: Login, Register, Phone, Otp |
| `CalendarStack.tsx` | Stack for Calendar tab (rides on HomeStack/Dashboard) |
| `FeatureStacks.tsx` | Profile stack and other feature stacks (CompanionInstall, Settings, etc.) |
| `HomeStack.tsx` | Stack for Home tab: Dashboard, MoodLog, MoodHistory, Predictions, Videos, AIChat, Journal, Breathing, Insights, HealthHub |
| `MainTabs.tsx` | Bottom tab navigator: Home, Calendar, Analytics, AI Chat, Profile |
| `OnboardingStack.tsx` | Stack for onboarding screens |
| `ProfileStack.tsx` | Re-export of FeatureStacks ProfileStack |
| `RootNavigator.tsx` | Root navigator: decides Splash → Auth / Onboarding / Main based on auth state and onboarding completion |
| `CycleStack.tsx` | Stack for cycle-related screens |
| `AnalyticsStack.tsx` | Stack for analytics tab |
| `AIChatStack.tsx` | Stack for AI chat tab |
| `SafetyStack.tsx` | Stack for safety tab |
| `WellnessStack.tsx` | Stack for wellness tab |
| `PregnancyStack.tsx` | Stack for pregnancy tab |
| `index.ts` | Barrel export for navigators |
| `rootNavigation.ts` | Imperative navigation helper (`navigate()`) used across app |
| `types.ts` | TypeScript `ParamList` types for all stacks and tabs |

---

## `services/`

Business logic, API clients, sync, ML, companion engine.

### Root-level services
| File | Description |
|------|-------------|
| `assetDownloader.ts` | Downloads/extracts Luna assets (zip), verifies checksum, manages install/uninstall lifecycle, emits `luna_installed`/`luna_uninstalled` events |
| `dbHealthCheck.ts` | Checks SQLite database health and connectivity |
| `endDateNotifications.ts` | Schedules and manages notifications for marking period end date |
| `eventBus.ts` | In-app typed event emitter for cross-module communication (e.g. `luna_installed`, `sync_completed`) |
| `healthTips.ts` | Fetches health tips from `/wellness/health-tips` with local JSON fallback |
| `safetySyncQueue.ts` | Listens for SOS queue events and triggers sync when network returns |
| `sentry.ts` | Sentry initialization and configuration |
| `storage.ts` | Encrypted storage wrapper (`EncryptedStorage`) for tokens and sensitive data |
| `localDb/index.ts` | Barrel export for all local SQLite services |

### `api/` — HTTP layer
| File | Description |
|------|-------------|
| `client.ts` | Axios instance, token store (encrypted), request/response interceptors, auto-refresh logic, session-expired auto-logout, `ApiSuccess`/`ApiError` envelope types |
| `index.ts` | Barrel export for all API services |
| `admin.ts` | Admin API: list users, update role, verify nurse, dashboard analytics, send broadcast |
| `auth.ts` | Auth API: register, login, OTP request/verify, getMe, logout, refresh, register device |
| `chat.ts` | Chat API: get Stream token, generate/use invite links, list rooms |
| `cycle.ts` | Cycle API: entries CRUD, predictions, history, calendar, analytics, model status/download, corrections, snooze |
| `family.ts` | Family API: list links, generate invite, get info, accept, update permissions, remove |
| `nurse_content.ts` | Nurse content API: list own contents, get detail (authenticated); public list/detail also available |
| `onboarding.ts` | Onboarding API: upsert, get, getStatus |
| `pregnancy.ts` | Pregnancy API: profile CRUD, daily logs CRUD, milestones, recommendations |
| `safety.ts` | Safety API: emergency contacts CRUD, SOS trigger/active/history/cancel/resolve, safety status; also exports `sendSmsFallback()` |
| `voice.ts` | Voice API: submit daily journal, get analysis |
| `wellness.ts` | Wellness API: journal CRUD, mood logs, breathing exercises, session completion, insights, journal analysis sync/model download |

### `queries/` — TanStack Query hooks
| File | Description |
|------|-------------|
| `index.ts` | Barrel export for query hooks |
| `admin.ts` | `useAdminUsers`, `useUpdateUserRole`, `useVerifyNurse`, `useDashboardAnalytics`, `useSendBroadcast` |
| `auth.ts` | `useRegister`, `useLogin`, `useRequestOtp`, `useVerifyOtp`, `useLogout` |
| `chat.ts` | Chat query hooks |
| `cycle.ts` | `useCycleEntries`, `useCreateCycleEntry`, `useUpdateCycleEntry`, `useDeleteCycleEntry`, `usePredictions`, `usePredictionHistory`, `useCalendar`, `useAnalytics`, `useModelStatus`, `useCorrections`, `useSnooze` |
| `family.ts` | `useFamilyLinks`, `useGenerateInvite`, `useAcceptInvite`, `useUpdatePermissions`, `useRemoveLink` |
| `nurse_content.ts` | `useContents`, `useContentDetail` |
| `offlineMutationWrapper.ts` | Helper to wrap mutations with offline queue fallback |
| `safety.ts` | `useEmergencyContacts`, `useCreateEmergencyContact`, `useUpdateEmergencyContact`, `useDeleteEmergencyContact`, `useTriggerSos`, `useActiveSos`, `useSosHistory`, `useCancelSos`, `useResolveSos` |
| `useNetworkAwareQuery.ts` | Hook that adapts query behavior based on network state |
| `useRefreshWithSqlite.ts` | Hook to refresh queries after SQLite hydration |
| `voice.ts` | Voice query hooks |
| `wellness.ts` | `useJournalEntries`, `useCreateJournalEntry`, `useMoodLogs`, `useCreateMoodLog`, `useBreathingExercises`, `useCompleteBreathingSession`, `useInsights` |

### `sync/` — Offline sync engine
| File | Description |
|------|-------------|
| `syncEngine.ts` | Core sync: `pushOperations` (batch push with gzip), `pullServerData`, `syncAll` (full cycle). Handles conflicts, retries, non-retryable failures, SQLite hydration, React Query invalidation |
| `syncHydrate.ts` | Hydration helpers: `hydrateFromServerData`, `hydrateChangeItems` — maps server responses to SQLite writes |
| `syncMetricsStore.ts` | Sync metrics tracking (success/failed counts, duration, queue size) |
| `isNetworkError.ts` | Utility to detect network errors |
| `types.ts` | Sync-related TypeScript types (`PendingOperation`, `SyncBatchResponse`, etc.) |
| `backgroundSync.ts` | Background fetch task triggering `syncAll` |
| `sentrySyncBreadcrumbs.ts` | Adds Sentry breadcrumbs for sync lifecycle events |

### `localDb/` — SQLite layer
| File | Description |
|------|-------------|
| `index.ts` | Barrel export for local DB services |
| `BaseLocalService.ts` | Base class with common CRUD helpers for SQLite tables |
| `backfillSqlite.ts` | Backfills SQLite from React Query cache on first boot |
| `cleanupObsoleteKeys.ts` | Removes obsolete AsyncStorage keys after migration |
| `migrateStoreDataToSqlite.ts` | Migrates legacy Zustand store data from AsyncStorage into SQLite |
| `syncPlaceholders.ts` | Local fallback data providers for offline-first queries (cycle, journal, mood, contacts, SOS, pregnancy, family, insights, predictions, calendar, feature flags) |
| `writeThroughHelpers.ts` | Helpers to write server responses back to SQLite (journal, mood, contacts, SOS, etc.) |
| `pruneLocalDb.ts` | Prunes soft-deleted or stale local records |
| `Connection.ts` | SQLite database connection setup via drizzle-orm |
| `CycleLocalService.ts` | Cycle entries SQLite operations |
| `MoodLocalService.ts` | Mood logs SQLite operations |
| `JournalLocalService.ts` | Journal entries SQLite operations |
| `EmergencyContactLocalService.ts` | Emergency contacts SQLite operations |
| `SosAlertLocalService.ts` | SOS alerts SQLite operations |
| `PregnancyProfileLocalService.ts` | Pregnancy profile SQLite operations |
| `PregnancyMilestoneLocalService.ts` | Pregnancy milestones SQLite operations |
| `FamilyLinkLocalService.ts` | Family links SQLite operations |
| `HealthInsightLocalService.ts` | Health insights SQLite operations |
| `FeatureFlagLocalService.ts` | Feature flags SQLite operations |
| `CompanionLocalService.ts` | Luna companion metadata SQLite operations |

### `ml/` — On-device ML
| File | Description |
|------|-------------|
| `wellnessClassifier.ts` | Loads and runs wellness ONNX model for journal sentiment/classification |
| `wellnessTypes.ts` | TypeScript types for model metadata and inference results |
| `minilmEmbedder.ts` | MiniLM embedding model for text similarity |
| `embedder.ts` | Generic embedder wrapper |
| `wordpieceTokenizer.ts` | WordPiece tokenizer implementation |
| `minilmTokenizer.ts` | MiniLM-specific tokenizer |
| `tokenizer.ts` | Tokenizer types and base class |
| `heuristicScorer.ts` | Fallback heuristic scoring when model unavailable |
| `globalModel.ts` | Global cycle prediction model loader and inference |
| `useWellnessHydration.ts` | Hook to initialize wellness classifier on app start |
| `useMinilmHydration.ts` | Hook to initialize MiniLM embedder on app start |
| `modelUpdater.ts` | Checks remote model versions and downloads ONNX updates over Wi-Fi |
| `index.ts` | Barrel export for ML services |

### `companion/` — Luna engine
| File | Description |
|------|-------------|
| `AnimationEngine.ts` | Manages Luna sprite animations (idle, bounce, sleep, celebrate) |
| `DialogueEngine.ts` | Loads dialogue JSON and selects contextual Luna speech |
| `SoundEngine.ts` | Loads and plays Luna sound effects (meow, purr, yawn, celebration) |
| `AchievementEngine.ts` | Evaluates user activity against achievement rules and emits unlocks |
| `MoodManager.ts` | Maps user mood/activity to Luna emotional state |
| `EmotionEngine.ts` | Coordinates Luna expression based on mood manager and context |
| `EventEngine.ts` | Main companion loop: ties animation, dialogue, sound, achievements, and mood together |
| `LunaSprite.tsx` | React component rendering Luna cat image/animation |
| `index.ts` | Barrel export for Luna sprite |
| `assetPaths.ts` | File paths for Luna assets (sprites, sounds, dialogues) |

---

## `stores/`

Zustand global state.

| File | Description |
|------|-------------|
| `authStore.ts` | Auth state: user object, hydration, login, register, logout, token cache |
| `cycleStore.ts` | Cycle-specific UI state (period logging, predictions, calendar selection) |
| `wellnessStore.ts` | Wellness UI state (journal drafts, breathing session progress) |
| `pregnancyStore.ts` | Pregnancy UI state (profile, daily log form, milestones) |
| `safetyStore.ts` | Safety UI state (SOS active, contact form) |
| `onboardingStore.ts` | Onboarding completion flag and step tracking |
| `companionStore.ts` | Luna state: install status, XP, coins, level, outfit, memory, settings |
| `offlineStore.ts` | Offline queue state: pending operations, enqueue/remove/retry/discard with encrypted persistence |
| `syncMetricsStore.ts` | Sync metrics: success/failed counts, durations, queue snapshots |
| `downloadStore.ts` | Luna asset download state: progress, bytes, error |
| `endDateStore.ts` | End-date prompt state for period tracking |
| `healthMetricsStore.ts` | Luna health hub metrics: daily logs, streaks, completion counts |
| `achievementStore.ts` | Achievement unlocks, popup queue, notification tracking |
| `index.ts` | Barrel export for all stores |

---

## `hooks/`

Empty directory. Custom hooks may be added later or live in `services/`.

---

## `validation/`

Zod schemas shared between frontend and backend.

| File | Description |
|------|-------------|
| `auth.ts` | Zod schemas for login, register, OTP, MFA, password change, device register |
| `cycle.ts` | Zod schemas for cycle entry create/update, correction, snooze |
| `wellness.ts` | Zod schemas for journal entry create, mood log create, breathing session complete |
| `onboarding.ts` | Zod schemas for onboarding upsert |
| `index.ts` | Barrel export for validation schemas |

---

## `types/`

Shared TypeScript types.

| File | Description |
|------|-------------|
| `auth.ts` | Types for `User`, `LoginResponse`, `RegisterRequest`, `TokenPair` |
| `onboarding.ts` | Types for `OnboardingData`, `OnboardingResponse`, `OnboardingStatusResponse` |
| `assets.d.ts` | Type declarations for imported assets |
| `expo-location.d.ts` | Type declarations for Expo Location |
| `index.ts` | Barrel export for types |

---

## `utils/`

Utility functions.

| File | Description |
|------|-------------|
| `uuid.ts` | UUID generator (native when available, fallback to Math.random) |
| `logger.ts` | Structured logger wrapper (console in dev, Sentry in prod) |
| `predictionColors.ts` | Color helpers for cycle prediction UI (fertile, period, ovulation, etc.) |
| `cyclePhases.ts` | Cycle phase calculation helpers (menstrual, follicular, ovulation, luteal) |
| `index.ts` | Barrel export for utils |

---

## `theme/`

Design system.

| File | Description |
|------|-------------|
| `tokens.ts` | Design tokens: colors (primary, secondary, success, danger, background, surface, text variants), spacing scale, radius, typography scale, shadows |
| `ThemeProvider.tsx` | React context provider exposing `useTheme()` hook |
| `index.ts` | Barrel export for theme |

---

## `constants/`

App constants.

| File | Description |
|------|-------------|
| `config.ts` | `API_BASE_URL`, `lunaEnabled`, feature flags, model paths |
| `symptoms.ts` | Symptom vocabulary arrays for cycle and wellness logging |
| `companion.ts` | Luna companion constants (XP thresholds, sound names, outfit IDs) |
| `index.ts` | Barrel export for constants |

---

## `db/`

Drizzle ORM schema and migrations.

| File | Description |
|------|-------------|
| `schema.ts` | All 21 SQLite table definitions: user_profiles, onboarding_data, cycle_entries, journal_entries, mood_logs, emergency_contacts, sos_alerts, pregnancy_profiles, pregnancy_daily_logs, pregnancy_milestones, pregnancy_recommendations, family_links, chat_rooms, nurse_contents, feature_flags, health_insights, predictions, snooze_events, sync_log, companion_metadata, health_metrics. Includes indexes and type inference. |
| `connection.ts` | SQLite database connection and migration runner setup |
| `migrations/` | Auto-generated Drizzle migration files |
