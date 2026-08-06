import React, { Component, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  DefaultLight,
  FilamentScene,
  FilamentView,
  RenderCallbackContext,
  useAnimator,
  useFilamentContext,
  useModel,
  useSyncSharedValue,
  type Entity,
  type FilamentAnimator,
  type FrameInfo,
  type TransformManager,
} from 'react-native-filament';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSharedValue as useWorkletsSharedValue, type ISharedValue } from 'react-native-worklets-core';
import type { BufferSource } from 'react-native-filament';
import { CAT_GLB_PATH } from '../assetPaths';
import { animationToPose, emptyPose, type LunaPose } from './poseMapper';
import type { AnimationState } from '../AnimationEngine';

const INITIAL_POSE: LunaPose = emptyPose();

interface ModelInfo {
  clipIndex: number;
  clipDuration: number;
  animationCount: number;
  prev: Record<string, number>;
}

/**
 * Bone entities captured in the render worklet closure. These must be the
 * actual Filament EntityWrapper host objects (from asset.getFirstEntityByName /
 * model.rootEntity) — the native API rejects plain `{ id }` objects.
 */
interface BoneEntities {
  root: Entity | null;
  head: Entity | null;
  tail: Entity | null;
  jaw: Entity | null;
  earL: Entity | null;
  earR: Entity | null;
  eyeL: Entity | null;
  eyeR: Entity | null;
}

const EMPTY_PREV: ModelInfo['prev'] = {
  headNod: 0,
  headTilt: 0,
  tail: 0,
  jaw: 0,
  earL: 0,
  earR: 0,
  eyeL: 0,
  eyeR: 0,
  bodyScale: 1,
};

const EMPTY_MODEL_INFO: ModelInfo = {
  clipIndex: -1,
  clipDuration: 1,
  animationCount: 0,
  prev: EMPTY_PREV,
};

const EMPTY_BONES: BoneEntities = {
  root: null,
  head: null,
  tail: null,
  jaw: null,
  earL: null,
  earR: null,
  eyeL: null,
  eyeR: null,
};

const BONE_CANDIDATES: Omit<Record<keyof BoneEntities, readonly string[]>, 'root'> = {
  head: ['neck bone ik', 'Bone.009', 'Bone.008', 'Bone.006'],
  tail: ['tailik Bone', 'Bone.018', 'Bone.017', 'Bone.016'],
  jaw: ['jaw', 'Jaw', 'mouth', 'Bone.031', 'Bone.007'],
  earL: ['earL ik', 'Earik R..001'],
  earR: ['Earik R.', 'Earik R..001'],
  eyeL: ['eyeL', 'eye_l', 'Eye.L'],
  eyeR: ['eyeR', 'eye_r', 'Eye.R'],
};

const AXIS_X: readonly [number, number, number] = [1, 0, 0];
const AXIS_Y: readonly [number, number, number] = [0, 1, 0];
const AXIS_Z: readonly [number, number, number] = [0, 0, 1];

function applyRotationDelta(
  tm: TransformManager,
  entity: Entity | null,
  axis: readonly [number, number, number],
  targetRadians: number,
  prev: Record<string, number>,
  key: string,
): void {
  'worklet';
  if (entity == null) {
    return;
  }
  const delta = targetRadians - prev[key];
  if (Math.abs(delta) > 0.0001) {
    tm.setEntityRotation(entity, delta, axis as [number, number, number], true);
  }
  prev[key] = targetRadians;
}

