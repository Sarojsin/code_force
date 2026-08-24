import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Dimensions, AppState, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { Text, Skeleton, AnimatedSection } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCurrentCycleState } from 'src/hooks/useCurrentCycleState';
import { useTodayRecommendation } from 'src/hooks/useTodayRecommendation';
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
import { HomeHeader } from 'src/components/home/HomeHeader';
import { CycleHeroCard } from 'src/components/home/CycleHeroCard';
import { EmptyCycleCard } from 'src/components/home/EmptyCycleCard';
import { PhaseTimeline } from 'src/components/home/PhaseTimeline';
import { BentoGrid } from 'src/components/home/BentoGrid';

type Nav = any;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const STAGGER = [50, 100, 150, 200, 250, 300, 350, 400, 450];
// Luna dock floats above the tab bar (~112 pt tall + 18 pt offset + breathing room);
// content must scroll clear of it so the last card is not obscured.
const LUNA_DOCK_CLEARANCE = 140;

export function HomeDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const tabBarHeight = useBottomTabBarHeight();
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

  const handleRefetch = useCallback(() => refetch(), [refetch]);
  const handleSos = useCallback(() => navigation.navigate('SOSActive'), [navigation]);
  const handleProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const handleLogPeriod = useCallback(
    () => navigation.navigate('Main', { screen: 'Calendar', params: { screen: 'LogPeriod' } }),
    [navigation],
  );
  const handleNewJournal = useCallback(
    () => navigation.navigate('JournalEntry', { id: 'new' }),
    [navigation],
  );
  const handleDiaryPress = useCallback(() => {
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
  }, [navigation, diaryAssetStatus]);
  const handleVideos = useCallback(() => navigation.navigate('Videos'), [navigation]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[theme.colors.primary + '38', 'transparent']}
        locations={[0, 0.65]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + tabBarHeight + LUNA_DOCK_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.danger + '15', borderColor: theme.colors.danger + '30', borderRadius: theme.radius.md }]}>
            <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.danger }]}>
              Could not reload dashboard. Please check your connection.
            </Text>
            <Pressable onPress={handleRefetch} accessibilityLabel="Retry loading dashboard" accessibilityRole="button">
              <Text variant="bodySmall" style={[styles.retryText, { color: theme.colors.danger }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        <HomeHeader todayStr={todayStr} firstName={firstName} onSos={handleSos} onProfile={handleProfile} />

        {loading ? (
          <View style={styles.loadingGrid}>
            <Skeleton height={200} style={styles.skeletonHero} />
            <Skeleton height={100} style={styles.skeletonHalf} />
            <Skeleton height={100} style={styles.skeletonHalf} />
          </View>
        ) : (
          <View style={styles.grid}>
            {!hasCycleData ? (
              <AnimatedSection delay={STAGGER[0]}>
                <EmptyCycleCard onLogPeriod={handleLogPeriod} />
              </AnimatedSection>
            ) : (
              <AnimatedSection delay={STAGGER[0]}>
                <CycleHeroCard
                  cycleDay={cycleDay}
                  phaseName={phaseName}
                  phaseEmoji={phaseEmoji}
                  phaseDesc={phaseDesc}
                  phaseColor={phaseColor}
                  nextPeriodDays={nextPeriodDays}
                  predictedCycleLength={predictedCycleLength}
                />
              </AnimatedSection>
            )}

            <AnimatedSection delay={STAGGER[1]}>
              <CheckInCard calData={calData} />
            </AnimatedSection>

            {hasCycleData && (
              <AnimatedSection delay={STAGGER[2]}>
                <HomeRecommendationBanner />
              </AnimatedSection>
            )}

            <AnimatedSection delay={STAGGER[3]}>
              <PhaseTimeline phaseKey={hasCycleData ? phaseKey : undefined} />
            </AnimatedSection>

            <AnimatedSection delay={STAGGER[4]}>
              <CatchUpCard />
            </AnimatedSection>

            <AnimatedSection delay={STAGGER[5]}>
              <BentoGrid
                diaryAssetStatus={diaryAssetStatus}
                onJournal={handleNewJournal}
                onDiary={handleDiaryPress}
                onVideos={handleVideos}
              />
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
          recommendationCard={todayInsight.card}
        />
      )}
      {lunaEnabled && <AchievementPopup achievement={currentPopup} onDismiss={dismissPopup} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, marginBottom: 12 },
  errorText: { flex: 1 },
  retryText: { fontWeight: '700' },
  loadingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  grid: {},
  skeletonHero: { width: SCREEN_WIDTH - 48, marginBottom: CARD_GAP, borderRadius: 26 },
  skeletonHalf: { width: (SCREEN_WIDTH - 48 - CARD_GAP) / 2, marginBottom: CARD_GAP, borderRadius: 20 },
});