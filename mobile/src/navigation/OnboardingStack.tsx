import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { WelcomeScreen } from 'src/screens/onboarding/WelcomeScreen';
import { PersonalInfoScreen } from 'src/screens/onboarding/PersonalInfoScreen';
import { LifestyleScreen } from 'src/screens/onboarding/LifestyleScreen';
import { CurrentCycleScreen } from 'src/screens/onboarding/CurrentCycleScreen';
import { PastCycleScreen } from 'src/screens/onboarding/PastCycleScreen';
import { CompleteScreen } from 'src/screens/onboarding/CompleteScreen';

import type { OnboardingStackParamList } from './types';

const Stack = createStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="Lifestyle" component={LifestyleScreen} />
      <Stack.Screen name="CurrentCycle" component={CurrentCycleScreen} />
      <Stack.Screen name="PastCycle1" component={PastCycleScreen} />
      <Stack.Screen name="PastCycle2" component={PastCycleScreen} />
      <Stack.Screen name="PastCycle3" component={PastCycleScreen} />
      <Stack.Screen name="Complete" component={CompleteScreen} />
    </Stack.Navigator>
  );
}