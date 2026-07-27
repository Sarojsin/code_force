# Day 8 — Downloadable Assets (Game DLC Model)

## Goal
Build the full "Download Luna" flow: the user taps "Download", the app downloads a ~4.5 MB zip from the backend, verifies it with SHA-256, extracts it to the file system, and activates Luna. All of this with offline resume and cellular data warnings.

---

### Required Dependency

Before implementing, install the zip extraction library:

```bash
npx expo install react-native-zip-archive
```

This is used by `extractZip()` in §8.4. The library is well-maintained and supports both iOS and Android.

---

## 8.1 Architecture Overview

### What is Pre-Bundled (in APK, ~200 KB)
- All React/TS code (components, stores, engines, schemas)
- The `LunaSprite` inline SVG placeholder
- Fallback dialogue set (2-3 messages per context)

### What is Downloaded (from CDN, ~4.5 MB)
- `luna_assets_v1.zip` containing:
  - `spritesheet.png` (animated cat frames)
  - `spritesheet.json` (frame coordinates)
  - `dialogues.json` (full 80+ message set)
  - `sounds/meow.mp3`, `sounds/purr.mp3`, `sounds/celebrate.mp3`

### Backend Endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/v1/features/luna/metadata` | GET | `{ version, size_mb, checksum_sha256, download_url }` |
| `download_url` | GET | Binary `.zip` file (hosted on S3/CDN) |

---

## 8.2 Backend: Metadata Endpoint

In the backend, add a simple endpoint that returns the latest asset version info.

**File:** `backend/app/modules/luna/routes.py`

```python
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/features/luna", tags=["luna"])

class LunaAssetMetadata(BaseModel):
    version: str = "1.0.0"
    size_mb: float = 4.5
    checksum_sha256: str = "abc123def456..."  # actual hash of the zip
    download_url: str = "https://cdn.shecare.app/luna_assets_v1.zip"

@router.get("/metadata", response_model=LunaAssetMetadata)
async def get_luna_metadata():
    # In production, read from config or DB
    return LunaAssetMetadata()
```

**Security note:** Use a signed CDN URL with expiration for production to prevent hotlinking.

---

## 8.3 Mobile: Download Store (Zustand)

**File:** `src/stores/downloadStore.ts`

```typescript
/**
 * Tracks the download progress for Luna assets.
 * Part of the Game DLC model — keeps the APK lean.
 */
import { create } from 'zustand';

export type DownloadState =
  | 'idle'
  | 'checking_wifi'
  | 'downloading'
  | 'extracting'
  | 'verifying'
  | 'ready'
  | 'error'
  | 'paused';

interface DownloadStore {
  state: DownloadState;
  progress: number;       // 0–100
  errorMessage: string | null;
  bytesDownloaded: number;
  totalBytes: number;

  setState: (state: DownloadState) => void;
  setProgress: (progress: number) => void;
  setError: (message: string) => void;
  setBytes: (downloaded: number, total: number) => void;
  reset: () => void;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  state: 'idle',
  progress: 0,
  errorMessage: null,
  bytesDownloaded: 0,
  totalBytes: 0,

  setState: (state) => set({ state }),
  setProgress: (progress) => set({ progress }),
  setError: (message) => set({ state: 'error', errorMessage: message }),
  setBytes: (downloaded, total) => set({ bytesDownloaded: downloaded, totalBytes: total }),
  reset: () => set({
    state: 'idle',
    progress: 0,
    errorMessage: null,
    bytesDownloaded: 0,
    totalBytes: 0,
  }),
}));
```

---

## 8.4 Mobile: Asset Downloader Service

**File:** `src/services/assetDownloader.ts`

