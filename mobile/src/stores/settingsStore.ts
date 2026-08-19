import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { EncryptedStorage } from 'src/services/storage';

export interface SettingsState {
  pushNotifications: boolean;
  periodReminders: boolean;
  lunaInsights: boolean;
  emailNotifications: boolean;
  smsAlerts: boolean;
  biometricLock: boolean;
  shareAnalytics: boolean;
  darkMode: boolean | null;
  offlineAI: boolean;
  autoUpdateModels: boolean;
}

export type SettingsKey = keyof SettingsState;

interface SettingsStore extends SettingsState {
  setSetting: <K extends SettingsKey>(key: K, value: SettingsState[K]) => void;
  toggleSetting: (key: SettingsKey) => void;
}

const initialSettings: SettingsState = {
  pushNotifications: true,
  periodReminders: true,
  lunaInsights: true,
  emailNotifications: false,
  smsAlerts: true,
  biometricLock: false,
  shareAnalytics: false,
  darkMode: null,
  offlineAI: true,
  autoUpdateModels: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...initialSettings,
      setSetting: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      toggleSetting: (key) =>
        set((state) => ({ [key]: !state[key] } as Partial<SettingsState>)),
    }),
    {
      name: 'user_preferences',
      storage: createJSONStorage(() => ({
        getItem: async (key) => {
          try {
            return await EncryptedStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: async (key, value) => {
          try {
            await EncryptedStorage.setItem(key, value);
          } catch {}
        },
        removeItem: async (key) => {
          try {
            await EncryptedStorage.removeItem(key);
          } catch {}
        },
      })),
    },
  ),
);