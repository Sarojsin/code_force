/**
 * Wellness home placeholder. Real implementation lands in plan 08.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Skeleton, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

export function WellnessHomeScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1">Wellness</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
          Journal, mood, breathing exercises (plan 08).
        </Txt>
        <Card>
          <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
          <Skeleton width="90%" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
