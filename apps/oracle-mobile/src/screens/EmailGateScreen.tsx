import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import {
  buildAppReturnUrl,
  buildWhopCheckoutUrl,
  stashPendingCheckoutEmail,
  WHOP_CHECKOUT_PLAN_URL,
} from '../access/whop';
import { EaTradeLogoMark } from '../components/EaTradeBrand';

type Props = {
  onOpenAdminPortal: () => void;
};

type Step = 'email' | 'pay';

export function EmailGateScreen({ onOpenAdminPortal }: Props) {
  const insets = useSafeAreaInsets();
  const { tryEnter, recordWhopPaid, whopReturnHandled } = useAccess();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);

  // After Whop return, AccessProvider unlocks session — show brief note while settling
  useEffect(() => {
    if (!whopReturnHandled) return;
  }, [whopReturnHandled]);

  const onContinueEmail = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await tryEnter(email);
      if (result.ok) {
        setBusy(false);
        return;
      }
      if (result.needsPayment) {
        setStep('pay');
        setError(null);
        setInfo('Complete payment on Whop, then you can enter your license key.');
        setBusy(false);
        return;
      }
      setError(result.reason ?? 'Access denied.');
    } finally {
      setBusy(false);
    }
  };

  const openWhopCheckout = async () => {
    const n = email.trim().toLowerCase();
    if (!n.includes('@')) {
      setError('Enter a valid email first.');
      setStep('email');
      return;
    }
    stashPendingCheckoutEmail(n);
    const url = buildWhopCheckoutUrl(n);
    setInfo(`Return URL (configure in Whop if needed): ${buildAppReturnUrl(n)}`);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(url);
        return;
      }
      await Linking.openURL(url);
    } catch {
      setError(`Could not open Whop. Open manually: ${WHOP_CHECKOUT_PLAN_URL}`);
    }
  };

  /** Best-effort: client confirms payment (mock / Whop return without redirect). */
  const onConfirmPaid = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await recordWhopPaid(email);
      if (!result.ok) {
        setError(result.reason);
        setBusy(false);
        return;
      }
      setInfo('Payment saved. Continue to activate your license key.');
    } finally {
      setBusy(false);
    }
  };

  if (!whopReturnHandled) {
    return (
      <View style={[styles.root, styles.centerBoot]} testID="whop-return-boot">
        <ActivityIndicator color="#fff" />
        <Text style={styles.bootText}>Checking payment…</Text>
      </View>
    );
  }

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
          onPress={() => {
            if (step === 'pay') {
              setStep('email');
              setError(null);
              setInfo(null);
            }
          }}
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
          <Text style={styles.title}>{step === 'pay' ? 'Payment' : 'Sign in'}</Text>
          <Text style={styles.sub}>
            {step === 'pay'
              ? 'Pay on Whop to unlock Activate license key for this email.'
              : 'Use the email linked to your membership'}
          </Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
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
                testID="member-email-input"
                style={styles.input}
                onSubmitEditing={() => void onContinueEmail()}
              />

              {error ? (
                <Text style={styles.error} testID="member-email-error">
                  {error}
                </Text>
              ) : null}
              {info ? <Text style={styles.info}>{info}</Text> : null}

              <Pressable
                onPress={() => void onContinueEmail()}
                style={[styles.continue, busy && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
                testID="member-email-continue"
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#0A0A0A" />
                ) : (
                  <Text style={styles.continueText}>Continue</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>EMAIL</Text>
              <Text style={[styles.input, styles.emailReadonly]} testID="member-pay-email">
                {email.trim().toLowerCase()}
              </Text>
              <Text style={styles.payHint}>
                You will open Whop checkout. After paying, return here — we save your email as paid
                on the Subscription list (awaiting approval) and unlock Activate.
              </Text>

              {error ? (
                <Text style={styles.error} testID="member-pay-error">
                  {error}
                </Text>
              ) : null}
              {info ? <Text style={styles.info}>{info}</Text> : null}

              <Pressable
                onPress={() => void openWhopCheckout()}
                style={styles.whopBtn}
                accessibilityRole="button"
                accessibilityLabel="Pay with Whop"
                testID="whop-checkout-open"
              >
                <Text style={styles.whopBtnText}>Pay with Whop</Text>
              </Pressable>

              <Pressable
                onPress={() => void onConfirmPaid()}
                style={[styles.continue, busy && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="I have paid continue"
                testID="whop-confirm-paid"
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#0A0A0A" />
                ) : (
                  <Text style={styles.continueText}>I&apos;ve paid — continue</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setStep('email');
                  setError(null);
                  setInfo(null);
                }}
                testID="whop-back-email"
              >
                <Text style={styles.backLink}>Use a different email</Text>
              </Pressable>
            </>
          )}
        </View>

        <Pressable
          onPress={onOpenAdminPortal}
          style={styles.adminLink}
          accessibilityRole="button"
          accessibilityLabel="Admin"
          testID="open-admin-portal"
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
  centerBoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bootText: {
    color: '#9CA3AF',
    fontSize: 14,
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
  },
  emailReadonly: {
    paddingVertical: 14,
  },
  payHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  },
  info: {
    color: '#93C5FD',
    fontSize: 12,
    lineHeight: 17,
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
  whopBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  whopBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  backLink: {
    color: 'rgba(156,163,175,0.8)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
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
