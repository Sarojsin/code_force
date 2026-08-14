import {
  getKeywordsForSymptom,
  recommendContents,
  resolveSymptomName,
  scoreContent,
} from 'src/utils/videoRecommendations';
import type { NurseContent } from 'src/services/api/nurse_content';

function makeContent(overrides: Partial<NurseContent>): NurseContent {
  return {
    id: Math.random().toString(36).slice(2),
    nurse_id: 'n1',
    title: 'Untitled',
    description: null,
    summary: null,
    body: null,
    reading_time_minutes: null,
    author_name: null,
    content_type: 'video',
    video_public_id: null,
    video_url: null,
    video_duration_seconds: null,
    thumbnail_public_id: null,
    thumbnail_url: null,
    images: null,
    category: 'wellness',
    tags: [],
    status: 'approved',
    approved_by: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('resolveSymptomName — alias reuse (plan sanity check #2)', () => {
  it('resolves legacy aliases to canonical master names', () => {
    expect(resolveSymptomName('Cramps')).toBe('Abdominal Cramps');
    expect(resolveSymptomName('Low Energy')).toBe('Fatigue');
  });

  it('passes canonical names through unchanged', () => {
    expect(resolveSymptomName('Headache')).toBe('Headache');
  });
});

describe('getKeywordsForSymptom — curated map + fallback (plan sanity check #3)', () => {
  it('returns curated keywords for common symptoms', () => {
    const kws = getKeywordsForSymptom('Abdominal Cramps');
    expect(kws).toContain('cramps');
    expect(kws).toContain('period pain');
  });

  it('falls back to word-split for symptoms without a curated entry', () => {
    const kws = getKeywordsForSymptom('Vision Changes');
    expect(kws.length).toBeGreaterThan(0);
    expect(kws).toContain('vision');
  });

  it('lowercases fallback keywords', () => {
    const kws = getKeywordsForSymptom('Heavy / Prolonged Bleeding');
    expect(kws.every((k) => k === k.toLowerCase())).toBe(true);
  });

  it('resolves aliases before looking up curated keywords', () => {
    const kws = getKeywordsForSymptom('Cramps');
    expect(kws).toContain('cramps');
  });
});

describe('scoreContent — simple hit count (plan sanity check #4)', () => {
  it('scores 0 when nothing matches', () => {
    const content = makeContent({ title: 'Hair care tips' });
    expect(scoreContent(content, ['cramps', 'bloating'])).toBe(0);
  });

  it('counts a title hit (case-insensitive substring)', () => {
    const content = makeContent({ title: 'Easy CRAMPS relief at home' });
    expect(scoreContent(content, ['cramps'])).toBe(1);
  });

  it('counts description hits', () => {
    const content = makeContent({ title: 'Self care', description: 'Deals with bloating and back pain.' });
    expect(scoreContent(content, ['bloating', 'back pain'])).toBe(2);
  });

  it('counts tag hits', () => {
    const content = makeContent({ title: 'Sleep guide', tags: ['insomnia', 'sleep'] });
    expect(scoreContent(content, ['insomnia'])).toBe(1);
  });

  it('counts a hit once per keyword, no double counting', () => {
    const content = makeContent({ title: 'cramps cramps', description: 'cramps' });
    expect(scoreContent(content, ['cramps'])).toBe(1);
  });
});

describe('recommendContents — split & ordering', () => {
  it('empty symptoms → everything in general, hasData false', () => {
    const a = makeContent({ title: 'Cramps relief' });
    const b = makeContent({ title: 'Hair care' });
    const result = recommendContents([a, b], []);
    expect(result.hasData).toBe(false);
    expect(result.recommended).toEqual([]);
    expect(result.general).toHaveLength(2);
    expect(result.matchedSymptoms).toEqual([]);
  });

  it('zero content → empty arrays', () => {
    const result = recommendContents([], ['Cramps']);
    expect(result.recommended).toEqual([]);
    expect(result.general).toEqual([]);
  });

  it('promotes matched content to recommended and keeps the rest general', () => {
    const matched = makeContent({ title: 'Cramps relief exercises' });
    const unrelated = makeContent({ title: 'Hair care' });
    const result = recommendContents([matched, unrelated], ['Abdominal Cramps']);
    expect(result.hasData).toBe(true);
    expect(result.recommended.map((c) => c.id)).toEqual([matched.id]);
    expect(result.general.map((c) => c.id)).toEqual([unrelated.id]);
    expect(result.matchedSymptoms).toContain('Abdominal Cramps');
  });

  it('breaks score ties by published_at desc', () => {
    const older = makeContent({ title: 'Cramps basics', published_at: '2026-01-01T00:00:00Z' });
    const newer = makeContent({ title: 'Cramps advanced', published_at: '2026-01-05T00:00:00Z' });
    const result = recommendContents([older, newer], ['Abdominal Cramps']);
    expect(result.recommended.map((c) => c.id)).toEqual([newer.id, older.id]);
  });

  it('sorts general by published_at desc', () => {
    const older = makeContent({ title: 'Hair care', published_at: '2026-01-01T00:00:00Z' });
    const newer = makeContent({ title: 'Yoga', published_at: '2026-01-05T00:00:00Z' });
    const result = recommendContents([older, newer], ['Abdominal Cramps']);
    expect(result.general.map((c) => c.id)).toEqual([newer.id, older.id]);
  });

  it('dedupes repeated symptom names', () => {
    const content = makeContent({ title: 'Bloating tips' });
    const result = recommendContents([content], ['Bloating', 'Bloating', 'Bloating']);
    expect(result.recommended.map((c) => c.id)).toEqual([content.id]);
  });

  it('handles legacy alias names in the symptom input', () => {
    const content = makeContent({ title: 'Fatigue management' });
    const result = recommendContents([content], ['Low Energy']);
    expect(result.recommended.map((c) => c.id)).toEqual([content.id]);
  });
});
