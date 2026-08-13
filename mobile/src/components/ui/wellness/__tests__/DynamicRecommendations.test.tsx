import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from 'src/theme';

import { DynamicRecommendations } from '../DynamicRecommendations';
import type { CurrentCycleState } from 'src/hooks/useCurrentCycleState';
import type { WellnessInsights } from 'src/services/api/wellness';
import type { PredictionListResponse } from 'src/services/api/cycle';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      clear: jest.fn(async () => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    },
  };
});

jest.mock('src/components/ui', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const Txt = ({ children, variant, style, ...rest }: any) => {
    const base = variant === 'emoji' ? { fontSize: 18 } : variant === 'bodySmall' ? { fontSize: 12 } : {};
    return React.createElement(Text, { ...rest, style: [base, style] }, children);
  };
  return {
    Text: Txt,
    ThemeProvider: View,
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: (props: object) => React.createElement(View, props) };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = () => React.createElement(View);
  return new Proxy({ default: MockIcon }, { get: () => MockIcon });
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const mockRecommendation: {
  card: { id: string; icon: string; title: string; body: string } | null;
  tier: string;
  phaseKey: string;
  painLevel: number;
  hasData: boolean;
  isLoading: boolean;
} = {
  card: {
    id: 'luteal-cramps',
    icon: '🔥',
    title: 'Magnesium + Omega-3',
    body: 'May ease cramps',
  },
  tier: 'recommendation',
  phaseKey: 'luteal',
  painLevel: 5,
  hasData: true,
  isLoading: false,
};

jest.mock('src/hooks/useTodayRecommendation', () => ({
  useTodayRecommendation: () => mockRecommendation,
}));

jest.mock('src/services/eventBus', () => ({
  eventBus: {
    on: jest.fn(() => () => {}),
  },
}));

jest.mock('src/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => unknown) => selector({ user: { id: 'u1' } }),
}));

jest.mock('src/stores/companionStore', () => ({
  useCompanionStore: (selector: (s: any) => unknown) =>
    selector({ showInsights: true }),
}));

jest.mock('src/services/localDb', () => ({
  localDb: {
    cycleDay: {
      getByDate: jest.fn(async () => null),
    },
  },
}));

const cycleState: CurrentCycleState = {
  isLoaded: true,
  isLoading: false,
  error: null,
  hasCycleData: true,
  phaseKey: 'luteal',
  phaseLabel: 'Luteal',
  phaseDesc: 'Pre-menstrual phase',
  cycleDay: 24,
  daysIntoPhase: 9,
  ovulationDate: null,
  periodStartDate: '2026-07-01',
  periodEndDate: null,
  cycleLength: 29,
} as unknown as CurrentCycleState;

function renderDynamic(overrides?: {
  insights?: WellnessInsights;
  predictions?: PredictionListResponse;
}) {
  return render(
    <ThemeProvider>
      <DynamicRecommendations
        cycleState={cycleState}
        insights={overrides?.insights}
        analytics={undefined}
        predictions={overrides?.predictions}
        healthTips={[]}
      />
    </ThemeProvider>,
  );
}

describe('DynamicRecommendations — "For today" engine block (plan5 §3.2)', () => {
  it('shows the "For today" card from the shared recommendation hook', () => {
    const view = renderDynamic();
    expect(view.getAllByText('Today').length).toBeGreaterThan(0);
    expect(view.getByText('Magnesium + Omega-3')).toBeTruthy();
  });

  it('without data and with sufficient data, the empty state renders and no block is prepended', async () => {
    mockRecommendation.card = null;
    const view = renderDynamic({
      insights: { total_mood_logs: 5 } as unknown as WellnessInsights,
      predictions: { data_quality: 'Good' } as unknown as PredictionListResponse,
    });
    await waitFor(() => {
      expect(view.getByText('No recommendations yet. Check back after logging more data.')).toBeTruthy();
    });
    expect(view.queryByText('Today')).toBeNull();
  });
});