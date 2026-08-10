import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { ThemeProvider } from 'src/theme';

import { RecommendationCarousel } from '../dayDetail/RecommendationCarousel';
import type { RecommendationCard } from 'src/utils/expertRecommendations';

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  function MockIcon() {
    return React.createElement(View);
  }
  const icons = [
    'Flame', 'Leaf', 'Droplet', 'Bone', 'Heart', 'HeartPulse', 'Moon', 'Wind',
    'CloudFog', 'CloudLightning', 'CloudRain', 'Eye', 'Target', 'Repeat', 'MapPin',
    'Utensils', 'Waves', 'Turtle', 'Sparkles', 'Scale', 'Thermometer',
  ];
  const map: Record<string, unknown> = { default: MockIcon };
  for (const name of icons) map[name] = MockIcon;
  return map;
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

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

function makeCard(overrides: Partial<RecommendationCard>): RecommendationCard {
  return {
    id: 'menstrual-cramps',
    icon: '🔥',
    title: 'Heat & Rest',
    body: 'A gentle heat pad on the lower belly can help ease cramping. Rest today.',
    cta: 'Log water',
    action: 'water',
    ...overrides,
  };
}

function renderCarousel({
  cards = [makeCard()],
  completed = [],
  onToggle = jest.fn(),
  onAction = jest.fn(),
}: {
  cards?: RecommendationCard[];
  completed?: string[];
  onToggle?: (id: string) => void;
  onAction?: (action: NonNullable<RecommendationCard['action']>, card: RecommendationCard) => void;
} = {}) {
  const view = render(
    <ThemeProvider>
      <RecommendationCarousel cards={cards} completed={completed} onToggle={onToggle} onAction={onAction} />
    </ThemeProvider>,
  );
  return { view, onToggle, onAction };
}

describe('RecommendationCarousel CTA button', () => {
  it('renders an interactive CTA button for actionable actions (water)', () => {
    const { view } = renderCarousel({ cards: [makeCard({ action: 'water', cta: 'Log water' })] });
    const cta = view.getByRole('button', { name: 'Log water' });
    expect(cta).toBeTruthy();
    expect(cta.props.accessibilityHint).toBe('Add one glass of water to today log');
  });

  it('does not render a CTA button for mark-done or null actions', () => {
    const { view } = renderCarousel({
      cards: [
        makeCard({ id: 'a', action: 'mark-done' }),
        makeCard({ id: 'b', action: null }),
      ],
    });
    expect(view.queryByRole('button')).toBeNull();
  });

  it('fires onAction with the action + card payload on CTA press', () => {
    const onAction = jest.fn();
    const { view } = renderCarousel({ cards: [makeCard({ action: 'water', cta: 'Log water' })], onAction });
    fireEvent.press(view.getByRole('button', { name: 'Log water' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('water', makeCard({ action: 'water', cta: 'Log water' }));
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });

  it('supports every actionable action the engine can emit', () => {
    const actions: Array<NonNullable<RecommendationCard['action']>> = [
      'water',
      'breathing',
      'days-stretch',
      'walk',
      'journal',
      'doctor',
    ];
    for (const action of actions) {
      const { view } = renderCarousel({
        cards: [makeCard({ action, cta: `CTA ${action}` })],
      });
      expect(view.queryByRole('button', { name: `CTA ${action}` })).toBeTruthy();
    }
  });

  it('mark-done checkbox still works alongside the CTA (only mark-done renders checkbox)', () => {
    const onToggle = jest.fn();
    const { view } = renderCarousel({
      cards: [makeCard({ action: 'mark-done', cta: null })],
      onToggle,
      completed: [],
    });
    const checkbox = view.getByRole('checkbox');
    fireEvent.press(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button')).toBeNull();
  });
});