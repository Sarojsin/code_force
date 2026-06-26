import { Platform } from 'react-native';

let EncryptedStorage: any = null;

if (Platform.OS === 'web') {
  class WebStorage {
    static async getItem(key: string): Promise<string | null> {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    static async setItem(key: string, value: string): Promise<void> {
      try {
        localStorage.setItem(key, value);
      } catch {}
    }
    static async removeItem(key: string): Promise<void> {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    static async clear(): Promise<void> {
      try {
        localStorage.clear();
      } catch {}
    }
  }
  EncryptedStorage = WebStorage;
} else {
  try {
    const ES = require('react-native-encrypted-storage').default;
    if (ES && ES.getItem) {
      EncryptedStorage = ES;
    } else {
      throw new Error('Invalid EncryptedStorage');
    }
  } catch {
    class FallbackStorage {
      static async getItem(): Promise<string | null> {
        return null;
      }
      static async setItem(): Promise<void> {}
      static async removeItem(): Promise<void> {}
      static async clear(): Promise<void> {}
    }
    EncryptedStorage = FallbackStorage;
  }
}

export { EncryptedStorage };
