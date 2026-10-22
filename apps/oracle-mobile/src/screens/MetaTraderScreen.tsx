import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, type TabKey } from '../components/BottomNav';
import { NeonBorder } from '../components/NeonBorder';
import { MT5_BROKERS } from '../data/brokers';
import { colors, radii, spacing } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onOpenPortal?: () => void;
};

export function MetaTraderScreen({ activeTab, onTabChange, onOpenPortal }: Props) {
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [broker, setBroker] = useState('');
  const [brokerFocused, setBrokerFocused] = useState(false);
  const [connected, setConnected] = useState(false);

  const brokerMatches = useMemo(() => {
    const q = broker.trim().toLowerCase();
    if (!q) {
      // Show a short starter list while focused with empty query
      return brokerFocused ? MT5_BROKERS.slice(0, 8) : [];
    }
    return MT5_BROKERS.filter((name) => name.toLowerCase().includes(q)).slice(0, 12);
  }, [broker, brokerFocused]);

  const showBrokerList = brokerFocused && brokerMatches.length > 0;

  const selectBroker = (name: string) => {
    setBroker(name);
    setBrokerFocused(false);
  };

  const clearBroker = () => {
    setBroker('');
    setBrokerFocused(true);
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.content}>
        <View style={styles.headerBlock}>
          <NeonBorder radius={radii.pill} fill={colors.navFill} style={styles.accountPill}>
            <Text style={styles.accountPillText}>MT5 ACCOUNT</Text>
          </NeonBorder>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, connected ? styles.statusDotOn : styles.statusDotOff]} />
            <Text style={styles.mt5Label}>MT5</Text>
          </View>

          <View style={styles.metricsRow}>
            <Text style={styles.metric}>
              <Text style={styles.metricLabel}>Equity </Text>
              <Text style={styles.metricValue}>—</Text>
            </Text>
            <Text style={styles.metric}>
              <Text style={styles.metricLabel}>Balance </Text>
              <Text style={styles.metricValue}>—</Text>
            </Text>
          </View>

          <View style={styles.logoMark} accessibilityLabel="eatrade">
            <View style={styles.logoBullseye}>
              <View style={styles.logoRingOuter} />
              <View style={styles.logoRingMid} />
              <View style={styles.logoCore} />
            </View>
            <Text style={styles.logoText}>eatrade</Text>
          </View>
        </View>

        <NeonBorder radius={radii.card} fill={colors.cardFill} style={styles.formCard}>
          <TextInput
            value={account}
            onChangeText={setAccount}
            placeholder="Account number"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel="Account number"
            autoCorrect={false}
          />

          <View style={styles.row}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              style={[styles.input, styles.inputFlex]}
              accessibilityLabel="Password"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.sideBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>

          <View style={styles.brokerBlock}>
            <View style={styles.row}>
              <View style={[styles.input, styles.inputFlex, styles.brokerField]}>
                <MaterialCommunityIcons
                  name="database-outline"
                  size={18}
                  color={broker ? colors.textPrimary : colors.textMuted}
                />
                <TextInput
                  value={broker}
                  onChangeText={(text) => {
                    setBroker(text);
                    setBrokerFocused(true);
                  }}
                  onFocus={() => setBrokerFocused(true)}
                  placeholder="Search broker"
                  placeholderTextColor={colors.textMuted}
                  style={styles.brokerInput}
                  accessibilityLabel="Broker"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              <Pressable
                style={styles.sideBtn}
                onPress={clearBroker}
                accessibilityRole="button"
                accessibilityLabel="Clear broker"
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {showBrokerList ? (
              <View style={styles.dropdown} accessibilityRole="list">
                <FlatList
                  data={brokerMatches}
                  keyExtractor={(item) => item}
                  keyboardShouldPersistTaps="handled"
                  style={styles.dropdownList}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.dropdownRow}
                      onPress={() => selectBroker(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select broker ${item}`}
                    >
                      <MaterialCommunityIcons
                        name="server"
                        size={16}
                        color={colors.neon}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={styles.dropdownText}>{item}</Text>
                    </Pressable>
                  )}
                />
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => setConnected((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Connect"
            style={styles.connectWrap}
          >
            <LinearGradient
              colors={connected ? ['#1F6B4A', '#2FA86E'] : ['#1A4FBF', '#3D8BFF', '#5AD0FF']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.connectBtn}
            >
              <Text style={styles.connectLabel}>{connected ? 'CONNECTED' : 'CONNECT'}</Text>
            </LinearGradient>
          </Pressable>
        </NeonBorder>
      </View>

      <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, spacing.navBottom) }]}>
        <BottomNav active={activeTab} onChange={onTabChange} onOpenPortal={onOpenPortal} />
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
  headerBlock: {
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 28,
  },
  accountPill: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginBottom: 14,
  },
  accountPillText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusDotOn: {
    backgroundColor: '#3DFF9A',
  },
  statusDotOff: {
    backgroundColor: colors.textMuted,
  },
  mt5Label: {
    color: '#8FB7FF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 22,
    marginBottom: 16,
  },
  metric: {
    fontSize: 14,
  },
  metricLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  logoMark: {
    alignItems: 'center',
    gap: 4,
  },
  logoBullseye: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRingOuter: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  logoRingMid: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  logoCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
  },
  logoText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  formCard: {
    padding: 16,
    gap: 12,
    overflow: 'visible',
  },
  input: {
    backgroundColor: '#0A0E1C',
    borderWidth: 1,
    borderColor: 'rgba(106, 160, 248, 0.35)',
    borderRadius: 14,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.neon,
    backgroundColor: colors.iconFrame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brokerBlock: {
    zIndex: 5,
  },
  brokerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 0,
  },
  brokerInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  dropdown: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: colors.neon,
    borderRadius: 14,
    backgroundColor: '#0A0E1C',
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(106, 160, 248, 0.25)',
  },
  dropdownText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  connectWrap: {
    marginTop: 4,
  },
  connectBtn: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  connectLabel: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  navWrap: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.gapAddToNav,
  },
});
