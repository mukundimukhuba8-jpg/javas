import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

const DARK = '#000000';

/** Force document chrome dark on web so keyboard / autofill never flashes white. */
function useDarkWebShell() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prev = {
      htmlBg: html.style.backgroundColor,
      htmlColor: html.style.color,
      bodyBg: body.style.backgroundColor,
      bodyColor: body.style.color,
      rootBg: root?.style.backgroundColor ?? '',
    };
    html.style.backgroundColor = DARK;
    html.style.color = '#FFFFFF';
    body.style.backgroundColor = DARK;
    body.style.color = '#FFFFFF';
    if (root) root.style.backgroundColor = DARK;

    const styleId = 'oracle-admin-signin-autofill';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        html, body, #root { background-color: ${DARK} !important; color: #fff; min-height: 100%; }
        input, textarea {
          color-scheme: dark;
          caret-color: #fff;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        select:-webkit-autofill {
          -webkit-text-fill-color: #FFFFFF !important;
          caret-color: #FFFFFF !important;
          transition: background-color 99999s ease-out 0s;
          box-shadow: 0 0 0px 1000px #0C0E14 inset !important;
          background-color: #0C0E14 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      html.style.backgroundColor = prev.htmlBg;
      html.style.color = prev.htmlColor;
      body.style.backgroundColor = prev.bodyBg;
      body.style.color = prev.bodyColor;
      if (root) root.style.backgroundColor = prev.rootBg;
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);
}

export function AdminSignInScreen({ onSuccess, onBackToMember }: Props) {
  useDarkWebShell();
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
    <View style={styles.root} accessibilityLabel="Admin signin">
      {/* Solid black base — always paints even if gradient fails on web */}
      <View style={styles.blackFill} pointerEvents="none" />
      <LinearGradient
        colors={['#0B1A3A', '#070B14', '#000000']}
        locations={[0, 0.45, 1]}
        style={styles.gradient}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 28) + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
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
              autoComplete="email"
              textContentType="emailAddress"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 4 }]}>PASSWORD</Text>
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
              autoComplete="password"
              textContentType="password"
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK,
    ...Platform.select({
      web: {
        minHeight: '100vh' as unknown as number,
        width: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  },
  blackFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: DARK,
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  flex: {
    flex: 1,
    backgroundColor: DARK,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    backgroundColor: DARK,
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
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginTop: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sub: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '400',
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
    fontWeight: '500',
    ...Platform.select({
      web: {
        outlineWidth: 0,
        colorScheme: 'dark',
      } as object,
      default: {},
    }),
  },
  error: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  },
  info: {
    color: '#93C5FD',
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
  footerLinks: {
    marginTop: 28,
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
