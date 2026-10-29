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
import { EaTradeLogoMark } from '../components/EaTradeBrand';
import { authenticatePortal } from '../access/adminAuth';
import { usePortalSession } from '../access/portalSession';
import { AUTH_DARK, authStyles, useDarkWebShell } from './authDarkShell';

type Props = {
  onSuccess: () => void;
  onBackToMember?: () => void;
  onOpenRegister?: () => void;
};

export function AdminSignInScreen({ onSuccess, onBackToMember, onOpenRegister }: Props) {
  useDarkWebShell('oracle-admin-signin-shell');
  const insets = useSafeAreaInsets();
  const { signInPortal } = usePortalSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authenticatePortal(email, password);
      if (!result.ok) {
        setError(result.reason);
        setBusy(false);
        return;
      }
      signInPortal(result.session);
      setBusy(false);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
      setBusy(false);
    }
  };

  return (
    <View style={authStyles.root} accessibilityLabel="Admin signin">
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
          {...(Platform.OS === 'web'
            ? ({
                dataSet: { authScroll: '1' },
              } as object)
            : null)}
        >
          {onBackToMember ? (
            <Pressable
              style={authStyles.backBtn}
              onPress={onBackToMember}
              accessibilityRole="button"
              accessibilityLabel="Back to member sign in"
              hitSlop={8}
              testID="portal-signin-back"
            >
              <View style={authStyles.backArrow} />
            </Pressable>
          ) : (
            <View style={authStyles.backBtn} />
          )}

          <View style={authStyles.hero}>
            <EaTradeLogoMark />
            <Text style={authStyles.brandLabel}>EA TRADE</Text>
            <Text style={authStyles.title}>Signin</Text>
            <Text style={authStyles.sub}>Welcome back! please login with your account details</Text>
          </View>

          <View style={authStyles.card}>
            <Text style={authStyles.label}>EMAIL ADDRESS</Text>
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
              style={authStyles.input}
              testID="portal-signin-email"
            />

            <Text style={[authStyles.label, { marginTop: 4 }]}>PASSWORD</Text>
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
              style={authStyles.input}
              onSubmitEditing={() => void onSignIn()}
              testID="portal-signin-password"
            />

            {error ? (
              <Text style={authStyles.error} testID="portal-signin-error">
                {error}
              </Text>
            ) : null}
            {info ? <Text style={authStyles.info}>{info}</Text> : null}

            <Pressable
              onPress={() => void onSignIn()}
              style={[authStyles.continue, busy && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Signin"
              disabled={busy}
              testID="portal-signin-submit"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={authStyles.continueText}>Signin</Text>
              )}
            </Pressable>
          </View>

          <View style={authStyles.footerLinks}>
            <Pressable
              onPress={() => {
                setError(null);
                setInfo('Password reset is not available yet. Contact your admin.');
              }}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={authStyles.linkText}>Forgot password</Text>
            </Pressable>
            <Text style={authStyles.linkSep}>|</Text>
            <Pressable
              onPress={() => {
                setError(null);
                setInfo(null);
                onOpenRegister?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Dont have account register"
              testID="portal-open-register"
            >
              <Text style={authStyles.linkText}>Dont have account register</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
