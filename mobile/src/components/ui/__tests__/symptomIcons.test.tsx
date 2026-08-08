import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ThemeProvider } from 'src/theme';

import { SymptomIcon } from '../symptomIcons/SymptomIcon';
import { CUSTOM_ICON_BY_NAME } from '../symptomIcons/CustomSymptomIcons';
import { SymptomAccordion } from '../dayDetail/SymptomAccordion';

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
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const mock = () =>
    (({ children, ...rest }: any) => (
      <View {...rest}>
        {children}
      </View>
    ));
  return {
    __esModule: true,
    default: mock(),
    Svg: mock(),
    Path: mock(),
    Circle: mock(),
    Ellipse: mock(),
    G: mock(),
  };
});
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const MockIcon = ({ children, ...props }: any) => <View {...props}>{children}</View>;
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (prop === 'default') return MockIcon;
        if (prop === '__esModule') return true;
        return MockIcon;
      },
    },
  );
});

const MASTER = [
  { id: 'abdominal-cramps', name: 'Abdominal Cramps', category: 'pain', icon_kind: 'custom', display_order: 1 },
  { id: 'headache', name: 'Headache', category: 'pain', icon_kind: 'custom', display_order: 7 },
  { id: 'bloating', name: 'Bloating', category: 'digestive', icon_kind: 'custom', display_order: 1 },
  { id: 'constipation', name: 'Constipation', category: 'digestive', icon_kind: 'lucide', display_order: 2 },
  { id: 'acne', name: 'Acne / Pimples', category: 'skin', icon_kind: 'lucide', display_order: 1 },
  { id: 'fatigue', name: 'Fatigue', category: 'general', icon_kind: 'custom', display_order: 1 },
] as const;

describe('SymptomIcon', () => {
  it('renders a custom SVG glyph for hero symptoms', () => {
    const { UNSAFE_getByType } = render(
      <ThemeProvider>
        <SymptomIcon name="Abdominal Cramps" size={20} />
      </ThemeProvider>,
    );
    expect(UNSAFE_getByType(CUSTOM_ICON_BY_NAME['Abdominal Cramps'] as any)).toBeTruthy();
  });
});

describe('SymptomAccordion 4-category taxonomy', () => {
  it('renders the four symptom categories (pain/digestive/skin/general)', () => {
    const screen = render(
      <ThemeProvider>
        <SymptomAccordion masterSymptoms={MASTER as any} selected={[]} onToggle={() => {}} />
      </ThemeProvider>,
    );
    for (const label of ['Pain', 'Digestive', 'Skin', 'General']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('renders a chip for each symptom regardless of icon kind', () => {
    const screen = render(
      <ThemeProvider>
        <SymptomAccordion masterSymptoms={MASTER as any} selected={[]} onToggle={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Abdominal Cramps')).toBeTruthy();
    expect(screen.getByText('Constipation')).toBeTruthy();
    expect(screen.getByText('Fatigue')).toBeTruthy();
  });
});

describe('SymptomAccordion tap-to-cycle severity (plan §6)', () => {
  it('announces severity via accessibilityValue for selected chips', () => {
    const screen = render(
      <ThemeProvider>
        <SymptomAccordion
          masterSymptoms={MASTER as any}
          selected={['Abdominal Cramps']}
          severities={{ 'Abdominal Cramps': 5 }}
          onToggle={() => {}}
        />
      </ThemeProvider>,
    );
    const chip = screen.getByLabelText('Abdominal Cramps');
    expect(chip.props.accessibilityValue).toEqual({ now: 5, min: 1, max: 5 });
    expect(chip.props.accessibilityState.checked).toBe(true);
  });

  it('defaults a selected chip without a severity entry to moderate (3)', () => {
    const screen = render(
      <ThemeProvider>
        <SymptomAccordion
          masterSymptoms={MASTER as any}
          selected={['Fatigue']}
          onToggle={() => {}}
        />
      </ThemeProvider>,
    );
    const chip = screen.getByLabelText('Fatigue');
    expect(chip.props.accessibilityValue).toEqual({ now: 3, min: 1, max: 5 });
  });

  it('fires onToggle on press and exposes severity dots', () => {
    const onToggle = jest.fn();
    const screen = render(
      <ThemeProvider>
        <SymptomAccordion
          masterSymptoms={MASTER as any}
          selected={['Abdominal Cramps']}
          severities={{ 'Abdominal Cramps': 3 }}
          onToggle={onToggle}
        />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByLabelText('Abdominal Cramps'));
    expect(onToggle).toHaveBeenCalledWith('Abdominal Cramps');
  });
});