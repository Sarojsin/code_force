import { useState, useEffect } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text, Card, Button, ProgressBar, Loader } from '../../components/ui';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { useDiaryAssetStore } from '../../stores/diaryAssetStore';
import { useDownloadStore } from '../../stores/downloadStore';
import { installDiaryAssets, uninstallDiaryAssets, checkDiaryInstallation } from '../../services/diaryAssetDownloader';
import { logger } from '../../utils';

const DIARY_FEATURES = [
  { icon: '\u{1F4D6}', title: 'Memory Diary', description: 'Create beautiful digital scrapbook pages with photos and text.' },
  { icon: '\u{1F5BC}\uFE0F', title: 'Stickers & Embellishments', description: 'Dozens of themed stickers to decorate your memories.' },
  { icon: '\u{1F3A8}', title: 'Vintage Textures', description: 'Paper textures, frames, and design elements for a tactile feel.' },
  { icon: '\u{1F3B5}', title: 'Background Music', description: 'Lo-fi soundscapes to accompany your journaling session.' },
  { icon: '\u{1F4DD}', title: 'Handwriting Fonts', description: 'Beautiful script fonts for that personal journal feel.' },
  { icon: '\u{1F50F}', title: '100% Private', description: 'All assets live on your device. Nothing leaves your phone.' },
  { icon: '\u{1F4E6}', title: 'Downloadable', description: '~18 MB download. Uninstall anytime to free up space.' },
];

export function DiaryAssetInstallScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);

  const [isInstalled, setIsInstalled] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const downloadState = useDownloadStore((s) => s.state);
  const downloadProgress = useDownloadStore((s) => s.progress);
  const downloadError = useDownloadStore((s) => s.errorMessage);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const status = await checkDiaryInstallation(user.id);
        setIsInstalled(status.installed);
        setInstalledVersion(status.version);
      } catch (error) {
        logger.error('DiaryAssetInstallScreen.checkStatus', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const handleInstall = async () => {
    if (!user) return;
    const success = await installDiaryAssets(user.id);
    if (success) {
      setIsInstalled(true);
      setInstalledVersion('1.0.0');
      useDiaryAssetStore.getState().hydrate(user.id);
    }
  };

  const handleUninstall = async () => {
    if (!user) return;
    Alert.alert(
      'Uninstall Diary Assets',
      'This will remove diary stickers, textures, fonts, and sounds from your device (~18 MB). Your diary pages are saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: async () => {
            await uninstallDiaryAssets(user.id);
            setIsInstalled(false);
            setInstalledVersion(null);
            useDiaryAssetStore.getState().reset();
          },
        },
      ]
    );
  };

  const isDownloading = ['downloading', 'extracting', 'verifying'].includes(downloadState);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Svg width={80} height={80} viewBox="0 0 100 100">
            <Rect x="20" y="10" width="60" height="80" rx="6" fill="#410403" />
            <Rect x="25" y="18" width="50" height="3" rx="1.5" fill="#7d562d" />
            <Rect x="25" y="26" width="35" height="3" rx="1.5" fill="#7d562d" />
            <Rect x="25" y="34" width="42" height="3" rx="1.5" fill="#7d562d" />
            <Path d="M35 50 L50 65 L65 50" stroke="#7d562d" strokeWidth="2" fill="none" />
            <Path d="M50 65 L50 80" stroke="#7d562d" strokeWidth="2" fill="none" />
            <Rect x="38" y="70" width="4" height="4" rx="1" fill="#7d562d" />
            <Rect x="46" y="70" width="4" height="4" rx="1" fill="#7d562d" />
            <Rect x="54" y="70" width="4" height="4" rx="1" fill="#7d562d" />
          </Svg>
          <Text variant="h1" align="center" color="primary" style={{ marginTop: 16, fontSize: 32 }}>Memory Diary</Text>
          <Text variant="body" color="secondary" align="center" style={{ marginTop: 8, paddingHorizontal: 16 }}>
            Stickers, textures, fonts, and sounds for your digital scrapbook. ~18 MB download.
          </Text>
        </View>

        <Card style={{ padding: 0, marginBottom: 24 }}>
          {DIARY_FEATURES.map((feature, index) => (
            <View
              key={feature.title}
              style={[
                styles.featureRow,
                index < DIARY_FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
              ]}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text variant="bodySmall" style={{ fontWeight: '600' }}>{feature.title}</Text>
                <Text variant="caption" color="muted">{feature.description}</Text>
              </View>
            </View>
          ))}
        </Card>

        {isDownloading && (
          <Card style={{ marginBottom: 24 }}>
            <View style={{ alignItems: 'center', padding: theme.spacing.lg }}>
              <Loader size="small" />
              <Text variant="body" style={{ fontWeight: '600', marginTop: 8 }}>
                {downloadState === 'downloading' && `Downloading... (${downloadProgress}%)`}
                {downloadState === 'verifying' && 'Verifying download...'}
                {downloadState === 'extracting' && 'Extracting files...'}
              </Text>
              <ProgressBar progress={downloadProgress / 100} height={6} />
              <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
                {downloadProgress}%
              </Text>
            </View>
          </Card>
        )}

        {downloadState === 'error' && downloadError && (
          <Card style={{ marginBottom: 24, borderColor: theme.colors.danger }}>
            <Text variant="body" align="center" color="danger" style={{ padding: 16 }}>
              {downloadError}
            </Text>
          </Card>
        )}

        <View style={styles.buttonContainer}>
          {isInstalled ? (
            <>
              <View style={styles.installedBadge}>
                <Text style={{ fontSize: 20 }}>{'\u2705'}</Text>
                <Text variant="body" style={{ fontWeight: '600', color: theme.colors.success }}>
                  Installed {installedVersion && `(v${installedVersion})`}
                </Text>
              </View>
              <Button
                label="Uninstall Diary Assets (~18 MB freed)"
                variant="outline"
                onPress={handleUninstall}
                disabled={isDownloading}
                accessibilityLabel="Uninstall diary assets"
                style={{ borderColor: theme.colors.danger, width: '100%' }}
              />
            </>
          ) : (
            <Button
              label={isDownloading ? 'Downloading...' : 'Download Diary Assets (~18 MB)'}
              variant="primary"
              onPress={handleInstall}
              disabled={isDownloading || isLoading}
              accessibilityLabel="Download diary assets"
              style={{ width: '100%' }}
            />
          )}
        </View>

        <Text variant="caption" color="muted" align="center" style={{ paddingHorizontal: 16, marginBottom: 16, opacity: 0.7 }}>
          Diary pages are created and saved even without assets. Stickers, textures, and fonts
          enhance your scrapbook only when downloaded. 100% offline — no data leaves your device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24 },
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
});
