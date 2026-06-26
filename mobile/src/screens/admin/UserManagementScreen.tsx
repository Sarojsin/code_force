/**
 * UserManagementScreen — user list and role management.
 */

import React, { useState } from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';

interface ManagedUser {
  id: string;
  displayName: string;
  phone: string;
  role: 'user' | 'family' | 'nurse' | 'admin';
  isActive: boolean;
  createdAt: string;
}

const MOCK_USERS: ManagedUser[] = [
  { id: '1', displayName: 'Alice Johnson', phone: '+1234567890', role: 'user', isActive: true, createdAt: '2026-01-15' },
  { id: '2', displayName: 'Dr. Smith', phone: '+1234567891', role: 'nurse', isActive: true, createdAt: '2026-02-01' },
  { id: '3', displayName: 'Bob Williams', phone: '+1234567892', role: 'user', isActive: false, createdAt: '2026-03-10' },
  { id: '4', displayName: 'Carol Davis', phone: '+1234567893', role: 'family', isActive: true, createdAt: '2026-04-20' },
  { id: '5', displayName: 'Admin User', phone: '+1234567894', role: 'admin', isActive: true, createdAt: '2026-01-01' },
];

const roleColors = { user: '#D1FAE5', family: '#FEF3C7', nurse: '#BFDBFE', admin: '#EDE9FE' } as const;

export function UserManagementScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<string | null>(null);

  const filteredUsers = filter ? MOCK_USERS.filter(u => u.role === filter) : MOCK_USERS;

  const renderItem = ({ item }: { item: ManagedUser }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => logger.info('UserManagementScreen.selectUser', { id: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`${item.displayName}, ${item.role}`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: roleColors[item.role], borderRadius: theme.radius.pill }]}>
                <Txt variant="bodySmall" color="primary">{item.displayName.charAt(0)}</Txt>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <View style={styles.topRow}>
                  <Txt variant="h3">{item.displayName}</Txt>
                  <View style={[styles.roleBadge, { backgroundColor: roleColors[item.role], borderRadius: theme.radius.sm }]}>
                    <Txt variant="caption" color="primary">{item.role}</Txt>
                  </View>
                </View>
                <Txt variant="bodySmall" color="secondary">{item.phone}</Txt>
                <View style={styles.bottomRow}>
                  <View style={[styles.statusDot, { backgroundColor: item.isActive ? theme.colors.success : theme.colors.danger, borderRadius: theme.radius.pill }]} />
                  <Txt variant="caption" color="muted">{item.isActive ? 'Active' : 'Inactive'}</Txt>
                  <Txt variant="caption" color="muted" style={{ marginLeft: 12 }}>Joined {item.createdAt}</Txt>
                </View>
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  const FilterChip = ({ label, active }: { label: string | null; active: boolean }) => (
    <Pressable
      onPress={() => setFilter(label)}
      style={[styles.filterChip, { backgroundColor: active ? theme.colors.primary : theme.colors.surface, borderColor: active ? theme.colors.primary : theme.colors.border, borderRadius: theme.radius.pill }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filter by ${label ?? 'all'}`}
    >
      <Txt variant="bodySmall" color={active ? 'inverse' : 'primary'}>{label ?? 'All'}</Txt>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View>
            <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>User Management</Txt>
            <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>Manage users and roles.</Txt>
            <View style={styles.filters}>
              {[null, 'user', 'nurse', 'family', 'admin'].map(f => (
                <FilterChip key={f ?? 'all'} label={f} active={filter === f} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Card style={{ marginTop: theme.spacing.md }}><Txt variant="body" color="secondary" align="center">No users found.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 8, height: 8, marginRight: 4 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, minHeight: 36, justifyContent: 'center' },
});
