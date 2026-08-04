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
  suppressAndroidPadding?: boolean;
  includeFontPadding?: boolean;
}

export function Text({
  variant = 'body',
  color = 'primary',
  align,
  style,
  children,
  suppressAndroidPadding,
  includeFontPadding: explicitIncludeFontPadding,
  ...rest
}: TextProps_) {
  const theme = useTheme();
  const token = theme.typography[variant];
  const fontFamily = token?.fontFamily
    ? (theme.fontsLoaded ? token.fontFamily : SYSTEM_FONTS[token.fontFamily] ?? undefined)
    : undefined;

  const effectiveIncludeFontPadding = explicitIncludeFontPadding ?? suppressAndroidPadding ?? false;

  const computedLineHeight: number | undefined =
    (token as TextStyle | undefined)?.lineHeight ?? (token?.fontSize ? Math.round(token.fontSize * 1.2) : undefined);

  const restWithPadding = {
    ...rest,
    includeFontPadding: effectiveIncludeFontPadding,
  };

  return (
    <RNText
      {...(restWithPadding as TextProps & { includeFontPadding?: boolean })}
      style={[
        token,
        { fontFamily: fontFamily ?? token?.fontFamily },
        { color: theme.colors[`text${capitalize(color)}` as keyof typeof theme.colors] ?? theme.colors.textPrimary },
        { lineHeight: computedLineHeight },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
