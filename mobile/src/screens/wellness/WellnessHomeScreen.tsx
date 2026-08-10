import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { PhaseAwareHero } from 'src/components/ui/wellness/PhaseAwareHero';
import { ReadinessScoreCard } from 'src/components/ui/wellness/ReadinessScoreCard';
import { MiniMetricsRow } from 'src/components/ui/wellness/MiniMetricsRow';
import { DynamicRecommendations } from 'src/components/ui/wellness/DynamicRecommendations';
import { MiniPhaseTimeline } from 'src/components/ui/wellness/MiniPhaseTimeline';
import { MoodAreaChart } from 'src/components/ui/wellness/MoodAreaChart';
import { MoodInsightCard } from 'src/components/ui/wellness/MoodInsightCard';
import { MoodPillList } from 'src/components/ui/wellness/MoodPillList';
import { FloatingActionButton } from 'src/components/ui/wellness/FloatingActionButton';
import { useWellnessDashboard } from 'src/hooks/useWellnessDashboard';

export function WellnessHomeScreen() {
  const theme = useTheme();
  const dashboard = useWellnessDashboard();
  const phaseAccent = dashboard.cycle.phaseAccent ?? theme.colors.primary;
  const phaseBg = dashboard.cycle.phaseBg ?? `${theme.colors.primary}44`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Txt variant="h1" style={styles.titleText}>Wellness</Txt>
          <Txt variant="body" color="secondary">
            Your daily wellness hub
          </Txt>
        </View>

        <PhaseAwareHero
          cycleState={dashboard.cycle}
          onStartTracking={() => {}}
        />

        <View style={styles.tabContainer}>
          <TabItem label="Insights" isActive={true} />
        </View>

        <View style={styles.section}>
          <ReadinessScoreCard
            score={dashboard.readinessScore}
            breakdown={dashboard.readinessBreakdown}
          />
        </View>

        <View style={styles.section}>
          <MiniMetricsRow dayData={dashboard.dayData} />
        </View>

        <View style={styles.section}>
          <MiniPhaseTimeline
            cycleState={dashboard.cycle}
            predictions={dashboard.predictions}
          />
        </View>

        <View style={styles.section}>
          <DynamicRecommendations
            cycleState={dashboard.cycle}
            insights={dashboard.insights}
            analytics={dashboard.analytics}
            predictions={dashboard.predictions}
            healthTips={dashboard.phaseRecommendations}
            dayData={dashboard.dayData}
          />
        </View>

        <View style={styles.moodSection}>
          <Txt variant="h3" style={styles.moodTitle}>Mood Tracker</Txt>
          <MoodAreaChart
            moodLogs={dashboard.moodLogs}
            phaseColor={phaseAccent}
            phaseBg={phaseBg}
          />

          <View style={styles.section}>
            <MoodPillList
              moodLogs={dashboard.moodLogs}
              phaseAccent={phaseAccent}
              onPressMood={() => {}}
            />
          </View>

          <MoodInsightCard
            cycleState={dashboard.cycle}
            insight={dashboard.moodInsight}
          />

          <View style={styles.fabContainer}>
            <FloatingActionButton
              onPress={() => {}}
              label="Log mood"
              accessibilityLabel="Log a new mood entry"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TabItem({ label, isActive }: { label: string; isActive: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.segmentTab,
        isActive && styles.segmentTabActive,
        {
          backgroundColor: isActive ? `${theme.colors.primary}11` : theme.colors.border,
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <Txt
        variant="caption"
        style={[
          styles.segmentLabel,
          isActive && styles.segmentLabelActive,
          { color: isActive ? theme.colors.primary : theme.colors.textMuted },
        ]}
      >
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { padding: 24 },
  header: { marginBottom: 16 },
  titleText: { marginBottom: 4 },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  segmentTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentTabActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  segmentLabelActive: {
    fontWeight: '700',
  },
  section: {
    marginTop: 16,
  },
  moodSection: {
    marginTop: 24,
  },
  moodTitle: {
    marginBottom: 12,
  },
  fabContainer: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
});
