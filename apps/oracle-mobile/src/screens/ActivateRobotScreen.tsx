import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccess } from '../access/AccessStore';
import { EaTradeLogoMark } from '../components/EaTradeBrand';
import { useLicenses } from '../license/LicenseStore';
import { AUTH_DARK, authStyles, useDarkWebShell } from './authDarkShell';

export function ActivateRobotScreen() {
  useDarkWebShell('oracle-activate-shell');
  const insets = useSafeAreaInsets();
  const { sessionEmail } = useAccess();
  const { activateKey, keys: catalogKeys } = useLicenses();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onActivate = async () => {
    if (!sessionEmail) {
      setError('Sign in again, then enter your robot key.');
      return;
    }
    setBusy(true);
    try {
      const result = await activateKey(sessionEmail, key);
      if (!result.ok) {
        const count = result.catalogCount ?? catalogKeys.length;
        setError(
          `${result.reason ?? 'Invalid robot key.'}${
            typeof count === 'number' ? ` (${count} keys in catalog)` : ''
          }`,
        );
        return;
      }
      setError(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={authStyles.root} accessibilityLabel="Activate robot">
      <View style={authStyles.blackFill} pointerEvents="none" />
      <LinearGradient
        colors={['#0B1A3A', '#070B14', AUTH_DARK]}
        locations={[0, 0.45, 1]}
        style={authStyles.gradient}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={authStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={authStyles.scroll}
          contentContainerStyle={[
            authStyles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 48) + 120,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          nestedScrollEnabled
          bounces
          testID="activate-auth-scroll"
          {...(Platform.OS === 'web'
            ? ({
                dataSet: { authScroll: '1' },
              } as object)
            : null)}
        >
          <View style={authStyles.backBtn} />

          <View style={authStyles.hero}>
            <EaTradeLogoMark />
            <Text style={authStyles.brandLabel}>EA TRADE</Text>
            <Text style={authStyles.title}>Activate robot</Text>
            <Text style={authStyles.sub}>Enter the license key from your mentor</Text>
          </View>

          <View style={authStyles.card}>
            <Text style={authStyles.label}>ROBOT KEY</Text>
            <TextInput
              value={key}
              onChangeText={(v) => {
                setKey(v.toUpperCase());
                setError(null);
              }}
              placeholder="XXX-XXX-XXX-XXX"
              placeholderTextColor="#6B7280"
              autoCapitalize="characters"
              autoCorrect={false}
              style={authStyles.input}
              onSubmitEditing={() => void onActivate()}
              testID="activate-robot-key"
            />

            {error ? (
              <Text style={authStyles.error} testID="activate-robot-error">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void onActivate()}
              disabled={busy}
              style={[authStyles.continue, busy && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Activate"
              testID="activate-robot-submit"
            >
              {busy ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={authStyles.continueText}>Activate</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
