export { useAnimationEngine } from './AnimationEngine';
export type { AnimationState, FrameConfig } from './AnimationEngine';

export { LunaSprite } from './LunaSprite';

export { dialogueEngine } from './DialogueEngine';
export type { DialogueContext } from './DialogueEngine';

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
