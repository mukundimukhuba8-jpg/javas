import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NeonBorder } from './NeonBorder';
import type { ChartSignal } from '../scanner/types';
import { colors, radii } from '../theme';

type Props = {
  signal: ChartSignal;
  symbolDraft: string;
  onChangeSymbol: (value: string) => void;
  onRescan: () => void;
};

export function ScanResultsCard({ signal, symbolDraft, onChangeSymbol, onRescan }: Props) {
  const bullish = signal.direction === 'BUY';

  return (
    <NeonBorder radius={radii.card} fill={colors.cardFill} style={styles.card}>
      <View style={styles.previewRow}>
        <Image source={{ uri: signal.imageUri }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.previewCopy}>
          <Text style={styles.kicker}>SCAN RESULT</Text>
          <Text style={[styles.direction, bullish ? styles.buy : styles.sell]}>
            {signal.direction}
          </Text>
          <Text style={styles.confidence}>{signal.confidence}% model confidence</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>SYMBOL</Text>
      <TextInput
        value={symbolDraft}
        onChangeText={onChangeSymbol}
        autoCapitalize="characters"
        style={styles.symbolInput}
        accessibilityLabel="Symbol"
      />
      {signal.symbolConfidence === 'low' ? (
        <Text style={styles.warn}>OCR was uncertain — edit symbol if needed.</Text>
      ) : null}

      <View style={styles.grid}>
        <Metric label="ENTRY" value={signal.entry == null ? '—' : String(signal.entry)} />
        <Metric label="TAKE PROFIT" value={String(signal.takeProfit)} accent="#3DFF9A" />
        <Metric label="STOP LOSS" value={String(signal.stopLoss)} accent="#FF6B6B" />
      </View>

      <Text style={styles.rationale}>{signal.rationale}</Text>
      <Text style={styles.notes}>{signal.notes}</Text>

      <Pressable style={styles.rescanBtn} onPress={onRescan} accessibilityRole="button">
        <Text style={styles.rescanLabel}>RETAKE / UPLOAD ANOTHER</Text>
      </Pressable>
    </NeonBorder>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neon,
    backgroundColor: '#111',
  },
  previewCopy: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  direction: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  buy: { color: '#3DFF9A' },
  sell: { color: '#FF6B6B' },
  confidence: {
    color: colors.textSub,
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  symbolInput: {
    borderWidth: 1,
    borderColor: colors.neon,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    backgroundColor: colors.actionRow,
  },
  warn: {
    color: '#FFC857',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(106,160,248,0.35)',
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.actionRow,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  rationale: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  notes: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  rescanBtn: {
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: colors.neon,
    borderRadius: radii.pill,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.addRobotFill,
  },
  rescanLabel: {
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 1.1,
    fontSize: 12,
  },
});
