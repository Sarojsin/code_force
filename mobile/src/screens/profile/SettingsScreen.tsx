import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Switch, Pressable, Alert, Image, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';

interface SettingRowProps {
  label: string;
  description?: string;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  showDisclosure?: boolean;
  destructive?: boolean;
  accessibilityLabel: string;
  icon?: string; // SVG path data for icon
}

const SETTING_ICONS: Record<string, string> = {
  'Personal Information': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  'Change Password': 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z',
  'Delete Account': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  'Push Notifications': 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  'Email Notifications': 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  'SMS Alerts': 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z',
  'Notification Preferences': 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  'Biometric Lock': 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z',
  'Share Analytics': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  'Export My Data': 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  'Offline AI Models': 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  'Auto-download Updates': 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  DarkMode: 'M12 3c.46 0 .93.04 1.38.14C10.61 4.13 9 6.57 9 9.5c0 3.58 2.92 6.5 6.5 6.5 2.93 0 5.37-1.61 6.36-4.38.1.45.14.92.14 1.38 0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9z',
  Language: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  'Text Size': 'M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3v-2H3v2z',
  'Help Center': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
  'Report a Problem': 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  'Contact Us': 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z',
  'Rate the App': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  'Linked Family Members': 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  Version: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  Licenses: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z',
  'Privacy Policy': 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  'Terms of Service': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
  'Manage Downloads': 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  'Clear Model Cache': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
};

