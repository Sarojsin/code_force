/**
 * Root navigator. Shows Splash → then decides Auth/Onboarding/Main.
 *
 * Onboarding decision (priority order):
 * 1. AsyncStorage direct read (fast path — no network, no race)
 * 2. `user.onboarding_completed` from auth /me response (hydrate gives us this)
 * 3. Server check (fallback for fresh installs or users who changed device)
 *
 * Safe fallback when server is unreachable:
 * - User has `onboarding_completed: true` on their User object → Main (correct)
 * - User has `onboarding_completed: false` → never auto-assume; show retry
 */

import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore, useOnboardingStore } from 'src/stores';
import { onboardingService } from 'src/services/api/onboarding';
import { SplashScreen } from 'src/screens/SplashScreen';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { MainTabs } from './MainTabs';

import type { RootStackParamList } from './types';

const Root = createStackNavigator<RootStackParamList>();
const ONBOARDING_KEY = 'shecare.onboarding';

export function RootNavigator() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const onboardingCompleted = useOnboardingStore((s) => s.isCompleted);
  const setCompleted = useOnboardingStore((s) => s.setCompleted);
  const [showSplash, setShowSplash] = useState(true);
  const [storageCompleted, setStorageCompleted] = useState<boolean | null>(null);
  const [serverRetry, setServerRetry] = useState(false);
  const serverChecked = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 1. AsyncStorage direct read
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed?.state?.isCompleted === true) {
            setStorageCompleted(true);
            return;
          }
        } catch {}
      }
      setStorageCompleted(false);
    });
  }, []);

  // 2. When hydrate completes, use `user.onboarding_completed` as the second source.
  //    Falls back to server check when local state is inconclusive.
  useEffect(() => {
    if (!isHydrated || storageCompleted === null) return;

    // Fast path: local or user object says completed (runs every time, even if
    // `serverChecked` is stale from a previous lifecycle — e.g. logout+login)
    if (storageCompleted || user?.onboarding_completed === true) {
      serverChecked.current = true;
      setCompleted(true);
      return;
    }

    if (serverChecked.current) return;

    // Never server-check when unauthenticated (avoids stale 401 errors)
    if (!user) {
      return;
    }

    // Not completed locally and user says not completed — try server
    if (serverRetry) {
      return;
    }

    onboardingService.getStatus()
      .then((resp) => {
        serverChecked.current = true;
        setServerRetry(false);
        if (resp.completed) {
          setCompleted(true);
        }
      })
      .catch(() => {
        serverChecked.current = true;
        setServerRetry(true);
      });
  }, [isHydrated, user, storageCompleted, onboardingCompleted, setCompleted, serverRetry]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  const onboardingOk = storageCompleted !== null;
  if (!isHydrated || !onboardingOk) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  const showOnboarding = !onboardingCompleted && !storageCompleted;

  // Persistent retry state when server is unreachable for an unconfirmed user
  if (user && serverRetry && !onboardingCompleted && !storageCompleted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          We're having trouble checking your account.{'\n'}Please make sure you have internet access.
        </Text>
        <TouchableOpacity
          onPress={() => { serverChecked.current = false; setServerRetry(false); }}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 32,
            backgroundColor: '#E91E63',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
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
