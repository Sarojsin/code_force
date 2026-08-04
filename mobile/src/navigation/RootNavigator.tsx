/**
 * Root navigator. Shows Splash → then decides Auth/Onboarding/Main.
 *
 * Onboarding decision — SINGLE source of truth is the onboarding Zustand store
 * (persisted, user-scoped). Zustand `persist` rehydrates asynchronously, so we
 * NEVER parse AsyncStorage manually inside this component (that would read a
 * stale/null value and flash between stacks).
 *
 * Decision priority:
 * 1. Store's persisted `userId` matches current user → trust store `isCompleted`.
 * 2. Otherwise (foreign/null flag) → trust server `user.onboarding_completed`;
 *    unknown server state defaults to showing onboarding (golden rule).
 *
 * A `useEffect` acts as a garbage collector: if the persisted flag belongs to a
 * DIFFERENT user, we immediately clear it (in-memory + AsyncStorage) via
 * `setCompleted(false)` so a sibling can never inherit it.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuthStore, useOnboardingStore } from 'src/stores';
import { shouldShowOnboarding } from 'src/utils';
import { SplashScreen } from 'src/screens/SplashScreen';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { MainTabs } from './MainTabs';
import { navigationRef } from './rootNavigation';

import type { RootStackParamList } from './types';

const Root = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const authIsHydrated = useAuthStore((s) => s.isHydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const onboardingCompleted = useOnboardingStore((s) => s.isCompleted);
  const storedUserId = useOnboardingStore((s) => s.userId);
  const setCompleted = useOnboardingStore((s) => s.setCompleted);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Garbage collector: if the persisted flag belongs to a DIFFERENT user, clear
  // it immediately (in-memory + AsyncStorage) so a sibling never inherits it.
  useEffect(() => {
    if (user && storedUserId && storedUserId !== user.id) {
      setCompleted(false);
    }
  }, [user?.id, storedUserId, setCompleted]);

  const showOnboarding = useMemo(() => {
    if (!user) return false;
    return shouldShowOnboarding(
      { isCompleted: onboardingCompleted, userId: storedUserId },
      user.id,
      user.onboarding_completed ?? null,
    );
  }, [user, onboardingCompleted, storedUserId]);

  // Wait for auth hydration. The onboarding decision does NOT gate on onboarding
  // store hydration: it falls back to the authoritative server flag whenever the
  // stored userId is null/mismatched, so there is no flash between stacks.
  if (showSplash || !authIsHydrated) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Root.Navigator screenOptions={{ headerShown: false, cardStyle: Platform.OS === 'web' ? ({ overflow: 'auto' } as any) : undefined }}>
        {user ? (
          showOnboarding ? (
            <Root.Screen name="Onboarding" component={OnboardingStack} />
          ) : (
            <Root.Screen name="Main" component={MainTabs} />
          )
        ) : (
          <Root.Screen name="Auth" component={AuthStack} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}