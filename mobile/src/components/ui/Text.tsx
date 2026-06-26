/**
 * Text — atomic. Replaces scattered <Text> with theme-driven variants.
 */

import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme, Typography } from 'src/theme';

type Variant = keyof Typography;

export interface TextProps_ extends TextProps {
  variant?: Variant;
  color?: 'primary' | 'secondary' | 'muted' | 'inverse' | 'danger' | 'success';
  align?: TextStyle['textAlign'];
}

export function Text({
  variant = 'body',
  color = 'primary',
  align,
  style,
  children,
  ...rest
}: TextProps_) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: theme.colors[`text${capitalize(color)}` as keyof typeof theme.colors] ?? theme.colors.textPrimary },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
