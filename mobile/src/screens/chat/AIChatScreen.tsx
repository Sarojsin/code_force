import React, { useState, useRef, useCallback } from 'react';
import { FlatList, StyleSheet, View, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import Svg, { Path, Line, Circle } from 'react-native-svg';

import { Text } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useNetworkStatus } from 'src/services/sync';
import { LinearGradient } from 'expo-linear-gradient';

const LUNA_BLUSH = '#FF6B8A';
const LUNA_ROSE = '#F7C5CC';
const LUNA_CREAM = '#FFF8F0';
const LUNA_DARK = '#2D1B26';
const LUNA_MID = '#6B4D5A';
const LUNA_GREEN = '#3CC87A';

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
    text: "Hi there! 🌸 I'm Luna, your cycle-aware wellness companion. I can help you track your period, log symptoms, and support you through every phase of your cycle. How are you feeling today?",
    sender: 'ai',
    timestamp: 'Just now',
  },
];

function LunaAvatar({ size = 46 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: LUNA_BLUSH, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.32, shadowRadius: 16, elevation: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <LinearGradient colors={[LUNA_BLUSH, '#E8D5F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={{ fontSize: size * 0.52 }}>🤖</Text>
      <View style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: LUNA_GREEN,
        borderWidth: 2, borderColor: '#fff',
      }} />
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
      'track my period': "Of course! 🌸 Head over to the **Calendar** tab to log your start and end dates. Or just tell me when it started and I'll guide you there step by step. Tracking regularly helps me give you better cycle insights!",
      'log a symptom': "I'm here for you! 💕 Which symptom are you noticing today? Common ones include: Cramps 🫨, Bloating 🫧, Fatigue 😴, Headache 🤕, Nausea 🤢, or Back pain. You can also tap the Calendar tab and log them right there. Every log helps us spot your patterns!",
      'cycle education': "Let's explore your cycle together! 🌙\n\n🩸 **Menstrual** (Days 1–5): Your period arrives — time to rest and restore\n🌱 **Follicular** (Days 6–13): Energy is rising, you're glowing!\n✨ **Ovulation** (Days 14–16): Peak fertility, vibrant and confident\n🌙 **Luteal** (Days 17–28): PMS may show up — be gentle with yourself\n\nWant to dive deeper into any phase? I've got plenty more to share! 💫",
      'feeling anxious': "I hear you, and it's okay to feel this way. 💗 Let me share a few things that might help you find some calm:\n\n🧘‍♀️ **Breathe with me** — try 4 seconds in, hold 4, out 4\n🚶‍♀️ A short walk outdoors can work wonders\n📝 Write it out — journaling helps release what's inside\n🗣️ Reach out to someone you trust\n\nWould you like me to guide you through a breathing exercise right now? 🌸",
    };
    const response = (responses[userText.toLowerCase()] ?? `Thank you for sharing that, lovely. 💕 I'm here for all things cycle tracking, symptom logging, and wellness. Could you tell me a bit more about what's on your mind? I'd love to help!`) + "\n\n⚕️ I'm AI-powered and not a substitute for professional medical advice.";

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

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.id === TYPING_INDICATOR_ID) {
      return (
        <View style={[styles.messageRow, styles.aiRow]}>
          <LunaAvatar size={32} />
<View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.90)', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 5, borderBottomRightRadius: 18, borderWidth: 1, borderColor: LUNA_ROSE + '55' }]}>
              <TypingDots />
            </View>
        </View>
      );
    }
    const isAI = item.sender === 'ai';
    const isStreamed = streamed[item.id] != null;
    return (
      <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
        {isAI && <LunaAvatar size={32} />}
        {isAI ? (
          <View style={[
            styles.bubble,
            {
              backgroundColor: 'rgba(255,255,255,0.90)',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: 5,
              borderBottomRightRadius: 18,
              borderWidth: 1,
              borderColor: LUNA_ROSE + '55',
              shadowColor: LUNA_MID,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.14,
              shadowRadius: 12,
              elevation: 2,
            },
          ]}>
            {isStreamed ? <StreamText text={item.text} /> : <Text variant="body" style={{ color: LUNA_DARK }}>{item.text}</Text>}
            <Text variant="caption" style={{ color: LUNA_MID, marginTop: 4 }}>{item.timestamp}</Text>
          </View>
        ) : (
          <View style={{
            padding: 14, maxWidth: '100%',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 5,
            shadowColor: LUNA_BLUSH,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.30,
            shadowRadius: 16,
            elevation: 6,
            overflow: 'hidden',
          }}>
            <LinearGradient colors={['#FF6B8A', '#D4507A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text variant="body" style={{ color: '#fff' }}>{item.text}</Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{item.timestamp}</Text>
          </View>
        )}
      </View>
    );
  }, [theme, streamed]);

  const displayedMessages = isTyping
    ? [...messages, { id: TYPING_INDICATOR_ID, text: '', sender: 'ai' as const, timestamp: '' }]
    : messages;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: LUNA_CREAM }]} edges={['top']}>
        {/* Floral decorative overlay */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, zIndex: 0, opacity: 0.08 }}>
          <Svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <Circle cx="90" cy="30" r="18" stroke={LUNA_BLUSH} strokeWidth="1" fill="none" />
            <Circle cx="82" cy="22" r="8" stroke={LUNA_BLUSH} strokeWidth="0.8" fill="none" />
            <Circle cx="98" cy="22" r="8" stroke={LUNA_BLUSH} strokeWidth="0.8" fill="none" />
            <Circle cx="82" cy="38" r="8" stroke={LUNA_BLUSH} strokeWidth="0.8" fill="none" />
            <Circle cx="98" cy="38" r="8" stroke={LUNA_BLUSH} strokeWidth="0.8" fill="none" />
            <Path d="M90 48 L90 60" stroke={LUNA_BLUSH} strokeWidth="1" />
            <Path d="M78 36 L70 28" stroke={LUNA_BLUSH} strokeWidth="0.8" />
            <Path d="M102 36 L110 28" stroke={LUNA_BLUSH} strokeWidth="0.8" />
            <Path d="M75 20 L73 10" stroke={LUNA_BLUSH} strokeWidth="0.6" />
            <Path d="M105 20 L107 10" stroke={LUNA_BLUSH} strokeWidth="0.6" />
          </Svg>
        </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.header, { borderBottomColor: LUNA_ROSE + '55' }]}>
          <LinearGradient colors={['rgba(255,248,240,0.96)', 'rgba(255,255,255,0.92)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            <LunaAvatar size={46} />
            <View style={{ marginLeft: 10 }}>
              <Text variant="h3">Luna AI</Text>
              <Text variant="caption" style={{ color: '#1A6B45', fontWeight: '700' }}>Online · Cycle-aware · Always here</Text>
            </View>
          </View>
        </View>

        {!isConnected && (
          <View style={[styles.offlineBanner, { backgroundColor: LUNA_ROSE + '44' }]}>
            <Text variant="caption" style={{ color: LUNA_MID }}>Offline mode — messages will sync when you reconnect</Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={displayedMessages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          initialNumToRender={7}
          ListHeaderComponent={!disclaimerShown ? (
            <Pressable onPress={() => setDisclaimerShown(true)} style={[styles.disclaimerBanner, { backgroundColor: LUNA_ROSE + '33', borderColor: LUNA_ROSE + '55', borderRadius: 12 }]}>
              <Text variant="caption" style={{ color: LUNA_MID, flex: 1 }}>
                AI-powered insights — not a substitute for professional medical advice
              </Text>
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={LUNA_MID} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </Pressable>
          ) : null}
          ListEmptyComponent={
            <Text variant="body" color="muted" align="center" style={{ marginTop: 40 }}>Start a conversation with Luna AI 🌸</Text>
          }
        />

        <View style={styles.suggestionRow}>
          {SUGGESTIONS.map(s => (
            <Pressable
              key={s}
              onPress={() => handleSend(s)}
              style={[styles.chip, { backgroundColor: 'rgba(255,255,255,0.75)', borderColor: LUNA_ROSE }]}
            >
              <Text variant="caption" style={{ color: LUNA_BLUSH }}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.inputBar, { backgroundColor: 'rgba(255,248,240,0.96)', borderTopColor: LUNA_ROSE + '55' }]}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Luna anything…"
            placeholderTextColor={LUNA_MID}
            multiline
            maxLength={500}
            accessibilityLabel="Message input"
            style={[
              styles.input,
              {
                color: LUNA_DARK,
                backgroundColor: 'rgba(255,255,255,0.85)',
                borderColor: LUNA_ROSE,
              },
            ]}
          />
          <View style={styles.inputActions}>
            <Pressable
              onPress={() => setIsRecording(v => !v)}
              accessibilityLabel={isRecording ? 'Stop recording' : 'Voice input'}
              style={[styles.iconAction, { backgroundColor: isRecording ? '#FFE5E5' : '#E8D5F5', borderRadius: 20 }]}
            >
              <View>
                {isRecording && <PulseRing active={isRecording} />}
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke={isRecording ? '#FF3B30' : LUNA_BLUSH} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke={isRecording ? '#FF3B30' : LUNA_BLUSH} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="12" y1="19" x2="12" y2="23" stroke={isRecording ? '#FF3B30' : LUNA_BLUSH} strokeWidth="2" strokeLinecap="round" />
                  <Line x1="8" y1="23" x2="16" y2="23" stroke={isRecording ? '#FF3B30' : LUNA_BLUSH} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </View>
            </Pressable>
            <Pressable
              onPress={() => handleSend()}
              disabled={!inputText.trim()}
              accessibilityLabel="Send message"
              style={[
                styles.sendBtn,
                {
                  backgroundColor: inputText.trim() ? LUNA_BLUSH : LUNA_ROSE,
                  shadowColor: inputText.trim() ? LUNA_BLUSH : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: inputText.trim() ? 0.35 : 0,
                  shadowRadius: 16,
                  elevation: inputText.trim() ? 8 : 0,
                },
              ]}
            >
              <Text style={{ fontSize: 20, color: '#fff', lineHeight: 22 }}>↑</Text>
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
  messageRow: { marginBottom: 12, maxWidth: '80%', flexDirection: 'row', alignItems: 'flex-end' },
  aiRow: { alignSelf: 'flex-start', gap: 8 },
  userRow: { alignSelf: 'flex-end' },
  offlineBanner: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  bubble: { padding: 14, maxWidth: '100%' },
  typingRow: { flexDirection: 'row', gap: 4, padding: 4 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LUNA_BLUSH + '88' },
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
    borderWidth: 1.5,
    borderRadius: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingHorizontal: 12,
    paddingBottom: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    fontSize: 15,
    borderRadius: 16,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  iconAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  disclaimerBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 12, borderWidth: 1, gap: 8 },
});
