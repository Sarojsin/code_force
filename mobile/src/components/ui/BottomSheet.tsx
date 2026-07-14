import React, { ReactNode, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, BackHandler, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import { useTheme } from 'src/theme';
import { Text } from './Text';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: number[];
}

const DEFAULT_SNAP_POINTS = [0.3, 0.65, 0.9];

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  snapPoints: snapPointsProp,
}: BottomSheetProps) {
  const theme = useTheme();
  const snapPoints = useMemo(() => snapPointsProp ?? DEFAULT_SNAP_POINTS, [snapPointsProp]);

  const currentSnap = useSharedValue(snapPoints.length - 1);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  const translateToSnap = useCallback((index: number) => {
    'worklet';
    const target = SCREEN_HEIGHT * (1 - snapPoints[index]);
    translateY.value = withSpring(target, { damping: 25, stiffness: 250 });
    currentSnap.value = index;
  }, [snapPoints, translateY, currentSnap]);

  const closeSheet = useCallback(() => {
    'worklet';
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
    opacity.value = withTiming(0, { duration: 250 });
    runOnJS(onClose)();
  }, [onClose, translateY, opacity]);

  useEffect(() => {
    if (visible) {
      translateToSnap(snapPoints.length - 1);
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible, translateY, opacity, translateToSnap, snapPoints.length]);

  useEffect(() => {
    const handler = () => { if (visible) { onClose(); return true; } return false; };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [visible, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const pan = Gesture.Pan()
    .minDistance(10)
    .onUpdate((e) => {
      const sheetStart = SCREEN_HEIGHT * (1 - snapPoints[snapPoints.length - 1]);
      if (e.translationY > 0) {
        translateY.value = sheetStart + e.translationY;
      } else if (e.translationY < 0 && currentSnap.value === snapPoints.length - 1) {
        translateY.value = sheetStart + e.translationY * 0.3;
      }
    })
    .onEnd((e) => {
      const totalTravel = e.translationY;
      if (totalTravel > SCREEN_HEIGHT * 0.2) {
        if (currentSnap.value > 0) {
          translateToSnap(currentSnap.value - 1);
        } else {
          closeSheet();
        }
      } else if (totalTravel < -SCREEN_HEIGHT * 0.1 && currentSnap.value < snapPoints.length - 1) {
        translateToSnap(currentSnap.value + 1);
      } else {
        translateToSnap(currentSnap.value);
      }
    });

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          onPress={onClose}
          style={styles.backdropPressable}
          accessibilityLabel="Close"
          accessibilityRole="button"
          accessibilityHint="Tap to close bottom sheet"
        />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.xxl,
            },
            sheetStyle,
          ]}
          accessibilityViewIsModal
          accessibilityLabel={title || 'Bottom sheet'}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          {title && (
            <Text variant="h3" style={{ marginBottom: theme.spacing.md }}>
              {title}
            </Text>
          )}
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  backdropPressable: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
});
