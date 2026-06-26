/**
 * Pregnancy home placeholder. Real implementation lands in plan 10.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

export function PregnancyHomeScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1">Pregnancy</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
          Profile, daily logs, milestones (plan 10).
        </Txt>
        <Card>
          <Txt variant="h3">Week 0</Txt>
          <Txt variant="body" color="secondary">
            Set your due date to begin.
          </Txt>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
