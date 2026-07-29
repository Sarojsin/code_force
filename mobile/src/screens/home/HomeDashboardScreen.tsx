import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Dimensions, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

import { Text, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCycleCalendar } from 'src/services/queries';
import { useAuthStore } from 'src/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { LunaOverlay } from '../companion/LunaOverlay';
import { initEventEngine } from '../../services/companion/EventEngine';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { useCompanionStore } from '../../stores/companionStore';
import { useAchievementStore } from '../../stores/achievementStore';
import { AchievementPopup } from '../../components/ui/AchievementPopup';
import { eventBus } from '../../services/eventBus';

type Nav = any;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Good night';
}

function getPhaseName(days: number): string {
  if (days >= 1 && days <= 5) return 'Menstrual';
  if (days >= 6 && days <= 13) return 'Follicular';
  if (days === 14 || days === 15) return 'Ovulation';
  return 'Luteal';
}

function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'Menstrual': return '#F48FB1';
    case 'Follicular': return '#CE93D8';
    case 'Ovulation': return '#81C784';
    case 'Luteal': return '#90CAF9';
    default: return '#F48FB1';
  }
}

function getPhaseEmoji(phase: string): string {
  switch (phase) {
    case 'Menstrual': return '🩸';
    case 'Follicular': return '🌱';
    case 'Ovulation': return '🌟';
    case 'Luteal': return '🌙';
    default: return '🌸';
  }
}

function getPhaseDescription(phase: string): string {
  switch (phase) {
    case 'Menstrual': return 'Rest and recharge';
    case 'Follicular': return 'Energy rising';
    case 'Ovulation': return 'Peak vitality. Magnetic energy.';
    case 'Luteal': return 'Slow down, stay cosy';
    default: return '';
  }
}

