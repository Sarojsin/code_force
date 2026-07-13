import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { CalendarScreen } from 'src/screens/calendar/CalendarScreen';
import { CycleDashboardScreen } from 'src/screens/cycle/CycleDashboardScreen';
import { MenstrualPhasesScreen } from 'src/screens/cycle/MenstrualPhasesScreen';
import { LogPeriodScreen } from 'src/screens/cycle/LogPeriodScreen';
import { CycleHistoryScreen } from 'src/screens/cycle/CycleHistoryScreen';
import { CyclePredictionsScreen } from 'src/screens/cycle/CyclePredictionsScreen';
import { CycleAnalyticsScreen } from 'src/screens/cycle/CycleAnalyticsScreen';

import type { CalendarStackParamList } from './types';

const Stack = createStackNavigator<CalendarStackParamList>();

export function CalendarStack() {
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
      <Stack.Screen name="CalendarMain" component={CalendarScreen} options={{ title: 'Calendar', headerShown: false }} />
      <Stack.Screen name="PhaseDetail" component={MenstrualPhasesScreen} options={{ title: 'Phase Details' }} />
      <Stack.Screen name="CycleDashboard" component={CycleDashboardScreen} options={{ title: 'Cycle Dashboard' }} />
      <Stack.Screen name="LogPeriod" component={LogPeriodScreen} options={{ title: 'Log Period' }} />
      <Stack.Screen name="CycleHistory" component={CycleHistoryScreen} options={{ title: 'Cycle History' }} />
      <Stack.Screen name="CyclePredictions" component={CyclePredictionsScreen} options={{ title: 'Predictions' }} />
      <Stack.Screen name="CycleAnalytics" component={CycleAnalyticsScreen} options={{ title: 'Cycle Analytics' }} />
    </Stack.Navigator>
  );
}
