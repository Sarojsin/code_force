import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Dimensions, Pressable, Modal as RNModal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle as SvgCircle,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Line as SvgLine,
} from 'react-native-svg';
import {
  CalendarDays,
  ChevronRight,
  Sparkles,
  Lock,
  Activity,
  Droplets,
  Sun,
  MoonStar,
  HeartPulse,
  Smile,
  TrendingUp,
  Bot,
} from 'lucide-react-native';

import { Card, Text, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { safeStep, buildAreaPath, buildLinePath } from 'src/utils/svg';
import {
  useCycleEntries,
  useCycleAnalytics,
  useLatestCycleReport,
  useCycleReport,
  useRequestCycleReportSync,
} from 'src/services/queries/cycle';
import type { CycleEntry, CycleReport } from 'src/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32 - 48;

const Y_TICKS = [20, 25, 30, 35];

// ---------------------------------------------------------------------------
// Mascot — white soft blob sitting with legs tucked, closed happy eyes
// (colors come from theme surface / primary to stay theme-driven).
// ---------------------------------------------------------------------------

function Mascot({ size = 64 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* body */}
      <Path
        d="M60 14 C38 14 24 28 24 48 C24 66 26 82 30 94 L18 100 L26 108 L40 100 C46 104 53 107 60 107 C67 107 74 104 80 100 L94 108 L102 100 L90 94 C94 82 96 66 96 48 C96 28 82 14 60 14 Z"
        fill={theme.colors.surface}
      />
      {/* blush cheeks */}
      <SvgCircle cx="40" cy="56" r="6" fill={theme.colors.roseQuartz} opacity="0.8" />
      <SvgCircle cx="80" cy="56" r="6" fill={theme.colors.roseQuartz} opacity="0.8" />
      {/* closed happy eyes */}
      <Path d="M34 46 Q38 40 42 46" stroke={theme.colors.textSecondary} strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path d="M78 46 Q82 40 86 46" stroke={theme.colors.textSecondary} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* smile */}
      <Path d="M50 66 Q60 76 70 66" stroke={theme.colors.accent} strokeWidth="4" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Cycle Length Trend chart — y-gridlines at 20/25/30/35 with labels, value
// labels above each point, months below.
// ---------------------------------------------------------------------------

function TrendChart({ cycleData, months }: { cycleData: number[]; months: string[] }) {
  const theme = useTheme();
  if (cycleData.length < 2) return null;

  const w = CHART_WIDTH;
  const h = 150;
  const padding = { top: 22, bottom: 22, left: 30, right: 6 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const minVal = Y_TICKS[0];
  const maxVal = Y_TICKS[Y_TICKS.length - 1];
  const range = maxVal - minVal;
  const stepX = safeStep(plotW, cycleData.length);

  const validValues = cycleData.map((v) => Math.max(minVal, Math.min(maxVal, v)));
  const points = validValues.map((v, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - ((v - minVal) / range) * plotH,
  }));

  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(linePath, points[points.length - 1].x, points[0].x, h - 2);

  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={theme.colors.accent} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={theme.colors.accent} stopOpacity="0.02" />
        </SvgGradient>
      </Defs>

      {/* horizontal gridlines + y labels */}
      {Y_TICKS.map((tick) => {
        const y = padding.top + plotH - ((tick - minVal) / range) * plotH;
        return (
          <React.Fragment key={tick}>
            <SvgLine
              x1={padding.left}
              y1={y}
              x2={padding.left + plotW}
              y2={y}
              stroke={theme.colors.border}
              strokeWidth={0.6}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
            <SvgText x={padding.left - 6} y={y + 3.5} fontSize="9" fill={theme.colors.textMuted} textAnchor="end">{tick}</SvgText>
          </React.Fragment>
        );
      })}

      <Path d={areaPath} fill="url(#trendGrad)" />
      <Path d={linePath} fill="none" stroke={theme.colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <React.Fragment key={i}>
          <SvgCircle cx={p.x} cy={p.y} r="3.5" fill={theme.colors.surface} stroke={theme.colors.accent} strokeWidth="2" />
          <SvgText x={p.x} y={p.y - 9} fontSize="9" fontWeight="600" fill={theme.colors.textSecondary} textAnchor="middle">
            {cycleData[i]}
          </SvgText>
        </React.Fragment>
      ))}
      {months.map((m, i) => (
        <SvgText key={i} x={padding.left + i * stepX} y={h - 4} fontSize="9" fill={theme.colors.textMuted} textAnchor="middle">{m}</SvgText>
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title, action, onAction }: { icon: React.ReactNode; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderTitle}>
        {icon}
        <Text variant="h3">{title}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={styles.sectionAction}>
          <Text variant="caption" color="accent">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatCard({ icon, value, label, tint }: { icon: React.ReactNode; value: string; label: string; tint: string }) {
  const theme = useTheme();
  return (
    <Card style={styles.statCard} padded>
      <View style={[styles.statIconWrap, { backgroundColor: `${tint}22`, borderRadius: theme.radius.pill }]}>
        {icon}
      </View>
      <Text variant="h2" color="primary" style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" color="muted" style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </Card>
  );
}

function MiniPill({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: `${theme.colors.primary}22`, borderRadius: theme.radius.pill }]}>
      <Text variant="chip" color="primary">{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AI Insights card — lavender gradient hero + white inner panel with three
// divider-separated insights. Healthy state / loading skeleton / empty state.
// ---------------------------------------------------------------------------

function pillDefault(value: string | null | undefined): string {
  if (value == null || Number.isNaN(Number(value)) || Number(value) <= 0) return '--';
  return String(Math.round(Number(value)));
}

function AiInsightsCard({ onViewFull }: { onViewFull?: () => void }) {
  const theme = useTheme();
  const { data: report, isLoading } = useLatestCycleReport();

  if (isLoading) {
    return (
      <View style={[styles.aiCardWrap, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.xl }]}>
        <View style={styles.aiHeaderRow}>
          <Skeleton width={110} height={16} style={styles.aiSkeletonTitle} />
          <Skeleton width={48} height={20} style={{ borderRadius: theme.radius.pill }} />
        </View>
        <Skeleton width="88%" height={10} style={styles.aiSkeletonLine} />
        <Skeleton width="72%" height={10} style={styles.aiSkeletonLine} />
        <Skeleton width="45%" height={10} />
      </View>
    );
  }

  const data = report?.report_data;

  // Healthy state — a ready report exists.
  if (report && data) {
    return (
      <View style={[styles.aiCardWrap, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.xl }]}>
        <View style={[styles.aiGradient, { borderRadius: theme.radius.xl }]}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiTitleWrap}>
              <Mascot size={44} />
              <View>
                <View style={styles.aiTitleRow}>
                  <Text variant="h3" style={styles.aiTitleText}>AI Insights</Text>
                  <View style={[styles.newPill, { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill }]}>
                    <Text variant="chip" color="inverse">NEW</Text>
                  </View>
                </View>
                <Text variant="caption" color="muted">Analyzed from your cycle logs</Text>
              </View>
            </View>
            <Sparkles size={20} color={theme.colors.accent} />
          </View>

          <View style={[styles.aiInnerPanel, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
            <View style={styles.aiInsightCols}>
              <View style={styles.aiInsightCol}>
                <Text variant="heroValue" color="accent" style={styles.aiInsightValue}>
                  {pillDefault(data.avg_cycle_length_days != null ? String(data.avg_cycle_length_days) : null)}
                </Text>
                <Text variant="caption" color="muted" align="center">days avg cycle length</Text>
              </View>
              <View style={[styles.aiDividerV, { backgroundColor: theme.colors.borderSubtle }]} />
              <View style={styles.aiInsightCol}>
                <Text variant="heroValue" color="accent" style={styles.aiInsightValue}>{data.regularity_score}</Text>
                <Text variant="caption" color="muted" align="center">regularity score</Text>
              </View>
              <View style={[styles.aiDividerV, { backgroundColor: theme.colors.borderSubtle }]} />
              <View style={styles.aiInsightCol}>
                <Text variant="heroValue" color="accent" style={styles.aiInsightValue}>
                  {pillDefault(data.avg_sleep_hours != null ? String(Math.round((Number(data.avg_sleep_hours) + Number.EPSILON) * 10) / 10) : null)}
                </Text>
                <Text variant="caption" color="muted" align="center">h avg sleep</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={onViewFull} accessibilityRole="button" style={styles.aiFooterBtn}>
            <Text variant="button" color="accent">View full AI report</Text>
            <ChevronRight size={16} color={theme.colors.accent} />
          </Pressable>
        </View>
      </View>
    );
  }

  // Empty state — DB-first: nothing stored for the latest cycle yet.
  return (
    <View style={[styles.aiCardWrap, styles.aiCardEmpty, { backgroundColor: `${theme.colors.accentLight}66`, borderColor: theme.colors.accentLight, borderRadius: theme.radius.xl }]}>
      <View style={styles.aiEmptyRow}>
        <Mascot size={56} />
        <View style={styles.aiEmptyText}>
          <Text variant="h3" style={styles.aiTitleText}>AI Insights</Text>
          <Text variant="bodySmall" color="secondary" style={styles.aiEmptyBody}>
            Your AI report will appear here once a cycle is marked complete. It can spot patterns in your cycle, sleep, and mood.
          </Text>
        </View>
        <Sparkles size={18} color={theme.colors.accent} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Full AI report modal
// ---------------------------------------------------------------------------

function FullReportModal({ report, visible, onClose }: { report: CycleReport | null | undefined; visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  if (!report?.report_data) return null;
  const data = report.report_data;
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          accessibilityRole="none"
          style={[styles.modalSheet, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl }]}
        >
          <View style={styles.modalHeader}>
            <Sparkles size={18} color={theme.colors.accent} />
            <Text variant="h3" style={styles.modalHeaderTitle}>AI Cycle Report</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close report" hitSlop={10} style={[styles.modalClose, { backgroundColor: theme.colors.borderSubtle, borderRadius: theme.radius.pill }]}>
              <Text variant="body" color="muted">✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
            <Text variant="bodySmall" color="primary" style={styles.modalLabel}>SUMMARY</Text>
            <Text variant="body" style={styles.modalText}>{data.summary}</Text>

            {data.regularity_score != null && (
              <>
                <Text variant="bodySmall" color="primary" style={styles.modalLabelWide}>REGULARITY SCORE</Text>
                <Text variant="h2" color="accent">{data.regularity_score}/100</Text>
              </>
            )}

            {data.top_symptoms?.length ? (
              <>
                <Text variant="bodySmall" color="primary" style={styles.modalLabelWide}>MOST COMMON SYMPTOMS</Text>
                <View style={styles.modalChips}>
                  {data.top_symptoms.map((s) => <MiniPill key={s} text={s} />)}
                </View>
              </>
            ) : null}

            {data.correlation_found ? (
              <>
                <Text variant="bodySmall" color="primary" style={styles.modalLabelWide}>CORRELATION</Text>
                <Text variant="body" style={styles.modalText}>{data.correlation_found}</Text>
              </>
            ) : null}

            {data.doctor_note ? (
              <>
                <Text variant="bodySmall" color="primary" style={styles.modalLabelWide}>WELLNESS NOTE</Text>
                <View style={[styles.doctorNote, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.lg }]}>
                  <HeartPulse size={16} color={theme.colors.primary} />
                  <Text variant="bodySmall" style={styles.modalText}>{data.doctor_note}</Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

// ---------------------------------------------------------------------------
// Cycle History — one row per cycle; tapping reveals that cycle's report.
// DB-first: reads the stored report; only a miss triggers sync generation.
// ---------------------------------------------------------------------------

function formatStartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function cycleLength(entries: CycleEntry[], index: number): number | null {
  if (index >= entries.length - 1) return null;
  const a = new Date(entries[index + 1].period_start_date).getTime();
  const b = new Date(entries[index].period_start_date).getTime();
  const diff = Math.round((a - b) / 86400000);
  return diff >= 20 && diff <= 45 ? diff : null;
}

function CycleHistoryRow({
  entry,
  cycleNo,
  len,
  selected,
  onPress,
  report,
  reportLoading,
  onGenerate,
  generating,
}: {
  entry: CycleEntry;
  cycleNo: number;
  len: number | null;
  selected: boolean;
  onPress: () => void;
  report?: CycleReport | null;
  reportLoading: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  const theme = useTheme();

  let rightState: React.ReactNode;
  if (selected) {
    if (reportLoading) {
      rightState = <View style={styles.historyGenWrap}><Skeleton width={88} height={10} /><Skeleton width={56} height={10} /></View>;
    } else if (report?.report_data) {
      rightState = (
        <View style={styles.historyGenWrap}>
          <Text variant="caption" color="accent">Viewing report</Text>
          <ChevronRight size={14} color={theme.colors.accent} />
        </View>
      );
    } else {
      rightState = (
        <Pressable
          onPress={onGenerate}
          accessibilityRole="button"
          accessibilityLabel="Generate AI report for this cycle"
          style={[styles.generateBtn, { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill }]}
          disabled={generating}
        >
          <Bot size={14} color={theme.colors.textInverse} />
          <Text variant="chip" color="inverse">{generating ? 'Generating…' : 'Generate'}</Text>
        </Pressable>
      );
    }
  }

  return (
    <Card
      onPress={onPress}
      padded
      style={[styles.historyRow, selected && styles.historyRowSelected, selected && { borderColor: theme.colors.accent }]}
    >
      <View style={styles.historyMain}>
        <View style={[styles.historyDateIcon, { backgroundColor: `${theme.colors.accent}22`, borderRadius: theme.radius.md }]}>
          <CalendarDays size={18} color={theme.colors.accent} />
        </View>
        <View style={styles.historyTitleWrap}>
          <Text variant="body" style={styles.historyTitle}>Cycle {cycleNo}</Text>
          <Text variant="caption" color="muted">
            {formatStartDate(entry.period_start_date)}{len != null ? ` · ${len} days` : ''}
          </Text>
        </View>
        {rightState}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function AnalyticsDashboardScreen() {
  const theme = useTheme();

  const { data: entries, isLoading: entriesLoading } = useCycleEntries({ limit: 50, months_back: 12 });
  const { data: analytics, isLoading: analyticsLoading } = useCycleAnalytics();

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [reportModalReport, setReportModalReport] = useState<CycleReport | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const loading = entriesLoading || analyticsLoading;

  const sortedEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => new Date(b.period_start_date).getTime() - new Date(a.period_start_date).getTime());
  }, [entries]);

  const cycleData = useMemo(() => {
    if (sortedEntries.length < 2) return null;
    const lengths: number[] = [];
    const labels: string[] = [];
    for (let i = 1; i < sortedEntries.length; i++) {
      const prev = new Date(sortedEntries[i].period_start_date);
      const curr = new Date(sortedEntries[i - 1].period_start_date);
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff >= 20 && diff <= 45) {
        lengths.push(diff);
        labels.push(curr.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      }
    }
    return lengths.length >= 2 ? { lengths, labels } : null;
  }, [sortedEntries]);

  // DB-first per-cycle report for the selected history row.
  const { data: selectedReport, isLoading: selectedReportLoading } = useCycleReport(selectedEntryId);
  const requestSync = useRequestCycleReportSync();
  const { data: latestReport } = useLatestCycleReport();

  const symptomMax = analytics?.common_symptoms?.length
    ? Math.max(...analytics.common_symptoms.map((s) => s.count))
    : 0;
  const moodMax = analytics?.common_moods?.length
    ? Math.max(...analytics.common_moods.map((m) => m.count))
    : 0;

  const showHistory = analytics && analytics.total_entries > 0;

  const renderStatPills = () => (
    <View style={styles.moduleTabsRow}>
      <MiniPill text="AI-crafted" />
      <MiniPill text="Privacy-safe" />
    </View>
  );

  // Empty state — no cycles logged yet.
  if (!loading && (!analytics || analytics.total_entries === 0)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyContainer}>
          <Mascot size={120} />
          <Text variant="h2" align="center" style={styles.emptyTitle}>Patience is beautiful</Text>
          <Text variant="body" color="secondary" align="center" style={styles.emptyBody}>
            Log and complete at least one cycle to unlock AI insights and patterns
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Skeleton width={120} height={14} style={styles.skeletonHeader} />
          <Skeleton width={200} height={10} style={styles.skeletonSub} />
          <Skeleton height={168} radius={theme.radius.xl} style={styles.skeletonBlock} />
          <View style={styles.statGrid}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} style={styles.statCard} padded>
                <Skeleton width={36} height={36} shape="circle" style={styles.skeletonIcon} />
                <Skeleton width={52} height={22} style={styles.skeletonValue} />
                <Skeleton width={84} height={10} style={styles.skeletonSmall} />
              </Card>
            ))}
          </View>
          <Skeleton height={170} radius={theme.radius.lg} style={styles.skeletonBlock} />
          <Skeleton height={120} radius={theme.radius.lg} style={styles.skeletonLast} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text variant="h1Large" style={styles.headerTitle}>Analytics</Text>
            <Text variant="body" color="secondary" style={styles.headerSub}>Your cycle patterns, beautifully explained</Text>
          </View>
        </View>

        {/* Date-range chip */}
        <View style={styles.headerMetaRow}>
          <View style={[styles.chip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
            <CalendarDays size={14} color={theme.colors.primary} />
            <Text variant="caption" color="secondary">Last 12 months</Text>
          </View>
          {renderStatPills()}
        </View>

        {/* AI Insights hero card */}
        <AiInsightsCard onViewFull={() => { setReportModalReport(latestReport ?? null); setReportModalOpen(true); }} />

        {/* Cycle Overview — 4 stat cards */}
        <View style={styles.sectionSpacer}>
          <SectionHeader icon={<TrendingUp size={18} color={theme.colors.accent} />} title="Cycle Overview" />
        </View>
        <View style={styles.statGrid}>
          <StatCard
            icon={<CalendarDays size={20} color={theme.colors.primary} />}
            value={analytics?.average_cycle_length_days != null ? String(Math.round(analytics.average_cycle_length_days)) : '--'}
            label="Avg cycle length"
            tint={theme.colors.primary}
          />
          <StatCard
            icon={<Activity size={20} color={theme.colors.accent} />}
            value={
              analytics?.shortest_cycle_days != null && analytics?.longest_cycle_days != null
                ? `${analytics.shortest_cycle_days}–${analytics.longest_cycle_days}`
                : '--'
            }
            label="Cycle range (days)"
            tint={theme.colors.accent}
          />
          <StatCard
            icon={<Droplets size={20} color={theme.colors.primary} />}
            value={analytics?.avg_period_length_days != null ? String(Math.round(analytics.avg_period_length_days)) : '--'}
            label="Avg period length"
            tint={theme.colors.primary}
          />
          <StatCard
            icon={<Sun size={20} color={theme.colors.accentOrange} />}
            value={analytics?.avg_ovulation_day != null ? `Day ${Math.round(analytics.avg_ovulation_day)}` : '--'}
            label="Avg ovulation day"
            tint={theme.colors.warning}
          />
        </View>

        {/* Cycle length trend */}
        {cycleData && (
          <View style={styles.sectionSpacer}>
            <SectionHeader icon={<Activity size={18} color={theme.colors.accent} />} title="Cycle Length Trend" />
            <Card style={styles.trendCard}>
              <TrendChart cycleData={cycleData.lengths} months={cycleData.labels} />
            </Card>
          </View>
        )}

        {/* Common Symptoms + Mood Trend */}
        <View style={styles.twoColGrid}>
          {analytics?.common_symptoms && analytics.common_symptoms.length > 0 && (
            <Card style={styles.twoColCard} padded>
              <SectionHeader icon={<HeartPulse size={16} color={theme.colors.primary} />} title="Symptoms" />
              {analytics.common_symptoms.slice(0, 5).map((s, i) => {
                const pct = symptomMax > 0 ? Math.round((s.count / symptomMax) * 100) : 0;
                return (
                  <View key={s.symptom} style={styles.barRow}>
                    <Text variant="caption" style={styles.barLabel} numberOfLines={1}>{s.symptom}</Text>
                    <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: i % 2 === 0 ? theme.colors.primary : theme.colors.accent, borderRadius: theme.radius.sm },
                        ]}
                      />
                    </View>
                    <Text variant="caption" color="muted" style={styles.barCount}>{s.count}</Text>
                  </View>
                );
              })}
            </Card>
          )}

          {analytics?.common_moods && analytics.common_moods.length > 0 && (
            <Card style={styles.twoColCard} padded>
              <SectionHeader icon={<Smile size={16} color={theme.colors.accent} />} title="Mood Trend" />
              {analytics.common_moods.slice(0, 5).map((m, i) => {
                const pct = moodMax > 0 ? Math.round((m.count / moodMax) * 100) : 0;
                return (
                  <View key={m.mood} style={styles.barRow}>
                    <Text variant="caption" style={styles.barLabel} numberOfLines={1}>{m.mood}</Text>
                    <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: i % 2 === 0 ? theme.colors.accent : theme.colors.primary, borderRadius: theme.radius.sm },
                        ]}
                      />
                    </View>
                    <Text variant="caption" color="muted" style={styles.barCount}>{m.count}</Text>
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        {/* Sleep + Pain */}
        <View style={styles.twoColGrid}>
          {analytics?.avg_sleep_hours != null && (
            <Card style={styles.twoColCard} padded>
              <View style={styles.statIconWrap}><MoonStar size={16} color={theme.colors.accent} /></View>
              <Text variant="heroValue" color="accent" style={styles.twoColValue}>
                {Math.round((analytics.avg_sleep_hours + Number.EPSILON) * 10) / 10}
              </Text>
              <Text variant="caption" color="muted">Avg sleep hrs while on cycle</Text>
            </Card>
          )}
          {analytics?.avg_pain_level != null && (
            <Card style={styles.twoColCard} padded>
              <View style={styles.statIconWrap}><HeartPulse size={16} color={theme.colors.primary} /></View>
              <Text variant="heroValue" color="primary" style={styles.twoColValue}>
                {Math.round((analytics.avg_pain_level + Number.EPSILON) * 10) / 10}
              </Text>
              <Text variant="caption" color="muted">Avg pain level (0–5 scale)</Text>
            </Card>
          )}
        </View>

        {/* Cycle History */}
        {showHistory && (
          <View style={styles.sectionSpacer}>
            <SectionHeader icon={<CalendarDays size={18} color={theme.colors.primary} />} title="Cycle History" />
            <Text variant="caption" color="muted" style={styles.sectionSub}>
              Tap a cycle to open its AI report — stored locally, no re-analysis.
            </Text>
            <View style={styles.historyList}>
              {sortedEntries.slice(0, 6).map((entry, i) => {
                const cycleNo = sortedEntries.length - i;
                const len = cycleLength(sortedEntries, i);
                const selected = selectedEntryId === entry.id;
                return (
                  <View key={entry.id} style={styles.historyItem}>
                    <CycleHistoryRow
                      entry={entry}
                      cycleNo={cycleNo}
                      len={len}
                      selected={selected}
                      onPress={() => {
                        setSelectedEntryId((cur) => (cur === entry.id ? null : entry.id));
                      }}
                      report={selected ? selectedReport : undefined}
                      reportLoading={selected && selectedReportLoading}
                      onGenerate={() => requestSync.mutate(entry.id)}
                      generating={selected && requestSync.isPending}
                    />
                    {/* Expanded per-cycle report (DB-first) */}
                    {selected && selectedReport?.report_data && (
                      <Card padded style={[styles.historyReport, { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.lg }]}>
                        <View style={styles.historyReportHeader}>
                          <Mascot size={34} />
                          <View style={styles.historyReportTitle}>
                            <Text variant="bodySmall" color="accent" style={styles.historyReportHeading}>Cycle {cycleNo} · AI report</Text>
                            <Text variant="caption" color="muted">Regularity {selectedReport.report_data.regularity_score}/100</Text>
                          </View>
                          <Pressable
                            onPress={() => { setReportModalReport(selectedReport); setReportModalOpen(true); }}
                            accessibilityRole="button"
                            accessibilityLabel="Open full AI report"
                            hitSlop={8}
                          >
                            <Text variant="caption" color="accent">Full report →</Text>
                          </Pressable>
                        </View>
                        <Text variant="bodySmall" style={styles.historyReportText}>
                          {selectedReport.report_data.summary}
                        </Text>
                        {selectedReport.report_data.top_symptoms?.length ? (
                          <View style={styles.historyReportChips}>
                            {selectedReport.report_data.top_symptoms.slice(0, 3).map((s) => <MiniPill key={s} text={s} />)}
                          </View>
                        ) : null}
                      </Card>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Privacy footer */}
        <View style={styles.privacyFooter}>
          <View style={[styles.privacyIcon, { backgroundColor: `${theme.colors.mint}aa`, borderRadius: theme.radius.pill }]}>
            <Lock size={16} color={theme.colors.success} />
          </View>
          <View style={styles.privacyTextWrap}>
            <Text variant="caption" style={styles.privacyTitleText}>Your data stays yours</Text>
            <Text variant="caption" color="muted">
              Insights are end-to-end encrypted. AI reports only ever read your own cycle logs.
            </Text>
          </View>
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>

      <FullReportModal
        report={reportModalReport}
        visible={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  headerTitle: { marginBottom: 4 },
  headerSub: { fontSize: 14 },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
  moduleTabsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  pill: { paddingHorizontal: 10, paddingVertical: 4 },

  // AI card
  aiCardWrap: { overflow: 'hidden', marginBottom: 20 },
  aiGradient: { padding: 20 },
  aiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  aiTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitleText: { fontWeight: '800', fontSize: 20, lineHeight: 26 },
  newPill: { paddingHorizontal: 8, paddingVertical: 2 },
  aiInnerPanel: { paddingVertical: 16, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  aiInsightCols: { flexDirection: 'row', alignItems: 'center' },
  aiInsightCol: { flex: 1, alignItems: 'center' },
  aiInsightValue: { fontSize: 26, lineHeight: 32 },
  aiDividerV: { width: StyleSheet.hairlineWidth, height: 40, marginHorizontal: 8 },
  aiFooterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 14 },
  aiSkeletonTitle: { marginBottom: 10 },
  aiSkeletonLine: { marginBottom: 6 },
  aiCardEmpty: { padding: 18, borderWidth: 1 },
  aiEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiEmptyText: { flex: 1 },
  aiEmptyBody: { marginTop: 4, lineHeight: 18 },

  // Sections
  sectionSpacer: { marginTop: 20, marginBottom: 6 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionAction: { paddingVertical: 4 },
  sectionSub: { marginBottom: 10, paddingHorizontal: 2 },

  // Stats
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '46%', alignItems: 'center', paddingVertical: 14 },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { marginVertical: 2 },
  statLabel: { textAlign: 'center' },

  // Bars
  twoColGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  twoColCard: { flex: 1, minWidth: '46%' },
  twoColValue: { fontSize: 30, lineHeight: 36, marginVertical: 2 },
  trendCard: { paddingVertical: 8, paddingHorizontal: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 56 },
  barBg: { flex: 1, height: 14 },
  barFill: { height: '100%' },
  barCount: { width: 24, textAlign: 'right' },

  // History
  historyList: { gap: 8 },
  historyItem: { gap: 8 },
  historyRow: { paddingVertical: 12, paddingHorizontal: 14 },
  historyRowSelected: { borderWidth: 1.5 },
  historyMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyTitleWrap: { flex: 1 },
  historyDateIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontWeight: '600', marginBottom: 2 },
  historyGenWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 96, justifyContent: 'flex-end' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  historyReport: { padding: 14 },
  historyReportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyReportTitle: { flex: 1 },
  historyReportHeading: { fontWeight: '600' },
  historyReportText: { lineHeight: 18, marginTop: 8 },
  historyReportChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },

  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,12,24,0.5)' },
  modalSheet: { maxHeight: '78%', padding: 20, paddingBottom: 28 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modalHeaderTitle: { flex: 1, marginLeft: 8 },
  modalClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingBottom: 20 },
  modalLabel: { fontSize: 10, letterSpacing: 1, fontWeight: '600', marginBottom: 6 },
  modalLabelWide: { fontSize: 10, letterSpacing: 1, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  modalText: { lineHeight: 20 },
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  doctorNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },

  // Privacy footer
  privacyFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'transparent', marginTop: 24, paddingHorizontal: 4 },
  privacyIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  privacyTextWrap: { flex: 1 },
  privacyTitleText: { fontWeight: '600' },
  footerSpacer: { height: 32 },

  skeletonHeader: { marginBottom: 4 },
  skeletonSub: { marginBottom: 24 },
  skeletonBlock: { marginBottom: 16 },
  skeletonIcon: { alignSelf: 'center', marginBottom: 8 },
  skeletonValue: { alignSelf: 'center', marginBottom: 4 },
  skeletonSmall: { alignSelf: 'center' },
  skeletonLast: { marginTop: 16 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { marginTop: 24 },
  emptyBody: { marginTop: 8, paddingHorizontal: 32 },
});