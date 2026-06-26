import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { LoginScreen } from 'src/screens/auth/LoginScreen';
import { RegisterScreen } from 'src/screens/auth/RegisterScreen';
import { PhoneScreen } from 'src/screens/auth/PhoneScreen';
import { OtpScreen } from 'src/screens/auth/OtpScreen';

import type { AuthStackParamList } from './types';

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthStack() {
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
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
      <Stack.Screen name="Phone" component={PhoneScreen} options={{ title: 'Phone sign in' }} />
      <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Enter code' }} />
    </Stack.Navigator>
  );
}
