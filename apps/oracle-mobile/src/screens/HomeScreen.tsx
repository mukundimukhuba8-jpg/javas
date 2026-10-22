import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OracleCard } from '../components/OracleCard';
import { AddRobotButton } from '../components/AddRobotButton';
import { BottomNav, type TabKey } from '../components/BottomNav';
import { QuotesModal } from '../components/QuotesModal';
import { colors, spacing } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  selectedSymbolIds: string[];
  onChangeSelectedSymbols: (ids: string[]) => void;
  eaRunning: boolean;
  onToggleEa: () => void;
};

export function HomeScreen({
  activeTab,
  onTabChange,
  selectedSymbolIds,
  onChangeSelectedSymbols,
  eaRunning,
  onToggleEa,
}: Props) {
  const insets = useSafeAreaInsets();
  const [quotesOpen, setQuotesOpen] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 8) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <OracleCard
          running={eaRunning}
          onToggleStart={onToggleEa}
          onOpenQuotes={() => setQuotesOpen(true)}
          selectedCount={selectedSymbolIds.length}
        />
        <View style={styles.gap} />
        <AddRobotButton />
      </ScrollView>

      <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, spacing.navBottom) }]}>
        <BottomNav active={activeTab} onChange={onTabChange} />
      </View>

      <QuotesModal
        visible={quotesOpen}
        selectedIds={selectedSymbolIds}
        onChangeSelected={onChangeSelectedSymbols}
        onClose={() => setQuotesOpen(false)}
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
});
