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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccess } from '../access/AccessStore';
import { EaTradeLogoMark } from '../components/EaTradeBrand';

type Props = {
  onOpenAdminPortal: () => void;
};

export function EmailGateScreen({ onOpenAdminPortal }: Props) {
  const insets = useSafeAreaInsets();
  const { tryEnter } = useAccess();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    const result = await tryEnter(email);
    if (!result.ok) {
      setError(result.reason ?? 'Access denied.');
      return;
    }
    setError(null);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0B1A3A', '#070B14', '#000000']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <View style={styles.backArrow} />
        </Pressable>

        <View style={styles.hero}>
          <Pressable
            onLongPress={onOpenAdminPortal}
            delayLongPress={700}
            accessibilityRole="image"
            accessibilityLabel="EA Trade logo. Long press for admin."
          >
            <EaTradeLogoMark />
          </Pressable>

          <Text style={styles.brandLabel}>EA TRADE</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.sub}>Use the email linked to your membership</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder="you@email.com"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            onSubmitEditing={onContinue}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onContinue}
            style={styles.continue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onOpenAdminPortal}
          style={styles.adminLink}
          accessibilityRole="button"
          accessibilityLabel="Admin"
        >
          <Text style={styles.adminLinkText}>Admin</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
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
    marginTop: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  sub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
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
    fontWeight: '500',
  },
  error: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  },
  continue: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
  },
  continueText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
  adminLink: {
    alignSelf: 'center',
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  adminLinkText: {
    color: 'rgba(156,163,175,0.45)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
});
