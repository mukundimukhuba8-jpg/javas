import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NeonBorder } from './NeonBorder';
import { colors, radii } from '../theme';

export type TabKey = 'home' | 'scanner' | 'metatrader';

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs: {
  key: TabKey;
  label: string;
  renderIcon: (active: boolean) => ReactNode;
}[] = [
  {
    key: 'home',
    label: 'Home',
    renderIcon: (active) => (
      <Ionicons name="home" size={22} color={active ? colors.textPrimary : colors.textMuted} />
    ),
  },
  {
    key: 'scanner',
    label: 'AI Scanner',
    renderIcon: (active) => (
      <MaterialCommunityIcons
        name="line-scan"
        size={22}
        color={active ? colors.textPrimary : colors.textMuted}
      />
    ),
  },
  {
    key: 'metatrader',
    label: 'MetaTrader',
    renderIcon: (active) => (
      <Ionicons
        name="wallet-outline"
        size={22}
        color={active ? colors.textPrimary : colors.textMuted}
      />
    ),
  },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <NeonBorder radius={radii.pill} fill={colors.navFill} style={styles.bar}>
      <View style={styles.row}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              style={styles.tabHit}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.tabInner, isActive && styles.tabActive]}>
                {tab.renderIcon(isActive)}
                {isActive ? (
                  <View style={styles.activeUnderline} />
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
    backgroundColor: colors.homeActiveBg,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.textPrimary,
  },
  labelInactive: {
    color: colors.textMuted,
  },
  activeUnderline: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.neon,
  },
  underlineSpacer: {
    height: 3,
  },
});
