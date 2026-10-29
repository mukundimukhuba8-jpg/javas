import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors as fallback } from '../theme';
import { hexToRgba, useTheme } from '../theme/ThemeContext';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  radius: number;
  fill?: string;
};

/** Thin neon border with a soft outer glow (uses live accent from ThemeProvider). */
export function NeonBorder({ children, style, radius, fill }: Props) {
  const { colors } = useTheme();
  const neon = colors.neon || fallback.neon;
  const bg = fill ?? colors.cardFill;

  return (
    <View
      style={[
        styles.outer,
        {
          borderRadius: radius,
          borderColor: neon,
          backgroundColor: bg,
          ...Platform.select({
            ios: {
              shadowColor: neon,
              shadowOpacity: 0.55,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 6 },
            web: {
              boxShadow: `0 0 10px ${hexToRgba(neon, 0.45)}, 0 0 2px ${hexToRgba(neon, 0.8)}`,
            } as ViewStyle,
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});
