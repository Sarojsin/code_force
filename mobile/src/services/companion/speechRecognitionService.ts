import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';

/**
 * Opt-in STT ("talk to Luna", luna plan Phase 7b/8). Wraps
 * `expo-speech-recognition` — iOS `SFSpeechRecognizer`, Android
 * `SpeechRecognizer`, Web `SpeechRecognition` — behind a tiny subscription
 * API that mirrors `voiceService`. Permissions are requested at the moment of
 * use (never at app start). Recognition stays a one-shot session by default;
 * continuous mode (Home always-on listening) is opt-in per call.
 */

export interface SpeechTranscript {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechError {
  code: string;
  message: string;
}

type TranscriptListener = (result: SpeechTranscript) => void;
type StateListener = (listening: boolean) => void;
type ErrorListener = (error: SpeechError) => void;

const RECOGNITION_LANG = 'en-US';

class SpeechRecognitionService {
  private transcriptListeners = new Set<TranscriptListener>();
  private stateListeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private nativeSubscriptions: { remove: () => void }[] = [];
  private _listening = false;
  private nativeBound = false;

  get listening(): boolean {
    return this._listening;
  }

  isAvailable(): boolean {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  /** Requests mic + recognition permission at the moment of use. */
  async requestPermissions(): Promise<boolean> {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    } catch {
      return false;
    }
  }

  /** One-shot session; `continuous` enables always-on Home listening. */
  start(options: { continuous?: boolean; lang?: string } = {}): void {
    this.bindNative();
    const opts: ExpoSpeechRecognitionOptions = {
      lang: options.lang ?? RECOGNITION_LANG,
      interimResults: true,
      continuous: options.continuous ?? false,
      maxAlternatives: 1,
    };
    try {
      ExpoSpeechRecognitionModule.start(opts);
    } catch {
      this.emitError({ code: 'client', message: 'Failed to start speech recognition.' });
    }
  }

  stop(): void {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore — recognizer may already be stopped
    }
  }

  abort(): void {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
  }

  /** Removes native event subscriptions (used on teardown, e.g. tests). */
  dispose(): void {
    this.nativeSubscriptions.forEach((sub) => sub.remove());
    this.nativeSubscriptions = [];
    this.nativeBound = false;
    this.setListening(false);
  }

  onTranscript(cb: TranscriptListener): () => void {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  onListeningChange(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  private setListening(value: boolean): void {
    if (this._listening === value) {
      return;
    }
    this._listening = value;
    this.stateListeners.forEach((cb) => cb(value));
  }

  private emitTranscript(result: SpeechTranscript): void {
    this.transcriptListeners.forEach((cb) => cb(result));
  }

  private emitError(error: SpeechError): void {
    this.errorListeners.forEach((cb) => cb(error));
  }

  /** Registers the native event bridge exactly once. */
  private bindNative(): void {
    if (this.nativeBound) {
      return;
    }
    this.nativeBound = true;
    this.nativeSubscriptions = [
      ExpoSpeechRecognitionModule.addListener('start', () => this.setListening(true)),
      ExpoSpeechRecognitionModule.addListener('end', () => this.setListening(false)),
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const first = event?.results?.[0];
        if (!first?.transcript) {
          return;
        }
        this.emitTranscript({ transcript: first.transcript, isFinal: event.isFinal });
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
        this.setListening(false);
        this.emitError({
          code: event.error,
          message: event.message || event.error,
        });
      }),
    ];
  }
}

export const speechRecognitionService = new SpeechRecognitionService();