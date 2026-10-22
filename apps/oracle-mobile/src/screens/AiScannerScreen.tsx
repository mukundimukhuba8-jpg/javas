import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, type TabKey } from '../components/BottomNav';
import { CameraCaptureModal } from '../components/CameraCaptureModal';
import { NeonBorder } from '../components/NeonBorder';
import { ScanResultsCard } from '../components/ScanResultsCard';
import { analyzeChartImage } from '../scanner/analyzeChart';
import { pickChartFromLibrary, pickChartFromNativeCamera } from '../scanner/pickChart';
import type { ChartSignal } from '../scanner/types';
import { colors, spacing } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
};

export function AiScannerScreen({ activeTab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signal, setSignal] = useState<ChartSignal | null>(null);
  const [symbolDraft, setSymbolDraft] = useState('');

  const runAnalysis = async (uri: string) => {
    setCameraOpen(false);
    setScanning(true);
    setError(null);
    setSignal(null);
    setProgress('Preparing chart…');
    try {
      const result = await analyzeChartImage(uri, setProgress);
      setSignal(result);
      setSymbolDraft(result.symbol);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      setError(msg);
    } finally {
      setScanning(false);
      setProgress('');
    }
  };

  const onUpload = async () => {
    setError(null);
    const uri = await pickChartFromLibrary();
    if (uri) await runAnalysis(uri);
  };

  const onTakePhoto = async () => {
    setError(null);
    if (Platform.OS === 'web') {
      setCameraOpen(true);
      return;
    }
    const uri = await pickChartFromNativeCamera();
    if (uri) await runAnalysis(uri);
  };

  const reset = () => {
    setSignal(null);
    setSymbolDraft('');
    setError(null);
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => onTabChange('home')}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>AI SCANNER</Text>
            <Text style={styles.subtitle}>Upload a chart for AI analysis</Text>
          </View>
        </View>

        {scanning ? (
          <NeonBorder radius={22} fill={colors.cardFill} style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.neon} />
            <Text style={styles.loadingTitle}>Scanning chart…</Text>
            <Text style={styles.loadingHint}>{progress || 'OCR + signal engine running'}</Text>
          </NeonBorder>
        ) : null}

        {!scanning && signal ? (
          <ScanResultsCard
            signal={{ ...signal, symbol: symbolDraft || signal.symbol }}
            symbolDraft={symbolDraft}
            onChangeSymbol={setSymbolDraft}
            onRescan={reset}
          />
        ) : null}

        {!scanning && !signal ? (
          <>
            <Pressable
              onPress={onUpload}
              accessibilityRole="button"
              accessibilityLabel="Upload chart"
            >
              <NeonBorder radius={22} fill={colors.cardFill} style={styles.uploadBox}>
                <Ionicons name="cloud-upload-outline" size={36} color={colors.neon} />
                <Text style={styles.uploadTitle}>Tap to upload chart</Text>
                <Text style={styles.uploadHint}>
                  Charts only — MetaTrader, TradingView, or similar
                </Text>
              </NeonBorder>
            </Pressable>

            <Pressable
              style={styles.photoBtn}
              onPress={onTakePhoto}
              accessibilityRole="button"
              accessibilityLabel="Take photo of chart"
            >
              <MaterialCommunityIcons name="line-scan" size={22} color={colors.neon} />
              <Text style={styles.photoLabel}>Take photo of chart</Text>
            </Pressable>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.disclaimer}>
          AI analysis is for educational purposes only. Not financial advice. Always do your own
          research.
        </Text>
      </ScrollView>

      <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, spacing.navBottom) }]}>
        <BottomNav active={activeTab} onChange={onTabChange} />
      </View>

      <CameraCaptureModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(uri) => {
          void runAnalysis(uri);
        }}
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
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
    marginTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.neon,
    backgroundColor: colors.iconFrame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 14,
  },
  uploadBox: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 10,
    marginBottom: 16,
  },
  uploadTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  uploadHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A1D2A',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 28,
  },
  photoLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  loadingBox: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 24,
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  loadingHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  error: {
    color: '#FF8A8A',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  navWrap: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.gapAddToNav,
  },
});
