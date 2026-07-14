import React, { useState, useRef, useCallback } from 'react';
import { FlatList, StyleSheet, View, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import Svg, { Path, Line } from 'react-native-svg';

import { Text } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useNetworkStatus } from 'src/services/sync';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'ai' | 'user';
  timestamp: string;
}

const SUGGESTIONS = ['Track my period', 'Log a symptom', 'Cycle education', 'Feeling anxious'];

const TYPING_INDICATOR_ID = '__typing__';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    text: "Hello! I'm your SheCare health assistant. I can help you track your cycle, log symptoms, and answer health questions. Remember that I'm AI-powered and not a substitute for professional medical advice.",
    sender: 'ai',
    timestamp: 'Just now',
  },
];

function AIIcon({ theme }: { theme: any }) {
  return (
    <View style={[styles.aiAvatar, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.pill }]}>
      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V4a2 2 0 012-2z" stroke={theme.colors.accent} strokeWidth="1.5" />
        <Path d="M12 14l-2-3 2-3 2 3-2 3z" fill={theme.colors.accent} opacity="0.6" />
        <Path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" stroke={theme.colors.accent} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function TypingDots() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  React.useEffect(() => {
    const animate = (dot: { value: number }, delay: number) => {
      setTimeout(() => {
        dot.value = withSpring(1, { damping: 10, stiffness: 100 }, () => {
          dot.value = withSpring(0, { damping: 10, stiffness: 100 });
        });
      }, delay);
    };
    const interval = setInterval(() => {
      animate(dot1, 0);
      animate(dot2, 150);
      animate(dot3, 300);
    }, 1200);
    return () => clearInterval(interval);
  }, [dot1, dot2, dot3]);

  const dotAStyle = useAnimatedStyle(() => ({ opacity: dot1.value + 0.3 }));
  const dotBStyle = useAnimatedStyle(() => ({ opacity: dot2.value + 0.3 }));
  const dotCStyle = useAnimatedStyle(() => ({ opacity: dot3.value + 0.3 }));

  return (
    <View style={styles.typingRow}>
      <Animated.View style={[styles.typingDot, dotAStyle]} />
      <Animated.View style={[styles.typingDot, dotBStyle]} />
      <Animated.View style={[styles.typingDot, dotCStyle]} />
    </View>
  );
}

function PulseRing({ active }: { active: boolean }) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.4);

  React.useEffect(() => {
    if (active) {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 800 }),
          withTiming(0.4, { duration: 800 }),
        ),
        -1,
      );
    } else {
      ringScale.value = withSpring(1);
      ringOpacity.value = withTiming(0);
    }
  }, [active, ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  if (!active) return null;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 20,
          borderWidth: 2,
          borderColor: '#FF3B30',
        },
        ringStyle,
      ]}
    />
  );
}

function StreamText({ text }: { text: string }) {
  const words = text.split(/(\s+)/);
  const [revealed, setRevealed] = useState(1);

  React.useEffect(() => {
    if (revealed >= words.length) return;
    const timer = setTimeout(() => setRevealed((r) => Math.min(r + 1, words.length)), 30);
    return () => clearTimeout(timer);
  }, [revealed, words.length]);

  return (
    <Text variant="body" style={{ color: '#fff' }}>
      {words.slice(0, revealed).join('')}
      {revealed < words.length && <Text variant="body" style={{ color: 'rgba(255,255,255,0.4)' }}>▌</Text>}
    </Text>
  );
}

