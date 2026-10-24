import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NeonBorder } from './NeonBorder';
import { IconHome, IconScan, IconWallet } from './OracleIcons';
import { colors as base, radii } from '../theme';
import { useTheme } from '../theme/ThemeContext';

export type TabKey = 'home' | 'scanner' | 'metatrader';

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  /** Hidden superadmin entry — triple-tap Home within ~500ms (touch + click). */
  onOpenPortal?: () => void;
};

/** Window for counting rapid Home taps (mobile touch + desktop click). */
const TRIPLE_TAP_MS = 500;

const tabs: {
  key: TabKey;
  label: string;
  renderIcon: (active: boolean, muted: string, primary: string) => ReactNode;
}[] = [
  {
    key: 'home',
    label: 'Home',
    renderIcon: (active, muted, primary) => (
      <IconHome color={active ? primary : muted} size={22} />
    ),
  },
  {
    key: 'scanner',
    label: 'AI Scanner',
    renderIcon: (active, muted, primary) => (
      <IconScan color={active ? primary : muted} size={22} />
    ),
  },
  {
    key: 'metatrader',
    label: 'MetaTrader',
    renderIcon: (active, muted, primary) => (
      <IconWallet color={active ? primary : muted} size={22} />
    ),
  },
];

export function BottomNav({ active, onChange, onOpenPortal }: Props) {
  const { colors } = useTheme();
  const taps = useRef(0);
  const lastAt = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Count Home taps on both pressIn (mobile touch) and press (click/a11y).
   * Coalesce pressIn+press from the same gesture (~40ms) so we don't double-count.
   */
  const onHomeTap = () => {
    const now = Date.now();
    if (now - lastAt.current < 40) return;

    if (now - lastAt.current > TRIPLE_TAP_MS) taps.current = 0;
    lastAt.current = now;
    taps.current += 1;

    onChange('home');

    if (resetTimer.current) clearTimeout(resetTimer.current);

    if (taps.current >= 3) {
      taps.current = 0;
      lastAt.current = 0;
      onOpenPortal?.();
      return;
    }

    resetTimer.current = setTimeout(() => {
      taps.current = 0;
    }, TRIPLE_TAP_MS);
  };

  return (
    <NeonBorder radius={radii.pill} fill={colors.navFill} style={styles.bar}>
      <View style={styles.row}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const isHome = tab.key === 'home';
          return (
            <Pressable
              key={tab.key}
              style={styles.tabHit}
              onPressIn={isHome ? onHomeTap : undefined}
              onPress={isHome ? onHomeTap : () => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityHint={isHome ? 'Triple tap opens Superadmin Portal' : undefined}
              testID={isHome ? 'nav-home' : `nav-${tab.key}`}
            >
              <View style={[styles.tabInner, isActive && styles.tabActive]}>
                {tab.renderIcon(isActive, colors.textMuted, colors.textPrimary)}
                {isActive ? (
                  <View style={[styles.activeUnderline, { backgroundColor: colors.neon }]} />
                ) : (
                  <View style={styles.underlineSpacer} />
                )}
                <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </NeonBorder>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabHit: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.homeActive,
    minWidth: 86,
    gap: 3,
  },
  tabActive: {
    backgroundColor: base.homeActiveBg,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: base.textPrimary,
  },
  labelInactive: {
    color: base.textMuted,
  },
  activeUnderline: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  underlineSpacer: {
    height: 3,
  },
});
