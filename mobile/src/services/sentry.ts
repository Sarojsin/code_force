import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import { EncryptedStorage } from 'src/services/storage';
import { logger } from 'src/utils';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const CONSENT_KEY = 'shecare_sentry_consent';

export async function hasSentryConsent(): Promise<boolean> {
  try {
    const val = await EncryptedStorage.getItem(CONSENT_KEY);
    return val === 'granted';
  } catch {
    return false;
  }
}

export async function setSentryConsent(granted: boolean): Promise<void> {
  try {
    if (granted) {
      await EncryptedStorage.setItem(CONSENT_KEY, 'granted');
    } else {
      await EncryptedStorage.removeItem(CONSENT_KEY);
    }
  } catch {}
}

export async function initSentry(): Promise<void> {
  if (!SENTRY_DSN) {
    logger.info('Sentry: DSN not configured, skipping init');
    return;
  }
  if (isRunningInExpoGo()) {
    logger.info('Sentry: skipping init in Expo Go');
    return;
  }
  const consented = await hasSentryConsent();
  if (!consented) {
    logger.info('Sentry: user consent not granted, skipping init');
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      const scrubbed = { ...event };
      if (scrubbed.request?.data) {
        delete scrubbed.request.data;
      }
      if (scrubbed.user) {
        scrubbed.user = {};
        scrubbed.user.id = event.user?.id;
      }
      return scrubbed;
    },
  });
  logger.info('Sentry: initialized');
}
