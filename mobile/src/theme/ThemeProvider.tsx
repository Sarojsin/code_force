/**
 * Theme context + hook.
 * Rule §3.3: light and dark mode via useColorScheme, no layout shifts on switch.
 */

import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { colors as lightColors, darkColors, spacing, radius, typography, shadow, minTouchTarget, ThemeColors } from './tokens';

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadow: typeof shadow;
  minTouchTarget: number;
}

const defaultTheme: Theme = {
  isDark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  shadow,
  minTouchTarget,
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
      minTouchTarget,
      ...override,
    }),
    [isDark, override],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
