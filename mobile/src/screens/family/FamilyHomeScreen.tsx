/**
 * FamilyHomeScreen — family dashboard showing linked members and recent activity.
 */

import React from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Button, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  status: 'safe' | 'alert' | 'offline';
}

const MOCK_FAMILY: FamilyMember[] = [
  { id: '1', name: 'Mom', role: 'Mother', status: 'safe' },
  { id: '2', name: 'Sarah', role: 'Sister', status: 'safe' },
  { id: '3', name: 'David', role: 'Brother', status: 'offline' },
];

const statusIcons = { safe: '&#10003;', alert: '&#9888;', offline: '&#8212;' } as const;
const statusColors = { safe: '#D1FAE5', alert: '#FEE2E2', offline: '#E5E7EB' } as const;

export function FamilyHomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const renderItem = ({ item }: { item: FamilyMember }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.role}`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
                <Txt variant="h3" color="primary">{item.name.charAt(0)}</Txt>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Txt variant="h3">{item.name}</Txt>
                <Txt variant="bodySmall" color="secondary">{item.role}</Txt>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status], borderRadius: theme.radius.pill }]}>
                <Txt variant="caption">{statusIcons[item.status]}</Txt>
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_FAMILY}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Family</Txt>
            <Txt variant="body" color="secondary">Your linked family members and their status.</Txt>
          </View>
        }
        ListFooterComponent={
          <Button label="Invite family member" variant="outline" fullWidth style={{ marginTop: theme.spacing.md }} onPress={() => navigation.navigate('InviteFamily' as never)} />
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No family members yet. Invite someone to connect.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
