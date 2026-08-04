import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardEvent, Platform } from 'react-native';

const KEYBOARD_ANIMATION_DURATION = 250;

export interface UseKeyboardResult {
  keyboardHeight: Animated.Value;
  isKeyboardVisible: boolean;
  dismiss: () => void;
}

export function useKeyboard(): UseKeyboardResult {
  const keyboardHeight = useMemo(() => new Animated.Value(0), []);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      setIsKeyboardVisible(true);
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: KEYBOARD_ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };

    const onHide = () => {
      setIsKeyboardVisible(false);
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: KEYBOARD_ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  const dismiss = () => Keyboard.dismiss();

  return { keyboardHeight, isKeyboardVisible, dismiss };
}
