import React, { memo, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import { Text as Txt, Toggle } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import { useNavigation } from '@react-navigation/native';
import { useCompanionStore } from '../../stores/companionStore';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { resetAppForLogout } from '../../services/sessionReset';
import { authService } from '../../services/api';
import { usePregnancyModeStore } from '../../stores/pregnancyModeStore';
import { uninstallLuna } from '../../services/assetDownloader';
import { useDiaryAssetStore } from '../../stores/diaryAssetStore';
import { uninstallDiaryAssets } from '../../services/diaryAssetDownloader';
import { useAnimationEngine, voiceService } from '../../services/companion';
import { useVideoLibrarySettings } from '../../hooks/useVideoLibrarySettings';
import { lazyScreen } from 'src/components/ui/LazyScreen';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

const Luna3D = lazyScreen(() => import('../../services/companion/3d/Luna3D'), 'Luna3D');

interface SettingRowProps {
  label: string;
  iconKey?: string;
  description?: string;
  value?: boolean;
  disabled?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  showDisclosure?: boolean;
  destructive?: boolean;
  accessibilityLabel: string;
}

const SETTING_ICONS: Record<string, string> = {
  'Personal Information': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  'Change Password': 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z',
  'Delete Account': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  'Export My Data': 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  'Help Center': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
  'Rate the App': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  'Day Logs': 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z',
  Version: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  'Privacy Policy': 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  'Terms of Service': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
  DarkMode: 'M12 3c.46 0 .93.04 1.38.14C10.61 4.13 9 6.57 9 9.5c0 3.58 2.92 6.5 6.5 6.5 2.93 0 5.37-1.61 6.36-4.38.1.45.14.92.14 1.38 0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9z',
  Language: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
};

const formatRangePercent = (v: number) => `${Math.round(v * 100)}%`;

const SettingRow = memo(function SettingRowComponent({ label, iconKey, description, value, disabled, onToggle, onPress, showDisclosure, destructive, accessibilityLabel }: SettingRowProps) {
  const theme = useTheme();
  const hasSwitch = onToggle !== undefined;
  const hasNav = onPress !== undefined;
  const iconPath = iconKey ? SETTING_ICONS[iconKey] : SETTING_ICONS[label];
  const isDisabled = disabled || (hasNav && !onPress);

  return (
    <Pressable
      onPress={hasNav ? onPress : undefined}
      disabled={isDisabled}
      style={[styles.settingRow, isDisabled && styles.settingRowDisabled, { borderBottomColor: theme.colors.border, minHeight: theme.minTouchTarget }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={hasSwitch ? 'switch' : 'button'}
      accessibilityState={{ checked: value, disabled: isDisabled }}
      accessibilityHint={hasSwitch ? 'Tap to toggle' : undefined}
    >
      {iconPath && (
        <View style={[styles.settingIcon, { borderRadius: 10, backgroundColor: 'rgba(255,107,138,0.08)' }]}>
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <Path d={iconPath} fill={destructive ? theme.colors.danger : theme.colors.primary} />
          </Svg>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Txt variant="body" style={[destructive && { color: theme.colors.danger }]}>{label}</Txt>
        {description && <Txt variant="caption" color="muted" style={{ marginTop: 1 }}>{description}</Txt>}
      </View>
      {hasSwitch && (
        <Toggle on={value ?? false} onChange={onToggle} />
      )}
      {showDisclosure && (
        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={theme.colors.mauve} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </Pressable>
  );
});

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Txt style={styles.sectionTitle}>{title}</Txt>
      <View style={[styles.sectionCard, { backgroundColor: '#fff', borderRadius: 16 }]}>
        {children}
      </View>
    </View>
  );
}

const SpeechSliderRow = memo(function SpeechSliderRowComponent({
  label,
  value,
  minimum,
  maximum,
  step,
  formatValue,
  onSlidingComplete,
  accessibilityLabel,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  formatValue?: (v: number) => string;
  onSlidingComplete: (v: number) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(value);

  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.colors.border, minHeight: theme.minTouchTarget }]}>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Txt variant="body">{label}</Txt>
        <Slider
          style={{ marginTop: 4, marginRight: 12, height: 36 }}
          minimumValue={minimum}
          maximumValue={maximum}
          step={step}
          value={draft}
          onValueChange={setDraft}
          onSlidingComplete={(v) => onSlidingComplete(v)}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={theme.colors.border}
          thumbTintColor={theme.colors.primary}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
      <Txt variant="caption" color="muted" style={{ marginRight: 16 }}>
        {formatValue ? formatValue(draft) : String(draft)}
      </Txt>
    </View>
  );
});

export function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const authUser = useAuthStore((s) => s.user);
  const pregnancyIsActive = usePregnancyModeStore((s) => s.isActive);
  const pregnancyEnable = usePregnancyModeStore((s) => s.enable);
  const pregnancyDisable = usePregnancyModeStore((s) => s.disable);
  const companionHidden = useCompanionStore((s) => s.isHidden);
  const companionReduceAnimations = useCompanionStore((s) => s.reduceAnimations);
  const companionMuteSounds = useCompanionStore((s) => s.muteSounds);
  const companionSpeakEnabled = useCompanionStore((s) => s.speakEnabled);
  const companionSpeechRate = useCompanionStore((s) => s.speechRate);
  const companionSpeechPitch = useCompanionStore((s) => s.speechPitch);
  const companionLevel = useCompanionStore((s) => s.level);
  const companionTitle = useCompanionStore((s) => s.levelTitle);
  const companionXp = useCompanionStore((s) => s.xp);
  const companionShowInsights = useCompanionStore((s) => s.showInsights);
  const companionListenAndSpeak = useCompanionStore((s) => s.listenAndSpeak);
  const diaryInstallStatus = useDiaryAssetStore((s) => s.installStatus);
  const diaryAssetsVersion = useDiaryAssetStore((s) => s.assetsVersion);
  const diaryHydrated = useDiaryAssetStore((s) => s.isHydrated);
  const companionHydrated = useCompanionStore((s) => s.isHydrated);
  const installStatus = useCompanionStore((s) => s.installStatus);
  const { smartRecommendationsEnabled, setSmartRecommendationsEnabled } = useVideoLibrarySettings();
   const { currentAnim, rotation, rotationX } = useAnimationEngine();
  const assetsVersion = useCompanionStore((s) => s.assetsVersion);

  const pushNotifications = useSettingsStore((s) => s.pushNotifications);
  const periodReminders = useSettingsStore((s) => s.periodReminders);
  const lunaInsights = useSettingsStore((s) => s.lunaInsights);
  const biometricLock = useSettingsStore((s) => s.biometricLock);
  const shareAnalytics = useSettingsStore((s) => s.shareAnalytics);
  const offlineAI = useSettingsStore((s) => s.offlineAI);
  const autoUpdateModels = useSettingsStore((s) => s.autoUpdateModels);
  const emailNotifications = useSettingsStore((s) => s.emailNotifications);
  const smsAlerts = useSettingsStore((s) => s.smsAlerts);
  const setSetting = useSettingsStore((s) => s.setSetting);

  const handleLunaHiddenToggle = useCallback(async (value: boolean) => {
    await useCompanionStore.getState().setHidden(value);
    logger.info('Luna hidden:', value);
  }, []);

  const handleLunaReduceAnimationsToggle = useCallback(async (value: boolean) => {
    await useCompanionStore.getState().setReduceAnimations(value);
    logger.info('Luna reduceAnimations:', value);
  }, []);

  const handleLunaMuteSoundsToggle = useCallback(async (value: boolean) => {
    await useCompanionStore.getState().setMuteSounds(value);
    logger.info('Luna muteSounds:', value);
  }, []);

  const handleLunaSpeakToggle = useCallback(async (value: boolean) => {
    await voiceService.setEnabled(value);
    logger.info('Luna speaks:', value);
  }, []);

  const handleInsightsToggle = useCallback(async (value: boolean) => {
    await useCompanionStore.getState().setInsightsPref({ showInsights: value });
    logger.info('Luna showInsights:', value);
  }, []);

  const handleListenAndSpeakToggle = useCallback(async (value: boolean) => {
    await useCompanionStore.getState().setInsightsPref({ listenAndSpeak: value });
    logger.info('Luna listenAndSpeak:', value);
  }, []);

  const handleTestVoice = useCallback(() => {
    void voiceService.speak("Hi, I'm Luna!");
  }, []);

  const handleLunaUninstall = useCallback(() => {
    Alert.alert(
      'Uninstall Luna',
      "This removes Luna's sprites, sounds, and dialogues from your device (~4.5 MB). Your XP and level are saved.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: async () => {
            const user = useAuthStore.getState().user;
            if (user) await uninstallLuna(user.id);
            useCompanionStore.getState().reset();
          },
        },
      ],
    );
  }, []);

  const handleDarkModeToggle = useCallback((value: boolean) => {
    theme.setDark(value);
    logger.info('SettingsScreen.darkMode', { darkMode: value });
  }, [theme]);
  const togglePushNotifications = useCallback((value: boolean) => {
    setSetting('pushNotifications', value);
    logger.info('SettingsScreen.toggle', { pushNotifications: value });
  }, [setSetting]);
  const togglePeriodReminders = useCallback((value: boolean) => {
    setSetting('periodReminders', value);
    logger.info('SettingsScreen.toggle', { periodReminders: value });
  }, [setSetting]);
  const toggleLunaInsights = useCallback((value: boolean) => {
    setSetting('lunaInsights', value);
    logger.info('SettingsScreen.toggle', { lunaInsights: value });
  }, [setSetting]);
  const toggleBiometricLock = useCallback((value: boolean) => {
    setSetting('biometricLock', value);
    logger.info('SettingsScreen.toggle', { biometricLock: value });
  }, [setSetting]);
  const toggleShareAnalytics = useCallback((value: boolean) => {
    setSetting('shareAnalytics', value);
    logger.info('SettingsScreen.toggle', { shareAnalytics: value });
  }, [setSetting]);
  const toggleEmailNotifications = useCallback((value: boolean) => {
    setSetting('emailNotifications', value);
    logger.info('SettingsScreen.toggle', { emailNotifications: value });
  }, [setSetting]);
  const toggleSmsAlerts = useCallback((value: boolean) => {
    setSetting('smsAlerts', value);
    logger.info('SettingsScreen.toggle', { smsAlerts: value });
  }, [setSetting]);
  const toggleOfflineAI = useCallback((value: boolean) => {
    setSetting('offlineAI', value);
    logger.info('SettingsScreen.toggle', { offlineAI: value });
  }, [setSetting]);
  const toggleAutoUpdateModels = useCallback((value: boolean) => {
    setSetting('autoUpdateModels', value);
    logger.info('SettingsScreen.toggle', { autoUpdateModels: value });
  }, [setSetting]);

  const handlePregnancyToggle = useCallback((value: boolean) => {
    if (value) pregnancyEnable();
    else pregnancyDisable();
  }, [pregnancyEnable, pregnancyDisable]);

  const handleDayLogsPress = useCallback(() => {
    navigation.navigate('DailyLog');
  }, [navigation]);

  const handleNotAvailable = useCallback(() => {
    Toast.show({ type: 'info', text1: 'Not available yet' });
  }, []);

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          logger.info('SettingsScreen.logout');
          await resetAppForLogout();
        },
      },
    ]);
  }, []);

  const handleDeleteAccount = useCallback(() => {
    setDeletePassword('');
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
  if (!deletePassword || isDeleting) return;
  setIsDeleting(true);
  try {
    await authService.deleteAccount(deletePassword);
    setShowDeleteModal(false);
    setDeletePassword('');
    await resetAppForLogout();
    Toast.show({ type: 'success', text1: 'Your account has been deleted.' });
  } catch (err) {
    logger.error('SettingsScreen.deleteAccount.failed', err);
    Toast.show({ type: 'error', text1: 'Could not delete account. Check your password.' });
    setIsDeleting(false);
  }
}, [deletePassword, isDeleting]);

  const handleLunaInstallPress = useCallback(() => {
    if (installStatus === 'ready') {
      handleLunaUninstall();
    } else {
      navigation.navigate('CompanionInstall');
    }
  }, [installStatus, handleLunaUninstall, navigation]);

  const handleDiaryInstallPress = useCallback(() => {
    if (diaryInstallStatus === 'ready') {
      Alert.alert(
        'Uninstall Diary Assets',
        'This removes stickers, textures, fonts, and sounds (~18 MB). Your diary pages are saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Uninstall',
            style: 'destructive',
            onPress: async () => {
              const user = useAuthStore.getState().user;
              if (user) await uninstallDiaryAssets(user.id);
              useDiaryAssetStore.getState().reset();
            },
          },
        ]
      );
    } else {
      navigation.navigate('DiaryAssetInstall');
    }
  }, [diaryInstallStatus, navigation]);

  const handleSpeechRateCommit = useCallback((v: number) => {
    useCompanionStore.getState().setSpeechPref({ rate: v });
  }, []);

  const handleSpeechPitchCommit = useCallback((v: number) => {
    useCompanionStore.getState().setSpeechPref({ pitch: v });
  }, []);

  const displayName = authUser?.display_name ?? authUser?.email ?? 'SheCare User';
  const displayEmail = authUser?.email ?? '—';
  const avatarLetter = ((authUser?.display_name ?? authUser?.email) ?? 'S').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryMuted, '#A83060']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.profileHero, { borderRadius: 26 }]}
        >
          <View style={[styles.decoCircleLG, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          <View style={[styles.decoCircleSM, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <Pressable
            style={[styles.editBtn, { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 16 }]}
            accessibilityLabel="Edit profile"
          >
            <Txt style={{ color: '#fff', fontSize: 14 }}>✏️</Txt>
          </Pressable>
          <View style={[styles.profileAvatar, { borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Txt style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{avatarLetter}</Txt>
          </View>
          <Txt style={styles.profileName}>{displayName}</Txt>
          <Txt style={styles.profileEmail}>{displayEmail}</Txt>
          <View style={styles.profilePills}>
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 100 }]}>
              <Txt style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✨ Premium</Txt>
            </View>
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 100 }]}>
              <Txt style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>🔥 3-month streak</Txt>
            </View>
          </View>
        </LinearGradient>

        <SettingsSection title="NOTIFICATIONS">
          <SettingRow label="Push Notifications" description="Period reminders, wellness tips" value={pushNotifications} onToggle={togglePushNotifications} accessibilityLabel="Toggle push notifications" />
          <SettingRow label="Period Reminders" description="3 days before predicted" value={periodReminders} onToggle={togglePeriodReminders} accessibilityLabel="Toggle period reminders" />
          <SettingRow label="Luna AI Insights" description="Daily at 8:00 AM" value={lunaInsights} onToggle={toggleLunaInsights} accessibilityLabel="Toggle Luna AI insights" />
        </SettingsSection>

        <SettingsSection title="PREGNANCY">
          <SettingRow label="Pregnancy Mode 🤰" description="Switch to baby tracking" value={pregnancyIsActive} onToggle={handlePregnancyToggle} accessibilityLabel="Toggle pregnancy mode" />
        </SettingsSection>

        <SettingsSection title="PRIVACY & SECURITY">
          <SettingRow label="Biometric Lock" description="FaceID / Fingerprint to unlock" value={biometricLock} onToggle={toggleBiometricLock} accessibilityLabel="Toggle biometric lock" />
          <SettingRow label="Share Analytics" description="Help improve SheCare" value={shareAnalytics} onToggle={toggleShareAnalytics} accessibilityLabel="Toggle analytics sharing" />
          <SettingRow label="Export My Data" description="Download your data (GDPR)" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Export data" />
          <SettingRow label="Email Notifications" description="Account and security emails" value={emailNotifications} onToggle={toggleEmailNotifications} accessibilityLabel="Toggle email notifications" />
          <SettingRow label="SMS Alerts" description="Critical period updates by text" value={smsAlerts} onToggle={toggleSmsAlerts} accessibilityLabel="Toggle SMS alerts" />
          <SettingRow label="Delete Account" destructive showDisclosure onPress={handleDeleteAccount} accessibilityLabel="Delete account" />
        </SettingsSection>

        <SettingsSection title="APPEARANCE">
          <SettingRow label="Dark Mode" iconKey="DarkMode" value={theme.isDark} onToggle={handleDarkModeToggle} accessibilityLabel="Toggle dark mode" />
          <SettingRow label="Language" description="English" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Change language" />
        </SettingsSection>

        <SettingsSection title="MY DATA">
          <SettingRow label="Day Logs" description="View your daily observations history" showDisclosure onPress={handleDayLogsPress} accessibilityLabel="View day logs" />
        </SettingsSection>

        <SettingsSection title="CONTENT & PERSONALIZATION">
          <SettingRow
            label="Smart recommendations"
            description="Show personalized videos based on your logged symptoms"
            value={smartRecommendationsEnabled}
            onToggle={setSmartRecommendationsEnabled}
            accessibilityLabel="Toggle smart recommendations"
          />
        </SettingsSection>

        <SettingsSection title="AI & MODELS">
          <SettingRow label="Offline AI Models" description="Enable on-device predictions" value={offlineAI} onToggle={toggleOfflineAI} accessibilityLabel="Toggle offline AI models" />
          <SettingRow label="Auto-download Updates" description="Keep models up to date" value={autoUpdateModels} onToggle={toggleAutoUpdateModels} accessibilityLabel="Toggle auto-update models" />
          <SettingRow label="Manage Downloads" description="View installed models" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Manage downloaded models" />
          <SettingRow label="Clear Model Cache" description="Remove downloaded models" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Clear model cache" />
        </SettingsSection>

        <SettingsSection title="COMPANION">
          {companionHydrated && installStatus === 'ready' && (
            <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                <Txt style={{ fontSize: 24, marginRight: 10 }}>{'🐱'}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodySmall" style={{ fontWeight: '600' }}>Luna — {companionTitle}</Txt>
                  <Txt variant="caption" color="muted">
                    Level {companionLevel} · {companionXp} XP
                    {assetsVersion && ` · v${assetsVersion}`}
                  </Txt>
                </View>
              </View>
              {!companionHidden && (
                <View style={{ alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }}>
                   <Luna3D
                     size={60}
                     currentAnim={currentAnim}
                     rotation={rotation}
                     rotationX={rotationX}
                     installed={installStatus === 'ready'}
                    reduceAnimations={companionReduceAnimations}
                  />
                  <Txt variant="caption" color="muted" style={{ marginTop: 4 }}>
                    {companionReduceAnimations ? 'Static mode' : 'Animations enabled'}
                  </Txt>
                </View>
              )}
            </View>
          )}

          <SettingRow
            label={installStatus === 'ready' ? 'Uninstall Luna' : 'Download Luna'}
            description={
              installStatus === 'ready'
                ? 'Remove assets (XP saved)'
                : 'Download sprites, sounds (~4.5 MB)'
            }
            destructive={installStatus === 'ready'}
            showDisclosure
            onPress={handleLunaInstallPress}
            accessibilityLabel="Luna install or uninstall"
          />

          {installStatus === 'ready' && (
            <>
              <SettingRow label="Hide Companion" description="Luna disappears from the dashboard" value={companionHidden} onToggle={handleLunaHiddenToggle} accessibilityLabel="Toggle hide Luna companion" />
              <SettingRow label="Reduce Animations" description="Static cat only (no movement)" value={companionReduceAnimations} onToggle={handleLunaReduceAnimationsToggle} accessibilityLabel="Toggle reduce Luna animations" />
              <SettingRow label="Mute Sounds" description="Disable meows and purrs" value={companionMuteSounds} onToggle={handleLunaMuteSoundsToggle} accessibilityLabel="Toggle mute Luna sounds" />
              <SettingRow label="Show Health Insights" description="Tips and recommendations on Home" value={companionShowInsights} onToggle={handleInsightsToggle} accessibilityLabel="Toggle Luna health insights" />
              <SettingRow label="Listen & Speak" description="Tap the mic on Luna to talk — no passive listening" value={companionListenAndSpeak} onToggle={handleListenAndSpeakToggle} accessibilityLabel="Toggle Luna listen and speak" />
              <SettingRow label="Luna Speaks" description="Read dialogue aloud (device voice)" value={companionSpeakEnabled} onToggle={handleLunaSpeakToggle} accessibilityLabel="Toggle Luna speaking" />
              {companionSpeakEnabled && (
                <>
                  <SpeechSliderRow
                    label="Speaking Rate"
                    value={companionSpeechRate}
                    minimum={0.5}
                    maximum={2}
                    step={0.05}
                    formatValue={formatRangePercent}
                    onSlidingComplete={handleSpeechRateCommit}
                    accessibilityLabel="Adjust Luna speaking rate"
                  />
                  <SpeechSliderRow
                    label="Voice Pitch"
                    value={companionSpeechPitch}
                    minimum={0.5}
                    maximum={2}
                    step={0.05}
                    formatValue={formatRangePercent}
                    onSlidingComplete={handleSpeechPitchCommit}
                    accessibilityLabel="Adjust Luna voice pitch"
                  />
                  <SettingRow
                    label="Test Voice"
                    description="Hear the current voice, rate and pitch"
                    showDisclosure
                    onPress={handleTestVoice}
                    accessibilityLabel="Test Luna voice"
                  />
                </>
              )}
            </>
          )}
        </SettingsSection>

        <SettingsSection title="DIARY MODULE">
          {diaryHydrated && diaryInstallStatus === 'ready' && (
            <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Txt style={{ fontSize: 24, marginRight: 10 }}>{'\u{1F4D6}'}</Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="bodySmall" style={{ fontWeight: '600' }}>Memory Diary Assets</Txt>
                <Txt variant="caption" color="muted">
                  {diaryAssetsVersion && `v${diaryAssetsVersion} · `}Stickers, textures, fonts
                </Txt>
              </View>
            </View>
          )}
          <SettingRow
            label={diaryInstallStatus === 'ready' ? 'Uninstall Diary Assets' : 'Download Diary Assets'}
            description={
              diaryInstallStatus === 'ready'
                ? 'Remove assets (pages saved)'
                : 'Download stickers, textures, fonts (~18 MB)'
            }
            destructive={diaryInstallStatus === 'ready'}
            showDisclosure
            onPress={handleDiaryInstallPress}
            accessibilityLabel="Diary assets install or uninstall"
          />
        </SettingsSection>

        <SettingsSection title="SUPPORT">
          <SettingRow label="Help Center" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Help center" />
          <SettingRow label="Rate the App" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Rate the app" />
        </SettingsSection>

        <SettingsSection title="ABOUT">
          <SettingRow label="Version" description="0.1.0 (Build 1)" accessibilityLabel="App version" />
          <SettingRow label="Privacy Policy" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Privacy policy" />
          <SettingRow label="Terms of Service" showDisclosure onPress={handleNotAvailable} accessibilityLabel="Terms of service" />
        </SettingsSection>

        <Pressable onPress={handleLogout} style={[styles.logoutBtn, { borderColor: 'rgba(239,68,68,0.28)', backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 16 }]}>
          <Txt style={{ color: '#EF4444', fontWeight: '700' }}>Sign Out</Txt>
        </Pressable>
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderRadius: 20 }]}>
            <Txt variant="h3" style={{ marginBottom: 8 }}>Delete Account</Txt>
            <Txt variant="body" color="secondary" style={{ marginBottom: 16 }}>
              This action cannot be undone. Enter your password to confirm.
            </Txt>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              secureTextEntry
              placeholderTextColor={theme.colors.textSoft}
              style={[styles.modalInput, { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, borderColor: theme.colors.mauve, borderRadius: 12 }]}
              accessibilityLabel="Enter password to confirm deletion"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable onPress={() => setShowDeleteModal(false)} style={[styles.modalBtn, { flex: 1, borderColor: theme.colors.mauve, borderWidth: 1, borderRadius: 12 }]}>
                <Txt variant="body" align="center">Cancel</Txt>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                disabled={isDeleting}
                style={[styles.modalBtn, { flex: 1, backgroundColor: theme.colors.danger, borderRadius: 12 }]}
              >
                <Txt variant="body" align="center" style={{ color: '#fff' }}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  profileHero: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  decoCircleLG: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    right: -40,
  },
  decoCircleSM: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: -30,
    left: -20,
  },
  editBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileName: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    marginTop: 2,
  },
  profilePills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(160,120,136,0.8)',
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1.5,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    padding: 24,
  },
  modalInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  modalBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
});