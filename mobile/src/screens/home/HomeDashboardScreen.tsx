import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Dimensions, AppState, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

import { Text, Skeleton, AnimatedSection } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCurrentCycleState } from 'src/hooks/useCurrentCycleState';
import { useTodayRecommendation } from 'src/hooks/useTodayRecommendation';
import { getPhaseMeta } from 'src/utils';
import { useAuthStore } from 'src/stores/authStore';
import { useDiaryAssetStore } from 'src/stores/diaryAssetStore';
import { LinearGradient } from 'expo-linear-gradient';
import { LunaOverlay } from '../companion/LunaOverlay';
import { initEventEngine } from '../../services/companion/EventEngine';
import { useSpeechBubble } from '../../services/companion/EventEngine';
import { dialogueEngine } from '../../services/companion/DialogueEngine';
import type { CyclePhase } from '../../services/companion/DialogueEngine';
import { useCompanionStore } from '../../stores/companionStore';
import { usePregnancyModeStore } from '../../stores/pregnancyModeStore';
import { useAchievementStore } from '../../stores/achievementStore';
import { AchievementPopup } from '../../components/ui/AchievementPopup';
import { CheckInCard } from '../../components/home/CheckInCard';
import { CatchUpCard } from '../../components/home/CatchUpCard';
import { eventBus } from '../../services/eventBus';
import { HomeRecommendationBanner } from 'src/components/home/HomeRecommendationBanner';
import { HomeAlwaysListening } from '../../hooks/useHomeAlwaysListening';

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

