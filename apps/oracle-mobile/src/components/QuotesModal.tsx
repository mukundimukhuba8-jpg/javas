import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRADE_SYMBOLS, type TradeSymbol } from '../data/symbols';
import { colors, radii, spacing } from '../theme';
import { NeonBorder } from './NeonBorder';

type Props = {
  visible: boolean;
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
  onClose: () => void;
};

export function QuotesModal({ visible, selectedIds, onChangeSelected, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRADE_SYMBOLS;
    return TRADE_SYMBOLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (symbol: TradeSymbol) => {
    const next = new Set(selected);
    if (next.has(symbol.id)) next.delete(symbol.id);
    else next.add(symbol.id);
    onChangeSelected(Array.from(next));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 12) }]}>
        <NeonBorder radius={radii.card} fill={colors.cardFill} style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>QUOTES</Text>
              <Text style={styles.subtitle}>
                {selectedIds.length} selected · tap to multi-select
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close quotes"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search symbols…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="characters"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>No symbols match “{query.trim()}”.</Text>
            }
            renderItem={({ item }) => {
              const isOn = selected.has(item.id);
              return (
                <Pressable
                  style={[styles.row, isOn && styles.rowSelected]}
                  onPress={() => toggle(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn }}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.symbol}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {item.category} · {item.description}
                    </Text>
                  </View>
                  <View style={[styles.check, isOn && styles.checkOn]}>
                    {isOn ? (
                      <Ionicons name="checkmark" size={16} color={colors.textPrimary} />
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable style={styles.doneBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.doneLabel}>DONE</Text>
            </Pressable>
          </View>
        </NeonBorder>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: spacing.screenH,
    paddingBottom: 12,
  },
  sheet: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSub,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iconFrame,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neon,
    borderRadius: radii.pill,
    backgroundColor: colors.navFill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 28,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(106, 160, 248, 0.28)',
    backgroundColor: colors.actionRow,
  },
  rowSelected: {
    borderColor: colors.neon,
    backgroundColor: colors.addRobotFill,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  symbol: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.neonMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    borderColor: colors.neon,
    backgroundColor: colors.plusCircle,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  doneBtn: {
    borderWidth: 1.5,
    borderColor: colors.neon,
    borderRadius: radii.pill,
    backgroundColor: colors.addRobotFill,
    alignItems: 'center',
    paddingVertical: 14,
  },
  doneLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});
