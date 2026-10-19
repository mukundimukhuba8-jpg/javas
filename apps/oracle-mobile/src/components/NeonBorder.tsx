import { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  radius: number;
  fill?: string;
};

/** Thin neon cyan/electric-blue border with a soft outer glow. */
export function NeonBorder({ children, style, radius, fill = colors.cardFill }: Props) {
  return (
    <View
      style={[
        styles.outer,
        {
          borderRadius: radius,
          borderColor: colors.neon,
          backgroundColor: fill,
          ...Platform.select({
            ios: {
              shadowColor: colors.neon,
              shadowOpacity: 0.55,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 6 },
            web: {
              boxShadow: `0 0 10px rgba(106, 160, 248, 0.45), 0 0 2px rgba(106, 160, 248, 0.8)`,
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
