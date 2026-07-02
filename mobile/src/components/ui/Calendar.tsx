import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
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

// Type code colors for dictionary-encoded calendar days
const DAY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  P: { bg: '#F48FB1', text: '#FFFFFF' },        // period day
  p: { bg: '#FCE4EC', text: '#C62828' },         // predicted period
  F: { bg: '#CE93D8', text: '#FFFFFF' },          // fertile window
  f: { bg: '#F3E5F5', text: '#7B1FA2' },          // predicted fertile
  T: { bg: '#42A5F5', text: '#FFFFFF' },           // today
};

export interface CalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  markedDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
  /** Dictionary-encoded days from CalendarResponse (Phase 2) */
  encodedDays?: Record<string, string>;
}

export function Calendar({ selectedDate, onDateSelect, markedDates, minDate, maxDate, encodedDays }: CalendarProps) {
  const theme = useTheme();
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate ?? new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const canGoPrev = !minDate || subMonths(currentMonth, 1) >= startOfMonth(minDate);
  const canGoNext = !maxDate || addMonths(currentMonth, 1) <= endOfMonth(maxDate);

  return (
    <View
      accessibilityLabel="Calendar"
      accessibilityRole="list"
    >
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

      <View style={styles.weekRow} accessibilityRole="list">
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.dayCell}>
            <Text variant="caption" color="muted" align="center">
              {day}
            </Text>
          </View>
        ))}
      </View>

      {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow} accessibilityRole="list">
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
            const bgColor = typeColor?.bg ?? (selected ? theme.colors.primary : 'transparent');
            const txtColor = typeColor?.text ?? (
              disabled ? theme.colors.textMuted
              : selected ? theme.colors.textInverse
              : today ? theme.colors.primary
              : inMonth ? theme.colors.textPrimary
              : theme.colors.textMuted
            );

            return (
              <Pressable
                key={dayIdx}
                onPress={() => inMonth && !disabled && onDateSelect(day)}
                disabled={!inMonth || disabled}
                accessibilityLabel={`${format(day, 'MMMM d, yyyy')}${dayType !== 'none' ? `, ${dayType}` : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: !!selected, disabled: !inMonth || disabled }}
                style={[
                  styles.dayCell,
                  { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget },
                  { backgroundColor: bgColor, borderRadius: theme.radius.pill },
                  selected && { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text variant="body" align="center" style={{ color: txtColor }}>
                  {format(day, 'd')}
                </Text>
                {marked && !selected && !dayType && (
                  <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
});
