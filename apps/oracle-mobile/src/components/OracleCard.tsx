import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NeonBorder } from './NeonBorder';
import { assets } from '../assets';
import { colors, radii } from '../theme';

type Action = {
  key: string;
  label: string;
  icon: ReactNode;
  onPress?: () => void;
};

export function OracleCard() {
  const actions: Action[] = [
    {
      key: 'start',
      label: 'START',
      icon: <Ionicons name="play" size={22} color={colors.textPrimary} style={{ marginLeft: 2 }} />,
    },
    {
      key: 'quotes',
      label: 'QUOTES',
      icon: <MaterialCommunityIcons name="pulse" size={24} color={colors.textPrimary} />,
    },
    {
      key: 'remove',
      label: 'REMOVE',
      icon: <Ionicons name="trash-outline" size={22} color={colors.textPrimary} />,
    },
  ];

  return (
    <NeonBorder radius={radii.card} fill={colors.actionRow} style={styles.card}>
      <View style={styles.heroWrap}>
        <Image
          source={assets.oracleHero}
          style={styles.hero}
          resizeMode="cover"
          accessibilityLabel="The Oracle"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
          locations={[0.45, 0.7, 1]}
          style={styles.heroFade}
        />
        <View style={styles.titleRow}>
          <Text style={styles.title}>THE ORACLE</Text>
          <View style={styles.redDot} />
        </View>
      </View>

      <View style={styles.actionRow}>
        {actions.map((action, index) => (
          <View key={action.key} style={styles.actionCell}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <Pressable style={styles.actionBtn} onPress={action.onPress} accessibilityRole="button">
              <View style={styles.iconFrame}>{action.icon}</View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </NeonBorder>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  heroWrap: {
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: '#1a1a1a',
    justifyContent: 'flex-end',
  },
  hero: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroFade: {
    ...StyleSheet.absoluteFill,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 10,
    zIndex: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.redDot,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.actionRow,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  actionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
    opacity: 0.85,
    marginVertical: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconFrame: {
    width: 48,
    height: 48,
    borderRadius: radii.iconFrame,
    backgroundColor: colors.iconFrame,
    borderWidth: 1,
    borderColor: 'rgba(106, 160, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
});
