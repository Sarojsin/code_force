import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';

import { useAuthStore } from 'src/stores/authStore';
import { localDb } from 'src/services/localDb';
import { eventBus } from 'src/services/eventBus';
import { useContents } from 'src/services/queries/nurse_content';
import { useVideoLibrarySettings } from 'src/hooks/useVideoLibrarySettings';
import { recommendContents } from 'src/utils/videoRecommendations';
import type { NurseContent } from 'src/services/api/nurse_content';

export interface VideoRecommendations {
  /** Full fetched content list, newest first (used for the OFF/general mode). */
  all: NurseContent[];
  /** Score > 0, best matches first (carousel tier). Empty when master OFF. */
  recommended: NurseContent[];
  /** Everything else, newest first. All content when master OFF. */
  general: NurseContent[];
  /** Canonical symptom names that matched some content. */
  matchedSymptoms: string[];
  /** True when symptoms were logged in the last 7 days. */
  hasData: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** True while the global master switch state is still loading. */
  isSettingsLoading: boolean;
}

/**
 * Symptom-driven content recommendations for VideoLibraryScreen (plan §6).
 *
 * Master-switch gate: when smart recommendations are globally OFF we skip
 * symptom reads entirely and return a plain general list. When ON we read the
 * last 7 days of `cycle_days` from local SQLite (offline-first), score the
 * network-fetched content client-side, and re-run on `day_logged` so newly
 * logged symptoms surface immediately.
 */
export function useVideoRecommendations(category?: string): VideoRecommendations {
  const userId = useAuthStore((s) => s.user?.id);
  const { smartRecommendationsEnabled, isLoaded: isSettingsLoaded } = useVideoLibrarySettings();
  const [symptomNames, setSymptomNames] = useState<string[]>([]);
  const [isLoadingSymptoms, setIsLoadingSymptoms] = useState(true);

  const { data: contents, isLoading: isContentsLoading, isError, refetch } = useContents({
    limit: 100,
    category: category && category !== 'all' ? category : undefined,
  });

  useEffect(() => {
    if (!userId || !smartRecommendationsEnabled) {
      setSymptomNames([]);
      setIsLoadingSymptoms(false);
      return;
    }
    const load = () => {
      const today = new Date();
      const start = format(subDays(today, 6), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');
      localDb.cycleDay
        .getByRange(userId, start, end)
        .then((days) => {
          const names: string[] = [];
          for (const day of days) {
            const rows = Array.isArray(day.symptoms) ? day.symptoms : [];
            for (const row of rows) {
              if (row && typeof row.name === 'string' && row.name.trim()) names.push(row.name);
            }
          }
          setSymptomNames([...new Set(names)]);
        })
        .catch(() => setSymptomNames([]))
        .finally(() => setIsLoadingSymptoms(false));
    };
    setIsLoadingSymptoms(true);
    load();
    return eventBus.on('day_logged', () => load());
  }, [userId, smartRecommendationsEnabled]);

  return useMemo(() => {
    const all = sortNewest(contents ?? []);
    if (!smartRecommendationsEnabled || !isSettingsLoaded) {
      return {
        all,
        recommended: [],
        general: all,
        matchedSymptoms: [],
        hasData: false,
        isLoading: isContentsLoading,
        isError,
        refetch,
        isSettingsLoading: !isSettingsLoaded,
      };
    }

    const result = recommendContents(all, symptomNames);
    const isLoading = isLoadingSymptoms || isContentsLoading;
    return { all, ...result, isLoading, isError, refetch, isSettingsLoading: false };
  }, [
    smartRecommendationsEnabled,
    isSettingsLoaded,
    contents,
    symptomNames,
    isLoadingSymptoms,
    isContentsLoading,
    isError,
    refetch,
  ]);
}

function sortNewest(contents: NurseContent[]): NurseContent[] {
  return [...contents].sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });
}