export function AIChatScreen() {
  const theme = useTheme();
  const { isConnected } = useNetworkStatus();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [streamed, setStreamed] = useState<Record<string, number>>({});
  const [disclaimerShown, setDisclaimerShown] = useState(false);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const simulateAIResponse = useCallback((userText: string) => {
    if (!isConnected) {
      const errMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        text: "You appear to be offline. I couldn't process your request. Please check your connection and try again.",
        sender: 'ai' as const,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      appendMessage(errMsg);
      return;
    }

    setIsTyping(true);
    const responses: Record<string, string> = {
      'track my period': "I'll help you log your period! Head to the Calendar tab to log start/end dates, or tell me the date it started and I'll navigate you there.",
      'log a symptom': "Which symptom are you experiencing? Common ones include: Cramps, Bloating, Fatigue, Headache, Nausea, or Back pain. You can also log them from the Calendar tab.",
      'cycle education': "The menstrual cycle has 4 phases:\n\n🩸 Menstrual (Days 1-5): Your period\n🌱 Follicular (Days 6-13): Energy rises\n✨ Ovulation (Days 14-16): Peak fertility\n🌙 Luteal (Days 17-28): PMS symptoms\n\nWould you like to learn more about any phase?",
      'feeling anxious': "I'm sorry you're feeling anxious. Here are some things that might help:\n\n🧘 Deep breathing exercises\n🚶 Short walk in nature\n📝 Journaling your thoughts\n🗣️ Talking to a friend\n\nWould you like me to guide you through a breathing exercise?",
    };
    const response = (responses[userText.toLowerCase()] ?? `Thank you for sharing that. I'm here to help with period tracking, symptom logging, and wellness tips. Could you tell me more about what you'd like to know?`) + "\n\n⚕️ I'm AI-powered and not a substitute for professional medical advice.";

    const msg: ChatMessage = {
      id: `ai-${Date.now()}`,
      text: response,
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTimeout(() => {
      setIsTyping(false);
      appendMessage(msg);
      setStreamed(prev => ({ ...prev, [msg.id]: 1 }));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 500);
  }, [appendMessage]);

  const handleSend = useCallback((text?: string) => {
    const msgText = (text ?? inputText).trim();
    if (!msgText) return;
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      text: msgText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    appendMessage(msg);
    setInputText('');
    simulateAIResponse(msgText);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, appendMessage, simulateAIResponse]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isAI = item.sender === 'ai';
    const isStreamed = streamed[item.id] != null;
    return (
      <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
        {isAI && <AIIcon theme={theme} />}
        <View style={[
          styles.bubble,
          isAI ? { backgroundColor: '#F5F5F5', borderTopLeftRadius: 4 } : { backgroundColor: theme.colors.primary, borderTopRightRadius: 4 },
          { borderRadius: 20 },
        ]}>
          {isAI && isStreamed ? <StreamText text={item.text} /> : <Text variant="body" style={{ color: isAI ? theme.colors.textPrimary : '#fff' }}>{item.text}</Text>}
          <Text variant="caption" style={{ color: isAI ? theme.colors.textMuted : 'rgba(255,255,255,0.7)', marginTop: 4 }}>{item.timestamp}</Text>
        </View>
      </View>
    );
  };

  const displayedMessages = isTyping
    ? [...messages, { id: TYPING_INDICATOR_ID, text: '', sender: 'ai' as const, timestamp: '' }]
    : messages;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerLeft}>
            <AIIcon theme={theme} />
            <View style={{ marginLeft: 10 }}>
              <Text variant="h3">SheCare AI</Text>
              <Text variant="caption" color="muted">Health Assistant</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setIsRecording(v => !v)}
            accessibilityLabel={isRecording ? 'Stop recording' : 'Voice input'}
            style={[styles.voiceBtn, { backgroundColor: isRecording ? '#FFE5E5' : theme.colors.accentMuted, borderRadius: theme.radius.pill }]}
          >
            <View>
              {isRecording && <PulseRing active={isRecording} />}
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke={isRecording ? '#FF3B30' : theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke={isRecording ? '#FF3B30' : theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Line x1="12" y1="19" x2="12" y2="23" stroke={isRecording ? '#FF3B30' : theme.colors.accent} strokeWidth="2" strokeLinecap="round" />
                <Line x1="8" y1="23" x2="16" y2="23" stroke={isRecording ? '#FF3B30' : theme.colors.accent} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
          </Pressable>
        </View>

        {!isConnected && (
          <View style={[styles.offlineBanner, { backgroundColor: theme.colors.warning + '20' }]}>
            <Text variant="caption" style={{ color: theme.colors.warning }}>You're offline — messages will be sent when reconnected</Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={displayedMessages}
          keyExtractor={item => item.id}
          renderItem={(props) => props.item.id === TYPING_INDICATOR_ID ? (
            <View style={[styles.messageRow, styles.aiRow]}>
              <AIIcon theme={theme} />
              <View style={[styles.bubble, { backgroundColor: '#F5F5F5', borderRadius: 20, borderTopLeftRadius: 4 }]}>
                <TypingDots />
              </View>
            </View>
          ) : renderItem(props)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          ListHeaderComponent={!disclaimerShown ? (
            <Pressable onPress={() => setDisclaimerShown(true)} style={[styles.disclaimerBanner, { backgroundColor: theme.colors.warning + '12', borderColor: theme.colors.warning + '30', borderRadius: theme.radius.md }]}>
              <Text variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
                AI-powered insights — not a substitute for professional medical advice
              </Text>
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={theme.colors.warning} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </Pressable>
          ) : null}
          ListEmptyComponent={
            <Text variant="body" color="muted" align="center" style={{ marginTop: 40 }}>Start a conversation with SheCare AI</Text>
          }
        />

        <View style={styles.suggestionRow}>
          {SUGGESTIONS.map(s => (
            <Pressable
              key={s}
              onPress={() => handleSend(s)}
              style={[styles.chip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}
            >
              <Text variant="caption" color="primary">{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
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
          <View style={styles.inputActions}>
            <Pressable
              onPress={() => setIsRecording(v => !v)}
              accessibilityLabel={isRecording ? 'Stop recording' : 'Voice input'}
              style={[styles.iconAction, { borderRadius: theme.radius.pill }]}
            >
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke={isRecording ? '#FF3B30' : theme.colors.accent} strokeWidth="2" strokeLinecap="round" />
                <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke={isRecording ? '#FF3B30' : theme.colors.accent} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => handleSend()}
              disabled={!inputText.trim()}
              accessibilityLabel="Send message"
              style={[
                styles.sendBtn,
                {
                  backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M22 2L11 13" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  voiceBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  messageRow: { marginBottom: 12, maxWidth: '80%', flexDirection: 'row', alignItems: 'flex-end' },
  aiRow: { alignSelf: 'flex-start', gap: 8 },
  userRow: { alignSelf: 'flex-end' },
  aiAvatar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  bubble: { padding: 14, maxWidth: '100%' },
  typingRow: { flexDirection: 'row', gap: 4, padding: 4 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#999' },
  suggestionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 15,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  iconAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  disclaimerBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 12, borderWidth: 1, gap: 8 },
});
