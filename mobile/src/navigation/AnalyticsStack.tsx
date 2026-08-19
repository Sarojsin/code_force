import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { lazyScreen } from 'src/components/ui/LazyScreen';

import type { AnalyticsStackParamList } from './types';

const AnalyticsDashboardScreen = lazyScreen(() => import('src/screens/analytics/AnalyticsDashboardScreen'), 'AnalyticsDashboardScreen');

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
