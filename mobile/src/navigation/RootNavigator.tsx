/**
 * Root navigator. Decides between Auth stack, Onboarding stack, and Main tabs
 * based on whether the user is logged in and has completed onboarding.
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuthStore } from 'src/stores';
import { onboardingService } from 'src/services/api/onboarding';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { MainTabs } from './MainTabs';

import type { RootStackParamList } from './types';

const Root = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!user) {
      setOnboardingChecked(true);
      return;
    }
    onboardingService.getStatus()
      .then((resp) => {
        setOnboardingCompleted(resp.completed);
        setOnboardingChecked(true);
      })
      .catch(() => {
        setOnboardingCompleted(false);
        setOnboardingChecked(true);
      });
  }, [user]);

  if (!isHydrated || !onboardingChecked) {
    return null;
  }

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          onboardingCompleted ? (
            <Root.Screen name="Main" component={MainTabs} />
          ) : (
            <Root.Screen name="Onboarding" component={OnboardingStack} />
          )
        ) : (
          <Root.Screen name="Auth" component={AuthStack} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}