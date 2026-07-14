/**
 * Text — atomic. Replaces scattered <Text> with theme-driven variants.
 */

import React from 'react';
import { Text as RNText, TextProps, TextStyle, Platform } from 'react-native';

import { useTheme, Typography } from 'src/theme';

type Variant = keyof Typography;

const SYSTEM_FONTS: Record<string, string> = {
  'Playfair Display': Platform.select({ ios: 'Georgia', default: 'serif' })!,
  'Inter': Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' })!,
};

export interface TextProps_ extends TextProps {
  variant?: Variant;
  color?: 'primary' | 'secondary' | 'muted' | 'inverse' | 'danger' | 'success' | 'accent';
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
  const token = theme.typography[variant];
  const fontFamily = token?.fontFamily
    ? (theme.fontsLoaded ? token.fontFamily : SYSTEM_FONTS[token.fontFamily] ?? undefined)
    : undefined;

  return (
    <RNText
      style={[
        token,
        { fontFamily: fontFamily ?? token?.fontFamily },
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
