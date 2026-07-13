import React, { useState } from 'react';
import { ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt, Button } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useAuthStore } from 'src/stores';
import { authService } from 'src/services/api';

export function ProfileHomeScreen() {
  const theme = useTheme();
  const reset = useAuthStore((s) => s.reset);
  const [loggingOut, setLoggingOut] = useState(false);

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      /* server logout is best-effort */
    }
    await reset();
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        void performLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: performLogout },
      ]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, flexGrow: 1 }}>
        <Txt variant="h1">Profile</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
          Account, settings, family links.
        </Txt>
        <Card>
          <Txt variant="body" color="secondary">
            Plan 05 fills this in.
          </Txt>
        </Card>
        <Button
          label="Logout"
          variant="danger"
          fullWidth
          loading={loggingOut}
          onPress={handleLogout}
          style={{ marginTop: 'auto', marginBottom: theme.spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
