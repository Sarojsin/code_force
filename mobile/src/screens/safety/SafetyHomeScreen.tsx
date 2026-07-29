import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Path } from 'react-native-svg';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useEmergencyContacts, useActiveSos } from 'src/services/queries';
import type { SafetyStackParamList } from 'src/navigation/types';
import { LinearGradient } from 'expo-linear-gradient';

type Nav = StackNavigationProp<SafetyStackParamList, 'SafetyHome'>;

export function SafetyHomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: contacts } = useEmergencyContacts();
  const { data: activeAlert } = useActiveSos();

  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.6);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.3);

  useEffect(() => {
    ring1Scale.value = withRepeat(
      withSequence(withTiming(1.25, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1, true,
    );
    ring1Opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 1200 }), withTiming(0.6, { duration: 1200 })),
      -1, true,
    );
    ring2Scale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1, true,
    );
    ring2Opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 1200 }), withTiming(0.3, { duration: 1200 })),
      -1, true,
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const sosScale = useSharedValue(1);
  const sosPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sosScale.value }],
  }));

  useEffect(() => {
    if (activeAlert) {
      navigation.navigate('SOSActive');
    }
  }, [activeAlert, navigation]);

  const handleSosPress = () => {
    navigation.navigate('SOSActive');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[theme.colors.primary + '1F', 'transparent']}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={[styles.scroll, { padding: 24 }]}>
        <Txt style={{ fontSize: 28, fontWeight: '800', color: theme.colors.textPrimary }}>Safety Centre</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: 24 }}>
          You are safe. Your emergency network is ready.
        </Txt>

        <View style={styles.sosWrapper}>
          <Animated.View style={[styles.pulseRing, ring2Style]} />
          <Animated.View style={[styles.pulseRing, ring1Style]} />
          <Animated.View style={[sosPressStyle, styles.sosButtonContainer]}>
            <Pressable
              onPressIn={() => { sosScale.value = withSpring(0.92); }}
              onPressOut={() => { sosScale.value = withSpring(1); }}
              onPress={handleSosPress}
              accessibilityLabel="SOS Emergency Alert"
              accessibilityRole="button"
              accessibilityHint="Triggers 5-second countdown, then alerts contacts"
            >
              <LinearGradient
                colors={['#FF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.sosCircle, { borderRadius: 90 }]}
              >
                <Txt style={{ fontSize: 42 }}>🆘</Txt>
                <Txt style={styles.sosLabel}>SOS</Txt>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>

        <Card elevated style={{ marginBottom: 16 }}>
          <Txt variant="h3" style={{ marginBottom: 12 }}>Emergency Contacts</Txt>
          {(contacts ?? []).length > 0 ? (
            (contacts ?? []).map((c: any, idx: number) => (
              <View key={c.id || idx} style={[styles.contactRow, { borderBottomColor: theme.colors.border }]}>
                <LinearGradient
                  colors={['#FF6B8A', '#D4507A']}
                  style={[styles.contactAvatar, { borderRadius: 20 }]}
                >
                  <Txt style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    {(c.name || '?')[0].toUpperCase()}
                  </Txt>
                </LinearGradient>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Txt variant="body" style={{ fontWeight: '600' }}>{c.name}</Txt>
                  <Txt variant="caption" color="muted">{c.relationship || 'Emergency contact'}</Txt>
                </View>
                <Pressable style={[styles.callBtn, { backgroundColor: theme.colors.mint, borderRadius: 20 }]}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </Svg>
                </Pressable>
              </View>
            ))
          ) : (
            <Txt variant="body" color="muted" style={{ marginBottom: 8 }}>No contacts added yet.</Txt>
          )}
          <Pressable
            onPress={() => navigation.navigate('EmergencyContacts')}
            style={[styles.addContactBtn, { borderColor: theme.colors.mauve, borderRadius: 16, borderStyle: 'dashed' }]}
          >
            <Txt variant="body" color="primary" style={{ fontWeight: '600' }}>+ Add Contact</Txt>
          </Pressable>
        </Card>

        <Button
          label="SOS History"
          variant="secondary"
          onPress={() => navigation.navigate('SosHistory')}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  sosWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    position: 'relative',
    height: 200,
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  sosButtonContainer: {
    position: 'absolute',
  },
  sosCircle: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  sosLabel: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addContactBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1.5,
    marginTop: 12,
  },
});