function SettingRow({ label, description, value, onToggle, onPress, showDisclosure, destructive, accessibilityLabel }: SettingRowProps) {
  const theme = useTheme();
  const hasSwitch = onToggle !== undefined;
  const hasNav = onPress !== undefined;
  const iconPath = SETTING_ICONS[label];

  return (
    <Pressable
      onPress={hasNav ? onPress : undefined}
      disabled={!hasNav}
      style={[styles.settingRow, { borderBottomColor: '#D4A5B540', minHeight: theme.minTouchTarget }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={hasSwitch ? 'switch' : 'button'}
      accessibilityState={{ checked: value }}
    >
      {iconPath && (
        <View style={{ width: 24, height: 24, marginRight: 12, justifyContent: 'center', alignItems: 'center' }}>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Path d={iconPath} fill={destructive ? theme.colors.danger : theme.colors.textMuted} />
          </Svg>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Txt variant="body" style={destructive ? { color: theme.colors.danger } : undefined}>{label}</Txt>
        {description && <Txt variant="caption" color="muted" style={{ marginTop: 1 }}>{description}</Txt>}
      </View>
      {hasSwitch && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
          thumbColor={value ? theme.colors.primary : '#f4f3f4'}
        />
      )}
      {showDisclosure && (
        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={theme.colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Txt variant="bodySmall" color="muted" style={{ marginBottom: theme.spacing.sm, paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </Txt>
      <Card style={{ paddingVertical: 0, paddingHorizontal: 0 }}>{children}</Card>
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: false,
    smsAlerts: true,
    biometricLock: false,
    shareAnalytics: false,
    darkMode: theme.isDark,
    offlineAI: true,
    autoUpdateModels: true,
  });

  const toggle = (key: keyof typeof settings) => (value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    logger.info('SettingsScreen.toggle', { [key]: value });
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logger.info('SettingsScreen.logout') },
    ]);
  };

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteAccount = () => {
    setDeletePassword('');
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    logger.info('SettingsScreen.deleteAccount');
    setShowDeleteModal(false);
    setDeletePassword('');
    Alert.alert('Account Deleted', 'Your account has been scheduled for deletion.');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Txt variant="h1" style={{ marginBottom: 24 }}>Settings</Txt>

        {/* Profile Summary Card */}
        <Pressable
          style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border }]}
          accessibilityLabel="View profile"
          accessibilityRole="button"
          onPress={() => {}}
        >
          <Image
            source={{ uri: 'https://i.pravatar.cc/64?u=shecare' }}
            style={[styles.avatar, { borderRadius: 32 }]}
            accessibilityLabel="Profile avatar"
          />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Txt variant="h3">Priya Sharma</Txt>
            <Txt variant="bodySmall" color="secondary">priya.sharma@example.com</Txt>
          </View>
          <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={theme.colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingRow label="Personal Information" description="Name, DOB, contact details" showDisclosure onPress={() => {}} accessibilityLabel="Personal Information" />
          <SettingRow label="Change Password" showDisclosure onPress={() => {}} accessibilityLabel="Change Password" />
          <SettingRow label="Linked Family Members" description="Manage family connections" showDisclosure onPress={() => {}} accessibilityLabel="Linked Family Members" />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingRow label="Push Notifications" description="Period reminders, wellness tips" value={settings.pushNotifications} onToggle={toggle('pushNotifications')} accessibilityLabel="Toggle push notifications" />
          <SettingRow label="Email Notifications" description="Weekly summary" value={settings.emailNotifications} onToggle={toggle('emailNotifications')} accessibilityLabel="Toggle email notifications" />
          <SettingRow label="SMS Alerts" description="SOS and critical alerts" value={settings.smsAlerts} onToggle={toggle('smsAlerts')} accessibilityLabel="Toggle SMS alerts" />
          <SettingRow label="Notification Preferences" description="Quiet hours, log type" showDisclosure onPress={() => {}} accessibilityLabel="Notification preferences" />
        </SettingsSection>

        {/* Privacy & Security */}
        <SettingsSection title="Privacy & Security">
          <SettingRow label="Biometric Lock" description="FaceID / Fingerprint to unlock" value={settings.biometricLock} onToggle={toggle('biometricLock')} accessibilityLabel="Toggle biometric lock" />
          <SettingRow label="Share Analytics" description="Help improve SheCare" value={settings.shareAnalytics} onToggle={toggle('shareAnalytics')} accessibilityLabel="Toggle analytics sharing" />
          <SettingRow label="Export My Data" description="Download your data (GDPR)" showDisclosure onPress={() => {}} accessibilityLabel="Export data" />
          <SettingRow label="Delete Account" destructive showDisclosure onPress={handleDeleteAccount} accessibilityLabel="Delete account" />
        </SettingsSection>

        {/* AI & Models */}
        <SettingsSection title="AI & Models">
          <SettingRow label="Offline AI Models" description="Enable on-device predictions" value={settings.offlineAI} onToggle={toggle('offlineAI')} accessibilityLabel="Toggle offline AI models" />
          <SettingRow label="Auto-download Updates" description="Keep models up to date" value={settings.autoUpdateModels} onToggle={toggle('autoUpdateModels')} accessibilityLabel="Toggle auto-update models" />
          <SettingRow label="Manage Downloads" description="View installed models" showDisclosure onPress={() => {}} accessibilityLabel="Manage downloaded models" />
          <SettingRow label="Clear Model Cache" description="Remove downloaded models" showDisclosure onPress={() => {}} accessibilityLabel="Clear model cache" />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingRow label="Dark Mode" value={settings.darkMode} onToggle={toggle('darkMode')} accessibilityLabel="Toggle dark mode" />
          <SettingRow label="Language" description="English" showDisclosure onPress={() => {}} accessibilityLabel="Change language" />
          <SettingRow label="Text Size" description="Medium" showDisclosure onPress={() => {}} accessibilityLabel="Change text size" />
        </SettingsSection>

        {/* Support */}
        <SettingsSection title="Support">
          <SettingRow label="Help Center" showDisclosure onPress={() => {}} accessibilityLabel="Help center" />
          <SettingRow label="Report a Problem" showDisclosure onPress={() => {}} accessibilityLabel="Report a problem" />
          <SettingRow label="Contact Us" showDisclosure onPress={() => {}} accessibilityLabel="Contact us" />
          <SettingRow label="Rate the App" showDisclosure onPress={() => {}} accessibilityLabel="Rate the app" />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingRow label="Version" description="0.1.0 (Build 1)" accessibilityLabel="App version" />
          <SettingRow label="Licenses" showDisclosure onPress={() => {}} accessibilityLabel="Open source licenses" />
          <SettingRow label="Privacy Policy" showDisclosure onPress={() => {}} accessibilityLabel="Privacy policy" />
          <SettingRow label="Terms of Service" showDisclosure onPress={() => {}} accessibilityLabel="Terms of service" />
        </SettingsSection>

        {/* Logout Button */}
        <Pressable
          onPress={handleLogout}
          style={[styles.logoutButton, { borderColor: theme.colors.danger, borderRadius: theme.radius.md }]}
          accessibilityLabel="Logout"
          accessibilityRole="button"
        >
          <Txt variant="body" style={{ color: theme.colors.danger }}>Logout</Txt>
        </Pressable>
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
            <Txt variant="h3" style={{ marginBottom: 8 }}>Delete Account</Txt>
            <Txt variant="body" color="secondary" style={{ marginBottom: 16 }}>
              This action cannot be undone. Enter your password to confirm.
            </Txt>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              secureTextEntry
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.modalInput, { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
              accessibilityLabel="Enter password to confirm deletion"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable onPress={() => setShowDeleteModal(false)} style={[styles.modalButton, { flex: 1, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.md }]}>
                <Txt variant="body" align="center">Cancel</Txt>
              </Pressable>
              <Pressable onPress={confirmDelete} style={[styles.modalButton, { flex: 1, backgroundColor: theme.colors.danger, borderRadius: theme.radius.md }]}>
                <Txt variant="body" align="center" style={{ color: '#fff' }}>Delete</Txt>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1.5,
    marginTop: 16,
  },
  modalInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 8,
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
  modalButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
});
