import { speechRecognitionService } from '../speechRecognitionService';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

describe('speechRecognitionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // reset internal binding so bindNative re-registers listeners per test
    (speechRecognitionService as any)._listening = false;
    (speechRecognitionService as any).nativeBound = false;
    (speechRecognitionService as any).nativeSubscriptions = [];
  });

  afterEach(() => {
    // restore binding state so later tests start clean
    (speechRecognitionService as any)._listening = false;
    (speechRecognitionService as any).nativeBound = false;
  });

  it('reports availability through the native module', () => {
    (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(true);
    expect(speechRecognitionService.isAvailable()).toBe(true);

    (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(false);
    expect(speechRecognitionService.isAvailable()).toBe(false);
  });

  it('isAvailable() is resilient when the native call throws', () => {
    (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockImplementation(() => {
      throw new Error('native not linked');
    });
    expect(speechRecognitionService.isAvailable()).toBe(false);
  });

  it('requestPermissions resolves granted flag', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await expect(speechRecognitionService.requestPermissions()).resolves.toBe(true);

    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expect(speechRecognitionService.requestPermissions()).resolves.toBe(false);
  });

  it('requestPermissions is resilient when the native call rejects', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(speechRecognitionService.requestPermissions()).resolves.toBe(false);
  });

  it('start() calls the native module with defaults (one-shot, en-US)', () => {
    speechRecognitionService.start();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  });

  it('start() forwards continuous mode for Home always-on listening', () => {
    speechRecognitionService.start({ continuous: true });
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ continuous: true }),
    );
  });

  it('stop() / abort() delegate to the native module', () => {
    speechRecognitionService.stop();
    expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalled();

    speechRecognitionService.abort();
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
  });

  it('propagates transcripts to subscribers (interim + final)', () => {
    const cb = jest.fn();
    speechRecognitionService.onTranscript(cb);
    speechRecognitionService.start();

    const fire = (ExpoSpeechRecognitionModule as any).__fireEvent;
    const mockModule = ExpoSpeechRecognitionModule as any;

    // interim
    fire('result', { isFinal: false, results: [{ transcript: 'track my', confidence: 0.9 }] });
    expect(cb).toHaveBeenLastCalledWith({ transcript: 'track my', isFinal: false });

    // final
    mockModule.__fireEvent('result', { isFinal: true, results: [{ transcript: 'track my period', confidence: 0.9 }] });
    expect(cb).toHaveBeenLastCalledWith({ transcript: 'track my period', isFinal: true });
  });

  it('ignores result events with no transcript', () => {
    const cb = jest.fn();
    speechRecognitionService.onTranscript(cb);
    speechRecognitionService.start();

    (ExpoSpeechRecognitionModule as any).__fireEvent('result', { isFinal: true, results: [] });
    (ExpoSpeechRecognitionModule as any).__fireEvent('nomatch', null);
    expect(cb).not.toHaveBeenCalled();
  });

  it('tracks listening state and notifies subscribers on start/end', () => {
    const listener = jest.fn();
    const unsub = speechRecognitionService.onListeningChange(listener);
    speechRecognitionService.start();

    (ExpoSpeechRecognitionModule as any).__fireEvent('start', null);
    expect(speechRecognitionService.listening).toBe(true);

    (ExpoSpeechRecognitionModule as any).__fireEvent('end', null);
    expect(speechRecognitionService.listening).toBe(false);
    expect(listener).toHaveBeenCalledWith(true);
    expect(listener).toHaveBeenCalledWith(false);

    unsub();
  });

  it('emits mapped errors and resets listening state', () => {
    const errCb = jest.fn();
    speechRecognitionService.onError(errCb);
    speechRecognitionService.start();

    (ExpoSpeechRecognitionModule as any).__fireEvent('error', { error: 'not-allowed', message: 'denied' });
    expect(errCb).toHaveBeenCalledWith({ code: 'not-allowed', message: 'denied' });
    expect(speechRecognitionService.listening).toBe(false);
  });

  it('start() emits a client error when the native call throws', () => {
    const errCb = jest.fn();
    speechRecognitionService.onError(errCb);
    (ExpoSpeechRecognitionModule.start as jest.Mock).mockImplementation(() => {
      throw new Error('native failure');
    });

    speechRecognitionService.start();
    expect(errCb).toHaveBeenCalledWith({
      code: 'client',
      message: 'Failed to start speech recognition.',
    });
  });

  it('binds native listeners only once across repeated starts', () => {
    speechRecognitionService.start();
    speechRecognitionService.start();
    speechRecognitionService.start();
    expect((ExpoSpeechRecognitionModule.addListener as jest.Mock).mock.calls.length).toBe(4); // once per event type
  });

  it('unsubscribing removes transcript listeners', () => {
    const cb = jest.fn();
    const unsub = speechRecognitionService.onTranscript(cb);
    speechRecognitionService.start();
    unsub();

    (ExpoSpeechRecognitionModule as any).__fireEvent('result', { isFinal: true, results: [{ transcript: 'hello', confidence: 1 }] });
    expect(cb).not.toHaveBeenCalled();
  });
});