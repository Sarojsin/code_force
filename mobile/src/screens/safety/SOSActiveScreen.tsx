import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Toast from 'react-native-toast-message';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useActiveSos, useCancelSos, useResolveSos, useTriggerSos, useEmergencyContacts } from 'src/services/queries';
import { sendSmsFallback } from 'src/services/api/safety';
import { enqueueSos, enqueueResolve, enqueueCancel } from 'src/services/safetySyncQueue';
import { useAuthStore } from 'src/stores/authStore';

const LAST_LOCATION_KEY = 'shecare.last_known_location';

async function getLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
    });
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location.coords)).catch(() => {});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  } catch {
    try {
      const cached = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      if (cached) return { ...JSON.parse(cached), accuracy: null };
    } catch {}
    return null;
  }
}

const SOS_TRIGGER_DELAY_MS = 2000;

export function SOSActiveScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { data: activeAlert, isLoading } = useActiveSos();
  const { data: contacts } = useEmergencyContacts();
  const user = useAuthStore(state => state.user);
  const cancelMutation = useCancelSos();
  const resolveMutation = useResolveSos();
  const triggerMutation = useTriggerSos();
  const [phase, setPhase] = useState<'countdown' | 'active' | 'resolved'>('countdown');
  const [countdown, setCountdown] = useState(SOS_TRIGGER_DELAY_MS / 1000);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const cancelledRef = useRef(false);

  // --- Countdown phase: 2-second hold before SOS fires ---
  useEffect(() => {
    if (phase !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 0.1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown' || countdown <= 0) return;
    if (countdown <= 0.5) {
      if (Platform.OS !== 'web') {
        Vibration.vibrate(200);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } else if (Math.abs(countdown - Math.round(countdown)) < 0.05) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }
    }
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== 'countdown' || countdown > 0) return;
    handleTriggerSos();
  }, [countdown, phase]);

  // --- Active phase: elapsed timer ---
  useEffect(() => {
    if (phase !== 'active') return;

    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleTriggerSos = async () => {
    const idempotencyKey = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const location = await getLocation();
    const data = {
      latitude: location?.latitude ?? 0,
      longitude: location?.longitude ?? 0,
      location_accuracy_m: location?.accuracy ?? null,
      trigger_source: 'button' as const,
    };
    const userName = user?.display_name || user?.email || 'Someone';

    try {
      await triggerMutation.mutateAsync({ data, idempotencyKey });
      setPhase('active');
    } catch (err) {
      await enqueueSos(data).catch(() => {});
      if (contacts && contacts.length > 0) {
        sendSmsFallback(
          contacts.map(c => c.phone_number),
          userName,
          location ?? undefined,
        );
      }
      Toast.show({
        type: 'success',
        text1: 'SOS sent via SMS to your emergency contacts',
      });
      setPhase('active');
    }
  };

  const handleCancelCountdown = () => {
    cancelledRef.current = true;
    navigation.goBack();
  };

  const handleImSafe = async () => {
    if (!activeAlert) return;
    try {
      await resolveMutation.mutateAsync(activeAlert.id);
      setPhase('resolved');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      await enqueueResolve(activeAlert.id).catch(() => {});
      Toast.show({
        type: 'info',
        text1: "We'll sync when online. You're marked as safe locally.",
      });
      setPhase('resolved');
      setTimeout(() => navigation.goBack(), 1500);
    }
  };

  const handleCancelSos = async () => {
    if (!activeAlert) return;
    try {
      await cancelMutation.mutateAsync(activeAlert.id);
      navigation.goBack();
    } catch (err) {
      await enqueueCancel(activeAlert.id).catch(() => {});
      Toast.show({
        type: 'info',
        text1: 'Cancel will sync when online.',
      });
      navigation.goBack();
    }
  };

  // --- Countdown UI (pre-trigger) ---
  if (phase === 'countdown') {
    const progress = 1 - countdown / (SOS_TRIGGER_DELAY_MS / 1000);
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.danger }]}>
        <View style={styles.container}>
          <View style={styles.countdownContainer}>
            <Txt variant="display" color="inverse" align="center" style={styles.bigCountdown}>
              {Math.ceil(countdown)}
            </Txt>
            <Txt variant="h3" color="inverse" align="center">Hold — SOS will trigger</Txt>
            <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: theme.radius.pill }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: '#fff', borderRadius: theme.radius.pill }]} />
            </View>
          </View>
          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" onPress={handleCancelCountdown} fullWidth />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'resolved') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.success }]}>
        <View style={styles.center}>
          <Txt variant="h2" color="inverse" align="center">You're safe ✓</Txt>
          <Txt variant="body" color="inverse" align="center" style={{ marginTop: 8 }}>Contacts notified</Txt>
        </View>
      </SafeAreaView>
    );
  }

  // --- Active SOS UI (post-trigger) ---
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}>
          <Txt variant="h2" color="secondary">Loading...</Txt>
        </View>
      </SafeAreaView>
    );
  }

  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.danger }]}>
      <View style={styles.container}>
        <View style={styles.countdownContainer}>
          <Txt variant="h1" color="inverse" align="center" style={styles.countdown}>
            {timeStr}
          </Txt>
          <Txt variant="h3" color="inverse" align="center">SOS ACTIVE</Txt>
          <Txt variant="body" color="inverse" align="center" style={{ marginTop: theme.spacing.sm, opacity: 0.9 }}>
            Emergency contacts are being notified
          </Txt>
        </View>

        <Card elevated style={styles.infoCard}>
          <Txt variant="h3" color="danger">Help is on the way</Txt>
          <Txt variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            Your emergency contacts have been alerted with your current location.
          </Txt>
          {(activeAlert?.manual_intervention_needed) && (
            <Txt variant="bodySmall" color="danger" style={{ marginTop: theme.spacing.sm }}>
              SMS delivery failed for all contacts. Manual intervention may be needed.
            </Txt>
          )}
        </Card>

        <View style={styles.actions}>
          <Button
            label="I'm Safe"
            variant="primary"
            onPress={handleImSafe}
            fullWidth
            loading={resolveMutation.isPending}
            disabled={cancelMutation.isPending}
            style={{ marginBottom: theme.spacing.md }}
          />
          <Button
            label="Cancel SOS (false alarm)"
            variant="outline"
            onPress={handleCancelSos}
            fullWidth
            loading={cancelMutation.isPending}
            disabled={resolveMutation.isPending}
          />
          {cancelMutation.isSuccess && (
            <Txt variant="caption" color="inverse" align="center" style={{ marginTop: theme.spacing.sm }}>
              Contacts notified of false alarm
            </Txt>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 48 },
  countdownContainer: { alignItems: 'center', marginTop: 60 },
  countdown: { fontSize: 64, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 8 },
  bigCountdown: { fontSize: 96, fontWeight: '800', fontVariant: ['tabular-nums'], marginBottom: 16 },
  progressBar: { height: 6, width: '80%', maxWidth: 240, marginTop: 24, overflow: 'hidden' },
  progressFill: { height: '100%' },
  infoCard: { marginVertical: 32 },
  actions: { gap: 8 },
});
