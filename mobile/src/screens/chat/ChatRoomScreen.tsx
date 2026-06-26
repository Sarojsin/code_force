/**
 * ChatRoomScreen — chat messages with FlatList.
 */

import React, { useState, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import type { ChatStackParamList } from 'src/navigation/types';

type Rt = RouteProp<ChatStackParamList, 'ChatRoom'>;

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: string;
}

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', text: 'Hello! How are you feeling today?', sender: 'other', timestamp: '10:30 AM' },
  { id: 'm2', text: 'I am doing better, thank you!', sender: 'me', timestamp: '10:32 AM' },
  { id: 'm3', text: 'Glad to hear that. Any symptoms?', sender: 'other', timestamp: '10:33 AM' },
  { id: 'm4', text: 'Just mild fatigue, but nothing unusual.', sender: 'me', timestamp: '10:35 AM' },
  { id: 'm5', text: 'Take rest and stay hydrated. Let me know if anything changes.', sender: 'other', timestamp: '10:36 AM' },
];

export function ChatRoomScreen() {
  const theme = useTheme();
  const route = useRoute<Rt>();
  const { roomId } = route.params;
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const msg: Message = {
      id: `m${Date.now()}`,
      text: inputText.trim(),
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, msg]);
    setInputText('');
    logger.info('ChatRoomScreen.send', { roomId });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.sender === 'me';
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={[animStyle, styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.98); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          accessibilityRole="text"
          accessibilityLabel={`${isMe ? 'You' : 'Other'} said: ${item.text}`}
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? theme.colors.primary : theme.colors.surface,
              borderColor: isMe ? 'transparent' : theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <Txt variant="body" color={isMe ? 'inverse' : 'primary'}>{item.text}</Txt>
          <Txt variant="caption" color={isMe ? 'inverse' : 'muted'} style={{ marginTop: 4, opacity: 0.7 }}>{item.timestamp}</Txt>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: theme.spacing.md }}
          ListEmptyComponent={<Txt variant="body" color="secondary" align="center" style={{ marginTop: 40 }}>No messages yet. Say hello!</Txt>}
        />
        <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Message input"
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.pill,
              },
            ]}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!inputText.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={[
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <Txt variant="body" color="inverse">&#10148;</Txt>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  messageRow: { marginBottom: 8, maxWidth: '80%' },
  myRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderWidth: StyleSheet.hairlineWidth },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, height: 40, paddingHorizontal: 16, borderWidth: 1, marginRight: 8 },
  sendBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
