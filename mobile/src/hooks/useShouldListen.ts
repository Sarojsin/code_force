import { useIsFocused } from '@react-navigation/native';
import { useCompanionStore } from 'src/stores/companionStore';

/**
 * Home-screen-only active listening gate (luna plan Phase 0.6).
 *
 * Pure focus-based check — no global singleton. Listening is active ONLY when
 * the user opted into "Listen & Speak" AND the Home dashboard is the focused
 * route. Every other screen falls back to standard Tap-to-Speak.
 */
export function useShouldListen(): boolean {
  const listenAndSpeak = useCompanionStore((s) => s.listenAndSpeak);
  const isHomeFocused = useIsFocused();
  return listenAndSpeak === true && isHomeFocused === true;
}
