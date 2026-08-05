import React from 'react';
import { StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useTheme } from 'src/theme';
import { Text as Txt } from 'src/components/ui';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: React.ReactNode;
  label?: string;
  bgColor?: string;
  style?: ViewStyle;
  size?: number;
  accessibilityLabel?: string;
}

export function FloatingActionButton({
  onPress,
  icon,
  label,
  bgColor,
  style,
  size = 56,
  accessibilityLabel = 'Add',
}: FloatingActionButtonProps) {
  const theme = useTheme();
  const background = bgColor ?? theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon ?? <PlusIcon />}
      {label && (
        <Txt variant="caption" style={styles.label}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

function PlusIcon() {
  return (
    <Txt style={styles.plusIcon}>
      ＋
    </Txt>
  );
}

const styles = StyleSheet.create({
  fab: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  label: {
    position: 'absolute',
    bottom: -24,
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  plusIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
});