function applyPoseToEngine(
  animator: FilamentAnimator | undefined,
  tm: TransformManager,
  modelInfoSV: ISharedValue<ModelInfo>,
  bones: BoneEntities,
  poseSV: ISharedValue<LunaPose>,
  frame: FrameInfo,
): void {
  'worklet';
  if (animator == null) {
    return;
  }
  const info = modelInfoSV.value;
  // Apply the base animation clip (if any) — but always apply the live
  // micro-animation pose deltas below, so the cat breathes/blinks/twitches
  // even when the model ships no animation clips.
  if (info.clipIndex >= 0 && info.clipIndex < info.animationCount) {
    animator.applyAnimation(info.clipIndex, frame.passedSeconds % info.clipDuration);
  }
  const pose = poseSV.value;
  const prev = info.prev;
  applyRotationDelta(tm, bones.head, AXIS_X, pose.headNod, prev, 'headNod');
  applyRotationDelta(tm, bones.head, AXIS_Z, pose.headTilt, prev, 'headTilt');
  applyRotationDelta(tm, bones.head, AXIS_Y, pose.look, prev, 'look');
  applyRotationDelta(tm, bones.tail, AXIS_Z, pose.tail, prev, 'tail');
  applyRotationDelta(tm, bones.jaw, AXIS_X, -pose.jaw * 0.5, prev, 'jaw');
  const earCombined = pose.ear + pose.earTwitch;
  applyRotationDelta(tm, bones.earL, AXIS_X, earCombined * 0.5, prev, 'earL');
  applyRotationDelta(tm, bones.earR, AXIS_X, -earCombined * 0.5, prev, 'earR');
  applyRotationDelta(tm, bones.eyeL, AXIS_X, pose.blink * 0.7, prev, 'eyeL');
  applyRotationDelta(tm, bones.eyeR, AXIS_X, pose.blink * 0.7, prev, 'eyeR');
  applyRotationDelta(tm, bones.root, AXIS_X, pose.weightShift, prev, 'weightShift');
  const bodyTarget = 1 + pose.breath * 0.025;
  const bodyDelta = bodyTarget / prev.bodyScale;
  if (Math.abs(bodyDelta - 1) > 0.0001 && bones.root != null) {
    tm.setEntityScale(bones.root, [bodyDelta, bodyDelta, bodyDelta], true);
  }
  prev.bodyScale = bodyTarget;
  animator.updateBoneMatrices();
}

interface CatSceneProps {
  size: number;
  source: BufferSource;
  currentAnim: SharedValue<AnimationState>;
  reducedMotion: boolean;
  reduceAnimations: boolean;
  talking: SharedValue<boolean>;
  onModelLoaded?: () => void;
}

