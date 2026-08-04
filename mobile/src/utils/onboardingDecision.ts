/**
 * Pure onboarding gate decision. Single source of truth for "should the onboarding
 * stack render?" Kept free of RN/zustand imports so it is trivially unit-testable.
 *
 * Golden rule: a fresh registration must NEVER land on the dashboard — unknown
 * server state defaults to "show onboarding".
 */

export interface StoredOnboardingFlag {
  isCompleted: boolean;
  userId: string | null;
}

/**
 * Decide whether to show the onboarding stack.
 *
 * - No current user            -> false (the auth stack handles this case upstream)
 * - Stored flag belongs to user -> trust its isCompleted
 * - Different/null user flag    -> trust the server flag; default to show onboarding
 *                                   when the server is unknown (safety).
 */
export function shouldShowOnboarding(
  storedFlag: StoredOnboardingFlag | null,
  currentUserId: string | null,
  serverFlag: boolean | null,
): boolean {
  if (!currentUserId) return false;
  if (storedFlag?.userId === currentUserId) return !storedFlag.isCompleted;
  return serverFlag !== true;
}