import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { AIChatScreen } from 'src/screens/chat/AIChatScreen';

import type { AIChatStackParamList } from './types';

const Stack = createStackNavigator<AIChatStackParamList>();

export function AIChatStack() {
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
      <Stack.Screen name="AIChatMain" component={AIChatScreen} options={{ title: 'AI Chat', headerShown: false }} />
    </Stack.Navigator>
  );
}