function CatScene({ size, source, currentAnim, reducedMotion, reduceAnimations, talking, onModelLoaded }: CatSceneProps) {
  const model = useModel(source);
  // useModel returns a fresh object on every render, which would recreate the
  // animator (and re-run our effect + setState) each render. Memoize on the
  // stable state so the loaded model reference stays stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the memo must key on state only, not the fresh model identity
  const loadedModel = useMemo(() => model, [model.state]);
  const animator = useAnimator(loadedModel);
  const { transformManager } = useFilamentContext();
  // Filament's render loop runs on react-native-worklets-core, so pose/model
  // state must live in worklets-core shared values, not reanimated ones.
  const poseSV = useWorkletsSharedValue<LunaPose>(INITIAL_POSE);
  const modelInfoSV = useWorkletsSharedValue<ModelInfo>(EMPTY_MODEL_INFO);
  // Bone EntityWrapper host objects. Destructured on the JS thread so each is
  // captured DIRECTLY in the render worklet closure — worklets-core deep-copies
  // host objects nested inside captured plain objects (turning them into {id}),
  // but passes direct captures by reference (same as animator/transformManager).
  const [bones, setBones] = useState<BoneEntities>(EMPTY_BONES);
  const { root, head, tail, jaw, earL, earR, eyeL, eyeR } = bones;
  // Bridge reanimated shared values into worklets-core (useSyncSharedValue).
  const animSV = useSyncSharedValue(currentAnim);
  const talkingSV = useSyncSharedValue(talking);

  useEffect(() => {
    if (loadedModel.state !== 'loaded' || animator == null) {
      return;
    }
    onModelLoaded?.();
    const asset = loadedModel.asset;
    const clipCount = animator.getAnimationCount();
    let clipIndex = -1;
    let clipDuration = 1;
    if (clipCount > 0) {
      let preferred = 0;
      for (let i = 0; i < clipCount; i++) {
        const name = animator.getAnimationName(i).toLowerCase();
        if (name.includes('idle') || name.includes('breath') || name.includes('armature')) {
          preferred = i;
        }
      }
      clipIndex = preferred;
      clipDuration = Math.max(animator.getAnimationDuration(preferred), 0.001);
    }
    const nextBones: BoneEntities = {
      root: loadedModel.rootEntity,
      head: null,
      tail: null,
      jaw: null,
      earL: null,
      earR: null,
      eyeL: null,
      eyeR: null,
    };
    for (const role of Object.keys(BONE_CANDIDATES) as Array<keyof typeof BONE_CANDIDATES>) {
      for (const candidate of BONE_CANDIDATES[role]) {
        const entity = asset.getFirstEntityByName(candidate);
        if (entity != null) {
          nextBones[role] = entity;
          break;
        }
      }
    }
    try {
      transformManager.transformToUnitCube(loadedModel.rootEntity, loadedModel.boundingBox);
    } catch {
      if (__DEV__) {
        console.warn('[luna] transformToUnitCube failed');
      }
    }
    setBones(nextBones);
    modelInfoSV.value = {
      clipIndex,
      clipDuration,
      animationCount: clipCount,
      prev: EMPTY_PREV,
    };
    return () => {
      modelInfoSV.value = EMPTY_MODEL_INFO;
    };
  }, [loadedModel, animator, transformManager, modelInfoSV, onModelLoaded]);

  RenderCallbackContext.useRenderCallback(
    (frame) => {
      'worklet';
      poseSV.value = animationToPose(animSV.value, frame.passedSeconds, {
        reducedMotion,
        reduceAnimations,
        talking: talkingSV.value,
      });
      applyPoseToEngine(
        animator,
        transformManager,
        modelInfoSV,
        { root, head, tail, jaw, earL, earR, eyeL, eyeR },
        poseSV,
        frame,
      );
    },
    [animator, transformManager, modelInfoSV, root, head, tail, jaw, earL, earR, eyeL, eyeR, poseSV, animSV, talkingSV, reducedMotion, reduceAnimations],
  );

  return (
    <FilamentView style={{ width: size, height: size }} enableTransparentRendering>
      <DefaultLight />
      <Camera cameraPosition={[0, 0.05, 3.5]} cameraTarget={[0, 0, 0]} cameraUp={[0, 1, 0]} />
    </FilamentView>
  );
}

export interface TalkingCatProps {
  size: number;
  /** Live animation state from useAnimationEngine(). */
  currentAnim: SharedValue<AnimationState>;
  /** 3D model source. Defaults to the DLC filesystem path. */
  modelSource?: BufferSource;
  reducedMotion?: boolean;
  reduceAnimations?: boolean;
  /** Live TTS speaking flag — drives jaw lip-sync. */
  talking?: SharedValue<boolean>;
  /** Called once the model asset has been loaded from disk. */
  onModelLoaded?: () => void;
}

export function TalkingCat({
  size,
  currentAnim,
  modelSource,
  reducedMotion = false,
  reduceAnimations = false,
  talking,
  onModelLoaded,
}: TalkingCatProps): React.ReactElement {
  const source = useMemo<BufferSource>(
    () => modelSource ?? { uri: CAT_GLB_PATH },
    [modelSource],
  );
  const talkingFallback = useSharedValue(false);
  const talkingSV = talking ?? talkingFallback;
  return (
    <FilamentScene>
      <CatScene
        size={size}
        source={source}
        currentAnim={currentAnim}
        reducedMotion={reducedMotion}
        reduceAnimations={reduceAnimations}
        talking={talkingSV}
        onModelLoaded={onModelLoaded}
      />
    </FilamentScene>
  );
}

/**
 * Error boundary around the 3D renderer. If Filament init or model loading
 * fails (low-end devices, corrupt DLC), render children (the 2D fallback)
 * instead of crashing the overlay.
 */
export class Luna3DErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    if (__DEV__) {
      console.warn('[luna] 3D renderer failed, falling back to 2D:', error);
    }
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
