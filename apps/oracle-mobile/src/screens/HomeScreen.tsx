import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OracleCard } from '../components/OracleCard';
import { AddRobotButton } from '../components/AddRobotButton';
import { BottomNav, type TabKey } from '../components/BottomNav';
import { QuotesModal } from '../components/QuotesModal';
import { RobotPickerModal } from '../components/RobotPickerModal';
import { useAccess } from '../access/AccessStore';
import { useEas } from '../ea/EaStore';
import { DEFAULT_ORACLE_ID } from '../ea/types';
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
  const { eas, selected, selectedId, selectEa, removeEa } = useEas();
  const { signOut } = useAccess();

  /** REMOVE: clear session and return to Sign in; also drop selected user EA if any. */
  const onRemove = () => {
    if (selected.id !== DEFAULT_ORACLE_ID) {
      removeEa(selected.id);
    }
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
        <OracleCard
          running={eaRunning}
          onToggleStart={onToggleEa}
          onOpenQuotes={() => setQuotesOpen(true)}
          onRemove={onRemove}
          selectedCount={selectedSymbolIds.length}
          title={selected.name}
          imageUri={selected.imageUri}
        />
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
        eas={eas}
        selectedId={selectedId}
        onSelect={selectEa}
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
});
