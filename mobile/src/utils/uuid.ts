import { randomUUID } from 'expo-crypto';

export function generateUUID(): string {
  return randomUUID();
}

export function generateId(): string {
  return randomUUID();
}
