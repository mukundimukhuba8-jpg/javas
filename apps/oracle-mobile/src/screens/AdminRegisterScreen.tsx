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
import { registerMentorWaiting } from '../cloud/oracleCloud';
import { AUTH_DARK, authStyles, useDarkWebShell } from './authDarkShell';

type Props = {
  onBackToSignIn: () => void;
};

type FieldKey =
  | 'name'
  | 'mentorName'
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'password'
  | 'confirmPassword';

const EMPTY: Record<FieldKey, string> = {
  name: '',
  mentorName: '',
  email: '',
  whatsapp: '',
  instagram: '',
  password: '',
  confirmPassword: '',
};

export function AdminRegisterScreen({ onBackToSignIn }: Props) {
  useDarkWebShell('oracle-admin-register-shell');
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setField = (key: FieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async () => {
    setSuccess(null);
    const { name, mentorName, email, whatsapp, instagram, password, confirmPassword } = fields;
    if (
      !name.trim() ||
      !mentorName.trim() ||
      !email.trim() ||
      !whatsapp.trim() ||
      !instagram.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      const result = await registerMentorWaiting({
        name,
        mentorName,
        email,
        whatsapp,
        instagram,
      });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setError(null);
      setSuccess('Registration submitted. Waiting for admin approval.');
      setFields(EMPTY);
      setTimeout(() => onBackToSignIn(), 1600);
    } catch {
      setError('Could not save registration. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const renderField = (
    key: FieldKey,
    label: string,
    opts: {
      placeholder: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
      secure?: boolean;
      autoComplete?: string;
    },
  ) => (
    <View key={key} style={{ gap: 8 }}>
      <Text style={authStyles.label}>{label}</Text>
      <TextInput
        value={fields[key]}
        onChangeText={(v) => setField(key, v)}
        placeholder={opts.placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={opts.keyboardType ?? 'default'}
        secureTextEntry={opts.secure}
        autoCapitalize={
          key === 'email' || key === 'instagram' || opts.secure ? 'none' : 'words'
        }
        autoCorrect={false}
        style={authStyles.input}
      />
    </View>
  );

  return (
    <View style={authStyles.root} accessibilityLabel="Admin register">
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
          style={authStyles.flex}
          contentContainerStyle={[
            authStyles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 48) + 100,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          nestedScrollEnabled
          bounces
        >
          <Pressable
            style={authStyles.backBtn}
            onPress={onBackToSignIn}
            accessibilityRole="button"
            accessibilityLabel="Back to Signin"
            hitSlop={8}
          >
            <View style={authStyles.backArrow} />
          </Pressable>

          <View style={authStyles.hero}>
            <EaTradeLogoMark />
            <Text style={authStyles.brandLabel}>EA TRADE</Text>
            <Text style={authStyles.title}>Register</Text>
            <Text style={authStyles.sub}>
              Create a mentor account. Admin must approve before you can sign in.
            </Text>
          </View>

          <View style={authStyles.card}>
            {renderField('name', 'NAME', { placeholder: 'Your full name' })}
            {renderField('mentorName', 'MENTOR NAME', { placeholder: 'Display / mentor name' })}
            {renderField('email', 'EMAIL', {
              placeholder: 'you@email.com',
              keyboardType: 'email-address',
            })}
            {renderField('whatsapp', 'WHATSAPP NUMBER', {
              placeholder: '+27…',
              keyboardType: 'phone-pad',
            })}
            {renderField('instagram', 'INSTAGRAM LINK', {
              placeholder: 'https://instagram.com/…',
              keyboardType: 'url',
            })}
            {renderField('password', 'PASSWORD', {
              placeholder: '••••••••',
              secure: true,
            })}
            {renderField('confirmPassword', 'CONFIRM PASSWORD', {
              placeholder: '••••••••',
              secure: true,
            })}

            {error ? <Text style={authStyles.error}>{error}</Text> : null}
            {success ? <Text style={authStyles.info}>{success}</Text> : null}

            <Pressable
              onPress={() => void onSubmit()}
              disabled={busy}
              style={[authStyles.continue, busy ? { opacity: 0.7 } : null]}
              accessibilityRole="button"
              accessibilityLabel="Submit registration"
            >
              {busy ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={authStyles.continueText}>Register</Text>
              )}
            </Pressable>
          </View>

          <View style={authStyles.footerLinks}>
            <Pressable
              onPress={onBackToSignIn}
              accessibilityRole="button"
              accessibilityLabel="Back to Signin"
            >
              <Text style={authStyles.linkText}>Already have an account? Signin</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
