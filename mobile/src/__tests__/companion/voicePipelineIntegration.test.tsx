// voicePipelineIntegration.test.tsx — TTS prefs persistence + bubble hold pipeline (luna2phase3)

const encryptedStore: Record<string, string> = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => '{}'),
}));

jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(async (key: string) => encryptedStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      encryptedStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete encryptedStore[key];
    }),
    clear: jest.fn(async () => {
      Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
    }),
  },
}));

import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { companionMetadata } from '../../db/schema';
import { useCompanionStore } from '../../stores/companionStore';
import { voiceService, resolveVoice } from '../../services/companion/voiceService';
import { useSpeechBubble } from '../../services/companion/EventEngine';

const USER = 'voice-pipe-user';

const ENHANCED_FEMALE_VOICE = 'enhanced-female';

function Harness() {
  const { current, show, dismiss } = useSpeechBubble();
  return (
    <View>
      <Text testID="bubble">{current ? current.text : 'none'}</Text>
      <Pressable testID="show" onPress={() => show('Hello there', 'wave', 3000)} />
      <Pressable testID="dismiss" onPress={dismiss} />
    </View>
  );
}

async function cleanup() {
  const db = getDb();
  await db.delete(companionMetadata).where(eq(companionMetadata.user_id, USER));
  Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
  useCompanionStore.getState().reset();
}

beforeEach(async () => {
  jest.clearAllMocks();
  await cleanup();
  (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([
    { identifier: ENHANCED_FEMALE_VOICE, name: 'Zoe (Enhanced)', quality: 'Enhanced', language: 'en-US' },
    { identifier: 'default-male', name: 'Mark', quality: 'Default', language: 'en-US' },
  ]);
  await useCompanionStore.getState().hydrate(USER);
});

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

const getSpeakOpts = () => (Speech.speak as jest.Mock).mock.calls[0]?.[1];

describe('speech pref persistence (companion_metadata.memory.speech)', () => {
  it('setEnabled(true) persists enabled + resolved voice id', async () => {
    await voiceService.setEnabled(true);

    const state = useCompanionStore.getState();
    expect(state.speakEnabled).toBe(true);
    expect(state.speechVoiceId).toBe(ENHANCED_FEMALE_VOICE);

    const db = getDb();
    const rows = await db.select().from(companionMetadata).where(eq(companionMetadata.user_id, USER));
    const speech = (rows[0]?.memory as { speech?: Record<string, unknown> })?.speech;
    expect(speech?.enabled).toBe(true);
    expect(speech?.voiceId).toBe(ENHANCED_FEMALE_VOICE);
  });

  it('hydrate restores speech prefs across a reload', async () => {
    await voiceService.setEnabled(true);
    useCompanionStore.getState().reset();
    await useCompanionStore.getState().hydrate(USER);

    const state = useCompanionStore.getState();
    expect(state.speakEnabled).toBe(true);
    expect(state.speechVoiceId).toBe(ENHANCED_FEMALE_VOICE);
    expect(state.speechRate).toBe(1);
    expect(state.speechPitch).toBe(1);
  });

  it('setSpeechPref rate/pitch round-trips', async () => {
    await useCompanionStore.getState().setSpeechPref({ rate: 1.3, pitch: 0.8 });
    const state = useCompanionStore.getState();
    expect(state.speechRate).toBe(1.3);
    expect(state.speechPitch).toBe(0.8);

    useCompanionStore.getState().reset();
    await useCompanionStore.getState().hydrate(USER);
    const reloaded = useCompanionStore.getState();
    expect(reloaded.speechRate).toBe(1.3);
    expect(reloaded.speechPitch).toBe(0.8);
  });
});

describe('deterministic voice resolution end-to-end', () => {
  it('enhanced + female + lower index wins', () => {
    const voices = [
      { identifier: 'v1', name: 'Alex', quality: 'Default', language: 'en-US' },
      { identifier: 'v2', name: 'Male (Alex)', quality: 'Enhanced', language: 'en-US' },
      { identifier: 'v3', name: 'Female (Samantha)', quality: 'Enhanced', language: 'en-US' },
      { identifier: 'v4', name: 'Female (Zoe)', quality: 'Enhanced', language: 'en-US' },
    ];
    expect(resolveVoice(voices)?.identifier).toBe('v3');
  });

  it('speak is silent while muted even after enabling', async () => {
    await voiceService.setEnabled(true);
    await useCompanionStore.getState().setMuteSounds(true);
    await voiceService.speak('Hello');
    expect(Speech.speak).not.toHaveBeenCalled();
  });
});

describe('useSpeechBubble TTS hold pipeline', () => {
  it('holds the bubble until speech finishes when voice is enabled', async () => {
    await voiceService.setEnabled(true);
    const { getByTestId } = render(<Harness />);

    fireEvent.press(getByTestId('show'));
    await act(async () => {});
    expect(getByTestId('bubble').props.children).toBe('Hello there');

    const opts = getSpeakOpts();
    expect(opts.voice).toBe(ENHANCED_FEMALE_VOICE);

    act(() => {
      opts.onStart();
    });
    expect(getByTestId('bubble').props.children).toBe('Hello there');

    act(() => {
      opts.onDone();
    });
    expect(getByTestId('bubble').props.children).toBe('none');
  });

  it('auto-dismisses after durationMs when voice is disabled (no TTS call)', async () => {
    jest.useFakeTimers();
    const { getByTestId } = render(<Harness />);

    fireEvent.press(getByTestId('show'));
    expect(getByTestId('bubble').props.children).toBe('Hello there');
    expect(Speech.speak).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3001);
    });
    expect(getByTestId('bubble').props.children).toBe('none');
  });

  it('dismiss stops active speech', async () => {
    await voiceService.setEnabled(true);
    const { getByTestId } = render(<Harness />);

    fireEvent.press(getByTestId('show'));
    await act(async () => {});
    expect(getByTestId('bubble').props.children).toBe('Hello there');

    (Speech.stop as jest.Mock).mockClear();
    fireEvent.press(getByTestId('dismiss'));
    expect(Speech.stop).toHaveBeenCalled();
    expect(getByTestId('bubble').props.children).toBe('none');
  });
});
