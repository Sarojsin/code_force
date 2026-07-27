import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useDownloadStore } from '../stores/downloadStore';
import { useCompanionStore } from '../stores/companionStore';
import { companionLocalService } from './localDb/CompanionLocalService';
import { eventBus } from './eventBus';
import { dialogueEngine } from './companion/DialogueEngine';
import { soundEngine } from './companion/SoundEngine';
import { SOUNDS_DIR } from './companion/assetPaths';
import { logger } from '../utils';
import { API_BASE_URL } from '../constants/config';

const COMPANION_DIR = (FileSystem.documentDirectory ?? '') + 'companion/';
const DOWNLOAD_PATH = (FileSystem.cacheDirectory ?? '') + 'luna_assets_v1.zip';

let downloadInProgress = false;

interface AssetMetadata {
  version: string;
  size_mb: number;
  checksum_sha256: string;
  download_url: string;
}

async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isConnected && state.isInternetReachable === false) {
    useDownloadStore.getState().setError('No internet connection.');
    return false;
  }

  if (state.type === 'cellular') {
    return new Promise((resolve) => {
      Alert.alert(
        'Download over cellular?',
        'Luna assets are about 4.5 MB. Download over Wi-Fi to save data?',
        [
          { text: 'Wi-Fi only', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Download anyway', onPress: () => resolve(true) },
        ]
      );
    });
  }
  return true;
}

async function fetchMetadata(): Promise<AssetMetadata | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/features/luna/metadata`);
    if (!response.ok) return null;
    return await response.json() as AssetMetadata;
  } catch {
    return null;
  }
}

async function downloadFile(url: string): Promise<string> {
  const store = useDownloadStore.getState();

  const existing = await FileSystem.getInfoAsync(DOWNLOAD_PATH);
  if (existing.exists) {
    await FileSystem.deleteAsync(DOWNLOAD_PATH, { idempotent: true });
  }

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

  const result = await downloadResumable.downloadAsync();

  if (!result || !result.uri) {
    throw new Error('Download failed');
  }

  return result.uri;
}

async function computeChecksum(filePath: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    filePath
  );
}

async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  const { unzip } = require('react-native-zip-archive');
  await unzip(zipPath, targetDir);
}

async function cleanup(zipPath: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
  } catch {}
}

export async function installLuna(userId: string): Promise<boolean> {
  if (downloadInProgress) {
    logger.warn('Download already in progress, skipping');
    return false;
  }
  downloadInProgress = true;

  const store = useDownloadStore.getState();
  store.reset();

  try {
    store.setState('checking_wifi');
    const proceed = await checkNetwork();
    if (!proceed) {
      store.reset();
      return false;
    }

    const freeSpace = await (FileSystem as any).getFreeDiskStorageAsync?.();
    if (freeSpace !== undefined && freeSpace < 50 * 1024 * 1024) {
      store.setError('Not enough free space. Free at least 50 MB and try again.');
      return false;
    }

    store.setState('downloading');
    store.setProgress(0);
    const metadata = await fetchMetadata();
    if (!metadata) {
      store.setError('Could not fetch asset information. Please try again.');
      return false;
    }

    const zipPath = await downloadFile(metadata.download_url);
    store.setState('verifying');
    store.setProgress(70);

    const hash = await computeChecksum(zipPath);
    if (hash !== metadata.checksum_sha256) {
      await cleanup(zipPath);
      store.setError('Download corrupted. Please try again.');
      return false;
    }
    store.setProgress(85);

    store.setState('extracting');
    await extractZip(zipPath, COMPANION_DIR);
    store.setProgress(95);

    await cleanup(zipPath);
    store.setProgress(100);

    const soundsDirInfo = await FileSystem.getInfoAsync(SOUNDS_DIR);
    if (!soundsDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SOUNDS_DIR, { intermediates: true });
    }

    store.setState('ready');
    await companionLocalService.updateInstallStatus(userId, 'ready', metadata.version);
    useCompanionStore.getState().setInstallStatus('ready');
    useCompanionStore.getState().setAssetsVersion(metadata.version);

    await dialogueEngine.loadAssets();

    const soundsInfo = await FileSystem.getInfoAsync(SOUNDS_DIR);
    if (soundsInfo.exists) {
      await soundEngine.loadAssets();
      soundEngine.setupEventSubscription();
    } else {
      logger.warn('Sounds directory missing — skipping sound load');
    }

    eventBus.emit('luna_installed', { userId });
    logger.info('Luna assets installed', { version: metadata.version });
    return true;

  } catch (error: any) {
    logger.error('installLuna.failed', error);
    store.setError(error?.message ?? 'Installation failed. Please try again.');
    await cleanup(DOWNLOAD_PATH);
    return false;
  } finally {
    downloadInProgress = false;
  }
}

export async function uninstallLuna(userId: string): Promise<void> {
  try {
    soundEngine.teardownEventSubscription();
    await soundEngine.unloadAssets();
    await FileSystem.deleteAsync(COMPANION_DIR, { idempotent: true });
    await companionLocalService.updateInstallStatus(userId, 'none');
    useCompanionStore.getState().setInstallStatus('none');
    useCompanionStore.getState().setAssetsVersion(null);
    eventBus.emit('luna_uninstalled', { userId });
    logger.info('Luna assets uninstalled');
  } catch (error) {
    logger.error('uninstallLuna.failed', error);
  }
}

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

export function shouldUpdate(remote: string | null, local: string | null): boolean {
  if (!remote) return false;
  if (!local) return true;
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rn = r[i] || 0;
    const ln = l[i] || 0;
    if (rn > ln) return true;
    if (rn < ln) return false;
  }
  return false;
}
