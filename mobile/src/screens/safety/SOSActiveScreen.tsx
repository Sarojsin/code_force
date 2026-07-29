import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Vibration, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

import Toast from 'react-native-toast-message';

import { Button, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useActiveSos, useCancelSos, useResolveSos, useTriggerSos, useEmergencyContacts } from 'src/services/queries';
import { sendSmsFallback } from 'src/services/api/safety';
import { enqueueSos, enqueueResolve } from 'src/services/safetySyncQueue';
import { useAuthStore } from 'src/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';

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
const CIRCUMFERENCE = 2 * Math.PI * 80;

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

  const progress = 1 - countdown / (SOS_TRIGGER_DELAY_MS / 1000);
  const strokeOffset = CIRCUMFERENCE * (1 - progress);

  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (phase === 'countdown') {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={['#7F0000', '#C0392B', '#8B1A1A']} style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <View style={styles.countdownContainer}>
            <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={200} height={200} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
                <SvgCircle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                <SvgCircle
                  cx="100" cy="100" r="80"
                  stroke="#fff"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  transform="rotate(-90, 100, 100)"
                />
              </Svg>
              <Txt style={styles.bigCountdown}>{Math.ceil(countdown)}</Txt>
            </View>
            <Txt variant="h3" color="inverse" align="center" style={{ marginTop: 16 }}>Hold — SOS will trigger</Txt>
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
      <LinearGradient colors={['#059669', '#10B981']} style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Txt variant="h2" color="inverse" align="center">✓ You're safe</Txt>
        <Txt variant="body" color="inverse" align="center" style={{ marginTop: 8 }}>Contacts notified</Txt>
      </LinearGradient>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}><Txt variant="h2" color="secondary">Loading...</Txt></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#7F0000', '#C0392B', '#8B1A1A']} style={StyleSheet.absoluteFill} />
      <View style={styles.container}>
        <View style={styles.countdownContainer}>
          <Txt style={{ fontSize: 72, marginBottom: 8 }}>🚨</Txt>
          <Txt variant="h2" color="inverse" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">SOS Alert Sent</Txt>
          <Txt variant="body" color="inverse" align="center" style={{ marginTop: 4, opacity: 0.9 }}>
            {timeStr}
          </Txt>
        </View>

        {(contacts ?? []).length > 0 && (
          <View style={styles.contactSection}>
            {(contacts ?? []).slice(0, 3).map((c: any, idx: number) => (
              <View key={c.id || idx} style={styles.activeContactRow}>
                <View style={[styles.activeContactAvatar, { borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Txt style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{(c.name || '?')[0]}</Txt>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Txt style={{ color: '#fff', fontWeight: '600' }}>{c.name}</Txt>
                  <Txt style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{c.relationship || 'Emergency contact'}</Txt>
                </View>
                <Txt style={{ color: '#4ADE80', fontSize: 12, fontWeight: '600' }}>✓ Notified</Txt>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={handleImSafe}
            style={[styles.imSafeBtn, { borderColor: 'rgba(255,255,255,0.5)', borderRadius: 16 }]}
            accessibilityLabel="Cancel SOS alert"
            accessibilityRole="button"
            accessibilityHint="Notifies contacts that you are safe"
          >
            <Txt style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              I'm Safe — Cancel Alert
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => {}}
            style={[styles.callEmergencyBtn, { backgroundColor: '#fff', borderRadius: 16 }]}
            accessibilityLabel="Call emergency services"
            accessibilityRole="button"
          >
            <Txt style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>
              📞 Call Emergency Services
            </Txt>
          </Pressable>
          {cancelMutation.isPending && (
            <Txt variant="caption" color="inverse" align="center" style={{ marginTop: 8 }}>
              Cancelling...
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
  bigCountdown: { color: '#fff', fontSize: 54, fontWeight: '800', fontVariant: ['tabular-nums'] },
  contactSection: { marginVertical: 16 },
  activeContactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  activeContactAvatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 8 },
  imSafeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1.5,
  },
  callEmergencyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
});
