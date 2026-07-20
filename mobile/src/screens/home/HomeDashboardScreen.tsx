/**
 * HomeDashboardScreen — Bento + Glassmorphism layout per UI_UX Home_Screen spec.
 * Route: MainTabs → Home tab
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withSequence } from 'react-native-reanimated';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

import { Text, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCycleCalendar } from 'src/services/queries';
import { useAuthStore } from 'src/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';

type Nav = any;

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Good night';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_H_MD = 120;
const CARD_H_LG = 160;
const CARD_GAP = 12;

const GlassCard = React.memo(function GlassCard({
  children,
  style,
  onPress,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  delay?: number;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  React.useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { damping: 20, stiffness: 150 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 150 }));
  }, [delay]);

  const pressAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const Wrapper = onPress ? Animated.View : Animated.View;
  const wrapperStyle = onPress ? pressAnim : animStyle;

  return (
    <Wrapper style={wrapperStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { if (onPress) scale.value = withSpring(0.96); }}
        onPressOut={() => { if (onPress) scale.value = withSpring(1); }}
        disabled={!onPress}
        style={[
          styles.glassCard,
          {
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: theme.radius.xl,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Wrapper>
  );
});

const StatBadge = React.memo(function StatBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.badge}>
      <Text variant="h2" style={{ color, textAlign: 'center' }}>{value}</Text>
      <Text variant="caption" color="muted" align="center">{label}</Text>
    </View>
  );
});

export function HomeDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: calData, isLoading: loading, error, refetch } = useCycleCalendar(3, 3);
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? '';

  const nextPeriodDate = calData?.next_period_in_days != null
    ? new Date(Date.now() + calData.next_period_in_days * 86400000)
    : null;

  const bellRotation = useSharedValue(0);
  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellRotation.value}deg` }],
  }));

  const handleBellPress = useCallback(() => {
    bellRotation.value = withSequence(
      withSpring(-15, { damping: 4, stiffness: 200 }),
      withSpring(15, { damping: 4, stiffness: 200 }),
      withSpring(-10, { damping: 4, stiffness: 200 }),
      withSpring(0, { damping: 10, stiffness: 200 }),
    );
  }, [bellRotation]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.danger + '15', borderColor: theme.colors.danger + '30', borderRadius: theme.radius.md }]}>
            <Text variant="bodySmall" style={{ color: theme.colors.danger, flex: 1 }}>
              Could not reload dashboard. Please check your connection.
            </Text>
            <Pressable onPress={() => refetch()} accessibilityLabel="Retry loading dashboard" accessibilityRole="button">
              <Text variant="bodySmall" style={{ color: theme.colors.danger, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Header Card — 140px, avatar centered, bell top-right, greeting below */}
        <View style={[styles.headerCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border, minHeight: 140 }]}>
          <View style={styles.headerCardTop}>
            <View style={styles.headerAvatarWrapper}>
              <View style={[styles.headerAvatar, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
                <Text variant="h2" color="primary">🌸</Text>
              </View>
            </View>
            <Pressable onPress={handleBellPress} accessibilityLabel="Notifications" style={[styles.headerBell, { borderRadius: theme.radius.pill }]}>
              <Animated.View style={bellAnimStyle}>
                <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Animated.View>
            </Pressable>
          </View>
          <View style={styles.headerCardBottom}>
            <Text variant="display" style={{ color: theme.colors.textPrimary, fontSize: 18 }}>
              {getTimeGreeting()}{displayName ? `, ${displayName}` : ''}
            </Text>
            <Text variant="body" color="secondary" style={{ marginTop: 2 }}>
              🌸 SheCare
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingGrid}>
            <Skeleton height={CARD_H_MD} style={{ width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: theme.radius.xl }} />
            <Skeleton height={CARD_H_MD} style={{ width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: theme.radius.xl }} />
            <Skeleton height={CARD_H_LG} style={{ width: SCREEN_WIDTH - 48, marginBottom: CARD_GAP, borderRadius: theme.radius.xl }} />
            <Skeleton height={CARD_H_MD} style={{ width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: theme.radius.xl }} />
            <Skeleton height={CARD_H_MD} style={{ width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: theme.radius.xl }} />
          </View>
        ) : (
          <View style={styles.grid}>
            {/* Row 1: Today's Cycle + Next Period */}
            <GlassCard delay={0} style={[styles.cardHalf, { minHeight: CARD_H_MD }]}>
              <View style={styles.cardContent}>
                <View style={[styles.cardIcon, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.md }]}>
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text variant="bodySmall" color="muted" style={{ marginTop: 8 }}>Today's Cycle</Text>
                <Text variant="h2" style={{ marginTop: 2 }}>Day {calData?.days ? Object.keys(calData.days).length % 28 + 1 : '-'}</Text>
                <Text variant="caption" color="muted">Log symptoms</Text>
              </View>
            </GlassCard>

            <GlassCard delay={50} style={[styles.cardHalf, { minHeight: CARD_H_MD }]}>
              <LinearGradient colors={[theme.colors.primary, '#B06AB3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: theme.radius.xl, flex: 1, padding: 16, justifyContent: 'center' }}>
                <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.85)' }}>Next Period</Text>
                <Text variant="display" style={{ color: '#fff', fontSize: 28, marginTop: 4 }}>
                  {calData?.next_period_in_days != null ? `${calData.next_period_in_days} days` : '--'}
                </Text>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  {nextPeriodDate ? nextPeriodDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </Text>
              </LinearGradient>
            </GlassCard>

            {/* Row 2: AI Prediction (full width) */}
            <GlassCard delay={100} style={[styles.cardFull, { minHeight: CARD_H_LG }]}>
              <Pressable onPress={() => navigation.navigate('CyclePredictions')} style={{ flex: 1 }}>
                <View style={styles.cardContent}>
                  <View style={styles.cardRow}>
                    <View style={[styles.cardIcon, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.md }]}>
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <Path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <SvgCircle cx="12" cy="12" r="3" stroke={theme.colors.accent} strokeWidth="2" />
                      </Svg>
                    </View>
                    <Text variant="h3" style={{ flex: 1, marginLeft: 8 }}>AI Prediction</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <StatBadge value={calData?.predictions?.confidence ? `${Math.round(calData.predictions.confidence * 100)}%` : '86%'} label="Accuracy" color={theme.colors.success} />
                    <StatBadge value="75%" label="Fertility" color={theme.colors.accent} />
                    <StatBadge value="92%" label="Ovulation" color={theme.colors.primary} />
                  </View>
                  <View style={{ marginTop: 8, height: 24 }}>
                    <Svg width="100%" height="24" viewBox="0 0 200 24" preserveAspectRatio="none">
                      <Path d="M0 20 Q20 12 40 15 T80 10 T120 14 T160 6 T200 8" fill="none" stroke={theme.colors.accent} strokeWidth="1.5" opacity="0.6" />
                      <Path d="M0 20 Q20 12 40 15 T80 10 T120 14 T160 6 T200 8" fill="none" stroke={theme.colors.accent} strokeWidth="2.5" strokeLinecap="round" />
                    </Svg>
                  </View>
                </View>
              </Pressable>
            </GlassCard>

            {/* Row 3: Mood + Videos */}
            <GlassCard delay={150} style={[styles.cardHalf, { minHeight: CARD_H_MD }]}>
              <Pressable onPress={() => navigation.navigate('MoodLog')} style={{ flex: 1 }}>
                <View style={styles.cardContent}>
                  <View style={[styles.cardIcon, { backgroundColor: '#FEF3C7', borderRadius: theme.radius.md }]}>
                    <Text variant="h2">😊</Text>
                  </View>
                  <Text variant="bodySmall" color="muted" style={{ marginTop: 8 }}>Mood</Text>
                  <Text variant="body" style={{ marginTop: 2 }}>How are you feeling?</Text>
                </View>
              </Pressable>
            </GlassCard>

            <GlassCard delay={200} style={[styles.cardHalf, { minHeight: CARD_H_MD }]}>
              <Pressable onPress={() => (navigation as any).navigate('Videos')} style={{ flex: 1 }}>
                <View style={styles.cardContent}>
                  <View style={[styles.cardIcon, { backgroundColor: '#DCFCE7', borderRadius: theme.radius.md }]}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <Path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={theme.colors.success} strokeWidth="2" />
                    </Svg>
                  </View>
                  <Text variant="bodySmall" color="muted" style={{ marginTop: 8 }}>Videos</Text>
                  <View style={styles.badgeRow}>
                    <Text variant="body" style={{ marginTop: 2 }}>Explore</Text>
                    <View style={[styles.newBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}>
                      <Text variant="caption" color="inverse" style={{ fontSize: 10 }}>3 new</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </GlassCard>

            {/* Row 4: Journal + AI Chat */}
            <GlassCard delay={250} style={[styles.cardHalf, { minHeight: CARD_H_MD }]}>
              <Pressable onPress={() => navigation.navigate('JournalList')} style={{ flex: 1 }}>
                <View style={styles.cardContent}>
                  <View style={[styles.cardIcon, { backgroundColor: '#D1FAE5', borderRadius: theme.radius.md }]}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <Path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text variant="bodySmall" color="muted" style={{ marginTop: 8 }}>Journal</Text>
                  <Text variant="body" style={{ marginTop: 2 }}>Write your thoughts</Text>
                </View>
              </Pressable>
            </GlassCard>

            <GlassCard delay={300} style={[styles.cardHalf, { minHeight: CARD_H_MD }]}>
              <Pressable onPress={() => navigation.navigate('AIChat')} style={{ flex: 1 }}>
                <View style={styles.cardContent}>
                  <View style={[styles.cardIcon, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.md }]}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <Path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text variant="bodySmall" color="muted" style={{ marginTop: 8 }}>AI Chat</Text>
                  <Text variant="body" style={{ marginTop: 2 }}>Ask me anything</Text>
                </View>
              </Pressable>
            </GlassCard>

            {/* Row 5: Wellness Hub (Breathing, Mood History, Insights) */}
            <GlassCard delay={350} style={[styles.cardFull, { minHeight: 100 }]}>
              <Pressable onPress={() => navigation.navigate('Insights')} style={{ flex: 1 }}>
                <View style={styles.cardContent}>
                  <View style={styles.cardRow}>
                    <View style={[styles.cardIcon, { backgroundColor: '#EDE9FE', borderRadius: theme.radius.md }]}>
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <Path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text variant="h3" style={{ flex: 1, marginLeft: 10 }}>Wellness Hub</Text>
                  </View>
                  <View style={[styles.badgeRow, { marginTop: 8, gap: 8 }]}>
                    <Pressable onPress={() => navigation.navigate('BreathingList')} style={[styles.miniChip, { backgroundColor: '#EDE9FE', borderRadius: theme.radius.pill }]}>
                      <Text variant="caption" color="accent">🧘 Breathing</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('MoodHistory')} style={[styles.miniChip, { backgroundColor: '#BFDBFE', borderRadius: theme.radius.pill }]}>
                      <Text variant="caption" style={{ color: theme.colors.info }}>📊 Mood History</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('Insights')} style={[styles.miniChip, { backgroundColor: '#FCE7F3', borderRadius: theme.radius.pill }]}>
                      <Text variant="caption" color="primary">💡 Insights</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </GlassCard>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  headerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  headerCardTop: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBell: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerCardBottom: {
    alignItems: 'center',
    marginTop: 4,
  },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, marginBottom: 12 },
  loadingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  glassCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHalf: {
    width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2,
    marginBottom: CARD_GAP,
  },
  cardFull: {
    width: SCREEN_WIDTH - 48,
    marginBottom: CARD_GAP,
  },
  cardContent: {
    padding: 16,
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  badge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
