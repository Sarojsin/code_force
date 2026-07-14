import { Platform } from 'react-native';

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

let EncryptedStorage: StorageAdapter;

if (Platform.OS === 'web') {
  EncryptedStorage = {
    async getItem(key: string): Promise<string | null> {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    async removeItem(key: string): Promise<void> {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
    async clear(): Promise<void> {
      localStorage.clear();
    },
  };
} else {
  try {
    const SecureStore = require('expo-secure-store');
    EncryptedStorage = {
      async getItem(key: string): Promise<string | null> {
        return SecureStore.getItemAsync(key);
      },
      async setItem(key: string, value: string): Promise<void> {
        await SecureStore.setItemAsync(key, value);
      },
      async removeItem(key: string): Promise<void> {
        await SecureStore.deleteItemAsync(key);
      },
      async clear(): Promise<void> {
      },
    };
  } catch {
    EncryptedStorage = {
      async getItem(): Promise<string | null> { return null; },
      async setItem(): Promise<void> {},
      async removeItem(): Promise<void> {},
      async clear(): Promise<void> {},
    };
  }
}

export { EncryptedStorage };
