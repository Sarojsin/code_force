import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text as Txt, Card } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { usePregnancyModeStore } from 'src/stores/pregnancyModeStore';
import { format } from 'date-fns';

const TRIMESTER_LABELS = ['First Trimester', 'Second Trimester', 'Third Trimester'];
const TRIMESTER_WEEKS = [
  { start: 1, end: 13, color: '#EDE9FE' },
  { start: 14, end: 26, color: '#FCE7F3' },
  { start: 27, end: 40, color: '#D1FAE5' },
];

const BABY_SIZES: Record<number, { fruit: string; emoji: string }> = {
  4: { fruit: 'Poppy seed', emoji: '🌱' },
  8: { fruit: 'Raspberry', emoji: '🍓' },
  12: { fruit: 'Plum', emoji: '🍑' },
  16: { fruit: 'Avocado', emoji: '🥑' },
  20: { fruit: 'Banana', emoji: '🍌' },
  24: { fruit: 'Corn', emoji: '🌽' },
  28: { fruit: 'Eggplant', emoji: '🍆' },
  32: { fruit: 'Squash', emoji: '🎃' },
  36: { fruit: 'Romaine lettuce', emoji: '🥬' },
  40: { fruit: 'Watermelon', emoji: '🍉' },
};

function getBabySize(week: number): { fruit: string; emoji: string } {
  let closest = BABY_SIZES[4];
  for (const key of Object.keys(BABY_SIZES).map(Number).sort((a, b) => a - b)) {
    if (week >= key) closest = BABY_SIZES[key];
  }
  return closest;
}

function getTrimester(week: number): number {
  if (week <= 13) return 1;
  if (week <= 26) return 2;
  return 3;
}

export function PregnancyCalendarScreen() {
  const theme = useTheme();
  const currentWeek = usePregnancyModeStore((s) => s.currentWeek);
  const dueDate = usePregnancyModeStore((s) => s.dueDate);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const t = getTrimester(selectedWeek);
  const baby = getBabySize(selectedWeek);
  const due = dueDate ? new Date(dueDate) : null;
  const now = new Date();
  const monthLabel = format(now, 'MMMM yyyy');
  const daysLeft = due ? Math.ceil((due.getTime() - now.getTime()) / 86400000) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={styles.headerRow}>
          <View>
            <Txt style={{ fontSize: 12, color: theme.colors.textSoft, letterSpacing: 0.5 }}>{monthLabel}</Txt>
            <Txt style={[styles.weekTitle, { color: theme.colors.textPrimary }]}>
              Week {selectedWeek} &middot; Trimester {t}
            </Txt>
          </View>
          <View style={[styles.headerEmoji, { backgroundColor: theme.colors.primaryLight, borderRadius: 26 }]}>
            <Txt style={{ fontSize: 24 }}>🤰</Txt>
          </View>
        </View>

        <View style={styles.trimesterRow}>
          {TRIMESTER_WEEKS.map((tri) => {
            const active = t === TRIMESTER_WEEKS.indexOf(tri) + 1;
            return (
              <View
                key={tri.start}
                style={[
                  styles.triPill,
                  { backgroundColor: active ? tri.color : theme.colors.background, borderRadius: 100 },
                  active && { borderColor: theme.colors.primary, borderWidth: 1 },
                ]}
              >
                <Txt
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: active ? theme.colors.primary : theme.colors.textSoft,
                  }}
                >
                  {TRIMESTER_LABELS[TRIMESTER_WEEKS.indexOf(tri)]}
                </Txt>
              </View>
            );
          })}
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Txt
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: theme.colors.textSoft,
              letterSpacing: 1.5,
              marginBottom: 12,
            }}
          >
            PREGNANCY WEEKS
          </Txt>
          <View style={styles.weekGrid}>
            {Array.from({ length: 40 }, (_, i) => i + 1).map((week) => {
              const isSelected = week === selectedWeek;
              const isCurrent = week === currentWeek;
              const triIdx = getTrimester(week) - 1;
              const triColor = TRIMESTER_WEEKS[triIdx]?.color ?? '#EDE9FE';
              return (
                <Pressable
                  key={week}
                  onPress={() => setSelectedWeek(week)}
                  style={[
                    styles.weekCell,
                    { backgroundColor: isSelected ? theme.colors.primary : triColor, borderRadius: 8 },
                    isCurrent && !isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                  ]}
                  accessibilityLabel={`Week ${week}`}
                  accessibilityRole="button"
                >
                  <Txt
                    style={{
                      fontSize: 10,
                      fontWeight: isSelected || isCurrent ? '800' : '600',
                      color: isSelected ? '#fff' : theme.colors.textPrimary,
                    }}
                  >
                    {week}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={[styles.weekDetail, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.badge, { backgroundColor: theme.colors.primaryLight, borderRadius: 100 }]}>
              <Txt style={{ fontSize: 10, fontWeight: '700', color: theme.colors.primary }}>
                WEEK {selectedWeek}
              </Txt>
            </View>
            <Txt style={[styles.babySize, { color: theme.colors.textPrimary }]}>
              Baby is the size of a {baby.fruit} {baby.emoji}
            </Txt>
            <Txt style={{ fontSize: 12, color: theme.colors.textSoft, marginTop: 4 }}>
              Trimester {t} &middot; {40 - selectedWeek} weeks to go
            </Txt>
            {daysLeft !== null && (
              <Txt variant="caption" color="muted" style={{ marginTop: 4 }}>
                Due in {daysLeft} days {due ? `(${format(due, 'MMM d, yyyy')})` : ''}
              </Txt>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionChip, { backgroundColor: theme.colors.accentMuted, borderRadius: 12 }]}
              accessibilityLabel="Log symptoms"
            >
              <Txt style={{ fontSize: 14 }}>📝</Txt>
              <Txt variant="bodySmall" style={{ fontWeight: '600', marginLeft: 6 }}>
                Log Symptoms
              </Txt>
            </Pressable>
            <Pressable
              style={[styles.actionChip, { backgroundColor: theme.colors.mint, borderRadius: 12 }]}
              accessibilityLabel="Track kicks"
            >
              <Txt style={{ fontSize: 14 }}>🦶</Txt>
              <Txt variant="bodySmall" style={{ fontWeight: '600', marginLeft: 6 }}>
                Kick Counter
              </Txt>
            </Pressable>
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Txt
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: theme.colors.textSoft,
              letterSpacing: 1.5,
              marginBottom: 12,
            }}
          >
            TRIMESTER OVERVIEW
          </Txt>
          {TRIMESTER_WEEKS.map((tri, idx) => {
            const active = getTrimester(selectedWeek) === idx + 1;
            return (
              <View
                key={tri.start}
                style={[
                  styles.triRow,
                  { borderBottomColor: theme.colors.border },
                  active && { backgroundColor: tri.color, borderRadius: 12, paddingHorizontal: 8 },
                ]}
              >
                <View style={[styles.triDot, { backgroundColor: active ? theme.colors.primary : tri.color, borderRadius: 6 }]} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Txt variant="bodySmall" style={{ fontWeight: '600' }}>
                    {TRIMESTER_LABELS[idx]}
                  </Txt>
                  <Txt variant="caption" color="muted">
                    Weeks {tri.start}&ndash;{tri.end}
                  </Txt>
                </View>
                {active && <Txt style={{ fontSize: 12 }}>{'👈'}</Txt>}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  headerEmoji: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimesterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  triPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  weekCell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDetail: {
    paddingBottom: 12,
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  babySize: {
    fontSize: 18,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  triRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  triDot: {
    width: 12,
    height: 12,
  },
});