export function HomeDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { cycleDay, hasCycleData, phaseKey, phaseLabel, phaseEmoji, phaseAccent, phaseDesc, nextPeriodDays, predictedCycleLength, calData, isLoading: loading, error, refetch } = useCurrentCycleState(3, 3);
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? '';
  const firstName = displayName.split(' ')[0] || '';

  const phaseName = phaseLabel;
  const phaseColor = phaseAccent;
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const isFocused = useIsFocused();
  const lunaEnabled = useCompanionStore((s) => s.installStatus === 'ready');
  const pregnancyMode = usePregnancyModeStore((s) => s.isActive);
  const pregWeek = usePregnancyModeStore((s) => s.currentWeek);
  const lunaInitialized = useRef(false);
  const eventCleanupRef = useRef<(() => void) | null>(null);
  const { show: showBubble } = useSpeechBubble();
  const todayInsight = useTodayRecommendation();

  // Inject a cycle-phase reader into the dialogue engine (luna2 phase5 §2).
  // Reads the current phase at dialogue-pick time via a ref so it stays fresh
  // without reaching into the cycle module's store from the companion layer.
  const phaseKeyRef = useRef<CyclePhase | undefined>(hasCycleData ? phaseKey : undefined);
  phaseKeyRef.current = hasCycleData ? phaseKey : undefined;

  // Fresh-insight reader for the proactive override (luna plan Phase 2).
  const insightRef = useRef(todayInsight);
  insightRef.current = todayInsight;

  useEffect(() => {
    dialogueEngine.setCyclePhaseSource(() => phaseKeyRef.current);
    return () => dialogueEngine.setCyclePhaseSource(null);
  }, []);
  const showPopup = useAchievementStore((s) => s.showPopup);
  const dismissPopup = useAchievementStore((s) => s.dismissPopup);
  const currentPopup = useAchievementStore((s) => s.currentPopup);
  const hydrateCompanion = useCompanionStore((s) => s.hydrate);

  useEffect(() => {
    if (!lunaInitialized.current) {
      lunaInitialized.current = true;
      eventCleanupRef.current = initEventEngine(
        showBubble,
        (achievement) => {
          showPopup(achievement);
        },
        {
          getTodayInsight: () => ({
            card: insightRef.current.card
              ? { title: insightRef.current.card.title }
              : null,
            tier: insightRef.current.tier,
          }),
        },
      );
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

  const hydrateDiaryAssets = useDiaryAssetStore((s) => s.hydrate);
  const diaryAssetStatus = useDiaryAssetStore((s) => s.installStatus);

  useEffect(() => {
    if (user) {
      hydrateDiaryAssets(user.id);
    }
  }, [user, hydrateDiaryAssets]);

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

  const staggerItems = [50, 100, 150, 200, 250, 300, 350, 400, 450];

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
            {!hasCycleData ? (
              <AnimatedSection delay={staggerItems[0]}>
                <LinearGradient
                  colors={[theme.colors.primary + '22', theme.colors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.emptyCard, { borderRadius: 26, borderColor: theme.colors.primary + '30' }]}
                >
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text variant="h2" style={styles.emptyTitle}>Start tracking your first cycle</Text>
                  <Text variant="body" color="muted" style={styles.emptySubtitle}>
                    Log your first period to unlock personalized cycle predictions and phase insights.
                  </Text>
                  <Pressable
                    onPress={() => navigation.navigate('Main', { screen: 'Calendar', params: { screen: 'LogPeriod' } })}
                    accessibilityLabel="Log your first period"
                    accessibilityRole="button"
                    style={[styles.ctaButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg }]}
                  >
                    <Text style={styles.ctaButtonText}>Log Period</Text>
                  </Pressable>
                </LinearGradient>
              </AnimatedSection>
            ) : (
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
                            strokeDashoffset={2 * Math.PI * 34 * (1 - (cycleDay ?? 1) / (predictedCycleLength ?? 1))}
                          />
                        </Svg>
                        <View style={styles.ringLabel}>
                          <Text style={styles.ringDay}>{cycleDay}</Text>
                          <Text style={styles.ringTotal}>/ {predictedCycleLength}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{nextPeriodDays ?? '—'}</Text>
                        <Text style={styles.heroStatLabel}>Next period</Text>
                      </View>
                      <View style={[styles.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{predictedCycleLength ?? '—'}</Text>
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
            )}

            <AnimatedSection delay={staggerItems[1]}>
              <CheckInCard calData={calData} />
            </AnimatedSection>

            {hasCycleData && (
              <AnimatedSection delay={staggerItems[2]}>
                <HomeRecommendationBanner />
              </AnimatedSection>
            )}

            <AnimatedSection delay={staggerItems[3]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseTimeline}>
                {(['menstrual', 'follicular', 'ovulation', 'luteal'] as const).map((key) => {
                  const meta = getPhaseMeta(key);
                  const active = key === phaseKey;
                  return (
                    <Pressable
                      key={key}
                      style={[
                        styles.phaseCard,
                        {
                          backgroundColor: active ? meta.accent : 'rgba(255,255,255,0.75)',
                          borderColor: active ? meta.accent : 'rgba(0,0,0,0.06)',
                          borderRadius: 16,
                        },
                        active && { shadowColor: meta.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
                      ]}
                    >
                       <Text variant="emoji">{meta.emoji}</Text>
                      <Text style={[styles.phaseName, { color: active ? '#fff' : '#4A5568' }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </AnimatedSection>

            <AnimatedSection delay={staggerItems[4]}>
              <CatchUpCard />
            </AnimatedSection>

            <View style={styles.bentoRow}>
              <AnimatedSection delay={staggerItems[5]} style={{ flex: 1, marginRight: 6 }}>
                <Pressable
                  onPress={() => navigation.navigate('JournalEntry', { id: 'new' })}
                  style={[styles.bentoCard, { backgroundColor: '#fff', borderRadius: 20 }]}
                >
                  <View style={[styles.bentoIcon, { borderRadius: 12 }]}>
                    <LinearGradient colors={['#FFB3C6', '#FF6B8A']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    <Text style={{ fontSize: 20 }}>📒</Text>
                  </View>
                  <Text variant="h3" style={{ marginTop: 8 }}>Simple Journal</Text>
                  <Text variant="caption" color="muted">Quick thoughts in seconds</Text>
                </Pressable>
              </AnimatedSection>
              <AnimatedSection delay={staggerItems[5]} style={{ flex: 1, marginLeft: 6 }}>
                <Pressable
                  onPress={() => {
                    if (diaryAssetStatus === 'ready') {
                      navigation.navigate('DiaryLibrary');
                    } else {
                      Alert.alert(
                        'Download Required',
                        'Memory Diary needs ~18 MB of stickers, textures & fonts to create beautiful scrapbooks. Download now?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Download', onPress: () => navigation.navigate('DiaryAssetInstall') },
                        ]
                      );
                    }
                  }}
                  style={[styles.bentoCard, { backgroundColor: '#fff', borderRadius: 20 }]}
                >
                  <View style={[styles.bentoIcon, { borderRadius: 12 }]}>
                    <LinearGradient colors={['#E8D5B7', '#D4A574']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    <Text style={{ fontSize: 20 }}>📖</Text>
                  </View>
                  <Text variant="h3" style={{ marginTop: 8 }}>Memory Diary</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text variant="caption" color="muted">Create a beautiful scrapbook</Text>
                    {diaryAssetStatus !== 'ready' && (
                      <Text style={{ fontSize: 10, color: '#D97706' }}>⬇</Text>
                    )}
                  </View>
                </Pressable>
              </AnimatedSection>
            </View>

            <AnimatedSection delay={staggerItems[6]}>
              <Pressable
                onPress={() => navigation.navigate('Videos')}
                style={[styles.bentoCard, { backgroundColor: '#fff', borderRadius: 20, marginBottom: 24 }]}
              >
                <View style={[styles.bentoIcon, { borderRadius: 12 }]}>
                  <LinearGradient colors={['#60A5FA', '#3B82F6']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                  <Text style={{ fontSize: 20 }}>🏥</Text>
                </View>
                <Text variant="h3" style={{ marginTop: 8 }}>Health Library</Text>
                <Text variant="caption" color="muted">Videos, articles & tips from health experts</Text>
              </Pressable>
            </AnimatedSection>

          </View>
        )}

      </ScrollView>
      {isFocused && lunaEnabled && (
        <LunaOverlay
          screen="home"
          pregnancyMode={pregnancyMode}
          week={pregWeek}
          trimester={pregWeek <= 13 ? 1 : pregWeek <= 26 ? 2 : 3}
          currentPhase={phaseLabel}
          phaseKey={hasCycleData ? phaseKey : null}
          nextPeriodDays={nextPeriodDays}
          predictedStartDate={calData?.predictions?.predicted_next_period_start ?? null}
          predictedEndDate={calData?.predictions?.predicted_period_end ?? null}
          predictedCycleLength={predictedCycleLength}
          hasCycleData={hasCycleData}
        />
      )}
      {lunaEnabled && <AchievementPopup achievement={currentPopup} onDismiss={dismissPopup} />}
      {lunaEnabled && <HomeAlwaysListening />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
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
  emptyCard: {
    minHeight: 240,
    padding: 24,
    borderWidth: 1,
    marginBottom: CARD_GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
