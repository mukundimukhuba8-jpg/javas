import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NeonBorder } from './NeonBorder';
import { colors, radii } from '../theme';

type Props = {
  onPress?: () => void;
};

export function AddRobotButton({ onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add Robot">
      <NeonBorder radius={radii.pill} fill={colors.addRobotFill} style={styles.pill}>
        <View style={styles.row}>
          <View style={styles.plusCircle}>
            <Ionicons name="add" size={26} color={colors.textPrimary} />
          </View>

          <View style={styles.copy}>
            <Text style={styles.title}>ADD ROBOT</Text>
            <Text style={styles.subtitle}>HOST ROBOT KEY</Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </View>
      </NeonBorder>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  plusCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.plusCircle,
    borderWidth: 1.5,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSub,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
  },
});
