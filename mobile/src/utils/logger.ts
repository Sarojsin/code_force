/**
 * Safe wrapper around console that scrubs sensitive fields.
 * Rule §14.4: never log journal content, GPS, PII.
 */

const SCRUB_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'phone',
  'phone_number',
  'content', // journal
  'notes', // medical
  'medical_notes',
  'latitude',
  'longitude',
  'lat',
  'lng',
]);

function scrub(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SCRUB_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrub(v);
    }
  }
  return out;
}

const isDev = __DEV__;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(...args.map(scrub));
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(...args.map(scrub));
    }
  },
  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(...args.map(scrub));
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(...args.map(scrub));
  },
};
