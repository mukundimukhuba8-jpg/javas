import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeonBorder } from '../../components/NeonBorder';
import { useTheme } from '../../theme/ThemeContext';
import { colors as base, radii, spacing } from '../../theme';
import { PORTAL_MENU, type PortalSectionId } from './portalSections';
import { PortalSectionBody } from './PortalSections';

type Props = {
  onExit: () => void;
};

export function PortalScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [section, setSection] = useState<PortalSectionId | null>(null);
  const active = PORTAL_MENU.find((m) => m.id === section);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <Pressable
          style={[styles.backBtn, { borderColor: colors.neon }]}
          onPress={() => {
            if (section) setSection(null);
            else onExit();
          }}
          accessibilityRole="button"
          accessibilityLabel={section ? 'Back to portal menu' : 'Exit portal'}
        >
          <Ionicons name="chevron-back" size={22} color={base.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>SUPERADMIN</Text>
          <Text style={styles.title}>{active ? active.title : 'PORTAL'}</Text>
        </View>
        <Pressable
          style={[styles.exitBtn, { borderColor: colors.neon }]}
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Exit portal"
        >
          <Ionicons name="close" size={20} color={base.textPrimary} />
        </Pressable>
      </View>

      {section ? (
        <View style={styles.sectionWrap}>
          <PortalSectionBody section={section} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.menu, { paddingBottom: Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>Hidden console · select a module</Text>
          <View style={styles.grid}>
            {PORTAL_MENU.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSection(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                style={styles.gridHit}
              >
                <NeonBorder radius={18} fill={base.cardFill} style={styles.tile}>
                  <View style={[styles.iconWrap, { borderColor: colors.neon }]}>
                    <Ionicons name={item.icon} size={22} color={colors.neon} />
                  </View>
                  <Text style={styles.tileTitle}>{item.title}</Text>
                  <Text style={styles.tileSub}>{item.subtitle}</Text>
                </NeonBorder>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: base.background,
    paddingHorizontal: spacing.screenH,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: base.iconFrame,
  },
  exitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: base.iconFrame,
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: base.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: base.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: base.textMuted,
    fontSize: 13,
    marginBottom: 14,
  },
  menu: {
    paddingBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridHit: {
    width: '48%',
    flexGrow: 1,
  },
  tile: {
    padding: 14,
    minHeight: 118,
    gap: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: base.actionRow,
  },
  tileTitle: {
    color: base.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tileSub: {
    color: base.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  sectionWrap: {
    flex: 1,
  },
});
