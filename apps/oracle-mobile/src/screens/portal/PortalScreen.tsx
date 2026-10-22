import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, hexToRgba } from '../../theme/ThemeContext';
import { colors as base, spacing } from '../../theme';
import { PORTAL_MENU, type PortalSectionId } from './portalSections';
import { PortalSectionBody } from './PortalSections';

type Props = {
  onExit: () => void;
};

export function PortalScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<PortalSectionId>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const active = PORTAL_MENU.find((m) => m.id === section) ?? PORTAL_MENU[0];
  const narrow = width < 720;
  const sidebarWidth = narrow ? Math.min(260, width * 0.78) : width < 900 ? 200 : 228;

  const panelOpacity = useRef(new Animated.Value(1)).current;
  const panelSlide = useRef(new Animated.Value(0)).current;
  const drawerX = useRef(new Animated.Value(-sidebarWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    panelOpacity.setValue(0);
    panelSlide.setValue(10);
    Animated.parallel([
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(panelSlide, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [section, panelOpacity, panelSlide]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerX, {
        toValue: drawerOpen ? 0 : -sidebarWidth,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: drawerOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerOpen, sidebarWidth, drawerX, backdrop]);

  const selectSection = (id: PortalSectionId) => {
    setSection(id);
    if (narrow) setDrawerOpen(false);
  };

  const sidebar = (
    <View style={[styles.sidebarInner, { width: sidebarWidth }]}>
      <Text style={styles.sidebarLabel}>MODULES</Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sidebarScroll}
      >
        {PORTAL_MENU.map((item) => {
          const selected = item.id === section;
          return (
            <Pressable
              key={item.id}
              onPress={() => selectSection(item.id)}
              style={[
                styles.navItem,
                selected && {
                  backgroundColor: hexToRgba(colors.neon, 0.12),
                  borderColor: hexToRgba(colors.neon, 0.55),
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item.title}
            >
              {selected ? (
                <View style={[styles.navAccent, { backgroundColor: colors.neon }]} />
              ) : null}
              <View
                style={[
                  styles.navIconWrap,
                  selected && { backgroundColor: hexToRgba(colors.neon, 0.18) },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={selected ? colors.neon : base.textMuted}
                />
              </View>
              <View style={styles.navCopy}>
                <Text
                  style={[styles.navText, selected && { color: base.textPrimary }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {!narrow || drawerOpen ? (
                  <Text style={styles.navSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.sidebarFoot, { borderTopColor: hexToRgba(colors.neon, 0.2) }]}>
        <Text style={styles.sidebarFootLabel}>SESSION</Text>
        <Text style={styles.sidebarFootValue}>superadmin · console</Text>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <LinearGradient
        colors={['#08111F', '#03060C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topBar, { borderBottomColor: hexToRgba(colors.neon, 0.28) }]}
      >
        <View style={styles.brandBlock}>
          {narrow ? (
            <Pressable
              onPress={() => setDrawerOpen((v) => !v)}
              style={[styles.menuBtn, { borderColor: hexToRgba(colors.neon, 0.45) }]}
              accessibilityRole="button"
              accessibilityLabel={drawerOpen ? 'Close menu' : 'Open menu'}
            >
              <Ionicons
                name={drawerOpen ? 'close' : 'menu'}
                size={20}
                color={base.textPrimary}
              />
            </Pressable>
          ) : null}
          <View style={[styles.brandMark, { borderColor: colors.neon }]}>
            <View style={[styles.brandCore, { backgroundColor: colors.neon }]} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.brandKicker}>ORACLE // SUPERADMIN</Text>
            <Text style={styles.brandTitle}>CONTROL PORTAL</Text>
          </View>
        </View>
        <View style={styles.topRight}>
          <View style={[styles.livePill, { borderColor: hexToRgba(colors.neon, 0.5) }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: colors.neon }]}>LIVE</Text>
          </View>
          <Pressable
            onPress={onExit}
            style={[styles.exitBtn, { borderColor: hexToRgba(colors.neon, 0.55) }]}
            accessibilityRole="button"
            accessibilityLabel="Exit portal"
          >
            <Ionicons name="arrow-back" size={16} color={base.textPrimary} />
            <Text style={styles.exitLabel}>EXIT</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {!narrow ? (
          <View
            style={[
              styles.sidebarDock,
              {
                width: sidebarWidth,
                borderRightColor: hexToRgba(colors.neon, 0.28),
                ...Platform.select({
                  web: {
                    boxShadow: `6px 0 32px ${hexToRgba(colors.neon, 0.06)}`,
                  } as object,
                }),
              },
            ]}
          >
            {sidebar}
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.contentHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contentKicker, { color: colors.neon }]}>
                {active.subtitle.toUpperCase()}
              </Text>
              <Text style={styles.contentTitle}>{active.title}</Text>
            </View>
          </View>
          <Animated.View
            style={[
              styles.contentBody,
              {
                opacity: panelOpacity,
                transform: [{ translateY: panelSlide }],
              },
            ]}
          >
            <PortalSectionBody section={section} />
          </Animated.View>
        </View>

        {narrow ? (
          <>
            <Animated.View
              pointerEvents={drawerOpen ? 'auto' : 'none'}
              style={[
                styles.backdrop,
                {
                  opacity: backdrop,
                },
              ]}
            >
              <Pressable style={StyleSheet.absoluteFill as object} onPress={() => setDrawerOpen(false)} />
            </Animated.View>
            <Animated.View
              style={[
                styles.drawer,
                {
                  width: sidebarWidth,
                  borderRightColor: hexToRgba(colors.neon, 0.35),
                  transform: [{ translateX: drawerX }],
                  ...Platform.select({
                    web: {
                      boxShadow: `8px 0 40px rgba(0,0,0,0.55)`,
                    } as object,
                  }),
                },
              ]}
            >
              {sidebar}
            </Animated.View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#02040A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,16,28,0.9)',
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandKicker: {
    color: base.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  brandTitle: {
    color: base.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(8,24,18,0.75)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3DFF9A',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: base.iconFrame,
  },
  exitLabel: {
    color: base.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  sidebarDock: {
    borderRightWidth: 1,
    backgroundColor: '#050910',
  },
  sidebarInner: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 10,
  },
  sidebarLabel: {
    color: base.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 12,
    marginLeft: 8,
  },
  sidebarScroll: {
    paddingBottom: 16,
    gap: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  navAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  navIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  navCopy: {
    flex: 1,
    gap: 1,
  },
  navText: {
    color: base.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  navSub: {
    color: 'rgba(148,163,184,0.65)',
    fontSize: 10,
    fontWeight: '500',
  },
  sidebarFoot: {
    borderTopWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  sidebarFootLabel: {
    color: base.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sidebarFootValue: {
    color: base.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentHeader: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  contentKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  contentTitle: {
    color: base.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  contentBody: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#050910',
    borderRightWidth: 1,
    zIndex: 30,
  },
});
