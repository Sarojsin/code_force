import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from 'src/components/ui';
import { useTheme } from 'src/theme';

import { HomeHeaderProps } from './types';

// Greeting depends on the wall clock; compute inside the memoized section so the
// parent's re-renders never recompute it.
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Good night';
}

function HomeHeaderBase({ todayStr, firstName, onSos, onProfile }: HomeHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        <Text variant="caption" color="muted" style={styles.headerDate}>{todayStr}</Text>
        <Text variant="display" style={styles.greeting}>
          {getTimeGreeting()}{firstName ? `, ${firstName}` : ''} ✨
        </Text>
      </View>
      <Pressable
        onPress={onSos}
        accessibilityLabel="Emergency SOS"
        accessibilityHint="Triggers 5-second countdown, then alerts contacts"
        style={[styles.sosBtn, { backgroundColor: theme.colors.danger }]}
      >
        <Text style={styles.sosEmoji}>🆘</Text>
      </Pressable>
      <Pressable
        onPress={onProfile}
        accessibilityLabel="Profile"
        style={[styles.avatarBtn, { backgroundColor: theme.colors.primary + '22' }]}
      >
        <Text style={styles.avatarEmoji}>👤</Text>
      </Pressable>
    </View>
  );
}

export const HomeHeader = React.memo(HomeHeaderBase);

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  headerDate: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  greeting: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 4,
  },
  sosBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderRadius: 22,
  },
  sosEmoji: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderRadius: 22,
  },
  avatarEmoji: {
    fontSize: 20,
  },
});

export default HomeHeader;