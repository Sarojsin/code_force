/**
 * Idle-scheduling helpers.
 * RN 0.86 ships global `requestIdleCallback`; fall back to a short timeout on
 * platforms/engines where it is missing (Hermes dev builds on Android).
 */

type IdleCallback = (deadline: { didTimeout: boolean }) => void;
type IdleOptions = { timeout?: number };

const FALLBACK_TIMEOUT_MS = 50;

export function requestIdleIdle(callback: () => void, timeoutMs: number = FALLBACK_TIMEOUT_MS): void {
  const g = globalThis as { requestIdleCallback?: (cb: IdleCallback, options?: IdleOptions) => void };
  if (typeof g.requestIdleCallback === 'function') {
    g.requestIdleCallback(() => callback(), { timeout: timeoutMs });
    return;
  }
  setTimeout(callback, timeoutMs);
}

export function idle(timeoutMs: number = FALLBACK_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => requestIdleIdle(resolve, timeoutMs));
}
