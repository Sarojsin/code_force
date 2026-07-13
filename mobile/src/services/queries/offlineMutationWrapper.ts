import * as Sentry from '@sentry/react-native';

const SENSITIVE_FIELDS = new Set([
  'content',
  'notes',
  'symptoms',
  'mood_tags',
  'flow_intensity',
  'body',
  'data',
]);

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function addOfflineBreadcrumb(type: string, data: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'offline.mutation',
    message: `Offline ${type} queued`,
    level: 'info',
    data: {
      type,
      ...sanitizeData(data),
    },
  });
}
