/**
 * Runtime config. Build-time values come from .env files; this file holds
 * the shapes and the development defaults.
 *
 * For development, set EXPO_PUBLIC_API_URL in .env to your machine's LAN IP
 * to test on a physical device (e.g. EXPO_PUBLIC_API_URL=http://192.168.0.103:8000).
 * On web (same machine), localhost works automatically.
 */

import { Platform } from 'react-native';

const DEFAULT_HOST = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : 'http://192.168.0.103:8000';
const ROOT = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_HOST).replace(/\/+$/, '');
export const API_BASE_URL = `${ROOT}/api/v1`;
console.log('[config] Platform.OS:', Platform.OS, 'ROOT:', ROOT, 'API_BASE_URL:', API_BASE_URL);
export const SOCKET_URL = ROOT.replace(/^http/, 'ws') + '/ws';

// Feature flags (plan 35). Mobile reads these on launch.
export interface FeatureFlags {
  voiceJournal: boolean;
  pregnancyMode: boolean;
  aiSentiment: boolean;
  familyLinking: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  voiceJournal: false,
  pregnancyMode: true,
  aiSentiment: true,
  familyLinking: true,
};
