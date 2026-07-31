import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useDownloadStore } from '../stores/downloadStore';
import { useDiaryAssetStore } from '../stores/diaryAssetStore';
import { diaryAssetLocalService } from './localDb';
import { eventBus } from './eventBus';
import { logger } from '../utils';
import { API_BASE_URL, API_ROOT } from '../constants/config';

const DIARY_DIR = (FileSystem.documentDirectory ?? '') + 'diary/';
const DOWNLOAD_PATH = (FileSystem.cacheDirectory ?? '') + 'diary_assets_v1.zip';

let downloadInProgress = false;

interface DiaryAssetMetadata {
  version: string;
  size_mb: number;
  checksum_sha256: string;
  download_url: string;
  manifest: {
    asset_version: string;
    minimum_app_version: string;
    compatible_versions: string[];
  };
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
        'Diary assets are about 18 MB. Download over Wi-Fi to save data?',
        [
          { text: 'Wi-Fi only', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Download anyway', onPress: () => resolve(true) },
        ]
      );
    });
  }
  return true;
}

async function fetchMetadata(): Promise<DiaryAssetMetadata | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/features/diary/metadata`);
    if (!response.ok) return null;
    return await response.json() as DiaryAssetMetadata;
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
  if (!result || !result.uri) throw new Error('Download failed');

  const firstBytes = await FileSystem.readAsStringAsync(result.uri, {
    encoding: FileSystem.EncodingType.Base64,
    length: 8,
    position: 0,
  });
  const decoded = atob(firstBytes);
  if (decoded.length < 4 || decoded.charCodeAt(0) !== 0x50 || decoded.charCodeAt(1) !== 0x4b) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error('Server returned invalid response (not a zip)');
  }

  return result.uri;
}

async function computeChecksum(filePath: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const hashBytes = new Uint8Array(digest);
  return Array.from(hashBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function cleanup(zipPath: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
  } catch {}
}

export async function installDiaryAssets(userId: string): Promise<boolean> {
  if (downloadInProgress) {
    logger.warn('Diary download already in progress');
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

    const appVersion = '1.0.0';
    if (metadata.manifest.minimum_app_version > appVersion) {
      store.setError('App version too old. Please update the app first.');
      return false;
    }

    const downloadUrl = metadata.download_url.startsWith('http')
      ? metadata.download_url
      : `${API_ROOT}${metadata.download_url}`;
    const zipPath = await downloadFile(downloadUrl);
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
    await FileSystem.makeDirectoryAsync(DIARY_DIR, { intermediates: true });
    const { unzip } = require('react-native-zip-archive');
    await unzip(zipPath, DIARY_DIR);
    store.setProgress(95);

    await cleanup(zipPath);
    store.setProgress(100);

    store.setState('ready');
    await diaryAssetLocalService.updateInstallStatus(userId, 'ready', metadata.version);
    useDiaryAssetStore.getState().setInstallStatus('ready');
    useDiaryAssetStore.getState().setAssetsVersion(metadata.version);

    eventBus.emit('diary_assets_installed', { userId, version: metadata.version });
    logger.info('Diary assets installed', { version: metadata.version });
    return true;

  } catch (error: any) {
    logger.error('installDiaryAssets.failed', error);
    store.setError(error?.message ?? 'Installation failed. Please try again.');
    await cleanup(DOWNLOAD_PATH);
    return false;
  } finally {
    downloadInProgress = false;
  }
}

export async function uninstallDiaryAssets(userId: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(DIARY_DIR, { idempotent: true });
    await diaryAssetLocalService.updateInstallStatus(userId, 'none');
    useDiaryAssetStore.getState().setInstallStatus('none');
    useDiaryAssetStore.getState().setAssetsVersion(null);
    eventBus.emit('diary_assets_uninstalled', { userId });
    logger.info('Diary assets uninstalled');
  } catch (error) {
    logger.error('uninstallDiaryAssets.failed', error);
  }
}

export async function checkDiaryInstallation(userId: string): Promise<{
  installed: boolean;
  version: string | null;
}> {
  const result = await diaryAssetLocalService.getInstallStatus(userId);
  return {
    installed: result?.status === 'ready',
    version: result?.version ?? null,
  };
}
