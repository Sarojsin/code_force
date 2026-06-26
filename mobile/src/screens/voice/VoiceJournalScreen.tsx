/**
 * VoiceJournalScreen — record voice journal.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';

export function VoiceJournalScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');

  const pulseAnim = useSharedValue(1);
  useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      logger.info('VoiceJournalScreen.stop', { duration });
    } else {
      setIsRecording(true);
      setDuration(0);
      pulseAnim.value = withSequence(
        withSpring(1.12, { damping: 3, stiffness: 100 }),
        withSpring(0.96, { damping: 3, stiffness: 100 }),
      );
      logger.info('VoiceJournalScreen.start');
    }
  };

  const handleSave = () => {
    logger.info('VoiceJournalScreen.save', { transcript });
    navigation.goBack();
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (!isRecording) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, flexGrow: 1 }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Voice Journal</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Record your thoughts and feelings.
        </Txt>

        <Card style={styles.recorderCard}>
          <View style={styles.recordContainer}>
            <Animated.View style={[styles.recordOuter, { borderColor: isRecording ? theme.colors.danger : theme.colors.primary, borderRadius: theme.radius.pill }]}>
              <Pressable
                onPress={toggleRecording}
                accessibilityRole="button"
                accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
                style={[styles.recordBtn, { backgroundColor: isRecording ? theme.colors.danger : theme.colors.primary, borderRadius: theme.radius.pill }]}
              >
                <View style={[styles.recordInner, { backgroundColor: theme.colors.textInverse, borderRadius: isRecording ? 4 : theme.radius.pill }]} />
              </Pressable>
            </Animated.View>
            <Txt variant="display" style={{ marginTop: theme.spacing.lg }}>{formatDuration(duration)}</Txt>
            <Txt variant="bodySmall" color="muted" style={{ marginTop: theme.spacing.xs }}>
              {isRecording ? 'Recording... Tap to stop' : 'Tap to start recording'}
            </Txt>
          </View>
        </Card>

        {!isRecording && duration > 0 && (
          <>
            <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Transcript</Txt>
            <TextInput
              value={transcript}
              onChangeText={setTranscript}
              placeholder="Your voice will be transcribed here..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={5}
              accessibilityLabel="Journal transcript"
              style={[styles.textarea, { color: theme.colors.textPrimary, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
            />
            <View style={{ height: theme.spacing.lg }} />
            <Button label="Save journal entry" onPress={handleSave} fullWidth />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  recorderCard: { alignItems: 'center', paddingVertical: 32 },
  recordContainer: { alignItems: 'center' },
  recordOuter: { width: 100, height: 100, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  recordBtn: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  recordInner: { width: 28, height: 28 },
  textarea: { borderWidth: 1, padding: 12, fontSize: 16, minHeight: 120, textAlignVertical: 'top' },
});