```typescript
/**
 * Downloads, verifies, and extracts Luna's asset bundle.
 * Supports resume on interruption via expo-file-system createDownloadResumable.
 */
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as IntentLauncher from 'expo-intent-launcher'; // for storage settings
import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { zipUtil } from './zipUtil';  // expo-file-system or react-native-zip-archive
import { useDownloadStore } from '../stores/downloadStore';
import { useCompanionStore } from '../stores/companionStore';
import { companionLocalService } from '../services/localDb/CompanionLocalService';
import { eventBus } from '../services/eventBus';
import { dialogueEngine } from '../services/companion/DialogueEngine';
import { logger } from '../utils';

const COMPANION_DIR = FileSystem.documentDirectory + 'companion/';
const DOWNLOAD_PATH = FileSystem.cacheDirectory + 'luna_assets_v1.zip';
const METADATA_URL = '/api/v1/features/luna/metadata'; // full URL with base

interface AssetMetadata {
  version: string;
  size_mb: number;
  checksum_sha256: string;
  download_url: string;
}

/**
 * Check Wi-Fi and warn on cellular.
 * Returns true if the download should proceed.
 */
async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isConnected && state.isInternetReachable === false) {
    useDownloadStore.getState().setError('No internet connection.');
    return false;
  }
  // If on cellular, warn the user
  if (state.type === 'cellular') {
    return new Promise((resolve) => {
      Alert.alert(
        'Download over cellular?',
        'Luna assets are about 4.5 MB. Download over Wi-Fi to save data?',
        [
          { text: 'Wi-Fi only', onPress: () => resolve(false), style: 'cancel' },
          // Also check free storage before proceeding
          { text: 'Download anyway', onPress: () => resolve(true) },
        ]
      );
    });
  }
  return true;
}

/**
 * Fetch metadata from the backend.
 */
async function fetchMetadata(): Promise<AssetMetadata | null> {
  try {
    const response = await fetch(METADATA_URL);
    if (!response.ok) return null;
    return await response.json() as AssetMetadata;
  } catch {
    return null;
  }
}

/**
 * Download the zip file with resume support.
 */
async function downloadFile(url: string): Promise<string> {
  const store = useDownloadStore.getState();

  // Check if a partial download exists (for resume)
  const existing = await FileSystem.getInfoAsync(DOWNLOAD_PATH);

  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    DOWNLOAD_PATH,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesExpectedToWrite > 0
        ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
        : 0;
      store.setProgress(progress);
      store.setBytes(downloadProgress.totalBytesWritten, downloadProgress.totalBytesExpectedToWrite);
    }
  );

  // Resume if partial download exists
  let result;
  if (existing.exists) {
    result = await downloadResumable.resumeAsync();
  } else {
    result = await downloadResumable.downloadAsync();
  }

  if (!result || !result.uri) {
    throw new Error('Download failed');
  }

  return result.uri;
}

/**
 * Compute SHA-256 checksum of a file.
 */
async function computeChecksum(filePath: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    filePath
  );
}

/**
 * Extract the zip to the companion directory.
 */
async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  // Ensure target directory exists
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  // Unzip using react-native-zip-archive
  const { unzip } = require('react-native-zip-archive');
  await unzip(zipPath, targetDir);
}

/**
 * Clean up: delete the zip and temporary files.
 */
async function cleanup(zipPath: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
  } catch {}
}

/**
 * Main install flow. Orchestrates the entire download → verify → extract → activate pipeline.
 */
export async function installLuna(userId: string): Promise<boolean> {
  const store = useDownloadStore.getState();
  store.reset();

  try {
    // 1. Check Wi-Fi
    store.setState('checking_wifi');
    const proceed = await checkNetwork();
    if (!proceed) {
      store.reset();
      return false;
    }

    // 2. Check free storage (need at least 50 MB)
    const freeSpace = await FileSystem.getFreeDiskStorageAsync?.();
    if (freeSpace !== undefined && freeSpace < 50 * 1024 * 1024) {
      store.setError('Not enough free space. Free at least 50 MB and try again.');
      return false;
    }

    // 3. Fetch metadata
    store.setState('downloading');
    store.setProgress(0);
    const metadata = await fetchMetadata();
    if (!metadata) {
      store.setError('Could not fetch asset information. Please try again.');
      return false;
    }

    // 4. Download the zip
    const zipPath = await downloadFile(metadata.download_url);
    store.setState('verifying');
    store.setProgress(70);

    // 5. Verify checksum
    const hash = await computeChecksum(zipPath);
    if (hash !== metadata.checksum_sha256) {
      await cleanup(zipPath);
      store.setError('Download corrupted. Please try again.');
      return false;
    }
    store.setProgress(85);

    // 6. Extract
    store.setState('extracting');
    await extractZip(zipPath, COMPANION_DIR);
    store.setProgress(95);

    // 6. Cleanup zip
    await cleanup(zipPath);
    store.setProgress(100);

    // 7. Activate
    store.setState('ready');
    await companionLocalService.updateInstallStatus(userId, 'ready', metadata.version);
    useCompanionStore.getState().setInstallStatus('ready');
    useCompanionStore.getState().setAssetsVersion(metadata.version);

    // 8. Load dialogue assets
    await dialogueEngine.loadAssets();

    // 9. Emit event
    eventBus.emit('luna_installed', { userId });
    logger.info('Luna assets installed', { version: metadata.version });
    return true;

  } catch (error: any) {
    logger.error('installLuna.failed', error);
    store.setError(error?.message ?? 'Installation failed. Please try again.');
    await cleanup(DOWNLOAD_PATH);
    return false;
  }
}

/**
 * Uninstall: remove assets, keep XP data.
 */
export async function uninstallLuna(userId: string): Promise<void> {
  try {
    // Remove downloaded assets
    await FileSystem.deleteAsync(COMPANION_DIR, { idempotent: true });
    // Update status in DB
    await companionLocalService.updateInstallStatus(userId, 'none');
    useCompanionStore.getState().setInstallStatus('none');
    useCompanionStore.getState().setAssetsVersion(null);
    eventBus.emit('luna_uninstalled', { userId });
    logger.info('Luna assets uninstalled');
  } catch (error) {
    logger.error('uninstallLuna.failed', error);
  }
}

/**
 * Check if assets are installed and up-to-date.
 */
export async function checkLunaInstallation(userId: string): Promise<{
  installed: boolean;
  version: string | null;
}> {
  const status = await companionLocalService.getInstallStatus(userId);
  return {
    installed: status?.status === 'ready',
    version: status?.version ?? null,
  };
}
```

