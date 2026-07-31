import { create } from 'zustand';
import { diaryAssetLocalService } from '../services/localDb';

interface DiaryAssetState {
  userId: string | null;
  installStatus: string;
  assetsVersion: string | null;
  isHydrated: boolean;

  hydrate: (userId: string) => Promise<void>;
  setInstallStatus: (status: string) => void;
  setAssetsVersion: (version: string | null) => void;
  reset: () => void;
}

export const useDiaryAssetStore = create<DiaryAssetState>((set) => ({
  userId: null,
  installStatus: 'none',
  assetsVersion: null,
  isHydrated: false,

  hydrate: async (userId: string) => {
    try {
      const result = await diaryAssetLocalService.getInstallStatus(userId);
      if (result) {
        set({
          userId,
          installStatus: result.status,
          assetsVersion: result.version,
          isHydrated: true,
        });
      } else {
        set({ userId, installStatus: 'none', assetsVersion: null, isHydrated: true });
      }
    } catch (error) {
      console.error('[DiaryAssetStore] hydrate failed', error);
      set({ isHydrated: true });
    }
  },

  setInstallStatus: (status: string) => {
    set({ installStatus: status });
  },

  setAssetsVersion: (version: string | null) => {
    set({ assetsVersion: version });
  },

  reset: () => {
    set({
      userId: null,
      installStatus: 'none',
      assetsVersion: null,
      isHydrated: false,
    });
  },
}));
