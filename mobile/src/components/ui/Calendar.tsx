import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';

import { useTheme } from 'src/theme';
import { Text } from './Text';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PHASES = [
  { id: 'menstrual',  emoji: '🩸', label: 'Menstrual',  bg: '#FFE4EC', fg: '#B83058' },
  { id: 'follicular', emoji: '🌱', label: 'Follicular', bg: '#FFF4E3', fg: '#A0621A' },
  { id: 'ovulation',  emoji: '🌟', label: 'Ovulation',  bg: '#E5F9F0', fg: '#1A6B45' },
  { id: 'luteal',     emoji: '🌙', label: 'Luteal',     bg: '#EFE8FA', fg: '#5A35A0' },
];

const DAY_TYPE_COLORS: Record<string, { bg: string; text: string; dashed?: boolean }> = {
  P: { bg: '#FF6B8A', text: '#FFFFFF' },
  p: { bg: '#FFE4EC', text: '#B83058' },
  u: { bg: 'transparent', text: '#FF6B8A' },
  c: { bg: '#E0E0E0', text: '#9E9E9E' },
  F: { bg: '#CE93D8', text: '#FFFFFF' },
  f: { bg: '#F3E5F5', text: '#7B1FA2' },
  O: { bg: '#81C784', text: '#FFFFFF' },
  o: { bg: '#E8F5E9', text: '#2E7D32' },
  L: { bg: '#90CAF9', text: '#FFFFFF' },
  l: { bg: '#E3F2FD', text: '#1565C0' },
  T: { bg: '#42A5F5', text: '#FFFFFF' },
};

export interface CalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  markedDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
  encodedDays?: Record<string, string>;
  animatingDates?: Set<string>;
  showPhaseLegend?: boolean;
  phaseAccentForDate?: (dateStr: string) => string | undefined;
}

export const Calendar = React.memo(function Calendar({
  selectedDate, onDateSelect, markedDates, minDate, maxDate, encodedDays, animatingDates,
  showPhaseLegend, phaseAccentForDate,
}: CalendarProps) {
  const theme = useTheme();
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate ?? new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const canGoPrev = useMemo(() => !minDate || subMonths(currentMonth, 1) >= startOfMonth(minDate), [currentMonth, minDate]);
  const canGoNext = useMemo(() => !maxDate || addMonths(currentMonth, 1) <= endOfMonth(maxDate), [currentMonth, maxDate]);

  const dayGrid = useMemo(() =>
    Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
      <View key={weekIdx} style={styles.weekRow}>
        {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
          const inMonth = isSameMonth(day, currentMonth);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);
          const marked = markedDates?.some((d) => isSameDay(d, day));
          const disabled =
            (minDate && day < startOfMonth(minDate)) ||
            (maxDate && day > endOfMonth(maxDate));

          const dateStr = format(day, 'yyyy-MM-dd');
          const dayType = encodedDays?.[dateStr] ?? 'none';
          const typeColor = DAY_TYPE_COLORS[dayType];
          const isStrikethrough = dayType === 'c';
          const isPredicted = dayType === 'u';

          const animating = animatingDates?.has(dateStr);
          const phaseAccent = phaseAccentForDate?.(dateStr);
          const selectedBg = selected ? (phaseAccent ?? theme.colors.primary) : undefined;

          const cellBorder = selected ? 0 : (today && !selected ? 2 : (isPredicted ? 1.5 : 0));
          const cellBorderColor = today && !selected ? '#FF6B8A' : (isPredicted ? '#FF6B8A' : 'transparent');
          const cellBorderStyle = isPredicted ? 'dashed' : 'solid';

          const txtColor = typeColor?.text ?? (
            disabled ? theme.colors.textMuted
            : selected ? theme.colors.textInverse
            : today ? '#FF6B8A'
            : inMonth ? theme.colors.textDark
            : theme.colors.textMuted
          );

          return (
            <AnimatingWrapper key={dayIdx} animating={animating}>
              <Pressable
                onPress={() => inMonth && !disabled && onDateSelect(day)}
                disabled={!inMonth || disabled || isStrikethrough}
                accessibilityLabel={`${format(day, 'MMMM d, yyyy')}${dayType !== 'none' ? `, ${dayType}` : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: !!selected, disabled: !inMonth || disabled || isStrikethrough }}
                style={[
                  styles.dayCell,
                  { borderRadius: 14 },
                  selected && { backgroundColor: selectedBg ?? theme.colors.primary },
                  !selected && typeColor?.bg && typeColor.bg !== 'transparent' && { backgroundColor: typeColor.bg },
                  cellBorder > 0 && { borderWidth: cellBorder, borderColor: cellBorderColor, borderStyle: cellBorderStyle as any },
                  selected && {
                    shadowColor: phaseAccent ?? '#FF6B8A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.33,
                    shadowRadius: 14,
                    elevation: 4,
                  },
                ]}
              >
                <Text
                  variant="body"
                  align="center"
                  style={[
                    { color: txtColor },
                    isStrikethrough && { opacity: 0.5, textDecorationLine: 'line-through' },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {marked && !selected && !dayType && (
                  <View style={[styles.markedDot, { backgroundColor: theme.colors.primary }]} />
                )}
                {today && (
                  <View style={styles.todayDot} />
                )}
              </Pressable>
            </AnimatingWrapper>
          );
        })}
      </View>
    )),
    [days, currentMonth, selectedDate, markedDates, minDate, maxDate, encodedDays, animatingDates, phaseAccentForDate, onDateSelect, theme.colors],
  );

  return (
    <View accessibilityLabel="Calendar" accessibilityRole="list">
      <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
        <Pressable
          onPress={() => canGoPrev && setCurrentMonth((m) => subMonths(m, 1))}
          disabled={!canGoPrev}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          hitSlop={8}
          style={[styles.arrow, { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget }]}
        >
          <Text variant="body" color={canGoPrev ? 'primary' : 'muted'}>
            {'<'}
          </Text>
        </Pressable>
        <Text variant="h3">{format(currentMonth, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => canGoNext && setCurrentMonth((m) => addMonths(m, 1))}
          disabled={!canGoNext}
          accessibilityLabel="Next month"
          accessibilityRole="button"
          hitSlop={8}
          style={[styles.arrow, { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget }]}
        >
          <Text variant="body" color={canGoNext ? 'primary' : 'muted'}>
            {'>'}
          </Text>
        </Pressable>
      </View>

      {showPhaseLegend && (
        <View style={styles.phaseLegend}>
          {PHASES.map((p) => (
            <View key={p.id} style={[styles.phasePill, { backgroundColor: p.bg, borderColor: `${p.fg}22` }]}>
              <Text style={styles.phaseEmoji}>{p.emoji}</Text>
              <Text style={[styles.phaseLabel, { color: p.fg }]}>{p.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.dayCellWeekday}>
            <Text variant="caption" color="muted" align="center">
              {day}
            </Text>
          </View>
        ))}
      </View>

      {dayGrid}
    </View>
  );
});

function AnimatingWrapper({ animating, children }: { animating?: boolean; children: React.ReactNode }) {
  const animStyle = useAnimatedStyle(() => {
    if (!animating) return {};
    return { transform: [{ scale: withSpring(1, { damping: 15 }) }] };
  }, [animating]);
  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 4 },
  dayCell: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellWeekday: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  markedDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2, position: 'absolute', bottom: 4 },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444', position: 'absolute', bottom: 4 },
  phaseLegend: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 18,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  phasePill: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  phaseEmoji: { fontSize: 12 },
  phaseLabel: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
});