export function HomeDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: calData, isLoading: loading, error, refetch } = useCycleCalendar(3, 3);
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? '';
  const firstName = displayName.split(' ')[0] || '';

  const cycleDay = calData?.days ? Object.keys(calData.days).length % 28 + 1 : 1;
  const phaseName = getPhaseName(cycleDay);
  const phaseColor = getPhaseColor(phaseName);
  const phaseEmoji = getPhaseEmoji(phaseName);
  const phaseDesc = getPhaseDescription(phaseName);
  const nextPeriodDays = calData?.next_period_in_days ?? 14;
  const nextPeriodDate = calData?.next_period_in_days != null
    ? new Date(Date.now() + calData.next_period_in_days * 86400000)
    : null;

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const isFocused = useIsFocused();
  const lunaEnabled = useCompanionStore((s) => s.installStatus === 'ready');
  const lunaInitialized = useRef(false);
  const eventCleanupRef = useRef<(() => void) | null>(null);
  const { show: showBubble } = useSpeechBubble();
  const showPopup = useAchievementStore((s) => s.showPopup);
  const dismissPopup = useAchievementStore((s) => s.dismissPopup);
  const currentPopup = useAchievementStore((s) => s.currentPopup);
  const hydrateCompanion = useCompanionStore((s) => s.hydrate);

  useEffect(() => {
    if (!lunaInitialized.current) {
      lunaInitialized.current = true;
      eventCleanupRef.current = initEventEngine(showBubble, (achievement) => {
        showPopup(achievement);
      });
    }
    return () => {
      if (eventCleanupRef.current) {
        eventCleanupRef.current();
        eventCleanupRef.current = null;
        lunaInitialized.current = false;
      }
    };
  }, [showBubble]);

  useEffect(() => {
    if (user) {
      hydrateCompanion(user.id);
    }
  }, [user, hydrateCompanion]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        eventBus.emit('app_foregrounded', {});
      } else if (state === 'background') {
        eventBus.emit('app_backgrounded', {});
      }
    });
    return () => sub.remove();
  }, []);

  const staggerItems = [50, 100, 150, 200, 250, 300, 350, 400];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[theme.colors.primary + '38', 'transparent']}
        locations={[0, 0.65]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
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

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="muted" style={{ fontSize: 12, letterSpacing: 0.5 }}>{todayStr}</Text>
            <Text variant="display" style={styles.greeting}>{getTimeGreeting()}{firstName ? `, ${firstName}` : ''} ✨</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('SOSActive')}
            accessibilityLabel="Emergency SOS"
            accessibilityHint="Triggers 5-second countdown, then alerts contacts"
            style={[styles.sosBtn, { backgroundColor: theme.colors.danger, borderRadius: 22 }]}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>🆘</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Profile"
            style={[styles.avatarBtn, { backgroundColor: theme.colors.primary + '22', borderRadius: 22 }]}
          >
            <Text style={{ fontSize: 20 }}>👤</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingGrid}>
            <Skeleton height={200} style={{ width: SCREEN_WIDTH - 48, marginBottom: CARD_GAP, borderRadius: 26 }} />
            <Skeleton height={100} style={{ width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: 20 }} />
            <Skeleton height={100} style={{ width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: 20 }} />
          </View>
        ) : (
          <View style={styles.grid}>
            <AnimatedSection delay={staggerItems[0]}>
              <LinearGradient
                colors={[phaseColor + 'CC', phaseColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroCard, { borderRadius: 26 }]}
              >
                <View style={StyleSheet.absoluteFill}>
                  <View style={[styles.decoCircle, { width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -40, right: -40 }]} />
                  <View style={[styles.decoCircle, { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -20, right: -10 }]} />
                </View>
                <View style={styles.heroContent}>
                  <View style={styles.heroTop}>
                    <View style={[styles.phasePill, { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 100 }]}>
                      <View style={[styles.dot, { backgroundColor: '#81C784' }]} />
                      <Text style={styles.phasePillText}>CYCLE DAY {cycleDay} · {phaseName.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.heroTitle}>{phaseEmoji} {phaseName} Phase</Text>
                  <Text style={styles.heroSubtitle}>{phaseDesc}</Text>
                  <View style={styles.heroRingSection}>
                    <View style={{ alignItems: 'center' }}>
                      <Svg width={78} height={78} viewBox="0 0 78 78">
                        <SvgCircle cx="39" cy="39" r="34" stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="none" />
                        <SvgCircle
                          cx="39"
                          cy="39"
                          r="34"
                          stroke="#fff"
                          strokeWidth="5"
                          fill="none"
                          strokeDasharray={2 * Math.PI * 34}
                          strokeLinecap="round"
                          strokeDashoffset={2 * Math.PI * 34 * (1 - cycleDay / 28)}
                        />
                      </Svg>
                      <View style={styles.ringLabel}>
                        <Text style={styles.ringDay}>{cycleDay}</Text>
                        <Text style={styles.ringTotal}>/ 28</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                  <View style={styles.heroStats}>
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatValue}>{nextPeriodDays}</Text>
                      <Text style={styles.heroStatLabel}>Next period</Text>
                    </View>
                    <View style={[styles.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatValue}>28</Text>
                      <Text style={styles.heroStatLabel}>Cycle avg</Text>
                    </View>
                    <View style={[styles.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatValue}>3</Text>
                      <Text style={styles.heroStatLabel}>Streak</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </AnimatedSection>

            <View style={styles.quickStatsRow}>
              <AnimatedSection delay={staggerItems[1]} style={{ flex: 1, marginRight: 6 }}>
                <Pressable
                  onPress={() => navigation.navigate('CyclePredictions')}
                  style={[styles.statCard, { backgroundColor: theme.colors.accentMuted, borderRadius: 20 }]}
                >
                  <Text variant="caption" color="muted" style={{ fontSize: 10, letterSpacing: 0.8 }}>NEXT PERIOD</Text>
                  <Text style={styles.statNumber}>{nextPeriodDays}</Text>
                  <View style={[styles.progressBarSmall, { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 100 }]}>
                    <View style={[styles.progressFillSmall, { width: '50%', backgroundColor: '#A78BFA', borderRadius: 100 }]} />
                  </View>
                  <Text variant="caption" color="muted" style={{ fontSize: 10 }}>
                    {nextPeriodDate ? nextPeriodDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} · Predicted
                  </Text>
                </Pressable>
              </AnimatedSection>
              <AnimatedSection delay={staggerItems[1]} style={{ flex: 1, marginLeft: 6 }}>
                <Pressable
                  onPress={() => navigation.navigate('MoodLog')}
                  style={[styles.statCard, { backgroundColor: '#D1FAE5', borderRadius: 20 }]}
                >
                  <Text variant="caption" color="muted" style={{ fontSize: 10, letterSpacing: 0.8 }}>TODAY'S MOOD</Text>
                  <Text style={{ fontSize: 36 }}>😊</Text>
                  <View style={styles.moodLogRow}>
                    <View style={[styles.greenDot, { backgroundColor: '#10B981' }]} />
                    <Text variant="caption" style={{ color: '#059669', fontSize: 11 }}>Log feeling</Text>
                  </View>
                </Pressable>
              </AnimatedSection>
            </View>

            <AnimatedSection delay={staggerItems[2]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseTimeline}>
                {['Menstrual', 'Follicular', 'Ovulation', 'Luteal'].map((p) => {
                  const active = p === phaseName;
                  const pc = getPhaseColor(p);
                  return (
                    <Pressable
                      key={p}
                      style={[
                        styles.phaseCard,
                        {
                          backgroundColor: active ? pc : 'rgba(255,255,255,0.75)',
                          borderColor: active ? pc : 'rgba(0,0,0,0.06)',
                          borderRadius: 16,
                        },
                        active && { shadowColor: pc, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
                      ]}
                    >
                      <Text style={{ fontSize: 24 }}>{getPhaseEmoji(p)}</Text>
                      <Text style={[styles.phaseName, { color: active ? '#fff' : '#4A5568' }]}>{p}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </AnimatedSection>

            <AnimatedSection delay={staggerItems[3]}>
              <Pressable
                onPress={() => navigation.navigate('CyclePredictions')}
                style={[styles.aiCard, { borderRadius: 20 }]}
              >
                <LinearGradient colors={['#EDE9FE', '#FCE7F3']} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
                <View style={styles.aiCardContent}>
                  <View style={[styles.aiIconWrap, { borderRadius: 16, backgroundColor: theme.colors.accentMuted }]}>
                    <LinearGradient colors={['#C4B5FD', '#F0ABFC']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
                    <Text style={{ fontSize: 22 }}>🤖</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="h3">AI Prediction</Text>
                    <Text variant="body" color="secondary" style={{ marginTop: 2 }}>
                      Next period predicted <Text variant="body" style={{ fontWeight: '700' }}>
                        {nextPeriodDate ? nextPeriodDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                      </Text>
                    </Text>
                    <View style={styles.confidenceRow}>
                      <View style={[styles.confidenceBadge, { backgroundColor: '#10B981', borderRadius: 100 }]}>
                        <Text style={styles.confidenceText}>● 94% CONFIDENCE</Text>
                      </View>
                      <View style={[styles.confidenceBadge, { backgroundColor: '#10B981', borderRadius: 100 }]}>
                        <Text style={styles.confidenceText}>● ON TRACK</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            </AnimatedSection>

            <View style={styles.bentoRow}>
              <AnimatedSection delay={staggerItems[4]} style={{ flex: 1, marginRight: 6 }}>
                <Pressable
                  onPress={() => navigation.navigate('AIChat')}
                  style={[styles.bentoCard, { backgroundColor: '#fff', borderRadius: 20 }]}
                >
                  <View style={[styles.bentoIcon, { borderRadius: 12 }]}>
                    <LinearGradient colors={['#C4B5FD', '#F0ABFC']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    <Text style={{ fontSize: 20 }}>💬</Text>
                  </View>
                  <Text variant="h3" style={{ marginTop: 8 }}>Luna AI</Text>
                  <Text variant="caption" color="muted">Ask me anything about your health</Text>
                </Pressable>
              </AnimatedSection>
              <AnimatedSection delay={staggerItems[4]} style={{ flex: 1, marginLeft: 6 }}>
                <Pressable
                  onPress={() => navigation.navigate('JournalList')}
                  style={[styles.bentoCard, { backgroundColor: '#fff', borderRadius: 20 }]}
                >
                  <View style={[styles.bentoIcon, { borderRadius: 12 }]}>
                    <LinearGradient colors={['#A7F3D0', '#6EE7B7']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    <Text style={{ fontSize: 20 }}>📝</Text>
                  </View>
                  <Text variant="h3" style={{ marginTop: 8 }}>Journal</Text>
                  <Text variant="caption" color="muted">Log symptoms & feelings</Text>
                </Pressable>
              </AnimatedSection>
            </View>

            <AnimatedSection delay={staggerItems[5]}>
              <View style={[styles.analyticsCard, { backgroundColor: '#fff', borderRadius: 20 }]}>
                <Text variant="h3" style={{ marginBottom: 12 }}>Cycle Analytics</Text>
                <View style={styles.barChart}>
                  {['May', 'Jun', 'Jul'].map((month, idx) => {
                    const isCurrent = idx === 2;
                    const height = [70, 55, 85][idx];
                    return (
                      <View key={month} style={styles.barCol}>
                        <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>{['😊', '😌', '😊'][idx]}</Text>
                        <View style={[styles.bar, { height, borderRadius: 8, backgroundColor: isCurrent ? theme.colors.primary : '#FFD4DC' }]} />
                        <Text style={{ fontSize: 10, color: theme.colors.textMuted, marginTop: 4 }}>{month}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={[styles.regularityBadge, { backgroundColor: theme.colors.mint, borderRadius: 100 }]}>
                  <Text style={{ color: '#059669', fontSize: 12, fontWeight: '600' }}>📈 Average cycle: 28 days · Regularity score: 92%</Text>
                </View>
              </View>
            </AnimatedSection>

            <AnimatedSection delay={staggerItems[6]}>
              <Text variant="h3" style={{ marginBottom: 12 }}>Wellness Videos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  { emoji: '🥗', title: 'Cycle Nutrition', duration: '8 min', badge: 'Nutrition' },
                  { emoji: '🧘', title: 'Yoga for Cramps', duration: '15 min', badge: 'Exercise' },
                  { emoji: '😴', title: 'Better Sleep', duration: '6 min', badge: 'Sleep' },
                  { emoji: '🧠', title: 'Mindful Eating', duration: '10 min', badge: 'Wellness' },
                ].map((v, i) => (
                  <Pressable
                    key={v.title}
                    style={[styles.videoCard, { backgroundColor: '#fff', borderRadius: 16, marginRight: i < 3 ? 12 : 0 }]}
                  >
                    <View style={[styles.videoIcon, { borderRadius: 12 }]}>
                      <Text style={{ fontSize: 28 }}>{v.emoji}</Text>
                    </View>
                    <Text variant="body" style={{ fontWeight: '600', marginTop: 8 }}>{v.title}</Text>
                    <Text variant="caption" color="muted">⏱ {v.duration}</Text>
                    <View style={[styles.videoBadge, { backgroundColor: theme.colors.primary + '22', borderRadius: 100 }]}>
                      <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: '600' }}>{v.badge}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </AnimatedSection>

            <View style={{ height: 24 }} />
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
      {isFocused && lunaEnabled && <LunaOverlay />}
      {lunaEnabled && <AchievementPopup achievement={currentPopup} onDismiss={dismissPopup} />}
    </SafeAreaView>
  );
}

function AnimatedSection({ children, delay, style }: { children: React.ReactNode; delay: number; style?: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  React.useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { damping: 20, stiffness: 150 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 150 }));
  }, [delay]);
  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 4,
  },
  sosBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, marginBottom: 12 },
  loadingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  grid: {},
  heroCard: {
    minHeight: 240,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
  },
  decoCircle: {
    position: 'absolute',
  },
  heroContent: {
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  phasePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
  },
  heroRingSection: {
    alignItems: 'flex-end',
    marginTop: -60,
    marginBottom: 8,
  },
  ringLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    alignItems: 'center',
  },
  ringDay: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  ringTotal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  heroDivider: {
    height: 1,
    marginVertical: 12,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
  },
  quickStatsRow: {
    flexDirection: 'row',
    marginBottom: CARD_GAP,
  },
  statCard: {
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  progressBarSmall: {
    height: 4,
    marginVertical: 6,
  },
  progressFillSmall: {
    height: '100%',
  },
  moodLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  phaseTimeline: {
    marginBottom: CARD_GAP,
  },
  phaseCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginRight: 10,
    width: 90,
    borderWidth: 1,
  },
  phaseName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  aiCard: {
    minHeight: 100,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
  },
  aiCardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  aiIconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confidenceRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bentoRow: {
    flexDirection: 'row',
    marginBottom: CARD_GAP,
  },
  bentoCard: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    minHeight: 110,
  },
  bentoIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  analyticsCard: {
    padding: 16,
    marginBottom: CARD_GAP,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 4,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 32,
  },
  regularityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  videoCard: {
    width: 140,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  videoIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  videoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
});