---

## 8.5 Rewrite `LunaInstallScreen.tsx` with Download UI

**File:** `src/screens/companion/LunaInstallScreen.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { Text, Card, Button, ProgressBar, Loader } from '../../components/ui';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { useCompanionStore } from '../../stores/companionStore';
import { useDownloadStore } from '../../stores/downloadStore';
import { installLuna, uninstallLuna, checkLunaInstallation } from '../../services/assetDownloader';
import { dialogueEngine } from '../../services/companion/DialogueEngine';
import { logger } from '../../utils';

const LUNA_FEATURES = [
  { icon: '💬', title: 'Daily Companion', description: 'Luna greets you every day with warmth and encouragement.' },
  { icon: '🎉', title: 'Celebrates Your Wins', description: 'Log a period, journal, or exercise — Luna celebrates with you.' },
  { icon: '🎮', title: 'XP & Levels', description: 'Earn XP for healthy habits. Level up your friendship with Luna.' },
  { icon: '🎨', title: 'Customizable', description: 'Hats, glasses, beds, backgrounds — make Luna yours. (Phase 2)' },
  { icon: '🔒', title: '100% Private', description: 'Luna lives on your device. No data ever leaves your phone.' },
  { icon: '📦', title: 'Downloadable', description: '~4.5 MB download. Uninstall anytime to free up space.' },
];

export function LunaInstallScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useCompanionStore((s) => s.isHydrated);

  const [isInstalled, setIsInstalled] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Download store state
  const downloadState = useDownloadStore((s) => s.state);
  const downloadProgress = useDownloadStore((s) => s.progress);
  const downloadError = useDownloadStore((s) => s.errorMessage);

  // Check current installation status on mount
  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const status = await checkLunaInstallation(user.id);
        setIsInstalled(status.installed);
        setInstalledVersion(status.version);
        if (status.installed) {
          await dialogueEngine.loadAssets();
        }
      } catch (error) {
        logger.error('LunaInstallScreen.checkStatus', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const handleInstall = async () => {
    if (!user) return;
    const success = await installLuna(user.id);
    if (success) {
      setIsInstalled(true);
      setInstalledVersion('1.0.0');
      useCompanionStore.getState().hydrate(user.id);
    }
  };

  const handleUninstall = async () => {
    if (!user) return;
    Alert.alert(
      'Uninstall Luna',
      'This will remove Luna\'s assets (sprites, sounds) from your device. Your XP and level will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: async () => {
            await uninstallLuna(user.id);
            setIsInstalled(false);
            setInstalledVersion(null);
            useCompanionStore.getState().reset();
          },
        },
      ]
    );
  };

  // ── Render download progress UI ──
  const isDownloading = ['downloading', 'extracting', 'verifying'].includes(downloadState);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Svg width={80} height={80} viewBox="0 0 100 100">
            <SvgCircle cx="50" cy="45" r="30" fill="#FFD9E1" />
            <Path d="M30 30 L22 10 L42 28 Z" fill="#FFD9E1" />
            <Path d="M70 30 L78 10 L58 28 Z" fill="#FFD9E1" />
            <SvgCircle cx="40" cy="42" r="4" fill="#333" />
            <SvgCircle cx="60" cy="42" r="4" fill="#333" />
            <Path d="M46 50 L54 50 L50 54 Z" fill="#FF8F8F" />
          </Svg>
          <Text variant="h1" style={styles.title}>Luna</Text>
          <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
            A virtual companion who cares about you. ~4.5 MB download.
          </Text>
        </View>

        {/* Features */}
        <Card style={styles.featuresCard}>
          {LUNA_FEATURES.map((feature, index) => (
            <View
              key={feature.title}
              style={[
                styles.featureRow,
                index < LUNA_FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
              ]}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text variant="bodySmall" weight="600">{feature.title}</Text>
                <Text variant="caption" color="muted">{feature.description}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Download Progress */}
        {isDownloading && (
          <Card style={styles.progressCard}>
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Loader size="small" />
              <Text variant="body" weight="600" style={{ marginTop: 8 }}>
                {downloadState === 'downloading' && `Downloading Luna... (${downloadProgress}%)`}
                {downloadState === 'verifying' && 'Verifying download...'}
                {downloadState === 'extracting' && 'Extracting files...'}
              </Text>
              <ProgressBar progress={downloadProgress} style={{ marginTop: 8, width: '100%' }} />
              <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
                {downloadProgress}%
              </Text>
            </View>
          </Card>
        )}

        {/* Error State */}
        {downloadState === 'error' && downloadError && (
          <Card style={[styles.progressCard, { borderColor: theme.colors.danger }]}>
            <Text variant="body" align="center" color="danger" style={{ padding: 16 }}>
              {downloadError}
            </Text>
          </Card>
        )}

        {/* Install / Uninstall / Download Button */}
        <View style={styles.buttonContainer}>
          {isInstalled ? (
            <>
              <View style={styles.installedBadge}>
                <Text style={styles.checkmark}>✅</Text>
                <Text variant="body" weight="600" style={{ color: '#4CAF50' }}>
                  Installed {installedVersion && `(v${installedVersion})`}
                </Text>
              </View>
              <Button
                variant="outline"
                onPress={handleUninstall}
                disabled={isDownloading}
                accessibilityLabel="Uninstall Luna"
                style={styles.uninstallButton}
              >
                Uninstall Luna (~4.5 MB freed)
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onPress={handleInstall}
              disabled={isDownloading || isLoading}
              accessibilityLabel="Download Luna"
              style={styles.installButton}
            >
              {isDownloading ? 'Downloading...' : 'Download Luna (~4.5 MB)'}
            </Button>
          )}
        </View>

        {/* Info note */}
        <Text variant="caption" color="muted" align="center" style={styles.note}>
          Luna code is pre-bundled (~200 KB). Assets (sprites, sounds, dialogues) are downloaded
          only when you install. Luna is 100% offline and private — no data leaves your device.
        </Text>

        {/* Phase 2 teaser */}
        <Text variant="caption" color="muted" align="center" style={styles.comingSoon}>
          🎨 Pet House, outfits, and more coming in Phase 2!
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { marginTop: 16, fontSize: 32, fontWeight: '700', color: '#FF5C8A' },
  subtitle: { marginTop: 8, paddingHorizontal: 16 },
  featuresCard: { padding: 0, marginBottom: 24 },
  progressCard: { marginBottom: 24 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  featureIcon: { fontSize: 24, marginRight: 12 },
  featureText: { flex: 1 },
  buttonContainer: { alignItems: 'center', marginBottom: 24 },
  installedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  checkmark: { fontSize: 20 },
  installButton: { width: '100%' },
  uninstallButton: { width: '100%', borderColor: '#D63B3B' },
  note: { paddingHorizontal: 16, marginBottom: 16, opacity: 0.7 },
  comingSoon: { opacity: 0.5 },
});
```

