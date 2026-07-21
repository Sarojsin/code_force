# Zustand Store Audit

| Store | File | Persist? | Key | Data Size | Holds Server Data? | Phase 2 Action |
|-------|------|----------|-----|-----------|-------------------|----------------|
| `authStore` | `src/stores/authStore.ts` | Yes (EncryptedStorage) | `shecare.user`, `shecare.accessToken`, `shecare.refreshToken` | Small (< 5KB) | Yes (user profile + tokens) | KEEP EncryptedStorage persist |
| `offlineStore` | `src/stores/offlineStore.ts` | Yes (EncryptedStorage) | `shecare.offline.queue` | Variable (queue items) | No (pending operations) | KEEP EncryptedStorage persist |
| `cycleStore` | `src/stores/cycleStore.ts` | No (in-memory only) | — | Small (< 1KB) | No (UI ephemeral state) | REMOVED AsyncStorage persist |
| `endDateStore` | `src/stores/endDateStore.ts` | No (in-memory only) | — | Small (< 1KB) | No (transient UI state) | REMOVED AsyncStorage persist |
| `onboardingStore` | `src/stores/onboardingStore.ts` | Yes (AsyncStorage) | `shecare.onboarding` | Small (< 5KB) | No (UI state) | KEEP AsyncStorage persist |
| `syncMetricsStore` | `src/stores/syncMetricsStore.ts` | Yes (AsyncStorage) | `shecare.sync.metrics` | Small (< 1KB) | No (analytics) | KEEP AsyncStorage persist |
| `safetyStore` | `src/stores/safetyStore.ts` | No (in-memory only) | — | Small (< 1KB) | No (session state) | KEEP in-memory only |

## Migration decisions

- `cycleStore`: Stripped persist middleware. Now holds only UI ephemeral state (`localCorrectionDelta`, `deltaPredictionId`, `lastPredictedStart`). Persistent data lives in EncryptedStorage (`local_correction_delta`).
- `endDateStore`: Stripped persist middleware. End-date pending state is transient — survives via notification system instead of AsyncStorage.
- All other stores unchanged.
