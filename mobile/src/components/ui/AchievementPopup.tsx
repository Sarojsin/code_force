import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { Achievement } from '../../services/companion/AchievementEngine';

interface AchievementPopupProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export function AchievementPopup({ achievement, onDismiss }: AchievementPopupProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!achievement) return;

    Animated.spring(slideAnim, {
      toValue: insets.top + 8,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 3000);

    return () => clearTimeout(timer);
  }, [achievement]);

  if (!achievement) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primary,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityLabel={`Achievement unlocked: ${achievement.name}`}
      accessibilityRole="alert"
    >
      <Text style={styles.icon}>{achievement.icon}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Achievement Unlocked!</Text>
        <Text style={styles.name}>{achievement.name}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  icon: { fontSize: 28, marginRight: 12 },
  textContainer: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
