import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from 'src/theme';

import { Calendar } from '../Calendar';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (initial: number) => ({ value: initial }),
    withSpring: (v: unknown) => v,
    withDelay: (_d: unknown, v: unknown) => v,
  };
});

function renderCalendar(overrides?: Partial<React.ComponentProps<typeof Calendar>>) {
  const onDateSelect = jest.fn();
  const screen = render(
    <ThemeProvider>
      <Calendar month={new Date(2026, 6, 15)} onDateSelect={onDateSelect} {...overrides} />
    </ThemeProvider>,
  );
  return { onDateSelect, screen };
}

describe('Calendar past-day selection', () => {
  it('a cancelled (c) day is tappable and opens onDateSelect', () => {
    const { onDateSelect, screen } = renderCalendar({
      encodedDays: { '2026-07-24': 'c' },
    });
    const day = screen.getByLabelText('July 24, 2026, c');
    expect(day).toBeTruthy();
    fireEvent.press(day);
    expect(onDateSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps the cancelled-day strikethrough styling while selectable', () => {
    const { screen } = renderCalendar({
      encodedDays: { '2026-07-24': 'c' },
    });
    const dayText = screen.getByText('24');
    const flattened = dayText.props.style.flat(Infinity);
    expect(flattened).toEqual(
      expect.arrayContaining([{ opacity: 0.5, textDecorationLine: 'line-through' }]),
    );
  });

  it('still disables out-of-month trailing days', () => {
    const { onDateSelect, screen } = renderCalendar({});
    const outOfMonth = screen.getByLabelText('June 29, 2026');
    expect(outOfMonth.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(outOfMonth);
    expect(onDateSelect).not.toHaveBeenCalled();
  });
});
