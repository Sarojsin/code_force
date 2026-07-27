import { api } from './api/client';
import fallbackTips from '../assets/companion/health_tips_fallback.json';

export type HealthTipCategory =
  | 'sleep'
  | 'water'
  | 'food'
  | 'exercise'
  | 'medication'
  | 'general';

const FALLBACK_TIPS = fallbackTips as Record<HealthTipCategory, string[]>;

export async function getHealthTip(category: HealthTipCategory): Promise<string | null> {
  try {
    const response = await api.get('/wellness/health-tips', {
      params: { metric_type: category, limit: 1 },
    });
    const tips = response.data?.data;
    if (Array.isArray(tips) && tips.length > 0) {
      return tips[0].tip;
    }
  } catch {
    // Network error - fall through to fallback
  }
  return getFallbackTip(category);
}

export function getFallbackTip(category: HealthTipCategory): string | null {
  const pool = FALLBACK_TIPS[category];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function getDailyTips(): Promise<
  { category: HealthTipCategory; tip: string }[]
> {
  const categories: HealthTipCategory[] = [
    'sleep',
    'water',
    'food',
    'exercise',
    'medication',
    'general',
  ];

  const results = await Promise.allSettled(
    categories.map(async (cat) => {
      const tip = await getHealthTip(cat);
      return tip ? { category: cat, tip } : null;
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<{ category: HealthTipCategory; tip: string } | null> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value!)
    .slice(0, 3);
}
