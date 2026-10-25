import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccess } from '../access/AccessStore';
import { EaTradeIcon, EaTradeLogoStack } from '../components/EaTradeBrand';
import { useLicenses } from '../license/LicenseStore';

export function ActivateRobotScreen() {
  const insets = useSafeAreaInsets();
  const { sessionEmail } = useAccess();
  const { activateKey } = useLicenses();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onActivate = () => {
    if (!sessionEmail) {
      setError('Sign in again, then enter your robot key.');
      return;
    }
    const result = activateKey(sessionEmail, key);
    if (!result.ok) {
      setError(result.reason ?? 'Invalid robot key.');
      return;
    }
    setError(null);
  };

  return (
    <View style={styles.root}>
      <View style={styles.watermark} pointerEvents="none">
        <EaTradeIcon watermark size="lg" />
      </View>

      <KeyboardAvoidingView
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <EaTradeLogoStack />
          <Text style={styles.brandLabel}>EA TRADE</Text>
          <Text style={styles.title}>Activate robot</Text>
          <Text style={styles.sub}>Enter the license key from your mentor</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>ROBOT KEY</Text>
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
            style={styles.input}
            onSubmitEditing={onActivate}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onActivate}
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Activate"
          >
            <Text style={styles.primaryText}>Activate</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  watermark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 4.2 }],
    opacity: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  brandLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    marginTop: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  sub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  card: {
    backgroundColor: '#14161C',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 18px 40px rgba(0,0,0,0.35)' } as object,
      default: {},
    }),
  },
  label: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#0C0E14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  error: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
});
