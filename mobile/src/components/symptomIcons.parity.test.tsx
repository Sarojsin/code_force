import { readFileSync } from 'fs';
import { join } from 'path';

import { CUSTOM_ICON_BY_NAME } from './ui/symptomIcons/CustomSymptomIcons';
import { LUCIDE_ICON_BY_NAME } from './ui/symptomIcons/SymptomIcon';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const mock = () => (props: any) => <View {...props} />;
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
  const MockIcon = (props: any) => <View {...props} />;
  return new Proxy(
    { default: MockIcon },
    {
      get: (_t: any, prop: string) => (prop === '__esModule' ? true : MockIcon),
    },
  );
});

const SYMPTOMS_JSON = join(__dirname, '../assets/masters/symptoms.json');

describe('symptom icon registry parity (plan §5.1)', () => {
  const bundle: Array<{ name: string; icon_kind?: 'custom' | 'lucide' | null }> = JSON.parse(
    readFileSync(SYMPTOMS_JSON, 'utf8'),
  );

  it('every bundle row declares a valid icon_kind', () => {
    for (const row of bundle) {
      expect(['custom', 'lucide']).toContain(row.icon_kind);
    }
  });

  it('every custom-kind symptom has a bespoke SVG glyph', () => {
    const missing = bundle
      .filter((row) => row.icon_kind === 'custom')
      .map((row) => row.name)
      .filter((name) => !(name in CUSTOM_ICON_BY_NAME));
    expect(missing).toEqual([]);
  });

  it('every lucide-kind symptom has a lucide token', () => {
    const missing = bundle
      .filter((row) => row.icon_kind === 'lucide')
      .map((row) => row.name)
      .filter((name) => !(name in LUCIDE_ICON_BY_NAME));
    expect(missing).toEqual([]);
  });

  it('dispatcher never reaches the emoji fallback for a mapped row', () => {
    for (const row of bundle) {
      expect(row.name in CUSTOM_ICON_BY_NAME || row.name in LUCIDE_ICON_BY_NAME).toBe(true);
    }
  });
});