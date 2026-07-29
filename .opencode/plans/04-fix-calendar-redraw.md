# Fix 4: Calendar — React.memo + stable props + memoized day grid

**Problem:**
1. `Calendar` component is not wrapped in `React.memo` — re-renders on every parent render
2. `CycleDashboardScreen` passes `selectedDate={new Date()}` and `onDateSelect={() => {}}` — new references every render, defeats shallow prop comparison
3. Day cell grid (42 cells × ~7 date-fns calls = ~294 operations/render) is unmemoized inline code

## File 1: `mobile/src/components/ui/Calendar.tsx`

### Change 1 — Add useMemo import and wrap export (line 1, lines 55-57):
```
OLD: import React, { useMemo, useState } from 'react';
NEW: import React, { useCallback, useMemo, useState } from 'react';
```

### Change 2 — Wrap component with React.memo (line 55):
```
OLD:
export function Calendar({
  selectedDate, onDateSelect, markedDates, minDate, maxDate, encodedDays, animatingDates,
}: CalendarProps) {

NEW:
export const Calendar = React.memo(function Calendar({
  selectedDate, onDateSelect, markedDates, minDate, maxDate, encodedDays, animatingDates,
}: CalendarProps) {
```

### Change 3 — Memoize canGoPrev/canGoNext (lines 69-70):
```
OLD:
  const canGoPrev = !minDate || subMonths(currentMonth, 1) >= startOfMonth(minDate);
  const canGoNext = !maxDate || addMonths(currentMonth, 1) <= endOfMonth(maxDate);

NEW:
  const canGoPrev = useMemo(() => !minDate || subMonths(currentMonth, 1) >= startOfMonth(minDate), [currentMonth, minDate]);
  const canGoNext = useMemo(() => !maxDate || addMonths(currentMonth, 1) <= endOfMonth(maxDate), [currentMonth, maxDate]);
```

### Change 4 — Extract day grid into useMemo (replace lines 112-175):
Move the entire day grid rendering into a `useMemo`:
```
  const dayGrid = useMemo(() => 
    Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
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
          const isStrikethrough = typeColor?.strike ?? false;
          const isDashed = typeColor?.dashed ?? false;

          const animating = animatingDates?.has(dateStr);

          const bgColor = typeColor?.bg ?? (selected ? theme.colors.primary : 'transparent');

          const txtColor = typeColor?.text ?? (
            disabled ? theme.colors.textMuted
            : selected ? theme.colors.textInverse
            : today ? theme.colors.primary
            : inMonth ? theme.colors.textPrimary
            : theme.colors.textMuted
          );

          return (
            <AnimatedDayCell key={dayIdx} animating={animating}>
              <Pressable
                onPress={() => inMonth && !disabled && onDateSelect(day)}
                disabled={!inMonth || disabled || isStrikethrough}
                accessibilityLabel={`${format(day, 'MMMM d, yyyy')}${dayType !== 'none' ? `, ${dayType}` : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: !!selected, disabled: !inMonth || disabled || isStrikethrough }}
                style={[
                  styles.dayCell,
                  { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget },
                  { backgroundColor: bgColor, borderRadius: theme.radius.pill },
                  selected && { backgroundColor: theme.colors.primary },
                  isDashed && { borderWidth: 1.5, borderColor: '#CC3355', borderStyle: 'dashed' },
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
                  <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                )}
              </Pressable>
            </AnimatedDayCell>
          );
        })}
      </View>
    )),
    [days, currentMonth, selectedDate, markedDates, minDate, maxDate, encodedDays, animatingDates, onDateSelect, theme.colors],
  );
```

Then replace the inline JSX block (lines 111-176):
```
OLD:
      {Array.from({ length: Math.ceil(days.length / 7) }, ... )}

NEW:
      {dayGrid}
```

## File 2: `mobile/src/screens/cycle/CycleDashboardScreen.tsx`

### Change 1 — Add useRef import (line 1):
```
OLD: import React, { useCallback, useEffect, useState } from 'react';
NEW: import React, { useCallback, useEffect, useRef, useState } from 'react';
```

### Change 2 — Add stable refs for Calendar props (near existing refs around lines 55-61):
Add after existing state declarations:
```
  const todayRef = useRef(new Date());
  const noopRef = useRef(() => {});
```

### Change 3 — Replace unstable Calendar props (line 375):
```
OLD:           <Calendar selectedDate={new Date()} onDateSelect={() => {}} encodedDays={calData?.days} />
NEW:           <Calendar selectedDate={todayRef.current} onDateSelect={noopRef.current} encodedDays={calData?.days} />
```

**Effect:** Calendar only re-renders when relevant props change. The day grid is only recomputed when `currentMonth`, `encodedDays`, etc. change. `CycleDashboardScreen` re-renders no longer cascade into Calendar.

**Verification:** Calendar renders correctly, navigation works, month switching works.
