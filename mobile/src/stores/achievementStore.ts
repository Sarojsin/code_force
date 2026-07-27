import { create } from 'zustand';
import type { Achievement } from '../services/companion/AchievementEngine';

interface AchievementStoreState {
  currentPopup: Achievement | null;
  showPopup: (achievement: Achievement) => void;
  dismissPopup: () => void;
}

export const useAchievementStore = create<AchievementStoreState>((set) => ({
  currentPopup: null,

  showPopup: (achievement: Achievement) => {
    set({ currentPopup: achievement });
  },

  dismissPopup: () => {
    set({ currentPopup: null });
  },
}));
