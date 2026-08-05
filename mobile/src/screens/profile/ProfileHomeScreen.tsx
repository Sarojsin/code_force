import React, { useState } from 'react';
import { ScrollView, Alert, Platform, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Text as Txt, Button } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useAuthStore } from 'src/stores';
import { authService } from 'src/services/api';
import { resetAppForLogout } from 'src/services/sessionReset';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import type { ProfileStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

const MENU_ITEMS = [
  { label: 'Daily Log', route: 'DailyLog' as const, icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z' },
  { label: 'Edit Profile', route: 'EditProfile' as const, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: 'Health Info', route: 'EditHealth' as const, icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z' },
  { label: 'Settings', route: 'Settings' as const, icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z' },
  { label: 'Linked Family', route: 'LinkedFamily' as const, icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z' },
  { label: 'Change Password', route: 'ChangePassword' as const, icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' },
  { label: 'Companion Setup', route: 'CompanionInstall' as const, icon: 'M21 11.5v5c0 1.38-1.12 2.5-2.5 2.5H16v4.5c0 .28-.22.5-.5.5h-2c-.28 0-.5-.22-.5-.5V19h-2v4.5c0 .28-.22.5-.5.5h-2c-.28 0-.5-.22-.5-.5V19H5.5C4.12 19 3 17.88 3 16.5v-5c0-1.38 1.12-2.5 2.5-2.5h13c1.38 0 2.5 1.12 2.5 2.5z' },
];

export function ProfileHomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [loggingOut, setLoggingOut] = useState(false);

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
    }
    // Full per-user isolation: stores, encrypted/async storage, SQLite, query cache.
    await resetAppForLogout();
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm('Are you sure you want to sign out?')) {
        void performLogout();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: performLogout },
      ]);
    }
  };

  const initial = (user?.display_name || user?.email || 'S')[0].toUpperCase();
  const displayName = user?.display_name || user?.email?.split('@')[0] || 'Sofia';
  const displayEmail = user?.email || 'sofia@shecare.app';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryMuted, '#A83060']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.profileHero, { borderRadius: 26 }]}
        >
          <View style={[styles.decoCircleLG, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          <View style={[styles.decoCircleSM, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={[styles.editBtn, { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 16 }]}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
          >
            <Txt style={{ color: '#fff', fontSize: 14 }}>✏️</Txt>
          </Pressable>
          <View style={[styles.profileAvatar, { borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Txt style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{initial}</Txt>
          </View>
          <Txt style={styles.profileName}>{displayName}</Txt>
          <Txt style={styles.profileEmail}>{displayEmail}</Txt>
          <View style={styles.profilePills}>
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 100 }]}>
              <Txt style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✨ Premium</Txt>
            </View>
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 100 }]}>
              <Txt style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>🔥 3-month streak</Txt>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => navigation.navigate(item.route)}
              style={[styles.menuRow, { borderBottomColor: theme.colors.border, minHeight: theme.minTouchTarget }]}
              accessibilityLabel={`Navigate to ${item.label}`}
              accessibilityRole="button"
            >
              <View style={[styles.menuIcon, { borderRadius: 10, backgroundColor: theme.colors.primary + '14' }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path d={item.icon} fill={theme.colors.primary} />
                </Svg>
              </View>
              <Txt variant="body" style={styles.menuLabel}>{item.label}</Txt>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={theme.colors.mauve} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ))}
        </View>

        <Button
          label="Sign Out"
          variant="danger"
          fullWidth
          loading={loggingOut}
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  profileHero: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  decoCircleLG: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    right: -40,
  },
  decoCircleSM: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: -30,
    left: -20,
  },
  editBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileName: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    marginTop: 2,
  },
  profilePills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  menuSection: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    marginLeft: 12,
    fontWeight: '600',
  },
  logoutBtn: {
    marginTop: 8,
  },
});
