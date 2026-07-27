# Phase 2 Day 12 — Mobile Recommendations + Offline Fallback

## Goal
Build the mobile health tips service that fetches tips from the backend API and falls back to a bundled JSON file when offline. Wire the tip display into the Health Hub.

---

## 12.1 Create Bundled Fallback Tips

**File:** `mobile/src/assets/companion/health_tips_fallback.json`

```json
{
  "sleep": [
    "Consistent sleep schedule improves your cycle regularity.",
    "7-9 hours of sleep helps regulate stress hormones.",
    "Avoid caffeine 6 hours before bedtime.",
    "Sleep deprivation can worsen PMS symptoms.",
    "Create a bedtime ritual: read, stretch, or meditate."
  ],
  "water": [
    "Water helps reduce menstrual bloating.",
    "Staying hydrated reduces fatigue during periods.",
    "Aim for 8 glasses (2L) of water daily.",
    "Hydration improves skin elasticity and glow.",
    "Dehydration can trigger headaches."
  ],
  "food": [
    "Iron-rich foods help combat period fatigue.",
    "Omega-3 fatty acids can reduce period pain.",
    "Eat protein with every meal for stable energy.",
    "Dark leafy greens are packed with iron and folate.",
    "Reduce sugar intake to stabilize mood swings."
  ],
  "exercise": [
    "Gentle walking reduces period pain.",
    "Yoga helps relieve menstrual cramps.",
    "Exercise releases endorphins — natural mood lifters.",
    "Aim for 150 minutes of moderate exercise weekly.",
    "Listen to your body — rest when you need to."
  ],
  "medication": [
    "Track your medication schedule for consistency.",
    "Set daily reminders to never miss a dose.",
    "Consult your doctor before starting supplements.",
    "Check expiration dates regularly.",
    "Some medications work best with food."
  ],
  "general": [
    "Small consistent steps lead to big health changes.",
    "Self-care is not selfish — it's necessary.",
    "Your health journey is unique. Progress, not perfection.",
    "Celebrate every win, no matter how small.",
    "You're doing better than you think."
  ]
}
```

**Important for bundling:** If the project uses Metro bundler, JSON files in `src/assets/` are automatically included. Reference the path at runtime.

---

## 12.2 Create `src/services/healthTips.ts`

```typescript
import { apiClient } from '../api/client';
import fallbackTips from '../assets/companion/health_tips_fallback.json';

export type HealthTipCategory =
  | 'sleep'
  | 'water'
  | 'food'
  | 'exercise'
  | 'medication'
  | 'general';

const FALLBACK_TIPS = fallbackTips as Record<HealthTipCategory, string[]>;

/**
 * Fetch a health tip from the backend. Falls back to bundled JSON if offline.
 */
export async function getHealthTip(
  category: HealthTipCategory
): Promise<string | null> {
  try {
    const response = await apiClient.get('/wellness/health-tips', {
      params: { metric_type: category, limit: 1 },
    });
    const tips = response.data?.data;
    if (Array.isArray(tips) && tips.length > 0) {
      return tips[0].tip;
    }
  } catch {
    // Network error — fall through to fallback
  }

  // Offline fallback
  return getFallbackTip(category);
}

/**
 * Get a random tip from the bundled fallback JSON.
 */
export function getFallbackTip(category: HealthTipCategory): string | null {
  const pool = FALLBACK_TIPS[category];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get multiple tips for the Health Hub display.
 */
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
    .slice(0, 3); // Show max 3 tips
}
```

---

## 12.3 Add Tips Section to HealthHubScreen

**File:** `src/screens/companion/HealthHubScreen.tsx`

Add a health tips section below the streaks area:

```typescript
import { getDailyTips } from '../../services/healthTips';
import type { HealthTipCategory } from '../../services/healthTips';

// Inside the component:
const [tips, setTips] = useState<{ category: HealthTipCategory; tip: string }[]>([]);
const [tipsLoading, setTipsLoading] = useState(true);

useFocusEffect(
  useCallback(() => {
    if (userId) {
      hydrate(userId);
      loadTips();
    }
  }, [userId])
);

const loadTips = async () => {
  setTipsLoading(true);
  const result = await getDailyTips();
  setTips(result);
  setTipsLoading(false);
};
```

Add the tip section to the JSX:

```tsx
{/* Health Tips */}
<View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
    💡 Health Tips
  </Text>
  {tipsLoading ? (
    <Text style={{ color: theme.colors.textSecondary }}>Loading tips...</Text>
  ) : tips.length === 0 ? (
    <Text style={{ color: theme.colors.textSecondary }}>
      Check back later for more tips!
    </Text>
  ) : (
    tips.map((tip, i) => (
      <View key={i} style={styles.tipRow}>
        <Text style={styles.tipBullet}>•</Text>
        <Text style={[styles.tipText, { color: theme.colors.text }]}>
          {tip.tip}
        </Text>
      </View>
    ))
  )}
</View>
```

Add to `StyleSheet`:

```typescript
tipRow: {
  flexDirection: 'row',
  marginBottom: 8,
},
tipBullet: {
  fontSize: 14,
  marginRight: 8,
  color: '#666',
},
tipText: {
  fontSize: 13,
  lineHeight: 19,
  flex: 1,
},
```

---

## 12.4 Offline Behavior

| Scenario | Behavior |
|----------|----------|
| Online | Fetches from `GET /api/v1/wellness/health-tips` |
| Offline | Reads from `health_tips_fallback.json` (bundled) |
| Backend down | Same fallback as offline |
| No tips returned | Shows "Check back later" message |

The `apiClient.get()` call throws on network errors (handled by the `try/catch`), which triggers the fallback. No special connectivity checks needed.

---

## 12.5 Validation

- [ ] `getHealthTip('sleep')` returns a string
- [ ] `getHealthTip('sleep')` falls back to bundled JSON when API fails
- [ ] `getFallbackTip('water')` returns a tip from the JSON file
- [ ] `getFallbackTip('invalid')` returns `null`
- [ ] `getDailyTips()` returns max 3 tips
- [ ] Health Hub shows tips section with fetched/fallback content
- [ ] Tips refresh on screen focus (via `useFocusEffect`)
- [ ] Works offline without error
- [ ] `tsc --noEmit` passes with 0 new errors
