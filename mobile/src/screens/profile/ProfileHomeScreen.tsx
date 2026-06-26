/**
 * Profile home placeholder. Real implementation lands in plan 05.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

export function ProfileHomeScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1">Profile</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
          Account, settings, family links.
        </Txt>
        <Card>
          <Txt variant="body" color="secondary">
            Plan 05 fills this in.
          </Txt>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
