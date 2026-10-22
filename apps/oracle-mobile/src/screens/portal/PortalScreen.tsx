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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, hexToRgba } from '../../theme/ThemeContext';
import { portalFonts, usePortalFonts } from '../../theme/portalFonts';
import { PORTAL_MENU, type PortalSectionId } from './portalSections';
import { PortalSectionBody } from './PortalSections';

type Props = {
  onExit: () => void;
};

/** Explicit three-line hamburger — never an Ionicons menu glyph. */
function HamburgerIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <View style={ham.box} accessibilityElementsHidden>
      <View
        style={[
          ham.line,
          { backgroundColor: color },
          open && { transform: [{ rotate: '45deg' }, { translateY: 7 }] },
        ]}
      />
      <View
        style={[
          ham.line,
          { backgroundColor: color, opacity: open ? 0 : 1 },
        ]}
      />
      <View
        style={[
          ham.line,
          { backgroundColor: color },
          open && { transform: [{ rotate: '-45deg' }, { translateY: -7 }] },
        ]}
      />
    </View>
  );
}

const ham = StyleSheet.create({
  box: {
    width: 20,
    height: 16,
    justifyContent: 'space-between',
  },
  line: {
    height: 2,
    width: 20,
    borderRadius: 1,
  },
});

export function PortalScreen({ onExit }: Props) {
  const fontsReady = usePortalFonts();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const sidebarWidth = Math.min(280, Math.max(240, width * 0.72));

  const [section, setSection] = useState<PortalSectionId>('dashboard');
  // Mobile-first: closed by default. Desktop opens once; ☰ always toggles.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopBooted, setDesktopBooted] = useState(false);
  const active = PORTAL_MENU.find((m) => m.id === section) ?? PORTAL_MENU[0];

  const panelOpacity = useRef(new Animated.Value(1)).current;
  const panelY = useRef(new Animated.Value(0)).current;
  const drawerX = useRef(new Animated.Value(-280)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDesktop && !desktopBooted) {
      setDrawerOpen(true);
      setDesktopBooted(true);
    }
    if (!isDesktop) {
      setDesktopBooted(false);
      setDrawerOpen(false);
    }
  }, [isDesktop, desktopBooted]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerX, {
        toValue: drawerOpen ? 0 : -sidebarWidth,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOp, {
        toValue: drawerOpen && !isDesktop ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerOpen, sidebarWidth, isDesktop, drawerX, backdropOp]);

  useEffect(() => {
    panelOpacity.setValue(0);
    panelY.setValue(8);
    Animated.parallel([
      Animated.timing(panelOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(panelY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [section, panelOpacity, panelY]);

  const selectSection = (id: PortalSectionId) => {
    setSection(id);
    if (!isDesktop) setDrawerOpen(false);
  };

  const f = fontsReady ? portalFonts : null;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {/* Top bar — ☰ always present */}
      <View style={[styles.topBar, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <View style={styles.topLeft}>
          <Pressable
            onPress={() => setDrawerOpen((v) => !v)}
            style={[styles.hamburgerBtn, { borderColor: hexToRgba(colors.neon, 0.4) }]}
            accessibilityRole="button"
            accessibilityLabel={drawerOpen ? 'Close sidebar menu' : 'Open sidebar menu'}
            testID="portal-hamburger"
          >
            <HamburgerIcon open={drawerOpen} color="#F4F7FB" />
          </Pressable>
          <View>
            <Text
              style={[
                styles.brandEyebrow,
                f && { fontFamily: f.uiMed },
                { color: colors.neon },
              ]}
            >
              ORACLE SUPERADMIN
            </Text>
            <Text style={[styles.brandTitle, f && { fontFamily: f.display }]}>
              Portal
            </Text>
          </View>
        </View>
        <View style={styles.topRight}>
          <View style={[styles.statusChip, { borderColor: 'rgba(61,255,154,0.35)' }]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, f && { fontFamily: f.uiMed }]}>Live</Text>
          </View>
          <Pressable
            onPress={onExit}
            style={[styles.exitBtn, { borderColor: hexToRgba(colors.neon, 0.45) }]}
            accessibilityRole="button"
            accessibilityLabel="Exit portal"
          >
            <Ionicons name="arrow-back" size={15} color="#F4F7FB" />
            <Text style={[styles.exitLabel, f && { fontFamily: f.uiBold }]}>EXIT</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.workspace}>
        {/* Main content insets when desktop drawer is open */}
        <View
          style={[
            styles.main,
            isDesktop && drawerOpen ? { paddingLeft: sidebarWidth + 8 } : null,
          ]}
        >
          <View style={styles.pageHead}>
            <Text
              style={[
                styles.pageKicker,
                f && { fontFamily: f.uiMed },
                { color: colors.neon },
              ]}
            >
              {active.subtitle}
            </Text>
            <Text style={[styles.pageTitle, f && { fontFamily: f.display }]}>
              {active.title}
            </Text>
          </View>
          <Animated.View
            style={[
              styles.pageBody,
              { opacity: panelOpacity, transform: [{ translateY: panelY }] },
            ]}
          >
            <PortalSectionBody section={section} fontsReady={fontsReady} />
          </Animated.View>
        </View>

        {/* Backdrop on mobile when drawer open */}
        <Animated.View
          pointerEvents={drawerOpen && !isDesktop ? 'auto' : 'none'}
          style={[styles.backdrop, { opacity: backdropOp }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill as object}
            onPress={() => setDrawerOpen(false)}
            accessibilityLabel="Dismiss sidebar"
          />
        </Animated.View>

        {/* Drawer sidebar — toggled only via ☰ */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: sidebarWidth,
              borderRightColor: hexToRgba(colors.neon, 0.22),
              transform: [{ translateX: drawerX }],
              ...Platform.select({
                web: {
                  boxShadow: drawerOpen
                    ? '12px 0 48px rgba(0,0,0,0.45)'
                    : 'none',
                } as object,
              }),
            },
          ]}
        >
          <View style={styles.drawerHead}>
            <Text style={[styles.drawerLabel, f && { fontFamily: f.uiBold }]}>
              NAVIGATION
            </Text>
            <Text style={[styles.drawerHint, f && { fontFamily: f.ui }]}>
              10 modules
            </Text>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.navScroll}
          >
            {PORTAL_MENU.map((item, index) => {
              const selected = item.id === section;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => selectSection(item.id)}
                  style={[
                    styles.navItem,
                    selected && {
                      backgroundColor: hexToRgba(colors.neon, 0.1),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.title}
                >
                  <Text
                    style={[
                      styles.navIndex,
                      f && { fontFamily: f.mono },
                      selected && { color: colors.neon },
                    ]}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <View style={styles.navCopy}>
                    <Text
                      style={[
                        styles.navTitle,
                        f && { fontFamily: f.uiMed },
                        selected && { color: '#F8FAFC' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[styles.navSub, f && { fontFamily: f.ui }]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                  {selected ? (
                    <View style={[styles.navPip, { backgroundColor: colors.neon }]} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.drawerFoot, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={[styles.footLabel, f && { fontFamily: f.uiBold }]}>SESSION</Text>
            <Text style={[styles.footValue, f && { fontFamily: f.uiMed }]}>
              superadmin · console
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07090F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: '#0A0D14',
    zIndex: 40,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  hamburgerBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111522',
  },
  brandEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '600',
    marginBottom: 1,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(12, 28, 22, 0.7)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3DFF9A',
  },
  statusText: {
    color: '#3DFF9A',
    fontSize: 11,
    fontWeight: '600',
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#121526',
  },
  exitLabel: {
    color: '#F4F7FB',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  main: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    zIndex: 1,
  },
  pageHead: {
    marginBottom: 16,
    gap: 4,
  },
  pageKicker: {
    fontSize: 11,
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  pageBody: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2,4,10,0.62)',
    zIndex: 20,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0B0E16',
    borderRightWidth: 1,
    zIndex: 30,
    paddingTop: 8,
  },
  drawerHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 2,
  },
  drawerLabel: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  drawerHint: {
    color: 'rgba(148,163,184,0.55)',
    fontSize: 12,
  },
  navScroll: {
    paddingHorizontal: 10,
    paddingBottom: 16,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  navIndex: {
    color: 'rgba(148,163,184,0.45)',
    fontSize: 11,
    width: 22,
  },
  navCopy: {
    flex: 1,
    gap: 1,
  },
  navTitle: {
    color: 'rgba(226,232,240,0.78)',
    fontSize: 13.5,
    fontWeight: '600',
  },
  navSub: {
    color: 'rgba(148,163,184,0.5)',
    fontSize: 11,
  },
  navPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  drawerFoot: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  footLabel: {
    color: 'rgba(148,163,184,0.55)',
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: '700',
  },
  footValue: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 3,
  },
});
