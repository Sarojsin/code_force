import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'shecare_pregnancy_mode';

interface PregnancyModeState {
  isActive: boolean;
  currentWeek: number;
  dueDate: string | null;
  enable: () => void;
  disable: () => void;
  setWeek: (week: number) => void;
  setDueDate: (date: string) => void;
  hydrate: () => Promise<void>;
}

export const usePregnancyModeStore = create<PregnancyModeState>((set, get) => ({
  isActive: false,
  currentWeek: 14,
  dueDate: null,

  enable: () => {
    set({ isActive: true });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), isActive: true }));
  },

  disable: () => {
    set({ isActive: false });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), isActive: false }));
  },

  setWeek: (week: number) => {
    set({ currentWeek: week });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), currentWeek: week }));
  },

  setDueDate: (date: string) => {
    set({ dueDate: date });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), dueDate: date }));
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          isActive: parsed.isActive ?? false,
          currentWeek: parsed.currentWeek ?? 14,
          dueDate: parsed.dueDate ?? null,
        });
      }
    } catch {
      // Silently fail — defaults are fine
    }
  },
}));
