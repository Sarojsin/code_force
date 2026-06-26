/**
 * Main tab navigator — bottom tabs for primary modules.
 * Rule §1.1.
 */

import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useTheme } from 'src/theme';
import { useSafetyStore } from 'src/stores/safetyStore';
import { CycleStack } from './CycleStack';
import { PregnancyStack } from './PregnancyStack';
import { ProfileStack } from './ProfileStack';
import { SafetyStack } from './SafetyStack';
import { WellnessStack } from './WellnessStack';

import type { MainTabParamList } from './types';

const Tabs = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const theme = useTheme();
  const badgeCount = useSafetyStore((s) => s.badgeCount);
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="Wellness"
        component={WellnessStack}
        options={{ tabBarLabel: 'Wellness', tabBarIcon: tabIcon('W') }}
      />
      <Tabs.Screen
        name="Cycle"
        component={CycleStack}
        options={{ tabBarLabel: 'Cycle', tabBarIcon: tabIcon('C') }}
      />
      <Tabs.Screen
        name="Pregnancy"
        component={PregnancyStack}
        options={{ tabBarLabel: 'Pregnancy', tabBarIcon: tabIcon('P') }}
      />
      <Tabs.Screen
        name="Safety"
        component={SafetyStack}
        options={{
          tabBarLabel: 'Safety',
          tabBarIcon: tabIcon('S'),
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: 'Profile', tabBarIcon: tabIcon('M') }}
      />
    </Tabs.Navigator>
  );
}

function tabIcon(letter: string) {
  // Real icons land when plan 04 adds an icon set. Letter fallback for now.
  return ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{letter}</Text>;
}
