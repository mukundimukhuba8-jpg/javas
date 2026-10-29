import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OracleCard } from '../components/OracleCard';
import { AddRobotButton } from '../components/AddRobotButton';
import { BottomNav, type TabKey } from '../components/BottomNav';
import { QuotesModal } from '../components/QuotesModal';
import { RobotPickerModal } from '../components/RobotPickerModal';
import { useAccess } from '../access/AccessStore';
import { useEas } from '../ea/EaStore';
import { useLicenses } from '../license/LicenseStore';
import { colors, spacing } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  selectedSymbolIds: string[];
  onChangeSelectedSymbols: (ids: string[]) => void;
  eaRunning: boolean;
  onToggleEa: () => void;
  onOpenPortal?: () => void;
  onCreateEa?: () => void;
};

export function HomeScreen({
  activeTab,
  onTabChange,
  selectedSymbolIds,
  onChangeSelectedSymbols,
  eaRunning,
  onToggleEa,
  onOpenPortal,
  onCreateEa,
}: Props) {
  const insets = useSafeAreaInsets();
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [robotsOpen, setRobotsOpen] = useState(false);
  const { sessionEmail, signOut } = useAccess();
  const { unlockedRobotsForEmail } = useLicenses();
  const { eas } = useEas();

  const robots = (sessionEmail ? unlockedRobotsForEmail(sessionEmail) : []).map((r) => {
    const live =
      eas.find((e) => e.id === r.id) ||
      eas.find((e) => e.name.trim().toLowerCase() === r.name.trim().toLowerCase());
    const a = typeof live?.imageUri === 'string' ? live.imageUri.trim() : '';
    const b = typeof r.imageUri === 'string' ? r.imageUri.trim() : '';
    let uploaded: string | null = null;
    if (a && b) {
      if (/^https?:\/\//i.test(a)) uploaded = a;
      else if (/^https?:\/\//i.test(b)) uploaded = b;
      else uploaded = a.length >= b.length ? a : b;
    } else {
      uploaded = a || b || null;
    }
    return {
      ...r,
      name: (live?.name || r.name || '').trim() || r.name,
      imageUri: uploaded,
    };
  });
  const [selectedId, setSelectedId] = useState<string | null>(robots[0]?.id ?? null);

  useEffect(() => {
    if (robots.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !robots.some((r) => r.id === selectedId)) {
      setSelectedId(robots[0].id);
    }
  }, [robots, selectedId]);

  const selected = robots.find((r) => r.id === selectedId) ?? robots[0] ?? null;

  /** REMOVE: clear session and return to Sign in. */
  const onRemove = () => {
    signOut();
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 8) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {selected ? (
          <OracleCard
            running={eaRunning}
            onToggleStart={onToggleEa}
            onOpenQuotes={() => setQuotesOpen(true)}
            onRemove={onRemove}
            selectedCount={selectedSymbolIds.length}
            title={selected.name}
            imageUri={selected.imageUri}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No robot activated</Text>
            <Text style={styles.emptySub}>
              Activate a license key tied to an EA to see it here.
            </Text>
          </View>
        )}
        <View style={styles.gap} />
        <AddRobotButton onPress={() => setRobotsOpen(true)} />
      </ScrollView>

      <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, spacing.navBottom) }]}>
        <BottomNav active={activeTab} onChange={onTabChange} onOpenPortal={onOpenPortal} />
      </View>

      <QuotesModal
        visible={quotesOpen}
        selectedIds={selectedSymbolIds}
        onChangeSelected={onChangeSelectedSymbols}
        onClose={() => setQuotesOpen(false)}
      />

      <RobotPickerModal
        visible={robotsOpen}
        robots={robots}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClose={() => setRobotsOpen(false)}
        onOpenPortal={onCreateEa ?? onOpenPortal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.screenTop,
    paddingBottom: 12,
  },
  gap: {
    height: spacing.gapCardToAdd,
  },
  navWrap: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.gapAddToNav,
    backgroundColor: colors.background,
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: colors.actionRow,
    padding: 28,
    minHeight: 280,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(106,160,248,0.25)',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
});
