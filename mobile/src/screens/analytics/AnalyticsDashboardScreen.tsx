import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Card, Text, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCycleEntries, useCycleAnalytics } from 'src/services/queries/cycle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;

const BAR_COLORS = ['#FF5C8A', '#9B7BFF', '#F4A93C', '#4CAF50', '#42A5F5'];

function MiniLineChart({ cycleData, months }: { cycleData: number[]; months: string[] }) {
  const theme = useTheme();
  if (cycleData.length < 2) return null;
  const maxVal = Math.max(...cycleData) + 2;
  const minVal = Math.min(...cycleData) - 2;
  const range = maxVal - minVal;
  const w = CHART_WIDTH;
  const h = 120;
  const padding = { top: 10, bottom: 20, left: 0, right: 0 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const stepX = plotW / (cycleData.length - 1);

  const points = cycleData.map((v, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - ((v - minVal) / range) * plotH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#areaGrad)" />
      <Path d={linePath} fill="none" stroke={theme.colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <SvgCircle key={i} cx={p.x} cy={p.y} r="3.5" fill={theme.colors.surface} stroke={theme.colors.primary} strokeWidth="2" />
      ))}
      {months.map((m, i) => (
        <SvgText key={i} x={padding.left + i * stepX} y={h - 4} fontSize="10" fill={theme.colors.textMuted} textAnchor="middle">{m}</SvgText>
      ))}
    </Svg>
  );
}

export function AnalyticsDashboardScreen() {
  const theme = useTheme();

  const { data: entries, isLoading: entriesLoading } = useCycleEntries({ limit: 50, months_back: 12 });
  const { data: analytics, isLoading: analyticsLoading } = useCycleAnalytics();

  const loading = entriesLoading || analyticsLoading;

  const cycleData = useMemo(() => {
    if (!entries || entries.length < 2) return null;
    const lengths: number[] = [];
    const labels: string[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = new Date(entries[i - 1].period_start_date);
      const curr = new Date(entries[i].period_start_date);
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff >= 20 && diff <= 45) {
        lengths.push(diff);
        labels.push(curr.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      }
    }
    return lengths.length >= 2 ? { lengths, labels } : null;
  }, [entries]);

  const symptomMax = analytics?.common_symptoms?.length
    ? Math.max(...analytics.common_symptoms.map(s => s.count))
    : 0;

  if (!loading && (!analytics || analytics.total_entries === 0)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
        <View style={styles.emptyContainer}>
          <Svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <SvgCircle cx="60" cy="60" r="50" fill={theme.colors.primaryMuted} />
            <Path d="M40 55 Q50 45 60 55 Q70 65 80 55" stroke={theme.colors.primary} strokeWidth="3" fill="none" strokeLinecap="round" />
            <SvgCircle cx="48" cy="48" r="4" fill={theme.colors.accent} />
            <SvgCircle cx="72" cy="48" r="4" fill={theme.colors.accent} />
            <Path d="M45 75 L60 70 L75 75" stroke={theme.colors.accent} strokeWidth="2" fill="none" strokeLinecap="round" />
          </Svg>
          <Text variant="h2" align="center" style={{ marginTop: 24 }}>Patience is beautiful</Text>
          <Text variant="body" color="secondary" align="center" style={{ marginTop: 8, paddingHorizontal: 32 }}>
            Log at least 1 cycle to unlock insights and patterns
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Skeleton width={120} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={200} height={10} style={{ marginBottom: 24 }} />
          <View style={styles.statRow}>
            <Card style={{ flex: 1, marginRight: 6 }} padded><Skeleton width={40} height={24} style={{ alignSelf: 'center', marginBottom: 4 }} /><Skeleton width={80} height={10} style={{ alignSelf: 'center' }} /></Card>
            <Card style={{ flex: 1, marginLeft: 6 }} padded><Skeleton width={40} height={24} style={{ alignSelf: 'center', marginBottom: 4 }} /><Skeleton width={80} height={10} style={{ alignSelf: 'center' }} /></Card>
          </View>
          <Skeleton height={140} style={{ marginTop: 12, borderRadius: 16 }} />
          <Skeleton height={160} style={{ marginTop: 12, borderRadius: 16 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text variant="h1" style={{ marginBottom: 4 }}>Analytics</Text>
            <Text variant="body" color="secondary">Your cycle patterns at a glance</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <Card style={{ flex: 1, marginRight: 6 }} padded>
            <Text variant="h2" color="primary" align="center">
              {analytics?.average_cycle_length_days != null ? Math.round(analytics.average_cycle_length_days) : '--'}
            </Text>
            <Text variant="caption" color="muted" align="center">Avg cycle (days)</Text>
          </Card>
          <Card style={{ flex: 1, marginLeft: 6 }} padded>
            <Text variant="h2" color="primary" align="center">
              {(analytics?.shortest_cycle_days != null && analytics?.longest_cycle_days != null)
                ? `${analytics.shortest_cycle_days}-${analytics.longest_cycle_days}`
                : '--'}
            </Text>
            <Text variant="caption" color="muted" align="center">Cycle range (days)</Text>
          </Card>
        </View>

        {cycleData && (
          <Card style={{ marginTop: 12, paddingVertical: 16 }}>
            <Text variant="h3" style={{ marginBottom: 12, paddingHorizontal: 16 }}>Cycle Length Over Time</Text>
            <MiniLineChart cycleData={cycleData.lengths} months={cycleData.labels} />
          </Card>
        )}

        {analytics?.common_symptoms && analytics.common_symptoms.length > 0 && (
          <Card style={{ marginTop: 12 }}>
            <Text variant="h3" style={{ marginBottom: 12 }}>Top Symptoms</Text>
            {analytics.common_symptoms.slice(0, 5).map((s, i) => {
              const pct = symptomMax > 0 ? Math.round((s.count / symptomMax) * 100) : 0;
              return (
                <View key={s.symptom} style={styles.symptomRow}>
                  <Text variant="bodySmall" style={{ width: 80 }}>{s.symptom}</Text>
                  <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length], borderRadius: theme.radius.sm }]} />
                  </View>
                  <Text variant="caption" color="muted" style={{ width: 30, textAlign: 'right' }}>{s.count}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {analytics?.common_moods && analytics.common_moods.length > 0 && (
          <Card style={{ marginTop: 12 }}>
            <Text variant="h3" style={{ marginBottom: 12 }}>Top Moods</Text>
            {analytics.common_moods.slice(0, 5).map((m, i) => (
              <View key={m.mood} style={styles.symptomRow}>
                <Text variant="bodySmall" style={{ width: 80 }}>{m.mood}</Text>
                <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                  <View style={[styles.barFill, { width: `${Math.min((m.count / 10) * 100, 100)}%`, backgroundColor: BAR_COLORS[(i + 2) % BAR_COLORS.length], borderRadius: theme.radius.sm }]} />
                </View>
                <Text variant="caption" color="muted" style={{ width: 30, textAlign: 'right' }}>{m.count}</Text>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  statRow: { flexDirection: 'row' },
  circularContainer: { alignItems: 'center' },
  symptomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barBg: { flex: 1, height: 20 },
  barFill: { height: '100%' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
});
