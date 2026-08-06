// voiceService.test.ts — deterministic voice resolution + TTS gating (luna2phase3)

const mockState: {
  userId: string;
  speakEnabled: boolean;
  muteSounds: boolean;
  speechVoiceId: string | null;
  speechRate: number;
  speechPitch: number;
  setSpeechPref: (partial: any) => Promise<void>;
} = {
  userId: 'voice-test-user',
  speakEnabled: false,
  muteSounds: false,
  speechVoiceId: null,
  speechRate: 1,
  speechPitch: 1,
  setSpeechPref: async (partial: any) => {
    if (partial.enabled !== undefined) mockState.speakEnabled = partial.enabled;
    if (partial.voiceId !== undefined) mockState.speechVoiceId = partial.voiceId;
    if (partial.rate !== undefined) mockState.speechRate = partial.rate;
    if (partial.pitch !== undefined) mockState.speechPitch = partial.pitch;
  },
};

jest.mock('../../stores/companionStore', () => ({
  useCompanionStore: { getState: () => mockState },
}));

import * as Speech from 'expo-speech';
import {
  voiceService,
  resolveVoice,
  type VoiceCandidate,
} from '../../services/companion/voiceService';

const speakMock = Speech.speak as jest.Mock;
const stopMock = Speech.stop as jest.Mock;
const getVoicesMock = Speech.getAvailableVoicesAsync as jest.Mock;

const VOICES: VoiceCandidate[] = [
  { identifier: 'fiona', name: 'Fiona (Enhanced)', quality: 'Enhanced', language: 'en-US' },
  { identifier: 'alex', name: 'Alex', quality: 'Enhanced', language: 'en-US' },
  { identifier: 'samantha', name: 'Samantha', quality: 'Default', language: 'en-US' },
];

function resetMockState() {
  mockState.speakEnabled = false;
  mockState.muteSounds = false;
  mockState.speechVoiceId = null;
  mockState.speechRate = 1;
  mockState.speechPitch = 1;
}

describe('resolveVoice (deterministic selection)', () => {
  it('returns undefined for no voices', () => {
    expect(resolveVoice([])).toBeUndefined();
    expect(resolveVoice(undefined as unknown as VoiceCandidate[])).toBeUndefined();
  });

  it('prefers enhanced quality over default', () => {
    const voices: VoiceCandidate[] = [
      { identifier: 'sam', name: 'Samantha', quality: 'Default', language: 'en-US' },
      { identifier: 'alex', name: 'Alex', quality: 'Enhanced', language: 'en-US' },
    ];
    expect(resolveVoice(voices)?.identifier).toBe('alex');
  });

  it('prefers a female voice within the same quality tier', () => {
    const voices: VoiceCandidate[] = [
      { identifier: 'alex', name: 'Male (Alex)', quality: 'Enhanced', language: 'en-US' },
      { identifier: 'fiona', name: 'Female (Fiona)', quality: 'Enhanced', language: 'en-US' },
    ];
    expect(resolveVoice(voices)?.identifier).toBe('fiona');
  });

  it('breaks quality+gender ties by lower index for cross-session stability', () => {
    const voices: VoiceCandidate[] = [
      { identifier: 'a', name: 'Generic Voice', quality: 'Default', language: 'en-US' },
      { identifier: 'b', name: 'Generic Voice', quality: 'Default', language: 'en-US' },
    ];
    expect(resolveVoice(voices)?.identifier).toBe('a');
  });

  it('is stable under equal-quality re-sorting (no mutation of input order effects)', () => {
    const voices: VoiceCandidate[] = [
      { identifier: 'x', name: 'Beta', quality: 'Default', language: 'en-US' },
      { identifier: 'y', name: 'Alpha', quality: 'Default', language: 'en-US' },
    ];
    expect(resolveVoice(voices)?.identifier).toBe('x');
    expect(resolveVoice([...voices].reverse())?.identifier).toBe('y');
  });
});

