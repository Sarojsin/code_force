/**
 * Runtime config. Build-time values come from .env files; this file holds
 * the shapes and the development defaults.
 */

const ROOT = (process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.101:8000').replace(/\/+$/, '');
export const API_BASE_URL = `${ROOT}/api/v1`;
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