---

## 8.6 Add `installStatus` and `assetsVersion` to CompanionStore

Add these fields to `src/stores/companionStore.ts`:

```typescript
// In CompanionState interface:
installStatus: 'none' | 'downloading' | 'extracting' | 'ready' | 'error';
assetsVersion: string | null;

// In initial state:
installStatus: 'none',
assetsVersion: null,

// In hydrate, read from meta:
installStatus: meta.install_status ?? 'none',
assetsVersion: meta.assets_version ?? null,

// New actions:
setInstallStatus: (status: string) => void;
setAssetsVersion: (version: string | null) => void;
```

---

## 8.7 Navigation

Same as before — no changes needed to the navigation setup from the original plan.

---

## 8.8 Test the Download Flow

1. Open Settings → Companion → "Luna Cat Companion"
2. See feature list with "~4.5 MB download" badge
3. Tap "Download Luna (~4.5 MB)" (on Wi-Fi → proceeds; on cellular → warning appears)
4. Progress bar appears: "Downloading Luna... (0%)"
5. Progress reaches 100% → "Verifying download..."
6. Verification passes → "Extracting files..."
7. Extraction completes → "Installed (v1.0.0)" badge + Uninstall button
8. Luna appears on Home Dashboard
9. Force-quit app, reopen → Luna still present (assets persisted on disk)
10. Tap "Uninstall Luna (~4.5 MB freed)" → confirmation dialog → assets removed → Luna disappears

