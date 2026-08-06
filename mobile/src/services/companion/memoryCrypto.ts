import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import { EncryptedStorage } from '../storage';
import { logger } from '../../utils';

/**
 * Value encryption for companion memory (luna2phase2 §1.3).
 *
 * Memory rows store a plaintext `key` + encrypted `value`. The per-user AES-256
 * key is generated once and kept in encrypted storage (`EncryptedStorage`, i.e.
 * expo-secure-store on native). Decryption happens in the service layer only —
 * nothing outside this module ever sees plaintext memory values.
 */

const KEY_STORAGE_PREFIX = 'shecare.luna.memory.key.';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return global.btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = global.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

class MemoryCrypto {
  private keyCache = new Map<string, AESEncryptionKey>();

  private storageKey(userId: string): string {
    return `${KEY_STORAGE_PREFIX}${userId}`;
  }

  private async getOrCreateKey(userId: string): Promise<AESEncryptionKey> {
    const cached = this.keyCache.get(userId);
    if (cached) return cached;

    const stored = await EncryptedStorage.getItem(this.storageKey(userId));
    if (stored) {
      const key = await AESEncryptionKey.import(stored, 'base64');
      this.keyCache.set(userId, key);
      return key;
    }

    const key = await AESEncryptionKey.generate(AESKeySize.AES256);
    const encoded = await key.encoded('base64');
    await EncryptedStorage.setItem(this.storageKey(userId), encoded);
    this.keyCache.set(userId, key);
    return key;
  }

  async encrypt(userId: string, plaintext: string): Promise<string> {
    const key = await this.getOrCreateKey(userId);
    const plaintextB64 = bytesToBase64(new TextEncoder().encode(plaintext));
    const sealed = await aesEncryptAsync(plaintextB64, key);
    return (await sealed.combined('base64')) as string;
  }

  async decrypt(userId: string, combinedB64: string): Promise<string | null> {
    try {
      const key = await this.getOrCreateKey(userId);
      const sealed = AESSealedData.fromCombined(combinedB64);
      const decrypted = (await aesDecryptAsync(sealed, key, {
        output: 'base64',
      })) as string;
      return new TextDecoder().decode(base64ToBytes(decrypted));
    } catch (error) {
      logger.warn('MemoryCrypto.decrypt failed — value treated as unreadable', error);
      return null;
    }
  }

  async clear(userId: string): Promise<void> {
    this.keyCache.delete(userId);
    try {
      await EncryptedStorage.removeItem(this.storageKey(userId));
    } catch {
      // ignore
    }
  }
}

export const memoryCrypto = new MemoryCrypto();
