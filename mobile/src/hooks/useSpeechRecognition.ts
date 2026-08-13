import { useCallback, useEffect, useRef, useState } from 'react';
import { speechRecognitionService } from 'src/services/companion/speechRecognitionService';
import type { SpeechError, SpeechTranscript } from 'src/services/companion/speechRecognitionService';

/**
 * React binding for `speechRecognitionService` (luna plan Phase 7b/8).
 *
 * Keeps `isListening` / `lastTranscript` / `error` in component state and
 * exposes `start` / `stop` / `abort` for the chat mic and Home always-on
 * listening. Permissions are requested inside `start`, at the moment of use.
 */
export interface UseSpeechRecognitionOptions {
  /** Called for EVERY result (interim + final). */
  onResult?: (result: SpeechTranscript) => void;
}

export function useSpeechRecognition(
  options?: UseSpeechRecognitionOptions,
): {
  isListening: boolean;
  isAvailable: boolean;
  lastTranscript: string;
  error: SpeechError | null;
  start: (options?: { continuous?: boolean }) => Promise<boolean>;
  stop: () => void;
  abort: () => void;
} {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    setIsAvailable(speechRecognitionService.isAvailable());
    const unsubState = speechRecognitionService.onListeningChange(setIsListening);
    const unsubTranscript = speechRecognitionService.onTranscript((result: SpeechTranscript) => {
      setLastTranscript(result.transcript);
      setError(null);
      optionsRef.current?.onResult?.(result);
    });
    const unsubError = speechRecognitionService.onError(setError);
    return () => {
      unsubState();
      unsubTranscript();
      unsubError();
    };
  }, []);

  const start = useCallback(async (startOptions?: { continuous?: boolean }): Promise<boolean> => {
    if (!speechRecognitionService.isAvailable()) {
      setError({ code: 'service-not-allowed', message: 'Speech recognition is not available on this device.' });
      return false;
    }
    const granted = await speechRecognitionService.requestPermissions();
    if (!granted) {
      setError({ code: 'not-allowed', message: 'Microphone permission is required to talk to Luna.' });
      return false;
    }
    setLastTranscript('');
    setError(null);
    speechRecognitionService.start(startOptions);
    return true;
  }, []);

  const stop = useCallback(() => speechRecognitionService.stop(), []);
  const abort = useCallback(() => speechRecognitionService.abort(), []);

  return { isListening, isAvailable, lastTranscript, error, start, stop, abort };
}