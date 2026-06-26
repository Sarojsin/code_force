/**
 * Card — surface primitive.
 */

import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { useTheme } from 'src/theme';

export interface CardProps extends ViewProps {
  children: ReactNode;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, padded = true, elevated = false, style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
        elevated ? theme.shadow.md : null,
        padded ? { padding: theme.spacing.lg } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth },
});
