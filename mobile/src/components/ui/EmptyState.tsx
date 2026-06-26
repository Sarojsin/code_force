import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from 'src/theme';
import { Text } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { paddingHorizontal: theme.spacing.xl }]}
      accessibilityLabel={title}
      accessibilityRole="header"
    >
      {icon ? (
        <View style={styles.icon}>{icon}</View>
      ) : (
        <View
          style={[
            styles.iconPlaceholder,
            {
              backgroundColor: theme.colors.primaryMuted,
              borderRadius: theme.radius.xl,
            },
          ]}
        >
          <Text variant="h1" color="primary">
            --
          </Text>
        </View>
      )}
      <Text variant="h3" align="center" style={{ marginTop: theme.spacing.lg }}>
        {title}
      </Text>
      <Text
        variant="body"
        color="secondary"
        align="center"
        style={{ marginTop: theme.spacing.sm }}
      >
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="primary"
          style={{ marginTop: theme.spacing.xl, minWidth: 160 }}
          accessibilityHint={message}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  icon: { marginBottom: 8 },
  iconPlaceholder: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
});
