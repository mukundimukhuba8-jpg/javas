import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import { useAccess } from '../access/AccessStore';
import {
  buildAppReturnUrl,
  buildWhopCheckoutUrl,
  peekPendingCheckoutEmail,
  stashPendingCheckoutEmail,
  WHOP_CHECKOUT_PLAN_URL,
} from '../access/whop';
import { EaTradeLogoMark } from '../components/EaTradeBrand';
import { AUTH_DARK, authStyles, useDarkWebShell } from './authDarkShell';

type Props = {
  onOpenAdminPortal: () => void;
};

type Step = 'email' | 'pay';

export function EmailGateScreen({ onOpenAdminPortal }: Props) {
  useDarkWebShell('oracle-member-auth-shell');
  const insets = useSafeAreaInsets();
  const {
    tryEnter,
    whopReturnHandled,
    whopReturnError,
    clearWhopReturnError,
    checkWhopPayment,
  } = useAccess();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [checkingPay, setCheckingPay] = useState(false);

  // Invalid / forged Whop return → stay on Payment with an error (never unlock)
  useEffect(() => {
    if (!whopReturnHandled || !whopReturnError) return;
    setStep('pay');
    setError(whopReturnError);
    setInfo(null);
    if (!email.trim()) {
      const pending = peekPendingCheckoutEmail();
      if (pending) setEmail(pending);
    }
  }, [whopReturnHandled, whopReturnError, email]);

  // After Pay with Whop, poll cloud/webhook unlock every few seconds on Payment
  useEffect(() => {
    if (step !== 'pay') return;
    const n = email.trim().toLowerCase();
    if (!n.includes('@')) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || checkingPay) return;
      try {
        const result = await checkWhopPayment(n);
        if (!cancelled && result.paid) {
          setInfo('Payment confirmed. Opening Activate…');
          setError(null);
        }
      } catch {
        /* ignore transient */
      }
    };
    const id = setInterval(() => void tick(), 8_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, email, checkWhopPayment, checkingPay]);

  const onContinueEmail = async () => {
    const n = email.trim().toLowerCase();
    setEmail(n);
    if (!n || !n.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo('Checking access…');
    try {
      const result = await Promise.race([
        tryEnter(n),
        new Promise<{ ok: false; needsPayment: true; reason: string }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: false,
                needsPayment: true,
                reason: 'Cloud check took too long. Continue to payment to unlock Activate.',
              }),
            12_000,
          ),
        ),
      ]);
      if (result.ok) {
        setInfo(null);
        return;
      }
      if (result.needsPayment) {
        setStep('pay');
        setError(null);
        setInfo(
          result.reason ||
            'Complete payment on Whop, then you can enter your license key.',
        );
        return;
      }
      setError(result.reason ?? 'Access denied.');
      setInfo(null);
    } catch (e) {
      setStep('pay');
      setError(null);
      setInfo(
        e instanceof Error
          ? `${e.message} — continue to payment.`
          : 'Continue to payment to unlock Activate.',
      );
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
    setInfo(
      `After paying, Whop should return you here. Configure redirect to: ${buildAppReturnUrl(n)}`,
    );
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

  /** Poll Whop via server API (when keys configured) — auto-unlocks Activate if paid. */
  const onCheckPayment = async () => {
    const n = email.trim().toLowerCase();
    if (!n.includes('@')) {
      setError('Enter a valid email first.');
      return;
    }
    setCheckingPay(true);
    setError(null);
    setInfo('Checking Whop for payment…');
    clearWhopReturnError();
    try {
      const result = await checkWhopPayment(n);
      if (result.paid) {
        setInfo('Payment confirmed. Opening Activate…');
        return;
      }
      if (!result.configured) {
        setInfo(
          'Live Whop verify is not configured yet (API key). Finish checkout so Whop redirects back with a success return URL.',
        );
        return;
      }
      setError(
        result.reason === 'no_membership'
          ? 'Whop has no paid membership for this email on this plan yet.'
          : 'Payment not confirmed on Whop yet. Finish checkout, then check again.',
      );
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check Whop.');
      setInfo(null);
    } finally {
      setCheckingPay(false);
    }
  };

  if (!whopReturnHandled) {
    return (
      <View style={[authStyles.root, styles.centerBoot]} testID="whop-return-boot">
        <ActivityIndicator color="#fff" />
        <Text style={styles.bootText}>Checking payment…</Text>
      </View>
    );
  }

  return (
    <View style={authStyles.root} accessibilityLabel="Member signin">
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
              paddingBottom: Math.max(insets.bottom, 48) + 140,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          nestedScrollEnabled
          bounces
          testID="member-auth-scroll"
          {...(Platform.OS === 'web'
            ? ({
                dataSet: { authScroll: '1' },
              } as object)
            : null)}
        >
          <Pressable
            style={authStyles.backBtn}
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
            <View style={authStyles.backArrow} />
          </Pressable>

          <View style={authStyles.hero}>
            <Pressable
              onLongPress={onOpenAdminPortal}
              delayLongPress={700}
              accessibilityRole="image"
              accessibilityLabel="EA Trade logo. Long press for admin."
            >
              <EaTradeLogoMark />
            </Pressable>

            <Text style={authStyles.brandLabel}>EA TRADE</Text>
            <Text style={authStyles.title} testID="member-auth-title">
              {step === 'pay' ? 'Payment' : 'Sign in'}
            </Text>
            <Text style={authStyles.sub}>
              {step === 'pay'
                ? 'Pay on Whop to unlock Activate license key for this email.'
                : 'Use the email linked to your membership'}
            </Text>
          </View>

          <View style={authStyles.card}>
            {step === 'email' ? (
              <>
                <Text style={authStyles.label}>EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setError(null);
                    setInfo(null);
                  }}
                  placeholder="you@email.com"
                  placeholderTextColor="#6B7280"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  testID="member-email-input"
                  style={authStyles.input}
                  editable={!busy}
                  onSubmitEditing={() => void onContinueEmail()}
                />

                {error ? (
                  <Text style={authStyles.error} testID="member-email-error">
                    {error}
                  </Text>
                ) : null}
                {info ? (
                  <Text style={authStyles.info} testID="member-email-info">
                    {info}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => void onContinueEmail()}
                  style={[authStyles.continue, busy && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                  testID="member-email-continue"
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#0A0A0A" testID="member-email-busy" />
                  ) : (
                    <Text style={authStyles.continueText}>Continue</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={authStyles.label}>EMAIL</Text>
                <Text style={[authStyles.input, styles.emailReadonly]} testID="member-pay-email">
                  {email.trim().toLowerCase()}
                </Text>
                <Text style={styles.payHint}>
                  Open Whop checkout to pay. After a successful payment you return here and Activate
                  unlocks automatically when Whop confirms (API/webhook) or via the verified return
                  URL. There is no manual “I paid” unlock.
                </Text>

                {error ? (
                  <Text style={authStyles.error} testID="member-pay-error">
                    {error}
                  </Text>
                ) : null}
                {info ? <Text style={authStyles.info}>{info}</Text> : null}

                <Pressable
                  onPress={() => {
                    clearWhopReturnError();
                    void openWhopCheckout();
                  }}
                  style={styles.whopBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Pay with Whop"
                  testID="whop-checkout-open"
                >
                  <Text style={styles.whopBtnText}>Pay with Whop</Text>
                </Pressable>

                <Pressable
                  onPress={() => void onCheckPayment()}
                  style={[styles.checkBtn, checkingPay && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Check payment status"
                  testID="whop-check-payment"
                  disabled={checkingPay || busy}
                >
                  {checkingPay ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.checkBtnText}>Check payment status</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setStep('email');
                    setError(null);
                    setInfo(null);
                    clearWhopReturnError();
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bootText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  emailReadonly: {
    paddingVertical: 14,
  },
  payHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 19,
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
  checkBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkBtnText: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 15,
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
    marginBottom: 24,
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