### Edge Cases to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| No internet on first tap | Toast: "No internet connection." |
| Cellular data | Alert: "Download over Wi-Fi?" with options |
| Download interrupted (airplane mode) | Resume on next attempt or retry |
| Corrupted download (checksum mismatch) | Error message + delete zip + retry button |
| Storage full | Error message + prompt to free space |
| Uninstall during download | Uninstall removes partial download |
| Re-install after uninstall | Fresh download, XP preserved |

---

## ✅ Day 8 Validation

- [ ] Backend metadata endpoint `GET /api/v1/features/luna/metadata` created
- [ ] `downloadStore.ts` created with all download states + progress tracking
- [ ] `assetDownloader.ts` created with `installLuna()`, `uninstallLuna()`, `checkLunaInstallation()`
- [ ] `installLuna()` flow: check Wi-Fi → fetch metadata → download → verify checksum → extract → activate
- [ ] Download uses `createDownloadResumable` for automatic resume
- [ ] Checksum verification (SHA-256) prevents corrupted installs
- [ ] Uninstall removes the `companion/` folder from file system
- [ ] CompanionStore has `installStatus` and `assetsVersion` fields
- [ ] `LunaInstallScreen.tsx` shows progress bar, error state, installed badge
- [ ] Cellular data warning dialog shown before download
- [ ] All states tested: fresh install, resume, error, retry, uninstall, reinstall
- [ ] App builds without TypeScript errors
