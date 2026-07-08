/**
 * Main tab navigator — bottom tabs per UI_UX design spec.
 * Tabs: Home | Calendar | Analytics | AI Chat | Profile
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

import { useTheme } from 'src/theme';
import { HomeStack } from './HomeStack';
import { CalendarStack } from './CalendarStack';
import { AnalyticsStack } from './AnalyticsStack';
import { AIChatStack } from './AIChatStack';
import { ProfileStack } from './ProfileStack';

import type { MainTabParamList } from './types';

const Tabs = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const size = 24;
  const strokeWidth = focused ? 2.2 : 1.8;

  const renderIcon = () => {
    switch (name) {
      case 'Home':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'Calendar':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'Analytics':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'AIChat':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V4a2 2 0 012-2z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={focused ? 1 : 0.4} />
          </Svg>
        );
      case 'Profile':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      default:
        return <SvgCircle cx={12} cy={12} r={10} stroke={color} strokeWidth={strokeWidth} />;
    }
  };

  return <>{renderIcon()}</>;
}

export function MainTabs() {
  const theme = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tabs.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tabs.Screen
        name="Calendar"
        component={CalendarStack}
        options={{ tabBarLabel: 'Calendar' }}
      />
      <Tabs.Screen
        name="Analytics"
        component={AnalyticsStack}
        options={{ tabBarLabel: 'Analytics' }}
      />
      <Tabs.Screen
        name="AIChat"
        component={AIChatStack}
        options={{ tabBarLabel: 'AI Chat' }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tabs.Navigator>
  );
}
