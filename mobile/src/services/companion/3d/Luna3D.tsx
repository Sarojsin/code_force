import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { LunaSprite } from '../LunaSprite';
import { Luna3DErrorBoundary, TalkingCat } from './TalkingCat';
import { doesCatGlbExist } from './modelSource';
import type { AnimationState } from '../AnimationEngine';

interface Luna3DProps {
  size: number;
  currentAnim: SharedValue<AnimationState>;
  /** True when DLC is installed and 3D should be attempted. */
  installed: boolean;
  reducedMotion?: boolean;
  reduceAnimations?: boolean;
  /** Live TTS speaking flag — drives jaw lip-sync on the 3D cat. */
  talking?: SharedValue<boolean>;
}

/**
 * Renders the 3D Luna when the DLC model is present on disk, a skeleton
 * placeholder while it loads from the filesystem, and the 2D sprite as the
 * pre-install / failure fallback.
 */
export function Luna3D({
  size,
  currentAnim,
  installed,
  reducedMotion = false,
  reduceAnimations = false,
  talking,
}: Luna3DProps): React.ReactElement {
  const [modelExists, setModelExists] = useState(false);
  const [modelLoading, setModelLoading] = useState(installed);
  const [use3d, setUse3d] = useState(false);
  const talkingFallback = useSharedValue(false);
  const talkingSV = talking ?? talkingFallback;

  useEffect(() => {
    let active = true;
    doesCatGlbExist().then((exists) => {
      if (active) {
        setModelExists(exists);
      }
    });
    return () => {
      active = false;
    };
  }, [installed]);

  useEffect(() => {
    if (installed && modelExists) {
      setUse3d(true);
      setModelLoading(true);
    } else {
      setUse3d(false);
      setModelLoading(false);
    }
  }, [installed, modelExists]);

  const handleModelLoaded = useCallback(() => {
    setModelLoading(false);
  }, []);

  const fallback = (
    <LunaSprite
      size={reduceAnimations ? size - 8 : size}
      animatedStyle={undefined}
    />
  );

  if (!use3d) {
    return fallback;
  }

  return (
    <View style={{ width: size, height: size }}>
      {modelLoading && <CatSkeleton size={size} />}
      <Luna3DErrorBoundary fallback={fallback}>
        <TalkingCat
          size={size}
          currentAnim={currentAnim}
          reducedMotion={reducedMotion}
          reduceAnimations={reduceAnimations}
          talking={talkingSV}
          onModelLoaded={handleModelLoaded}
        />
      </Luna3DErrorBoundary>
    </View>
  );
}

function CatSkeleton({ size }: { size: number }): React.ReactElement {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <SkeletonPlaceholder>
        <View style={{ width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4 }} />
      </SkeletonPlaceholder>
    </View>
  );
}
