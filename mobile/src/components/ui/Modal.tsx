import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, View, Pressable, BackHandler, Modal as RNModal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useTheme } from 'src/theme';
import { Text } from './Text';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ visible, onClose, title, children }: ModalProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible, opacity]);

  useEffect(() => {
    const handler = () => { if (visible) { onClose(); return true; } return false; };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [visible, onClose]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
          accessibilityHint="Tap to close modal"
        />
        <View
          style={[
            styles.content,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              marginHorizontal: theme.spacing.xl,
            },
          ]}
          accessibilityViewIsModal
          accessibilityLabel={title || 'Modal'}
        >
          {title && (
            <Text variant="h3" style={{ marginBottom: theme.spacing.md }}>
              {title}
            </Text>
          )}
          {children}
        </View>
      </Animated.View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdrop: { ...StyleSheet.absoluteFill },
  content: { width: '100%', maxWidth: 400 },
});
