import { act, renderHook } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useLunaMicSession, LUNA_FALLBACK_REPLY, LUNA_NO_SPEECH_REPLY } from '../useLunaMicSession';
import { speechRecognitionService } from 'src/services/companion/speechRecognitionService';
import { voiceService } from 'src/services/companion/voiceService';
import { showBubble } from 'src/services/companion/EventEngine';

jest.mock('src/services/companion/EventEngine', () => ({
  showBubble: jest.fn(),
}));

jest.mock('src/services/companion/voiceService', () => ({
  voiceService: {
    stop: jest.fn(),
    isEnabled: jest.fn(() => false),
    onSpeaking: jest.fn(() => () => {}),
  },
}));

const fire = (event: string, payload: unknown) => {
  (ExpoSpeechRecognitionModule as any).__fireEvent(event, payload);
};

const mockCard = {
  title: 'Heat + gentle stretch',
  body: 'Place a heat pack on your lower abdomen.',
  cta: 'Log water intake',
};

const resetService = () => {
  (speechRecognitionService as any)._listening = false;
  (speechRecognitionService as any).nativeBound = false;
  (speechRecognitionService as any).nativeSubscriptions = [];
  (ExpoSpeechRecognitionModule.addListener as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.start as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.stop as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (showBubble as jest.Mock).mockClear();
  (voiceService.stop as jest.Mock).mockClear();
};

beforeEach(() => {
  resetService();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLunaMicSession', () => {
  it('stops TTS before listening and runs a one-shot session', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
    });
    expect(voiceService.stop).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ continuous: false, interimResults: true }),
    );
    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      fire('start', null);
    });
    expect(result.current.isListening).toBe(true);
    expect(result.current.isProcessing).toBe(false);
  });

  it('transcribes a final keyword into the card reply bubble', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      fire('start', null);
    });
    expect(result.current.isListening).toBe(true);

    await act(async () => {
      fire('result', { isFinal: true, results: [{ transcript: "What's today's tip?" }] });
    });
    await act(async () => {
      fire('end', null);
    });
    expect(showBubble).toHaveBeenCalledWith(`${mockCard.title}: ${mockCard.body} ${mockCard.cta}`, 'happy', 5000);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
  });

  it('falls back to the gentle bubble for non-keyword speech', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      fire('result', { isFinal: true, results: [{ transcript: 'the sky is blue' }] });
    });
    expect(showBubble).toHaveBeenCalledWith(LUNA_FALLBACK_REPLY, 'idle', 5000);
  });

  it('shows the no-speech bubble when the session ends without a final transcript', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      fire('start', null);
    });
    expect(result.current.isListening).toBe(true);

    await act(async () => {
      fire('end', null);
    });
    expect(showBubble).toHaveBeenCalledWith(LUNA_NO_SPEECH_REPLY, 'idle', 3000);
    expect(result.current.isListening).toBe(false);
  });

  it('closes the mic on the 10s safety timeout with no speech', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    expect(showBubble).toHaveBeenCalledWith(LUNA_NO_SPEECH_REPLY, 'idle', 3000);
    expect(result.current.isProcessing).toBe(false);
  });

  it('a tap while listening stops the session (toggle-off)', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      fire('start', null);
    });
    expect(result.current.isListening).toBe(true);

    await act(async () => {
      await result.current.start();
    });
    expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);

    await act(async () => {
      fire('end', null);
    });
    expect(result.current.isListening).toBe(false);
  });

  it('a tap while processing is ignored (no duplicate session)', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      await result.current.start();
    });
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
  });

  it('closes the session silently when permission is denied', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
    });
    expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
    expect(result.current.isProcessing).toBe(false);
    expect(showBubble).not.toHaveBeenCalled();
  });

  it('recovers on error without showing a fallback bubble', async () => {
    const { result } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      fire('start', null);
    });

    await act(async () => {
      fire('error', { error: 'network', message: 'unavailable' });
    });
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(showBubble).not.toHaveBeenCalled();
  });

  it('unmount teardown stops an active session', async () => {
    const { result, unmount } = renderHook(() => useLunaMicSession(mockCard));
    await act(async () => {
      await result.current.start();
      fire('start', null);
    });
    expect(result.current.isListening).toBe(true);

    unmount();
    expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalled();
  });
});