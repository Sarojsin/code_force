import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { CalendarScreen } from 'src/screens/calendar/CalendarScreen';
import { MenstrualPhasesScreen } from 'src/screens/cycle/MenstrualPhasesScreen';

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
    </Stack.Navigator>
  );
}
