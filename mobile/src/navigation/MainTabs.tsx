/**
 * Main tab navigator — bottom tabs per UI_UX design spec.
 * Tabs: Home | Calendar | Analytics | AI Chat | Profile
 */

import React from 'react';
import { View, Text as RNText } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

import { HomeStack } from './HomeStack';
import { CalendarStack } from './CalendarStack';
import { AnalyticsStack } from './AnalyticsStack';
import { WellnessStack } from './WellnessStack';
import { ProfileStack } from './ProfileStack';

import { useTheme } from 'src/theme';
import type { MainTabParamList } from './types';

const Tabs = createBottomTabNavigator<MainTabParamList>();

const ACTIVE_COLOR = '#FFFFFF';

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const size = 24;
  const strokeWidth = focused ? 2.5 : 1.8;

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
      case 'Wellness':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M12 2C12 2 6 7 6 13c0 3.31 2.69 6 6 6s6-2.69 6-6c0-6-6-11-6-11z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 22v-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
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
  const INACTIVE_COLOR = theme.colors.textLighter;
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <View style={{
            width: focused ? 42 : 36,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {focused ? (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryMuted]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 42,
                  height: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 14,
                  elevation: 6,
                }}
              >
                <TabIcon name={route.name} focused={true} color={ACTIVE_COLOR} />
              </LinearGradient>
            ) : (
              <TabIcon name={route.name} focused={false} color={INACTIVE_COLOR} />
            )}
          </View>
        ),
        tabBarLabel: ({ focused, children }) => (
          <RNText style={{
            fontSize: 10,
            fontWeight: focused ? '800' : '500',
            color: focused ? theme.colors.primary : INACTIVE_COLOR,
            textAlign: 'center',
          }}>
            {children}
          </RNText>
        ),
        tabBarStyle: {
          position: 'absolute',
          bottom: 12,
          left: 16,
          right: 16,
          backgroundColor: theme.isDark ? 'rgba(42,45,56,0.94)' : 'rgba(255,248,240,0.94)',
          borderTopWidth: 0,
          borderTopColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(247,197,204,0.4)',
          borderRadius: 20,
          height: 60,
          paddingBottom: 22,
          paddingTop: 8,
          shadowColor: theme.colors.mauve,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.16,
          shadowRadius: 24,
          elevation: 8,
        },
        headerShown: false,
        freezeOnBlur: true,
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
        name="Wellness"
        component={WellnessStack}
        options={{ tabBarLabel: 'Wellness' }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tabs.Navigator>
  );
}
