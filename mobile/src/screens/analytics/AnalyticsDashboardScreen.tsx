import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Card, Text, Skeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;

type FilterRange = '3mo' | '6mo' | '1yr' | 'All';

const FILTERS: FilterRange[] = ['3mo', '6mo', '1yr', 'All'];

const MOCK_STATS = {
  avgCycleLength: 28,
  avgPeriodLength: 5,
  loggedCycles: 6,
  predictionAccuracy: 86,
  moodScore: 7.2,
  avgSleep: 7.2,
  avgStress: 3.8,
};

const MOCK_CYCLE_DATA = [28, 27, 29, 28, 26, 30, 28];
const MOCK_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

const MOCK_SYMPTOMS = [
  { name: 'Cramps', pct: 80 },
  { name: 'Fatigue', pct: 66 },
  { name: 'Bloating', pct: 50 },
  { name: 'Headache', pct: 33 },
  { name: 'Nausea', pct: 25 },
];

const BAR_COLORS = ['#FF5C8A', '#9B7BFF', '#F4A93C', '#4CAF50', '#42A5F5'];

function MiniLineChart() {
  const theme = useTheme();
  const maxVal = Math.max(...MOCK_CYCLE_DATA) + 2;
  const minVal = Math.min(...MOCK_CYCLE_DATA) - 2;
  const range = maxVal - minVal;
  const w = CHART_WIDTH;
  const h = 120;
  const padding = { top: 10, bottom: 20, left: 0, right: 0 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const stepX = plotW / (MOCK_CYCLE_DATA.length - 1);

  const points = MOCK_CYCLE_DATA.map((v, i) => ({
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
      {MOCK_MONTHS.map((m, i) => (
        <SvgText key={i} x={padding.left + i * stepX} y={h - 4} fontSize="10" fill={theme.colors.textMuted} textAnchor="middle">{m}</SvgText>
      ))}
    </Svg>
  );
}

function CircularProgress({ pct, size = 80, label, color }: { pct: number; size?: number; label: string; color: string }) {
  const theme = useTheme();
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - pct / 100);

  return (
    <View style={styles.circularContainer}>
      <Svg width={size} height={size}>
        <SvgCircle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.border} strokeWidth={strokeWidth} fill="none" />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgText x={size / 2} y={size / 2 + 4} fontSize="16" fontWeight="bold" fill={theme.colors.textPrimary} textAnchor="middle">{pct}%</SvgText>
      </Svg>
      <Text variant="caption" color="muted" align="center" style={{ marginTop: 4 }}>{label}</Text>
    </View>
  );
}

export function AnalyticsDashboardScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<FilterRange>('6mo');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const hasData = MOCK_STATS.loggedCycles >= 3;

  if (!hasData) {
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
            Log at least 3 cycles to unlock detailed insights and patterns
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
          <View style={[styles.statRow, { marginTop: 12 }]}>
            <Card style={{ flex: 1, marginRight: 6 }} padded><Skeleton width={60} height={60} radius={30} style={{ alignSelf: 'center' }} /><Skeleton width={80} height={10} style={{ alignSelf: 'center', marginTop: 4 }} /></Card>
            <Card style={{ flex: 1, marginLeft: 6 }} padded><Skeleton width={40} height={24} style={{ alignSelf: 'center' }} /><Skeleton width={80} height={10} style={{ alignSelf: 'center', marginTop: 4 }} /></Card>
          </View>
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
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterChip, { backgroundColor: filter === f ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}
                accessibilityLabel={`Filter by ${f}`}
                accessibilityRole="button"
              >
                <Text variant="caption" style={{ color: filter === f ? '#fff' : theme.colors.textPrimary }}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.statRow}>
          <Card style={{ flex: 1, marginRight: 6 }} padded>
            <Text variant="h2" color="primary" align="center">{MOCK_STATS.avgCycleLength}</Text>
            <Text variant="caption" color="muted" align="center">Avg cycle (days)</Text>
          </Card>
          <Card style={{ flex: 1, marginLeft: 6 }} padded>
            <Text variant="h2" color="primary" align="center">{MOCK_STATS.avgPeriodLength}</Text>
            <Text variant="caption" color="muted" align="center">Avg period (days)</Text>
          </Card>
        </View>

        <Card style={{ marginTop: 12, paddingVertical: 16 }}>
          <Text variant="h3" style={{ marginBottom: 12, paddingHorizontal: 16 }}>Cycle Length Over Time</Text>
          <MiniLineChart />
        </Card>

        <View style={[styles.statRow, { marginTop: 12 }]}>
          <Card style={{ flex: 1, marginRight: 6 }} padded>
            <CircularProgress pct={MOCK_STATS.predictionAccuracy} color={theme.colors.success} label="Prediction Accuracy" />
          </Card>
          <Card style={{ flex: 1, marginLeft: 6 }} padded>
            <Text variant="h2" align="center">😊</Text>
            <Text variant="h2" color="primary" align="center">{MOCK_STATS.moodScore}</Text>
            <Text variant="caption" color="muted" align="center">Avg mood /10</Text>
          </Card>
        </View>

        <Card style={{ marginTop: 12 }}>
          <Text variant="h3" style={{ marginBottom: 12 }}>Top Symptoms</Text>
          {MOCK_SYMPTOMS.map((s, i) => (
            <View key={s.name} style={styles.symptomRow}>
              <Text variant="bodySmall" style={{ width: 80 }}>{s.name}</Text>
              <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                <View style={[styles.barFill, { width: `${s.pct}%`, backgroundColor: BAR_COLORS[i], borderRadius: theme.radius.sm }]} />
              </View>
              <Text variant="caption" color="muted" style={{ width: 30, textAlign: 'right' }}>{s.pct}%</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text variant="h3" style={{ marginBottom: 12 }}>Sleep & Stress</Text>
          <View style={styles.sleepRow}>
            <Text variant="bodySmall" style={{ width: 60 }}>Sleep</Text>
            <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm, flex: 1 }]}>
              <View style={[styles.barFill, { width: `${(MOCK_STATS.avgSleep / 10) * 100}%`, backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm }]} />
            </View>
            <Text variant="bodySmall" style={{ width: 40, textAlign: 'right' }}>{MOCK_STATS.avgSleep}h</Text>
          </View>
          <View style={[styles.sleepRow, { marginTop: 8 }]}>
            <Text variant="bodySmall" style={{ width: 60 }}>Stress</Text>
            <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm, flex: 1 }]}>
              <View style={[styles.barFill, { width: `${(MOCK_STATS.avgStress / 10) * 100}%`, backgroundColor: theme.colors.warning, borderRadius: theme.radius.sm }]} />
            </View>
            <Text variant="bodySmall" style={{ width: 40, textAlign: 'right' }}>{MOCK_STATS.avgStress}/10</Text>
          </View>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  filterRow: { flexDirection: 'row', gap: 4 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
  statRow: { flexDirection: 'row' },
  circularContainer: { alignItems: 'center' },
  symptomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barBg: { flex: 1, height: 20 },
  barFill: { height: '100%' },
  sleepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
});
