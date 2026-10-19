import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OracleCard } from '../components/OracleCard';
import { AddRobotButton } from '../components/AddRobotButton';
import { BottomNav, TabKey } from '../components/BottomNav';
import { colors, spacing } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
};

export function HomeScreen({ activeTab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 8) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <OracleCard />
        <View style={styles.gap} />
        <AddRobotButton />
      </ScrollView>

      <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, spacing.navBottom) }]}>
        <BottomNav active={activeTab} onChange={onTabChange} />
      </View>
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
