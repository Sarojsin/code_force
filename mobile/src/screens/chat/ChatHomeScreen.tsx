/**
 * ChatHomeScreen — list of chat rooms.
 */

import React from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { ChatStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<ChatStackParamList, 'ChatHome'>;

interface ChatRoom {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  avatar: string;
}

const MOCK_ROOMS: ChatRoom[] = [
  { id: 'room_1', name: 'Dr. Smith', lastMessage: 'Your test results are normal.', lastMessageTime: '2m ago', unread: 1, avatar: 'DS' },
  { id: 'room_2', name: 'Mom', lastMessage: 'How are you feeling today?', lastMessageTime: '1h ago', unread: 0, avatar: 'M' },
  { id: 'room_3', name: 'Wellness Group', lastMessage: 'Next meditation session at 6 PM', lastMessageTime: '3h ago', unread: 3, avatar: 'WG' },
  { id: 'room_4', name: 'Sarah (Sister)', lastMessage: 'Thanks for the update!', lastMessageTime: '1d ago', unread: 0, avatar: 'S' },
];

export function ChatHomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const renderItem = ({ item }: { item: ChatRoom }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => navigation.navigate('ChatRoom', { roomId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${item.name}, ${item.unread} unread messages`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
                <Txt variant="bodySmall" color="primary">{item.avatar}</Txt>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <View style={styles.topRow}>
                  <Txt variant="h3">{item.name}</Txt>
                  <Txt variant="caption" color="muted">{item.lastMessageTime}</Txt>
                </View>
                <Txt variant="bodySmall" color="secondary" numberOfLines={1}>{item.lastMessage}</Txt>
              </View>
              {item.unread > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}>
                  <Txt variant="caption" color="inverse">{item.unread}</Txt>
                </View>
              )}
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_ROOMS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Chats</Txt>
            <Txt variant="body" color="secondary">Messages with providers and family.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No conversations yet.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unreadBadge: { minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
});
