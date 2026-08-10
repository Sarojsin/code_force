import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from 'src/theme';

import { DynamicRecommendations } from '../DynamicRecommendations';
import type { CycleDay } from 'src/db/schema';
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

function makeDay(overrides?: Partial<CycleDay>): CycleDay {
  return {
    id: 'd1',
    user_id: 'u1',
    log_date: '2026-08-10',
    pain_level: 5,
    symptoms: [{ name: 'Abdominal Cramps', severity: 5 }],
    recommendations_completed: [],
    ...overrides,
  } as CycleDay;
}

function renderDynamic(overrides?: {
  dayData?: CycleDay | null;
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
        dayData={overrides?.dayData}
      />
    </ThemeProvider>,
  );
}

describe('DynamicRecommendations — "For today" engine block (plan5 §3.2)', () => {
  it('shows the engine-based card when dayData exists', () => {
    const view = renderDynamic({ dayData: makeDay() });
    expect(view.getAllByText('Today').length).toBeGreaterThan(0);
    expect(view.getByText('Magnesium + Omega-3')).toBeTruthy();
  });

  it('without dayData and with sufficient data, the empty state renders and no block is prepended', async () => {
    const view = renderDynamic({
      dayData: null,
      insights: { total_mood_logs: 5 } as unknown as WellnessInsights,
      predictions: { data_quality: 'Good' } as unknown as PredictionListResponse,
    });
    await waitFor(() => {
      expect(view.getByText('No recommendations yet. Check back after logging more data.')).toBeTruthy();
    });
    expect(view.queryByText('Today')).toBeNull();
  });
});