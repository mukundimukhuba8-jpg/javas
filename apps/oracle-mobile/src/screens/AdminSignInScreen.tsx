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
import { EaTradeLogoMark } from '../components/EaTradeBrand';
import { verifyAdminCredentials } from '../access/adminAuth';

type Props = {
  onSuccess: () => void;
  onBackToMember?: () => void;
};

export function AdminSignInScreen({ onSuccess, onBackToMember }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSignIn = () => {
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }
    if (!verifyAdminCredentials(email, password)) {
      setError('Wrong email or password.');
      return;
    }
    setError(null);
    onSuccess();
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
        {onBackToMember ? (
          <Pressable
            style={styles.backBtn}
            onPress={onBackToMember}
            accessibilityRole="button"
            accessibilityLabel="Back to member sign in"
            hitSlop={8}
          >
            <View style={styles.backArrow} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}

        <View style={styles.hero}>
          <EaTradeLogoMark />
          <Text style={styles.brandLabel}>EA TRADE</Text>
          <Text style={styles.title}>Signin</Text>
          <Text style={styles.sub}>Welcome back! please login with your account details</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
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
          />

          <Text style={[styles.label, { marginTop: 14 }]}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            placeholder="••••••••"
            placeholderTextColor="#6B7280"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            onSubmitEditing={onSignIn}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Pressable
            onPress={onSignIn}
            style={styles.continue}
            accessibilityRole="button"
            accessibilityLabel="Signin"
          >
            <Text style={styles.continueText}>Signin</Text>
          </Pressable>
        </View>

        <View style={styles.footerLinks}>
          <Pressable
            onPress={() => {
              setError(null);
              setInfo('Password reset is not available yet. Contact your admin.');
            }}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
          >
            <Text style={styles.linkText}>Forgot password</Text>
          </Pressable>
          <Text style={styles.linkSep}>|</Text>
          <Pressable
            onPress={() => {
              setError(null);
              setInfo('Registration is coming soon.');
            }}
            accessibilityRole="button"
            accessibilityLabel="Dont have account register"
          >
            <Text style={styles.linkText}>Dont have account register</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 22,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backArrow: {
    width: 12,
    height: 12,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#E5E7EB',
    transform: [{ rotate: '45deg' }],
    marginLeft: 6,
  },
  hero: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 28,
    gap: 10,
  },
  brandLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sub: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: 'rgba(17, 24, 39, 0.88)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    padding: 18,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0B1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(75, 85, 99, 0.8)',
    color: '#F9FAFB',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: {
    color: '#F87171',
    fontSize: 13,
    marginTop: 12,
  },
  info: {
    color: '#93C5FD',
    fontSize: 13,
    marginTop: 12,
  },
  continue: {
    marginTop: 18,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  continueText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '800',
  },
  footerLinks: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
  },
  linkSep: {
    color: '#4B5563',
    fontSize: 13,
  },
});
