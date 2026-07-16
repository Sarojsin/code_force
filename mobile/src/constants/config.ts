/**
 * Runtime config. Build-time values come from .env files; this file holds
 * the shapes and the development defaults.
 */

export const API_BASE_URL = 'http://192.168.0.103:8000/api/v1';
export const SOCKET_URL = 'ws://192.168.0.103:8000/ws';

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
