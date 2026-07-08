import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { AnalyticsDashboardScreen } from 'src/screens/analytics/AnalyticsDashboardScreen';

import type { AnalyticsStackParamList } from './types';

const Stack = createStackNavigator<AnalyticsStackParamList>();

export function AnalyticsStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: theme.typography.h3,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="AnalyticsMain" component={AnalyticsDashboardScreen} options={{ title: 'Analytics', headerShown: false }} />
    </Stack.Navigator>
  );
}
