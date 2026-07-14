/**
 * Theme context + hook + font loading.
 * Rule §3.3: light and dark mode via useColorScheme, no layout shifts on switch.
 */

import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { colors as lightColors, darkColors, spacing, radius, typography, shadow, fonts, minTouchTarget, ThemeColors } from './tokens';

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadow: typeof shadow;
  fonts: typeof fonts;
  minTouchTarget: number;
  fontsLoaded: boolean;
}

const defaultTheme: Theme = {
  isDark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  shadow,
  fonts,
  minTouchTarget,
  fontsLoaded: false,
};

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children, override }: { children: ReactNode; override?: Partial<Theme> }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const value = useMemo<Theme>(
    () => ({
      isDark,
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      shadow,
      fonts,
      minTouchTarget,
      fontsLoaded: true,
      ...override,
    }),
    [isDark, override],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useFontsLoaded() {
  return useContext(ThemeContext).fontsLoaded;
}
