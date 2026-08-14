import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { showBubble } from 'src/services/companion/EventEngine';
import { voiceService } from 'src/services/companion/voiceService';
import { matchesInsightKeyword, buildInsightReply } from 'src/utils/lunaReply';

/**
 * Tap-to-speak session engine (luna plan: luna_voice_listen_plan.md §5).
 *
 * There is NO passive/always-on listening. Every session is explicitly started
 * by the user tapping the mic halo on Luna and auto-closes after a final
 * transcript, a silence "end", an error, or a 10 s safety timeout. Permissions
 * are requested at the first tap, never at toggle-on or app start.
 *
 * Session rules (sanity checks, locked):
 * - Luna's own TTS is never transcribed: `voiceService.stop()` runs before the
 *   recognizer starts and again when the session ends.
 * - Only one session is active at a time. A tap while listening stops it
 *   (toggle-off); a tap while processing is ignored.
 * - No-keyword speech gets the gentle fallback bubble; silence gets the
 *   no-speech bubble; errors close the mic silently.
 */
export interface LunaMicCard {
  title: string;
  body: string;
  cta?: string | null;
}

const SESSION_TIMEOUT_MS = 10000;

export const LUNA_FALLBACK_REPLY = "I heard you 💕 Ask me about your period, mood, sleep, or today's tip!";
export const LUNA_NO_SPEECH_REPLY = "I didn't catch that — tap the mic and try again.";

export interface LunaMicSession {
  isListening: boolean;
  isProcessing: boolean;
  /** Starts a tap-to-speak session; a tap while listening stops it early. */
  start: () => Promise<void>;
  /** Explicit early stop (external, e.g. halo re-tap while processing). */
  stop: () => void;
}

export function useLunaMicSession(card: LunaMicCard | null): LunaMicSession {
  const sessionRef = useRef(false);
  const finalHandledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    isListening,
    error,
    start: beginRecognition,
    stop: stopRecognition,
    abort,
  } = useSpeechRecognition({
    onResult: (result) => {
      if (!sessionRef.current || !result.isFinal || !result.transcript.trim()) {
        return;
      }
      if (finalHandledRef.current) {
        return;
      }
      finalHandledRef.current = true;
      clearSessionTimer();
      const text = result.transcript.trim().toLowerCase();
      const reply = matchesInsightKeyword(text) ? buildInsightReply(card) : null;
      showBubble(reply ?? LUNA_FALLBACK_REPLY, reply ? 'happy' : 'idle', 5000);
      stopRecognition();
      closeSession();
    },
  });

  const clearSessionTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeSession = useCallback(() => {
    sessionRef.current = false;
    finalHandledRef.current = false;
    clearSessionTimer();
    setIsProcessing(false);
  }, [clearSessionTimer]);

  const armSessionTimer = useCallback(() => {
    clearSessionTimer();
    timerRef.current = setTimeout(() => {
      if (!sessionRef.current) {
        return;
      }
      if (finalHandledRef.current) {
        closeSession();
        return;
      }
      // Safety auto-stop: never let the mic stay open beyond the window.
      abort();
      closeSession();
      showBubble(LUNA_NO_SPEECH_REPLY, 'idle', 3000);
    }, SESSION_TIMEOUT_MS);
  }, [abort, closeSession, clearSessionTimer]);

  const start = useCallback(async () => {
    if (sessionRef.current) {
      // Overlapping sessions: a tap while listening is toggle-off; a tap while
      // processing is ignored.
      if (isListening) {
        stopRecognition();
        closeSession();
      }
      return;
    }
    // TTS guard (sanity check #1): never transcribe Luna's own speech.
    voiceService.stop();
    sessionRef.current = true;
    finalHandledRef.current = false;
    setIsProcessing(true);
    armSessionTimer();
    const ok = await beginRecognition({ continuous: false });
    if (!ok) {
      closeSession();
    }
  }, [isListening, beginRecognition, stopRecognition, armSessionTimer, closeSession]);

  const stop = useCallback(() => {
    if (!sessionRef.current) {
      return;
    }
    stopRecognition();
    closeSession();
  }, [stopRecognition, closeSession]);

  // Spinner ends once the recognizer is actually listening.
  useEffect(() => {
    if (isListening) {
      setIsProcessing(false);
    }
  }, [isListening]);

  // Silence / "end" before a final transcript → no-speech bubble.
  const prevListeningRef = useRef(isListening);
  useEffect(() => {
    const wasListening = prevListeningRef.current;
    prevListeningRef.current = isListening;
    if (!sessionRef.current || !wasListening || isListening) {
      return;
    }
    if (finalHandledRef.current || error) {
      closeSession();
      return;
    }
    closeSession();
    showBubble(LUNA_NO_SPEECH_REPLY, 'idle', 3000);
  }, [isListening, error, closeSession]);

  // Unmount teardown: never leave the mic or timers behind.
  useEffect(() => {
    return () => {
      clearSessionTimer();
      if (sessionRef.current) {
        stopRecognition();
      }
    };
  }, [clearSessionTimer, stopRecognition]);

  return { isListening, isProcessing, start, stop };
}
