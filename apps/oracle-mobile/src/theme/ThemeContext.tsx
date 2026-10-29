import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { colors as baseColors } from '../theme';

export const ACCENT_PRESETS = [
  { id: 'blue', label: 'Electric Blue', value: '#6AA0F8' },
  { id: 'cyan', label: 'Cyan', value: '#2EE6FF' },
  { id: 'green', label: 'Neon Green', value: '#3DFF9A' },
  { id: 'purple', label: 'Violet', value: '#A78BFA' },
  { id: 'orange', label: 'Amber', value: '#FFB020' },
  { id: 'pink', label: 'Hot Pink', value: '#FF4D9A' },
  { id: 'red', label: 'Signal Red', value: '#FF5C5C' },
  { id: 'teal', label: 'Teal', value: '#14B8A6' },
] as const;

type ThemeColors = Omit<typeof baseColors, 'neon' | 'neonBright' | 'neonMuted' | 'divider' | 'plusCircle'> & {
  neon: string;
  neonBright: string;
  neonMuted: string;
  divider: string;
  plusCircle: string;
};

type ThemeContextValue = {
  colors: ThemeColors;
  accent: string;
  setAccent: (hex: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<string>(baseColors.neon);

  const value = useMemo<ThemeContextValue>(() => {
    const colors: ThemeColors = {
      ...baseColors,
      neon: accent,
      neonBright: accent,
      neonMuted: accent,
      divider: accent,
      plusCircle: accent,
    };
    return { colors, accent, setAccent };
  }, [accent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      colors: baseColors as ThemeColors,
      accent: baseColors.neon,
      setAccent: (_hex: string) => undefined,
    };
  }
  return ctx;
}

/** Convert #RRGGBB to rgba() for web glow shadows. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
