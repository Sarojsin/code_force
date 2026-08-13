import { useEffect, useRef } from 'react';
import { useShouldListen } from './useShouldListen';
import { useTodayRecommendation } from './useTodayRecommendation';
import { useSpeechRecognition } from './useSpeechRecognition';
import { showBubble } from 'src/services/companion/EventEngine';
import { voiceService } from 'src/services/companion/voiceService';
import { useCompanionStore } from 'src/stores/companionStore';
import { matchesInsightKeyword, buildInsightReply } from 'src/utils/lunaReply';

/**
 * Home always-on listening (luna plan Phase 7b). When the "Listen & Speak"
 * toggle is ON and the Home dashboard is focused, continuous speech
 * recognition feeds every final transcript through the SAME keyword branch as
 * typed chat input and shows Luna's reply as a bubble.
 *
 * Feedback guard: Luna's own spoken reply (TTS) is never transcribed — the
 * recognizer is paused while `voiceService` is speaking and resumes after.
 */
export function useHomeAlwaysListening(): void {
  const shouldListen = useShouldListen();
  const installStatus = useCompanionStore((s) => s.installStatus);
  const { card } = useTodayRecommendation();

  const { start, abort } = useSpeechRecognition({
    onResult: (result) => {
      if (!result.isFinal || !result.transcript.trim()) {
        return;
      }
      const text = result.transcript.trim().toLowerCase();
      const reply = matchesInsightKeyword(text) ? buildInsightReply(card) : null;
      if (reply) {
        showBubble(reply, 'happy', 5000);
      } else {
        showBubble("I heard you 💕 Ask me about your period, mood, sleep, or today's tip!", 'idle', 3000);
      }
    },
  });

  const shouldListenRef = useRef(shouldListen);
  shouldListenRef.current = shouldListen;

  // Pause recognition while Luna is speaking to avoid a feedback loop.
  useEffect(() => {
    const unsub = voiceService.onSpeaking((speaking) => {
      if (!shouldListenRef.current) {
        return;
      }
      if (speaking) {
        abort();
      } else {
        start({ continuous: true }).catch(() => {});
      }
    });
    return unsub;
  }, [abort, start]);

  // Start continuous listening when the gate opens; stop when it closes.
  useEffect(() => {
    if (!shouldListen || installStatus !== 'ready') {
      abort();
      return;
    }
    start({ continuous: true }).catch(() => {});
    return () => abort();
  }, [shouldListen, installStatus, start, abort]);
}

/** Mount-point used by HomeDashboardScreen — only rendered when Luna is ready. */
export function HomeAlwaysListening(): null {
  useHomeAlwaysListening();
  return null;
}