describe('voiceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockState();
    getVoicesMock.mockResolvedValue(VOICES);
  });

  afterEach(() => {
    resetMockState();
  });

  describe('isEnabled', () => {
    it('is off by default', () => {
      expect(voiceService.isEnabled()).toBe(false);
    });

    it('is on only when speakEnabled and not muted', async () => {
      await voiceService.setEnabled(true);
      expect(voiceService.isEnabled()).toBe(true);
      mockState.muteSounds = true;
      expect(voiceService.isEnabled()).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('enabling resolves + persists a deterministic voice', async () => {
      await voiceService.setEnabled(true);
      expect(mockState.speakEnabled).toBe(true);
      expect(mockState.speechVoiceId).toBe('fiona');
      expect(getVoicesMock).toHaveBeenCalled();
    });

    it('disabling stops any active speech', async () => {
      await voiceService.setEnabled(false);
      expect(mockState.speakEnabled).toBe(false);
      expect(stopMock).toHaveBeenCalled();
    });
  });

  describe('speak', () => {
    it('is a no-op when disabled', async () => {
      await voiceService.speak('Hello');
      expect(speakMock).not.toHaveBeenCalled();
      expect(stopMock).not.toHaveBeenCalled();
    });

    it('stops the previous utterance before starting', async () => {
      await voiceService.setEnabled(true);
      stopMock.mockClear();
      await voiceService.speak('First');
      expect(stopMock).toHaveBeenCalled();
      expect(speakMock).toHaveBeenCalledTimes(1);
    });

    it('passes the persisted voice + store rate/pitch', async () => {
      mockState.speechVoiceId = 'fiona';
      mockState.speechRate = 1.2;
      mockState.speechPitch = 0.9;
      await voiceService.setEnabled(true);
      await voiceService.speak('Hello there');
      const opts = speakMock.mock.calls[0][1];
      expect(opts.voice).toBe('fiona');
      expect(opts.rate).toBe(1.2);
      expect(opts.pitch).toBe(0.9);
    });

    it('honors per-call rate/pitch overrides', async () => {
      mockState.speechVoiceId = 'fiona';
      await voiceService.setEnabled(true);
      await voiceService.speak('Hello', { rate: 2, pitch: 0.5 });
      const opts = speakMock.mock.calls[0][1];
      expect(opts.rate).toBe(2);
      expect(opts.pitch).toBe(0.5);
    });

    it('emits onSpeaking true on start and false on done', async () => {
      mockState.speechVoiceId = 'fiona';
      await voiceService.setEnabled(true);
      const seen: boolean[] = [];
      const unsubscribe = voiceService.onSpeaking((v) => seen.push(v));
      await voiceService.speak('Hello');
      const opts = speakMock.mock.calls[0][1];
      opts.onStart();
      opts.onDone();
      expect(seen).toEqual([false, true, false]);
      unsubscribe();
    });

    it('calls the caller onDone callback', async () => {
      mockState.speechVoiceId = 'fiona';
      await voiceService.setEnabled(true);
      const onDone = jest.fn();
      await voiceService.speak('Hello', { onDone });
      speakMock.mock.calls[0][1].onDone();
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('emits false + resolves even when speak throws', async () => {
      mockState.speechVoiceId = 'fiona';
      await voiceService.setEnabled(true);
      speakMock.mockImplementationOnce(() => {
        throw new Error('tts unavailable');
      });
      const seen: boolean[] = [];
      const unsubscribe = voiceService.onSpeaking((v) => seen.push(v));
      const onDone = jest.fn();
      await voiceService.speak('Hello', { onDone });
      expect(seen).toEqual([false, false]);
      expect(onDone).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });

  describe('resolveVoiceId', () => {
    it('reuses the persisted id while it still exists', async () => {
      mockState.speechVoiceId = 'alex';
      const result = await voiceService.resolveVoiceId();
      expect(result).toBe('alex');
      expect(getVoicesMock).toHaveBeenCalled();
    });

    it('re-resolves and persists when the persisted id disappears', async () => {
      mockState.speechVoiceId = 'gone';
      const result = await voiceService.resolveVoiceId();
      expect(result).toBe('fiona');
      expect(mockState.speechVoiceId).toBe('fiona');
    });

    it('falls back to the persisted id when voice listing throws', async () => {
      mockState.speechVoiceId = 'alex';
      getVoicesMock.mockRejectedValueOnce(new Error('no speech service'));
      const result = await voiceService.resolveVoiceId();
      expect(result).toBe('alex');
    });
  });

  describe('stop', () => {
    it('emits speaking false and calls native stop', () => {
      const seen: boolean[] = [];
      const unsubscribe = voiceService.onSpeaking((v) => seen.push(v));
      voiceService.stop();
      expect(stopMock).toHaveBeenCalled();
      expect(seen).toEqual([false]);
      unsubscribe();
    });
  });
});
