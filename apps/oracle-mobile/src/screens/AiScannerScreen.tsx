import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, type TabKey } from '../components/BottomNav';
import { NeonBorder } from '../components/NeonBorder';
import { colors, radii, spacing } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
};

export function AiScannerScreen({ activeTab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  const stubUpload = () => {
    setPickedLabel('Chart ready for analysis (stub)');
    if (Platform.OS === 'web') {
      // Keep UX light on web — no native picker required.
      return;
    }
    Alert.alert('Upload chart', 'Image picker stub — wire expo-image-picker when ready.');
  };

  const stubCamera = () => {
    setPickedLabel('Photo capture stub');
    if (Platform.OS === 'web') return;
    Alert.alert('Take photo', 'Camera stub — wire expo-image-picker / camera when ready.');
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.content}>
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

        <Pressable onPress={stubUpload} accessibilityRole="button" accessibilityLabel="Upload chart">
          <NeonBorder radius={22} fill={colors.cardFill} style={styles.uploadBox}>
            <Ionicons name="cloud-upload-outline" size={36} color={colors.neon} />
            <Text style={styles.uploadTitle}>Tap to upload chart</Text>
            <Text style={styles.uploadHint}>
              Charts only — MetaTrader, TradingView, or similar
            </Text>
            {pickedLabel ? <Text style={styles.picked}>{pickedLabel}</Text> : null}
          </NeonBorder>
        </Pressable>

        <Pressable
          style={styles.photoBtn}
          onPress={stubCamera}
          accessibilityRole="button"
          accessibilityLabel="Take photo of chart"
        >
          <MaterialCommunityIcons name="line-scan" size={22} color={colors.neon} />
          <Text style={styles.photoLabel}>Take photo of chart</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          AI analysis is for educational purposes only. Not financial advice. Always do your own
          research.
        </Text>
      </View>

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
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenH,
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
  picked: {
    marginTop: 6,
    color: '#3DFF9A',
    fontSize: 12,
    fontWeight: '700',
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
  disclaimer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  navWrap: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.gapAddToNav,
  },
});
