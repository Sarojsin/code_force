/**
 * SettingsScreen — Apple Cupertino-inspired per UI_UX Settings spec.
 * Sections: Account, Notifications, Privacy & Security, AI & Models, Appearance, Support, About
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Switch, Pressable } from 'react-native';
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
}

function SettingRow({ label, description, value, onToggle, onPress, showDisclosure, destructive, accessibilityLabel }: SettingRowProps) {
  const theme = useTheme();
  const hasSwitch = onToggle !== undefined;
  const hasNav = onPress !== undefined;

  return (
    <Pressable
      onPress={hasNav ? onPress : undefined}
      disabled={!hasNav}
      style={[styles.settingRow, { borderBottomColor: theme.colors.border, minHeight: theme.minTouchTarget }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={hasSwitch ? 'switch' : 'button'}
      accessibilityState={{ checked: value }}
    >
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Txt variant="h1" style={{ marginBottom: 24 }}>Settings</Txt>

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
          <SettingRow label="Delete Account" destructive showDisclosure onPress={() => {}} accessibilityLabel="Delete account" />
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
