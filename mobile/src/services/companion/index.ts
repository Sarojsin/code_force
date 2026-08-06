export { useAnimationEngine } from './AnimationEngine';
export type { AnimationState, FrameConfig } from './AnimationEngine';

export { LunaSprite } from './LunaSprite';

export { dialogueEngine } from './DialogueEngine';
export type { DialogueContext } from './DialogueEngine';

export { voiceService, resolveVoice } from './voiceService';
export type { SpeakOpts, VoiceCandidate } from './voiceService';

export { memoryService, initMemoryService } from './memoryService';
export type { MemoryContext, HabitType } from './memoryService';

export { areAssetsInstalled, getAssetsSize, COMPANION_DIR } from './assetPaths';

export { initEventEngine, useSpeechBubble } from './EventEngine';
export type { SpeechBubbleEvent } from './EventEngine';

export { achievementEngine, ACHIEVEMENTS } from './AchievementEngine';
export type { Achievement } from './AchievementEngine';

export { soundEngine } from './SoundEngine';
export type { SoundName } from './SoundEngine';

export { MoodManager } from './MoodManager';
export type { Mood, MoodTrend } from './MoodManager';

export { EmotionEngine, createEmotionEngine } from './EmotionEngine';

export {
  getLunaKeys,
  fetchLunaState,
  pushLunaState,
  replayLunaQueue,
  enqueueAndPush,
  buildLunaStatePayload,
  mergeServerMemory,
  applyServerState,
  reconcileLunaState,
  syncLunaState,
  clearLunaSync,
  useLunaState,
  usePushLunaState,
  useLunaStateSync,
  LUNA_QUEUE_CAP,
} from './lunaSyncClient';
export type {
  LunaServerState,
  LunaStatePayload,
  LunaMoodSample,
  LunaMoodTrend,
  LunaMoodValue,
  LunaMoodSource,
  LunaQueuedWrite,
  LunaReplayResult,
} from './lunaSyncClient';
