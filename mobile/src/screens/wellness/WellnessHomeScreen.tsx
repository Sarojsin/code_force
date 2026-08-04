import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text as Txt } from 'src/components/ui';

import { useTheme } from 'src/theme';
import { LinearGradient } from 'expo-linear-gradient';

const Text = Txt;

const TABS = ['✨ Insights', '🌸 Mood', '🧘 Breathe'] as const;
type Tab = (typeof TABS)[number];

export function WellnessHomeScreen() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('✨ Insights');

  function MetricCard({ value, label, trend }: { value: string; label: string; trend?: string }) {
    return (
      <View style={[styles.metricCard, { backgroundColor: theme.colors.surface, borderRadius: 16 }]}>
        <Txt variant="h3" style={{ color: theme.colors.textPrimary }}>{value}</Txt>
        <Txt variant="caption" color="muted" style={{ marginTop: 2 }}>{label}</Txt>
        {trend && <Txt style={{ color: trend.startsWith('↑') ? theme.colors.success : theme.colors.danger, fontSize: 11, marginTop: 2 }}>{trend}</Txt>}
      </View>
    );
  }

  function RecommendationRow({ emoji, description, badge }: { emoji: string; description: string; badge: string }) {
    return (
      <View style={[styles.recRow, { borderBottomColor: theme.colors.border }]}>
        <Text variant="emoji" style={{ width: 40 }}>{emoji}</Text>
        <Txt variant="body" style={{ flex: 1, marginLeft: 8 }}>{description}</Txt>
        <View style={[styles.recBadge, { backgroundColor: theme.colors.primary + '22', borderRadius: 100 }]}>
          <Txt style={{ color: theme.colors.primary, fontSize: 10, fontWeight: '600' }}>{badge}</Txt>
        </View>
      </View>
    );
  }

  function BreathingCard({ emoji, name, description, duration }: { emoji: string; name: string; description: string; duration: string }) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          style={[styles.breathingCard, { backgroundColor: theme.colors.surface, borderRadius: 16 }]}
        >
          <View style={[styles.breathingIcon, { backgroundColor: theme.colors.accentMuted, borderRadius: 28 }]}>
            <Text variant="emoji">{emoji}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Txt variant="body" style={{ fontWeight: '600' }}>{name}</Txt>
            <Txt variant="caption" color="muted" style={{ marginTop: 2 }}>{description}</Txt>
            <View style={[styles.durationBadge, { backgroundColor: theme.colors.border, borderRadius: 100 }]}>
              <Txt style={{ color: theme.colors.textMuted, fontSize: 10 }}>⏱ {duration}</Txt>
            </View>
          </View>
          <View style={[styles.playBtn, { backgroundColor: theme.colors.primary, borderRadius: 20 }]}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M8 5v14l11-7z" fill="#fff" />
            </Svg>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case '✨ Insights':
        return (
          <View>
            <LinearGradient colors={['#EDE9FE', '#FCE7F3']} style={[styles.lunaQuoteCard, { borderRadius: 20 }]}>
              <Txt variant="caption" color="muted" style={{ fontSize: 10, letterSpacing: 0.8 }}>LUNA'S DAILY INSIGHT</Txt>
              <Txt style={[styles.quoteText, { color: theme.colors.accent }]}>
                "Your body knows its rhythm. Today is a day for gentle movement and nourishing foods."
              </Txt>
            </LinearGradient>

            <Txt variant="h3" style={{ marginVertical: 16 }}>Wellness Metrics</Txt>
            <View style={styles.metricsGrid}>
              <MetricCard value="7.2h" label="Sleep" trend="↑ +0.5h" />
              <MetricCard value="6/8" label="Hydration" />
              <MetricCard value="4/7" label="Active Days" trend="↑ +1" />
              <MetricCard value="3.2" label="Stress Score" trend="↓ -0.3" />
            </View>

            <Txt variant="h3" style={{ marginVertical: 16 }}>Recommendations</Txt>
            <View style={[styles.recCard, { backgroundColor: theme.colors.surface, borderRadius: 16 }]}>
              <RecommendationRow emoji="🥗" description="Add iron-rich foods this week" badge="Nutrition" />
              <RecommendationRow emoji="🧘" description="Try gentle yoga for cramps" badge="Exercise" />
              <RecommendationRow emoji="💧" description="Increase water intake" badge="Hydration" />
            </View>
          </View>
        );

      case '🌸 Mood':
        return (
          <View>
            <View style={styles.moodHeader}>
              <Txt variant="h3">Last 7 days</Txt>
              <Txt variant="caption" color="secondary">Daily mood · intensity 1–5</Txt>
            </View>
            <View style={styles.moodChart}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                const moods = ['😊', '😌', '😰', '😊', '😴', '🌟', '😊'];
                const intensities = [3, 2, 1, 3, 2, 5, 3];
                const heights = [60, 45, 35, 70, 50, 80, 65];
                const isToday = i === 6;
                return (
                  <View key={day} style={styles.moodBarCol} accessibilityLabel={`${day}: ${moods[i]}, intensity ${intensities[i]}`}>
                    <Text style={{ fontSize: 16 }}>{moods[i]}</Text>
                    <Text style={[
                      styles.moodValue,
                      { color: isToday ? theme.colors.primary : theme.colors.textMuted },
                    ]}>{intensities[i]}</Text>
                    <View style={[styles.moodBar, { height: heights[i], borderRadius: 8, backgroundColor: isToday ? theme.colors.primary : '#FFD4DC' }]} />
                    <Txt variant="caption" color="secondary" style={styles.moodDayLabel}>
                      {isToday ? 'Today' : day}
                    </Txt>
                  </View>
                );
              })}
            </View>

            <LinearGradient colors={['#FCE7F3', '#FFF8F0']} style={[styles.moodInsightCard, { borderRadius: 20 }]}>
              <Txt style={[styles.moodInsightText, { color: theme.colors.primary }]}>
                "Your mood has been predominantly positive this week. Radiant energy on the rise."
              </Txt>
              <View style={styles.moodChips}>
                <View style={[styles.moodChip, { backgroundColor: theme.colors.primary + '22', borderRadius: 100 }]}>
                  <Txt style={{ color: theme.colors.primary, fontSize: 11 }}>✨ Radiant 3×</Txt>
                </View>
                <View style={[styles.moodChip, { backgroundColor: '#CE93D822', borderRadius: 100 }]}>
                  <Txt style={{ color: '#CE93D8', fontSize: 11 }}>🌸 Calm 2×</Txt>
                </View>
              </View>
            </LinearGradient>
          </View>
        );

      case '🧘 Breathe':
        return (
          <View>
            <BreathingCard emoji="🌊" name="Box Breathing" description="4-4-4-4 pattern" duration="5 min" />
            <BreathingCard emoji="🫁" name="Deep Relaxation" description="Progressive muscle relax" duration="10 min" />
            <BreathingCard emoji="🌅" name="Morning Calm" description="Gentle wake-up breathing" duration="3 min" />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Txt variant="h1" style={{ marginBottom: 4 }}>Wellness</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: 20 }}>
          Your daily wellness hub
        </Txt>

        <View style={[styles.segmentedControl, { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 18, padding: 4 }]}>
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.segmentTab, { borderRadius: 14 }]}
              >
                {isActive ? (
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryMuted]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                ) : null}
                <Txt
                  style={[
                    styles.segmentLabel,
                    { color: isActive ? '#fff' : theme.colors.textSoft },
                    isActive && { fontWeight: '700' },
                  ]}
                >
                  {tab}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 20 }}>
          {renderContent()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  lunaQuoteCard: {
    padding: 20,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48%',
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  recCard: {
    padding: 4,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  moodHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moodChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 8,
  },
  moodBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  moodValue: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  moodBar: {
    width: 24,
    marginTop: 4,
  },
  moodDayLabel: {
    marginTop: 4,
    fontSize: 10,
  },
  moodInsightCard: {
    padding: 20,
    marginTop: 16,
  },
  moodInsightText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  moodChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  moodChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  breathingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  breathingIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  playBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
