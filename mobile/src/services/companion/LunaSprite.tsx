import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import Animated from 'react-native-reanimated';
import { areAssetsInstalled, SPRITESHEET_PNG } from './assetPaths';
import LunaFallbackImage from '../../assets/companion/luna_fallback.png';

interface LunaSpriteProps {
  size?: number;
  animatedStyle?: object;
}

export const LunaSprite = React.memo(function LunaSprite({
  size = 80,
  animatedStyle,
}: LunaSpriteProps) {
  const [useSpritesheet, setUseSpritesheet] = useState(false);

  useEffect(() => {
    areAssetsInstalled().then(setUseSpritesheet);
  }, []);

  if (useSpritesheet) {
    return (
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
        <Image
          source={{ uri: SPRITESHEET_PNG }}
          style={{ width: size, height: size, resizeMode: 'contain' }}
          accessibilityLabel="Luna the cat"
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, { width: size, height: size }]}>
      <Image
        source={LunaFallbackImage}
        style={{ width: size, height: size, resizeMode: 'contain' }}
        accessibilityLabel="Luna the cat"
      />
    </Animated.View>
  );
});
