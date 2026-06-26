# Gap Plan 4: Mobile Component Tests (RNTL)

> **Target:** 2 component test files passing: `PeriodCalendar.test.tsx`, `SOSButton.test.tsx`
> **Current:** 0 — no component test files exist
> **Priority:** MEDIUM

---

## 4.1 Setup

### Ensure RNTL is installed

```bash
cd mobile/
npm install --save-dev @testing-library/react-native @testing-library/jest-native
```

### Add to `jest.config.js` if not present:

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|@expo/vector-icons|react-native-vector-icons|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-screens|@react-navigation/.*|react-native-encrypted-storage)/)',
  ],
};
```

---

## 4.2 Test: `PeriodCalendar.test.tsx`

**File:** `mobile/src/components/ui/__tests__/PeriodCalendar.test.tsx`

### What to test:

| Test | Description | Assertion |
|------|-------------|-----------|
| Renders month header | Calendar shows "June 2026" | `getByText('June 2026')` |
| Renders day cells | 28-31 day cells visible | `getAllByTestId('day-cell').length >= 28` |
| Colors period days | Cycle entry `day_type=period` marked red | Expect color prop to be theme `color.period` |
| Colors predicted period | Prediction dates styled differently | Uses `color.predictedPeriod` vs `color.period` |
| Shows today marker | Today's date has highlight | `getByTestId('today-marker')` exists |
| Tap day → callback | `onDayPress` fires with correct date | Mock callback called with `{date: '2026-06-15'}` |
| Empty state | No cycle data → shows no-data message | `getByText('no_cycle_data')` |
| Loading state | Loading → skeleton placeholder | `getByTestId('calendar-skeleton')` |

### Mock data:

```typescript
const mockCycleEntries: CycleEntry[] = [
  {
    id: '1',
    user_id: 'user1',
    entry_date: '2026-06-10',
    day_type: 'period',
    flow: 'heavy',
  },
  {
    id: '2',
    user_id: 'user1',
    entry_date: '2026-06-11',
    day_type: 'period',
    flow: 'medium',
  },
  // ...
];

const mockPredictions: CyclePrediction = {
  next_period_start: '2026-07-08',
  ovulation_date: '2026-06-24',
  prediction_window_days: 2,
  confidence: 0.85,
};
```

### Sample test pattern:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PeriodCalendar } from '../PeriodCalendar';

describe('PeriodCalendar', () => {
  it('renders month header correctly', () => {
    const { getByText } = render(
      <PeriodCalendar
        year={2026}
        month={6}
        entries={[]}
        predictions={null}
        onDayPress={jest.fn()}
      />
    );
    expect(getByText('June 2026')).toBeTruthy();
  });

  it('colors period days with theme color', () => {
    const { getByTestId } = render(
      <PeriodCalendar
        year={2026}
        month={6}
        entries={mockCycleEntries}
        predictions={null}
        onDayPress={jest.fn()}
      />
    );
    const periodDay = getByTestId('day-cell-2026-06-10');
    expect(periodDay.props.style.backgroundColor).toBe('#FF6B6B');
  });

  it('fires onDayPress with correct date', () => {
    const onDayPress = jest.fn();
    const { getByTestId } = render(
      <PeriodCalendar
        year={2026}
        month={6}
        entries={[]}
        predictions={null}
        onDayPress={onDayPress}
      />
    );
    fireEvent.press(getByTestId('day-cell-2026-06-15'));
    expect(onDayPress).toHaveBeenCalledWith({ date: '2026-06-15' });
  });

  it('shows skeleton during loading', () => {
    const { getByTestId } = render(
      <PeriodCalendar
        year={2026}
        month={6}
        entries={[]}
        predictions={null}
        onDayPress={jest.fn()}
        loading={true}
      />
    );
    expect(getByTestId('calendar-skeleton')).toBeTruthy();
  });
});
```

---

## 4.3 Test: `SOSButton.test.tsx`

**File:** `mobile/src/components/ui/__tests__/SOSButton.test.tsx`

### What to test:

| Test | Description | Assertion |
|------|-------------|-----------|
| Renders inactive state | Default red button with shield icon | `getByTestId('sos-button')` visible, label="SOS" |
| Press triggers countdown | Tap → 5...4...3... shown | `getByText('5')` then `getByText('4')` after 1s |
| Cancel during countdown | Tap cancel → button returns to idle | Button shows "SOS" again |
| Countdown completes → fires | After 5s → `onActivate` called | `onActivate` mock called |
| Disabled during active | After activation, button disabled | `button.props.disabled === true` |
| Loading state | `loading` prop → spinner | `getByTestId('sos-spinner')` |
| Small variant | `size="small"` → compact layout | Style assertions on container |

### Sample test pattern:

```typescript
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SOSButton } from '../SOSButton';

describe('SOSButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders inactive with SOS label', () => {
    const { getByTestId, getByText } = render(
      <SOSButton onActivate={jest.fn()} />
    );
    expect(getByTestId('sos-button')).toBeTruthy();
    expect(getByText('SOS')).toBeTruthy();
  });

  it('shows countdown after press', () => {
    const { getByTestId, getByText } = render(
      <SOSButton onActivate={jest.fn()} />
    );
    fireEvent.press(getByTestId('sos-button'));
    expect(getByText('5')).toBeTruthy();
  });

  it('fires onActivate after countdown completes', () => {
    const onActivate = jest.fn();
    const { getByTestId } = render(
      <SOSButton onActivate={onActivate} />
    );
    fireEvent.press(getByTestId('sos-button'));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('cancels countdown when cancel is pressed', () => {
    const onActivate = jest.fn();
    const { getByTestId, getByText } = render(
      <SOSButton onActivate={onActivate} />
    );
    fireEvent.press(getByTestId('sos-button'));
    fireEvent.press(getByTestId('cancel-sos-button'));
    expect(getByText('SOS')).toBeTruthy();  // Back to idle
  });

  it('shows loading spinner when loading prop is true', () => {
    const { getByTestId } = render(
      <SOSButton onActivate={jest.fn()} loading={true} />
    );
    expect(getByTestId('sos-spinner')).toBeTruthy();
  });
});
```

---

## 4.4 Component Test Patterns (for future expansion)

| Component | Test File | Key Test Cases |
|-----------|-----------|----------------|
| `Button` | `Button.test.tsx` | renders label, fires onPress, disabled state, loading spinner |
| `Input` | `Input.test.tsx` | text input, placeholder, error state, secure text toggle |
| `Card` | `Card.test.tsx` | renders children, title, subtitle, onPress |
| `Modal` | `Modal.test.tsx` | open state, close on backdrop, renders content |
| `BottomSheet` | `BottomSheet.test.tsx` | snap points, drag to dismiss, render children |
| `Toast` | `Toast.test.tsx` | success/error/info variants, auto-dismiss timer |
| `Loader` | `Loader.test.tsx` | visible during loading, hidden when done |
| `EmptyState` | `EmptyState.test.tsx` | renders icon, title, message, action button |
| `MoodPicker` | `MoodPicker.test.tsx` | renders 5 mood options, fires onSelect, highlights selected |
| `SymptomGrid` | `SymptomGrid.test.tsx` | renders symptom list, toggle selection, multi-select |

---

## 4.5 Validation

```bash
cd mobile/
npx jest src/components/ui/__tests__/ --coverage
# Expected: 2 suites, ~20 tests, all passing
```
