import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NeonBorder } from './NeonBorder';
import { IconPause, IconPlay, IconPulse, IconTrash } from './OracleIcons';
import { assets } from '../assets';
import { colors, radii } from '../theme';

type Action = {
  key: string;
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  active?: boolean;
};

type Props = {
  running: boolean;
  onToggleStart: () => void;
  onOpenQuotes: () => void;
  onRemove?: () => void;
  selectedCount?: number;
  title?: string;
  /** Custom EA image (data URL / URI). Falls back to built-in Oracle hero. */
  imageUri?: string | null;
};

export function OracleCard({
  running,
  onToggleStart,
  onOpenQuotes,
  onRemove,
  selectedCount = 0,
  title = 'Robot',
  imageUri = null,
}: Props) {
  const heroSource = imageUri ? { uri: imageUri } : assets.oracleHero;

  const actions: Action[] = [
    {
      key: 'start',
      label: running ? 'RUNNING' : 'START',
      active: running,
      onPress: onToggleStart,
      icon: running ? (
        <IconPause color={colors.textPrimary} size={22} />
      ) : (
        <IconPlay color={colors.textPrimary} size={22} />
      ),
    },
    {
      key: 'quotes',
      label: 'QUOTES',
      active: selectedCount > 0,
      onPress: onOpenQuotes,
      icon: <IconPulse color={colors.textPrimary} size={24} />,
    },
    {
      key: 'remove',
      label: 'REMOVE',
      onPress: onRemove,
      icon: <IconTrash color={colors.textPrimary} size={22} />,
    },
  ];

  return (
    <NeonBorder radius={radii.card} fill={colors.actionRow} style={styles.card}>
      <View style={styles.heroWrap}>
        <Image
          source={heroSource}
          style={styles.hero}
          resizeMode="cover"
          accessibilityLabel={title}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
          locations={[0.45, 0.7, 1]}
          style={styles.heroFade}
        />
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.statusDot, running ? styles.statusDotRunning : styles.statusDotIdle]} />
        </View>
        {running ? (
          <View style={styles.runningBadge} accessibilityLabel="EA running">
            <View style={styles.runningPulse} />
            <Text style={styles.runningBadgeText}>EA LIVE</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        {actions.map((action, index) => (
          <View key={action.key} style={styles.actionCell}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              style={styles.actionBtn}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: !!action.active }}
            >
              <View style={[styles.iconFrame, action.active && styles.iconFrameActive]}>
                {action.icon}
              </View>
              <Text style={[styles.actionLabel, action.active && styles.actionLabelActive]}>
                {action.label}
              </Text>
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  statusDotIdle: {
    backgroundColor: colors.redDot,
  },
  statusDotRunning: {
    backgroundColor: '#3DFF9A',
  },
  runningBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#3DFF9A',
    backgroundColor: 'rgba(8, 40, 24, 0.85)',
  },
  runningPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3DFF9A',
  },
  runningBadgeText: {
    color: '#3DFF9A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
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
  iconFrameActive: {
    borderColor: '#3DFF9A',
    backgroundColor: 'rgba(61, 255, 154, 0.12)',
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  actionLabelActive: {
    color: '#3DFF9A',
  },
});
