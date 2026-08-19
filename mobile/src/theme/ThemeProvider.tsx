/**
 * Theme context + hook + font loading.
 * Rule §3.3: light and dark mode via useColorScheme, no layout shifts on switch.
 */

import { createContext, ReactNode, useContext, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from 'src/stores/settingsStore';

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
  setDark: (dark: boolean) => void;
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
  setDark: () => {},
};

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children, override }: { children: ReactNode; override?: Partial<Theme> }) {
  const scheme = useColorScheme();
  const darkOverride = useSettingsStore((s) => s.darkMode);
  const setSetting = useSettingsStore((s) => s.setSetting);

  // `darkMode: null` means "follow the system scheme"; an explicit boolean wins.
  const isDark = darkOverride !== null ? darkOverride : scheme === 'dark';

  const setDark = useCallback(
    (dark: boolean) => setSetting('darkMode', dark),
    [setSetting],
  );

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
      setDark,
      ...override,
    }),
    [isDark, setDark, override],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useFontsLoaded() {
  return useContext(ThemeContext).fontsLoaded;
}
