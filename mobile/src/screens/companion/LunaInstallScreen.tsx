import React, { useState, useEffect } from 'react';
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
  { icon: '\u{1F4AC}', title: 'Daily Companion', description: 'Luna greets you every day with warmth and encouragement.' },
  { icon: '\u{1F431}', title: '3D Luna', description: 'A fully animated 3D cat appears on your dashboard once installed.' },
  { icon: '\u{1F389}', title: 'Celebrates Your Wins', description: 'Log a period, journal, or exercise \u2014 Luna celebrates with you.' },
  { icon: '\u{1F3AE}', title: 'XP & Levels', description: 'Earn XP for healthy habits. Level up your friendship with Luna.' },
  { icon: '\u{1F50A}', title: 'Sound Effects', description: 'Meows, purrs, yawns, and celebration sounds \u2014 Luna comes alive.' },
  { icon: '\u{1F512}', title: '100% Private', description: 'Luna lives on your device. No data ever leaves your phone.' },
  { icon: '\u{1F4E6}', title: 'Downloadable', description: '~5.5 MB download. Uninstall anytime to free up space.' },
];

export function LunaInstallScreen() {
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
      "This will remove Luna's assets (sprites, sounds) from your device. Your XP and level will be saved.",
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

  const isDownloading = ['downloading', 'extracting', 'verifying'].includes(downloadState);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Svg width={80} height={80} viewBox="0 0 100 100">
            <SvgCircle cx="50" cy="45" r="30" fill="#FFD9E1" />
            <Path d="M30 30 L22 10 L42 28 Z" fill="#FFD9E1" />
            <Path d="M70 30 L78 10 L58 28 Z" fill="#FFD9E1" />
            <SvgCircle cx="40" cy="42" r="4" fill="#333" />
            <SvgCircle cx="60" cy="42" r="4" fill="#333" />
            <Path d="M46 50 L54 50 L50 54 Z" fill="#FF8F8F" />
          </Svg>
          <Text variant="h1" align="center" color="primary" style={{ marginTop: 16, fontSize: 32 }}>Luna</Text>
          <Text variant="body" color="secondary" align="center" style={{ marginTop: 8, paddingHorizontal: 16 }}>
            A virtual companion who cares about you. ~4.5 MB download.
          </Text>
        </View>

        <Card style={{ padding: 0, marginBottom: 24 }}>
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
                {downloadState === 'downloading' && `Downloading Luna... (${downloadProgress}%)`}
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
                <Text style={{ fontSize: 20 }}>{'✅'}</Text>
                <Text variant="body" style={{ fontWeight: '600', color: theme.colors.success }}>
                  Installed {installedVersion && `(v${installedVersion})`}
                </Text>
              </View>
              <Button
                label="Uninstall Luna (~4.5 MB freed)"
                variant="outline"
                onPress={handleUninstall}
                disabled={isDownloading}
                accessibilityLabel="Uninstall Luna"
                style={{ borderColor: theme.colors.danger, width: '100%' }}
              />
            </>
          ) : (
            <Button
              label={isDownloading ? 'Downloading...' : 'Download Luna (~4.5 MB)'}
              variant="primary"
              onPress={handleInstall}
              disabled={isDownloading || isLoading}
              accessibilityLabel="Download Luna"
              style={{ width: '100%' }}
            />
          )}
        </View>

        <Text variant="caption" color="muted" align="center" style={{ paddingHorizontal: 16, marginBottom: 16, opacity: 0.7 }}>
          Luna code is pre-bundled (~200 KB). Assets (3D model, sprites, sounds, dialogues) are
          downloaded only when you install. Luna is 100% offline and private \u2014 no data leaves your device.
        </Text>

        <Text variant="caption" color="muted" align="center" style={{ opacity: 0.5 }}>
          {'\u{1F3A8}'} Pet House, outfits, and more coming in Phase 2!
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
