import { create } from 'zustand';
import { companionLocalService, calculateLevel, calculateRelationshipLevel } from '../services/localDb';
export { calculateLevel } from '../services/localDb';
export { calculateRelationshipLevel, RELATIONSHIP_THRESHOLDS } from '../services/localDb';

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Kitten',
  5: 'Explorer',
  10: 'Guardian',
  20: 'Best Friend',
  50: 'Legend',
};

export function getLevelTitle(level: number): string {
  const sorted = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const lvl of sorted) {
    if (level >= lvl) return LEVEL_TITLES[lvl];
  }
  return LEVEL_TITLES[1];
}

export function xpToNextLevel(level: number): number {
  if (level < 5) return 500;
  if (level < 10) return 2000;
  if (level < 20) return 10000;
  if (level < 50) return 100000;
  return 0;
}

export const XP_REWARDS = {
  journal_saved: 10,
  mood_logged: 5,
  water_logged: 3,
  food_logged: 5,
  exercise_completed: 8,
  exercise_logged: 8,
  medication_logged: 4,
  period_logged: 15,
  period_corrected: 5,
  daily_login: 2,
  health_streak: 20,
  health_milestone: 50,
  diary_page_created: 12,
  diary_photo_added: 5,
  diary_page_saved: 5,
  diary_opened: 2,
  diary_media_synced: 8,
  day_logged: 4,
} as const;

export const COIN_REWARDS = {
  journal_saved: 2,
  mood_logged: 1,
  water_logged: 1,
  food_logged: 2,
  exercise_completed: 2,
  exercise_logged: 2,
  medication_logged: 1,
  period_logged: 3,
  period_corrected: 1,
  daily_login: 1,
  health_streak: 5,
  health_milestone: 10,
  diary_page_created: 2,
  diary_photo_added: 1,
  diary_page_saved: 1,
  diary_media_synced: 2,
  day_logged: 1,
} as const;

/** Opt-in TTS prefs, persisted in `companion_metadata.memory.speech`. */
export interface SpeechPrefs {
  enabled: boolean;
  voiceId: string | null;
  rate: number;
  pitch: number;
}

export const DEFAULT_SPEECH_PREFS: SpeechPrefs = {
  enabled: false,
  voiceId: null,
  rate: 1,
  pitch: 1,
};

interface CompanionState {
  userId: string | null;
  xp: number;
  coins: number;
  level: number;
  relationshipLevel: number;
  lastSeenAt: number | null;
  currentOutfitId: string | null;
  ownedOutfits: string[];
  memory: Record<string, unknown>;

  speakEnabled: boolean;
  speechVoiceId: string | null;
  speechRate: number;
  speechPitch: number;

  isHidden: boolean;
  reduceAnimations: boolean;
  muteSounds: boolean;
  installStatus: string;
  assetsVersion: string | null;
  lastActiveAt: string | null;

  levelTitle: string;
  xpToNext: number;

  isHydrated: boolean;

  hydrate: (userId: string) => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  spendCoins: (amount: number) => Promise<boolean>;
  setOutfit: (outfitId: string | null) => Promise<void>;
  updateMemory: (key: string, value: unknown) => Promise<void>;
  setSpeechPref: (partial: Partial<SpeechPrefs>) => Promise<void>;
  setHidden: (hidden: boolean) => Promise<void>;
  setReduceAnimations: (reduce: boolean) => Promise<void>;
  setMuteSounds: (mute: boolean) => Promise<void>;
  setInstallStatus: (status: string) => void;
  setAssetsVersion: (version: string | null) => void;
  setLastSeen: (ts: number) => void;
  reset: () => void;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  userId: null,
  xp: 0,
  coins: 0,
  level: 1,
  relationshipLevel: 1,
  lastSeenAt: null,
  currentOutfitId: null,
  ownedOutfits: [],
  memory: {},
  speakEnabled: false,
  speechVoiceId: null,
  speechRate: 1,
  speechPitch: 1,
  isHidden: false,
  reduceAnimations: false,
  muteSounds: false,
  installStatus: 'none',
  assetsVersion: null,
  lastActiveAt: null,
  levelTitle: 'Kitten',
  xpToNext: 500,
  isHydrated: false,

