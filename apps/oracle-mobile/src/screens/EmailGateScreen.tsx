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
import { ea } from './portal/eaTradeTheme';

type Props = {
  onOpenAdminPortal: () => void;
};

export function EmailGateScreen({ onOpenAdminPortal }: Props) {
  const insets = useSafeAreaInsets();
  const { tryEnter } = useAccess();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onContinue = () => {
    const result = tryEnter(email);
    if (!result.ok) {
      setError(result.reason ?? 'Access denied.');
      return;
    }
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.markRow}>
        <View style={styles.logoMark}>
          <View style={styles.logoOuter}>
            <View style={styles.logoCore} />
          </View>
        </View>
        <Text style={styles.brand}>EA Trade</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Access check</Text>
        <Text style={styles.sub}>
          Enter the email your admin reactivated. This is not a signup — only activated emails can
          continue.
        </Text>

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="you@domain.com"
          placeholderTextColor={ea.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={onContinue}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={onContinue}
          style={styles.primary}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.primaryText}>Continue</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onOpenAdminPortal}
        style={styles.adminLink}
        accessibilityRole="button"
        accessibilityLabel="Open admin portal"
      >
        <Text style={styles.adminLinkText}>Admin portal</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ea.bg,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
    justifyContent: 'center',
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(47,107,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCore: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: ea.primary,
  },
  brand: {
    color: ea.text,
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    backgroundColor: ea.card,
    borderRadius: ea.radius,
    borderWidth: 1,
    borderColor: ea.border,
    padding: 20,
    gap: 12,
  },
  title: {
    color: ea.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sub: {
    color: ea.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: ea.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  input: {
    backgroundColor: ea.input,
    borderWidth: 1,
    borderColor: ea.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: ea.text,
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: ea.red,
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    backgroundColor: ea.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    ...Platform.select({
      web: { boxShadow: `0 0 20px ${ea.primaryGlow}` } as object,
      default: {},
    }),
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  adminLink: {
    alignSelf: 'center',
    marginTop: 22,
    padding: 10,
  },
  adminLinkText: {
    color: ea.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
