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
import { portalFonts, usePortalFonts } from '../../theme/portalFonts';
import { PORTAL_MENU, type PortalSectionId } from './portalSections';
import { PortalSectionBody } from './PortalSections';
import { ea } from './eaTradeTheme';

type Props = {
  onExit: () => void;
  initialSection?: PortalSectionId;
};

function HamburgerIcon({ color }: { color: string }) {
  return (
    <View style={ham.box} accessibilityElementsHidden>
      <View style={[ham.line, { backgroundColor: color }]} />
      <View style={[ham.line, { backgroundColor: color }]} />
      <View style={[ham.line, { backgroundColor: color }]} />
    </View>
  );
}

const ham = StyleSheet.create({
  box: { width: 18, height: 14, justifyContent: 'space-between' },
  line: { height: 2, width: 18, borderRadius: 1 },
});

function EaTradeMark({ fontsReady }: { fontsReady: boolean }) {
  const f = fontsReady ? portalFonts : null;
  return (
    <View style={styles.markRow}>
      <View style={styles.logoMark}>
        <View style={styles.logoOuter}>
          <View style={styles.logoMid}>
            <View style={styles.logoCore} />
          </View>
        </View>
      </View>
      <Text style={[styles.wordmark, f && { fontFamily: f.uiBold }]}>EA Trade</Text>
    </View>
  );
}

export function PortalScreen({ onExit, initialSection = 'dashboard' }: Props) {
  const fontsReady = usePortalFonts();
  const f = fontsReady ? portalFonts : null;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const sidebarWidth = Math.min(288, Math.max(248, width * 0.78));

  const [section, setSection] = useState<PortalSectionId>(initialSection);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopBooted, setDesktopBooted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const drawerX = useRef(new Animated.Value(-300)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(1)).current;

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
    Animated.timing(panelOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [section, panelOpacity]);

  const selectSection = (id: PortalSectionId) => {
    setSection(id);
    if (!isDesktop) setDrawerOpen(false);
  };

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
      {/* EA Trade header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setDrawerOpen((v) => !v)}
          style={styles.hamburgerBtn}
          accessibilityRole="button"
          accessibilityLabel={drawerOpen ? 'Close sidebar menu' : 'Open sidebar menu'}
          testID="portal-hamburger"
        >
          <HamburgerIcon color="#F5F5F7" />
        </Pressable>

        <EaTradeMark fontsReady={fontsReady} />

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setMenuOpen((v) => !v)}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Account menu"
          >
            <View style={styles.avatar}>
              <Ionicons name="hardware-chip" size={18} color="#93C5FD" />
            </View>
            <Ionicons name="chevron-down" size={14} color={ea.primary} />
          </Pressable>
        </View>
      </View>

      {menuOpen ? (
        <View style={styles.accountMenu}>
          <Text style={[styles.accountEmail, f && { fontFamily: f.uiMed }]}>
            eatrade@gmail.com
          </Text>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              onExit();
            }}
            style={styles.accountExit}
            accessibilityRole="button"
            accessibilityLabel="Exit portal"
          >
            <Ionicons name="exit-outline" size={16} color={ea.text} />
            <Text style={[styles.accountExitText, f && { fontFamily: f.uiBold }]}>EXIT</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.workspace}>
        <View
          style={[
            styles.main,
            isDesktop && drawerOpen ? { paddingLeft: sidebarWidth + 4 } : null,
          ]}
        >
          <Animated.View style={[styles.pageBody, { opacity: panelOpacity }]}>
            <PortalSectionBody
              section={section}
              fontsReady={fontsReady}
              onNavigate={selectSection}
            />
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents={drawerOpen && !isDesktop ? 'auto' : 'none'}
          style={[styles.backdrop, { opacity: backdropOp }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill as object}
            onPress={() => setDrawerOpen(false)}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: sidebarWidth,
              transform: [{ translateX: drawerX }],
              ...Platform.select({
                web: {
                  boxShadow: drawerOpen ? '10px 0 40px rgba(0,0,0,0.5)' : 'none',
                } as object,
              }),
            },
          ]}
        >
          <Text style={[styles.drawerLabel, f && { fontFamily: f.uiBold }]}>MENU</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.navScroll}
          >
            {PORTAL_MENU.map((item) => {
              const selected = item.id === section;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => selectSection(item.id)}
                  style={[styles.navItem, selected && styles.navItemSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.title}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={selected ? ea.primary : ea.textSecondary}
                  />
                  <Text
                    style={[
                      styles.navTitle,
                      f && { fontFamily: f.uiMed },
                      selected && { color: ea.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={onExit}
            style={styles.drawerExit}
            accessibilityRole="button"
            accessibilityLabel="Exit portal"
          >
            <Ionicons name="arrow-back" size={16} color={ea.text} />
            <Text style={[styles.drawerExitText, f && { fontFamily: f.uiBold }]}>
              Exit portal
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ea.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: ea.header,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ea.border,
    zIndex: 40,
  },
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ea.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ea.card,
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#151820',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(47,107,255,0.35)',
  },
  logoOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMid: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCore: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: ea.primary,
  },
  wordmark: {
    color: ea.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  avatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: 'rgba(47,107,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMenu: {
    position: 'absolute',
    top: 64,
    right: 14,
    zIndex: 50,
    backgroundColor: ea.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ea.borderStrong,
    padding: 12,
    gap: 10,
    minWidth: 200,
    ...Platform.select({
      web: { boxShadow: '0 12px 32px rgba(0,0,0,0.45)' } as object,
    }),
  },
  accountEmail: {
    color: ea.textSecondary,
    fontSize: 12,
  },
  accountExit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ea.cardElevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  accountExitText: {
    color: ea.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  workspace: {
    flex: 1,
    position: 'relative',
  },
  main: {
    flex: 1,
    zIndex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#121214',
    borderRightWidth: 1,
    borderRightColor: ea.border,
    zIndex: 30,
    paddingTop: 16,
  },
  drawerLabel: {
    color: ea.label,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    marginLeft: 18,
    marginBottom: 10,
  },
  navScroll: {
    paddingHorizontal: 10,
    gap: 4,
    paddingBottom: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemSelected: {
    backgroundColor: ea.primarySoft,
  },
  navTitle: {
    color: ea.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  drawerExit: {
    margin: 14,
    borderTopWidth: 1,
    borderTopColor: ea.border,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerExitText: {
    color: ea.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