  hydrate: async (userId: string) => {
    try {
      const meta = await companionLocalService.getMetadata(userId);
      if (meta) {
        const speech = (meta.memory as { speech?: Partial<SpeechPrefs> })?.speech ?? {};
        set({
          userId: meta.user_id,
          xp: meta.xp,
          coins: meta.coins,
          level: meta.level,
          relationshipLevel: meta.relationship_level,
          lastSeenAt: meta.last_seen_at,
          currentOutfitId: meta.current_outfit_id,
          ownedOutfits: meta.owned_outfits ?? [],
          memory: (meta.memory as Record<string, unknown>) ?? {},
          speakEnabled: speech.enabled ?? false,
          speechVoiceId: speech.voiceId ?? null,
          speechRate: speech.rate ?? 1,
          speechPitch: speech.pitch ?? 1,
          isHidden: meta.is_hidden,
          reduceAnimations: meta.reduce_animations,
          muteSounds: meta.mute_sounds,
          installStatus: meta.install_status,
          assetsVersion: meta.assets_version,
          lastActiveAt: meta.last_active_at,
          levelTitle: getLevelTitle(meta.level),
          xpToNext: xpToNextLevel(meta.level),
          isHydrated: true,
        });
      } else {
        const now = new Date().toISOString();
        await companionLocalService.upsertMetadata({
          user_id: userId,
          xp: 0,
          coins: 0,
          level: 1,
          relationship_level: 1,
          current_outfit_id: null,
          owned_outfits: [],
          memory: {},
          is_hidden: false,
          reduce_animations: false,
          mute_sounds: false,
          install_status: 'none',
          last_active_at: now,
          created_at: now,
          updated_at: now,
        });
        set({
          userId,
          xp: 0,
          coins: 0,
          level: 1,
          relationshipLevel: 1,
          lastSeenAt: null,
          currentOutfitId: null,
          ownedOutfits: [],
          memory: {},
          speakEnabled: false,
          speechVoiceId: null,
          speechRate: 1,
          speechPitch: 1,
          isHidden: false,
          reduceAnimations: false,
          muteSounds: false,
          installStatus: 'none',
          assetsVersion: null,
          lastActiveAt: now,
          levelTitle: 'Kitten',
          xpToNext: 500,
          isHydrated: true,
        });
      }
    } catch (error) {
      console.error('[CompanionStore] hydrate failed', error);
      set({ isHydrated: true });
    }
  },

  addXP: async (amount: number) => {
    const { userId, xp } = get();
    if (!userId) return;
    const newXp = xp + amount;
    const newLevel = calculateLevel(newXp);
    const newRelationshipLevel = calculateRelationshipLevel(newXp);
    await companionLocalService.addXP(userId, amount);
    set({
      xp: newXp,
      level: newLevel,
      relationshipLevel: newRelationshipLevel,
      levelTitle: getLevelTitle(newLevel),
      xpToNext: xpToNextLevel(newLevel),
      lastActiveAt: new Date().toISOString(),
    });
  },

  addCoins: async (amount: number) => {
    const { userId, coins } = get();
    if (!userId) return;
    const newCoins = coins + amount;
    await companionLocalService.addCoins(userId, amount);
    set({ coins: newCoins });
  },

  spendCoins: async (amount: number): Promise<boolean> => {
    const { userId, coins } = get();
    if (!userId || coins < amount) return false;
    const newCoins = coins - amount;
    const db = (await import('../db/connection')).getDb();
    const { companionMetadata } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(companionMetadata).set({ coins: newCoins }).where(eq(companionMetadata.user_id, userId));
    set({ coins: newCoins });
    return true;
  },

  setOutfit: async (outfitId: string | null) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.upsertMetadata({
      user_id: userId,
      current_outfit_id: outfitId,
      updated_at: new Date().toISOString(),
    } as any);
    set({ currentOutfitId: outfitId });
  },

  updateMemory: async (key: string, value: unknown) => {
    const { userId, memory } = get();
    if (!userId) return;
    const updated = { ...memory, [key]: value };
    await companionLocalService.upsertMetadata({
      user_id: userId,
      memory: updated,
      updated_at: new Date().toISOString(),
    } as any);
    set({ memory: updated });
  },

  setSpeechPref: async (partial: Partial<SpeechPrefs>) => {
    const { userId, speakEnabled, speechVoiceId, speechRate, speechPitch, memory } = get();
    if (!userId) return;
    const next: SpeechPrefs = {
      enabled: partial.enabled ?? speakEnabled,
      voiceId: partial.voiceId !== undefined ? partial.voiceId : speechVoiceId,
      rate: partial.rate ?? speechRate,
      pitch: partial.pitch ?? speechPitch,
    };
    const updated = { ...memory, speech: next };
    await companionLocalService.upsertMetadata({
      user_id: userId,
      memory: updated,
      updated_at: new Date().toISOString(),
    } as any);
    set({
      memory: updated,
      speakEnabled: next.enabled,
      speechVoiceId: next.voiceId,
      speechRate: next.rate,
      speechPitch: next.pitch,
    });
  },

  setHidden: async (hidden: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.updateSetting(userId, 'is_hidden', hidden);
    set({ isHidden: hidden });
  },

  setReduceAnimations: async (reduce: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.updateSetting(userId, 'reduce_animations', reduce);
    set({ reduceAnimations: reduce });
  },

  setMuteSounds: async (mute: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await companionLocalService.updateSetting(userId, 'mute_sounds', mute);
    set({ muteSounds: mute });
  },

  setInstallStatus: (status: string) => {
    set({ installStatus: status });
  },

  setAssetsVersion: (version: string | null) => {
    set({ assetsVersion: version });
  },

  setLastSeen: (ts: number) => {
    set({ lastSeenAt: ts });
  },

  reset: () => {
    set({
      userId: null,
      xp: 0,
      coins: 0,
      level: 1,
      relationshipLevel: 1,
      lastSeenAt: null,
      currentOutfitId: null,
      ownedOutfits: [],
      memory: {},
      speakEnabled: false,
      speechVoiceId: null,
      speechRate: 1,
      speechPitch: 1,
      isHidden: false,
      reduceAnimations: false,
      muteSounds: false,
      installStatus: 'none',
      assetsVersion: null,
      lastActiveAt: null,
      levelTitle: 'Kitten',
      xpToNext: 500,
      isHydrated: false,
    });
  },
}));
