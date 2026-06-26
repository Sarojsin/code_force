/**
 * SettingsScreen — app settings (notifications, privacy, dark mode).
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';

interface SettingRowProps {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  accessibilityLabel: string;
}

function SettingRow({ label, description, value, onToggle, accessibilityLabel }: SettingRowProps) {
  const theme = useTheme();
  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
      <View style={{ flex: 1 }}>
        <Txt variant="body">{label}</Txt>
        {description && <Txt variant="caption" color="muted">{description}</Txt>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
        thumbColor={value ? theme.colors.primary : theme.colors.textMuted}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: false,
    smsAlerts: true,
    shareAnalytics: false,
    biometricLock: false,
    darkMode: theme.isDark,
  });

  const toggle = (key: keyof typeof settings) => (value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    logger.info('SettingsScreen.toggle', { [key]: value });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Settings</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Manage your app preferences.</Txt>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Notifications</Txt>
          <SettingRow label="Push notifications" description="Period reminders, wellness tips" value={settings.pushNotifications} onToggle={toggle('pushNotifications')} accessibilityLabel="Toggle push notifications" />
          <SettingRow label="Email notifications" description="Weekly summary" value={settings.emailNotifications} onToggle={toggle('emailNotifications')} accessibilityLabel="Toggle email notifications" />
          <SettingRow label="SMS alerts" description="SOS and critical alerts" value={settings.smsAlerts} onToggle={toggle('smsAlerts')} accessibilityLabel="Toggle SMS alerts" />
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Privacy & Security</Txt>
          <SettingRow label="Biometric lock" description="FaceID / Fingerprint to unlock" value={settings.biometricLock} onToggle={toggle('biometricLock')} accessibilityLabel="Toggle biometric lock" />
          <SettingRow label="Share analytics" description="Help improve SheCare" value={settings.shareAnalytics} onToggle={toggle('shareAnalytics')} accessibilityLabel="Toggle analytics sharing" />
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Appearance</Txt>
          <SettingRow label="Dark mode" value={settings.darkMode} onToggle={toggle('darkMode')} accessibilityLabel="Toggle dark mode" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
});
