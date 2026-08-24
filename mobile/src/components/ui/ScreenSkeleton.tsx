import React from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from 'src/theme';
import { Skeleton } from './Skeleton';
import { Text } from './Text';

export type ScreenSkeletonVariant = 'list' | 'editor' | 'cards';

export interface ScreenSkeletonProps {
  variant?: ScreenSkeletonVariant;
  label?: string;
  count?: number;
  style?: ViewStyle;
}

function ListRow() {
  return (
    <View style={styles.row}>
      <Skeleton shape="circle" width={40} height={40} />
      <View style={styles.rowLines}>
        <Skeleton width="65%" height={14} />
        <Skeleton width="40%" height={12} style={styles.subLine} />
      </View>
    </View>
  );
}

function EditorLines() {
  return (
    <View style={styles.editor}>
      <Skeleton width="60%" height={22} />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} width={i === 4 ? '70%' : '100%'} height={14} style={styles.bodyLine} />
      ))}
    </View>
  );
}

export function ScreenSkeleton({
  variant = 'list',
  label,
  count = 6,
  style,
}: ScreenSkeletonProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityLabel={label ?? 'Loading'}
      accessibilityRole="progressbar"
    >
      {label ? (
        <View style={styles.labelRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text variant="caption" color="muted">
            {label}
          </Text>
        </View>
      ) : null}
      <View style={styles.grid}>
        {Array.from({ length: count }, (_, index) =>
          variant === 'editor' ? <EditorLines key={index} /> : <ListRow key={index} />,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  grid: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLines: {
    flex: 1,
    gap: 6,
  },
  subLine: {
    marginTop: 2,
  },
  editor: {
    gap: 14,
  },
  bodyLine: {
    marginTop: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
});