import { useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NeonBorder } from '../../components/NeonBorder';
import { ACCENT_PRESETS, useTheme, hexToRgba } from '../../theme/ThemeContext';
import { colors as base, radii } from '../../theme';
import type { PortalSectionId } from './portalSections';

type Props = {
  section: PortalSectionId;
};

async function copyText(value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <NeonBorder radius={18} fill={base.cardFill} style={{ ...styles.card, ...style }}>
      {children}
    </NeonBorder>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={base.textMuted}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[styles.input, { borderColor: hexToRgba(colors.neon, 0.45) }]}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.primaryBtn, { backgroundColor: colors.neon }]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={16} color="#061018" /> : null}
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function KpiCard({
  label,
  value,
  delta,
  spark,
}: {
  label: string;
  value: string;
  delta: string;
  spark: number[];
}) {
  const { colors } = useTheme();
  const up = delta.trim().startsWith('+');
  const max = Math.max(...spark, 1);

  return (
    <LinearGradient
      colors={['#0A1424', '#060B14']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.kpi, { borderColor: hexToRgba(colors.neon, 0.35) }]}
    >
      <View style={styles.kpiTop}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={[styles.kpiDelta, { color: up ? '#3DFF9A' : '#FF8A8A' }]}>{delta}</Text>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <View style={styles.sparkRow}>
        {spark.map((v, i) => (
          <View
            key={`${label}-${i}`}
            style={[
              styles.sparkBar,
              {
                height: 6 + (v / max) * 22,
                backgroundColor: hexToRgba(colors.neon, 0.35 + (v / max) * 0.55),
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.neon : 'rgba(255,255,255,0.12)',
          backgroundColor: selected ? hexToRgba(colors.neon, 0.16) : 'rgba(255,255,255,0.03)',
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && { color: colors.neon }]}>{label}</Text>
    </Pressable>
  );
}

export function PortalSectionBody({ section }: Props) {
  switch (section) {
    case 'dashboard':
      return <DashboardSection />;
    case 'create-keys':
      return <CreateKeysSection />;
    case 'expert-adviser':
      return <ExpertAdviserSection />;
    case 'reactivate-email':
      return <ReactivateEmailSection />;
    case 'affiliate-program':
      return <AffiliateProgramSection />;
    case 'manage-users':
      return <ManageUsersSection />;
    case 'affiliates':
      return <AffiliatesSection />;
    case 'color-changer':
      return <ColorChangerSection />;
    case 'reactivate-license':
      return <ReactivateLicenseSection />;
    case 'keys-analytics':
      return <KeysAnalyticsSection />;
    default:
      return null;
  }
}

function DashboardSection() {
  const { colors } = useTheme();
  const week = [
    { label: 'Mon', v: 0.42 },
    { label: 'Tue', v: 0.58 },
    { label: 'Wed', v: 0.51 },
    { label: 'Thu', v: 0.76 },
    { label: 'Fri', v: 0.69 },
    { label: 'Sat', v: 0.44 },
    { label: 'Sun', v: 0.61 },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <View style={styles.kpiGrid}>
        <KpiCard label="USERS" value="2,846" delta="+4.2%" spark={[3, 5, 4, 7, 6, 8, 9]} />
        <KpiCard label="KEYS ISSUED" value="12,480" delta="+8.1%" spark={[4, 4, 6, 5, 8, 7, 10]} />
        <KpiCard label="ACTIVE LICENSES" value="9,214" delta="+2.6%" spark={[6, 5, 7, 7, 8, 8, 9]} />
        <KpiCard label="AFFILIATES" value="318" delta="+12" spark={[2, 3, 3, 4, 5, 6, 7]} />
        <KpiCard label="REVENUE (30D)" value="$84.2k" delta="+11%" spark={[5, 6, 5, 8, 7, 9, 10]} />
        <KpiCard label="ACTIVATIONS" value="1,902" delta="+6.4%" spark={[4, 6, 5, 7, 6, 8, 8]} />
      </View>

      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Activations · 7 days</Text>
          <Text style={[styles.cardHint, { color: colors.neon }]}>LIVE FEED</Text>
        </View>
        <View style={styles.chartRow}>
          {week.map((b) => (
            <View key={b.label} style={styles.chartCol}>
              <View style={styles.chartTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${Math.round(b.v * 100)}%`,
                      backgroundColor: colors.neon,
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.splitRow}>
        <Card style={styles.splitCard}>
          <Text style={styles.cardTitle}>System health</Text>
          {[
            ['License API', 'Operational'],
            ['Email relay', 'Operational'],
            ['MT5 bridge', 'Degraded'],
            ['Affiliate payouts', 'Operational'],
          ].map(([k, v]) => (
            <View key={k} style={styles.rowBetween}>
              <Text style={styles.rowLeft}>{k}</Text>
              <Text style={[styles.rowRight, v === 'Degraded' && styles.warn]}>{v}</Text>
            </View>
          ))}
        </Card>
        <Card style={styles.splitCard}>
          <Text style={styles.cardTitle}>Recent admin actions</Text>
          {[
            'Created 12 Pro keys · 2m ago',
            'Reactivated license ORC-9F2A · 18m ago',
            'Updated affiliate rate to 25% · 1h ago',
            'Disabled user marco@ea.io · 3h ago',
          ].map((line) => (
            <Text key={line} style={styles.listLine}>
              {line}
            </Text>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}

type GeneratedKey = {
  id: string;
  key: string;
  plan: string;
  days: string;
  email: string;
  createdAt: string;
};

function CreateKeysSection() {
  const [plan, setPlan] = useState('Pro');
  const [qty, setQty] = useState('1');
  const [days, setDays] = useState('30');
  const [email, setEmail] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keys, setKeys] = useState<GeneratedKey[]>([
    {
      id: 'seed-1',
      key: 'ORC-A91K-7MQ2-PL4X',
      plan: 'Pro',
      days: '30',
      email: 'ava@ea.io',
      createdAt: 'just now',
    },
  ]);
  const { colors } = useTheme();
  const plans = ['Trial', 'Pro', 'Elite'];

  const generate = () => {
    const n = Math.max(1, Math.min(20, Number(qty) || 1));
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const created: GeneratedKey[] = Array.from({ length: n }, (_, i) => {
      const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      return {
        id: `${Date.now()}-${i}`,
        key: `ORC-${chunk()}-${chunk()}-${chunk()}`,
        plan,
        days,
        email: email.trim() || 'unassigned',
        createdAt: stamp,
      };
    });
    setKeys((prev) => [...created, ...prev].slice(0, 24));
  };

  const onCopy = async (item: GeneratedKey) => {
    const ok = await copyText(item.key);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 1600);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>License key generator</Text>
          <Text style={styles.cardHint}>Local preview · not persisted</Text>
        </View>

        <Text style={styles.fieldLabel}>PLAN</Text>
        <View style={styles.chipRow}>
          {plans.map((p) => (
            <Chip key={p} label={p} selected={plan === p} onPress={() => setPlan(p)} />
          ))}
        </View>

        <Field
          label="USER EMAIL"
          value={email}
          onChangeText={setEmail}
          placeholder="trader@domain.com"
          keyboardType="email-address"
        />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Field
              label="DURATION (DAYS)"
              value={days}
              onChangeText={setDays}
              placeholder="30"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="QUANTITY"
              value={qty}
              onChangeText={setQty}
              placeholder="1"
              keyboardType="numeric"
            />
          </View>
        </View>
        <PrimaryButton label="GENERATE KEYS" onPress={generate} icon="key-outline" />
      </Card>

      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Generated keys</Text>
          <Text style={styles.cardHint}>{keys.length} ready</Text>
        </View>
        {keys.map((item) => {
          const copied = copiedId === item.id;
          return (
            <View
              key={item.id}
              style={[styles.keyRow, { borderColor: hexToRgba(colors.neon, 0.4) }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.keyText}>{item.key}</Text>
                <Text style={styles.keyMeta}>
                  {item.plan} · {item.days}d · {item.email} · {item.createdAt}
                </Text>
              </View>
              <Pressable
                onPress={() => onCopy(item)}
                style={[
                  styles.copyBtn,
                  {
                    borderColor: colors.neon,
                    backgroundColor: copied ? colors.neon : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Copy ${item.key}`}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color={copied ? '#061018' : colors.neon}
                />
                <Text style={[styles.copyLabel, { color: copied ? '#061018' : colors.neon }]}>
                  {copied ? 'COPIED' : 'COPY'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function ExpertAdviserSection() {
  const [name, setName] = useState('The Oracle EA');
  const [version, setVersion] = useState('2.4.1');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text style={styles.cardTitle}>EXPERT ADVISER</Text>
        <Field label="EA NAME" value={name} onChangeText={setName} />
        <Field label="VERSION" value={version} onChangeText={setVersion} />
        <Pressable
          style={[styles.toggleRow, { borderColor: hexToRgba(colors.neon, 0.45) }]}
          onPress={() => setEnabled((v) => !v)}
        >
          <Text style={styles.rowLeft}>Distribution enabled</Text>
          <Text style={{ color: enabled ? '#3DFF9A' : base.textMuted, fontWeight: '800' }}>
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
        <PrimaryButton
          label={saved ? 'SAVED' : 'SAVE EA SETTINGS'}
          onPress={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1400);
          }}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Build pipeline</Text>
        {[
          ['oracle-ea-2.4.1.ex5', 'Published'],
          ['oracle-ea-2.4.0.ex5', 'Archived'],
          ['oracle-ea-2.5.0-beta.ex5', 'Staging'],
        ].map(([file, status]) => (
          <View key={file} style={styles.rowBetween}>
            <Text style={styles.rowLeft}>{file}</Text>
            <Text style={styles.rowRight}>{status}</Text>
          </View>
        ))}
        <PrimaryButton label="QUEUE NEW BUILD" onPress={() => undefined} icon="cloud-upload-outline" />
      </Card>
    </ScrollView>
  );
}

function ReactivateEmailSection() {
  const [email, setEmail] = useState('');
  const [log, setLog] = useState<string[]>(['sent → alex@trade.io · delivered']);

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text style={styles.cardTitle}>Reactivate email</Text>
        <Text style={styles.help}>
          Resend the activation message for a stalled account. Delivery is simulated locally.
        </Text>
        <Field
          label="USER EMAIL"
          value={email}
          onChangeText={setEmail}
          placeholder="user@domain.com"
          keyboardType="email-address"
        />
        <PrimaryButton
          label="SEND REACTIVATION"
          icon="mail-outline"
          onPress={() => {
            if (!email.trim()) return;
            setLog((prev) => [`sent → ${email.trim()} · queued`, ...prev].slice(0, 12));
            setEmail('');
          }}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Delivery log</Text>
        {log.map((line, i) => (
          <Text key={`${line}-${i}`} style={styles.listLine}>
            {line}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function AffiliateProgramSection() {
  const [rate, setRate] = useState('25');
  const [cookie, setCookie] = useState('30');
  const [copied, setCopied] = useState(false);
  const link = 'https://oracle.app/r/SUPERADMIN';

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text style={styles.cardTitle}>Affiliate program</Text>
        <Field label="COMMISSION %" value={rate} onChangeText={setRate} keyboardType="numeric" />
        <Field label="COOKIE DAYS" value={cookie} onChangeText={setCookie} keyboardType="numeric" />
        <Text style={styles.fieldLabel}>REFERRAL LINK</Text>
        <View style={styles.linkRow}>
          <Text style={styles.mono} numberOfLines={1}>
            {link}
          </Text>
          <Pressable
            onPress={async () => {
              if (await copyText(link)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Copy referral link"
          >
            <Text style={styles.linkCopy}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
        <PrimaryButton label="SAVE PROGRAM" onPress={() => undefined} />
      </Card>
      <View style={styles.kpiGrid}>
        <KpiCard label="CLICKS" value="4,921" delta="+9%" spark={[3, 4, 5, 4, 6, 7, 8]} />
        <KpiCard label="CONVERSIONS" value="318" delta="+14" spark={[2, 3, 3, 4, 4, 5, 6]} />
      </View>
    </ScrollView>
  );
}

function ManageUsersSection() {
  const [q, setQ] = useState('');
  const users = useMemo(
    () =>
      [
        { name: 'Ava Chen', email: 'ava@ea.io', role: 'Pro', status: 'Active' },
        { name: 'Marco Diaz', email: 'marco@ea.io', role: 'Trial', status: 'Disabled' },
        { name: 'Noah Park', email: 'noah@funds.io', role: 'Elite', status: 'Active' },
        { name: 'Ivy Stone', email: 'ivy@desk.io', role: 'Affiliate', status: 'Active' },
        { name: 'Leo Grant', email: 'leo@desk.io', role: 'Pro', status: 'Pending' },
      ].filter(
        (u) =>
          !q.trim() ||
          u.name.toLowerCase().includes(q.toLowerCase()) ||
          u.email.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text style={styles.cardTitle}>Manage users</Text>
        <Field label="SEARCH" value={q} onChangeText={setQ} placeholder="Name or email" />
        {users.map((u) => (
          <View key={u.email} style={[styles.userRow, { borderColor: hexToRgba(colors.neon, 0.35) }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.name}</Text>
              <Text style={styles.userMeta}>
                {u.email} · {u.role}
              </Text>
            </View>
            <Text style={[styles.badge, u.status !== 'Active' && styles.warn]}>{u.status}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function AffiliatesSection() {
  const rows = [
    { id: 'AF-104', name: 'North Desk', earned: '$2,840', rate: '25%' },
    { id: 'AF-231', name: 'Signal Lab', earned: '$1,120', rate: '20%' },
    { id: 'AF-088', name: 'Prime Media', earned: '$6,455', rate: '30%' },
    { id: 'AF-412', name: 'FX Growth', earned: '$910', rate: '15%' },
  ];
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <Card>
        <Text style={styles.cardTitle}>Affiliates</Text>
        {rows.map((r) => (
          <View key={r.id} style={[styles.userRow, { borderColor: hexToRgba(colors.neon, 0.35) }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>
                {r.name} · {r.id}
              </Text>
              <Text style={styles.userMeta}>Rate {r.rate}</Text>
            </View>
            <Text style={styles.badge}>{r.earned}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function ColorChangerSection() {
  const { accent, setAccent, colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <Card>
        <Text style={styles.cardTitle}>Color changer</Text>
        <Text style={styles.help}>
          Tap a swatch to update the live app accent (borders, nav underline, CTAs).
        </Text>
        <View style={styles.swatchGrid}>
          {ACCENT_PRESETS.map((p) => {
            const selected = accent.toLowerCase() === p.value.toLowerCase();
            return (
              <Pressable
                key={p.id}
                onPress={() => setAccent(p.value)}
                style={[
                  styles.swatch,
                  { backgroundColor: p.value, borderColor: selected ? '#fff' : p.value },
                ]}
                accessibilityRole="button"
                accessibilityLabel={p.label}
              >
                {selected ? <Ionicons name="checkmark" size={18} color="#000" /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.mono, { color: colors.neon }]}>Active: {accent}</Text>
      </Card>
    </ScrollView>
  );
}

function ReactivateLicenseSection() {
  const [key, setKey] = useState('');
  const [history, setHistory] = useState(['ORC-9F2A-… · reactivated · success']);

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text style={styles.cardTitle}>Reactivate license key</Text>
        <Field
          label="LICENSE KEY"
          value={key}
          onChangeText={setKey}
          placeholder="ORC-XXXX-XXXX-XXXX"
        />
        <PrimaryButton
          label="REACTIVATE"
          icon="refresh-outline"
          onPress={() => {
            if (!key.trim()) return;
            setHistory((prev) => [`${key.trim()} · reactivated · success`, ...prev].slice(0, 10));
            setKey('');
          }}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>History</Text>
        {history.map((h, i) => (
          <Text key={`${h}-${i}`} style={styles.listLine}>
            {h}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function KeysAnalyticsSection() {
  const bars = [
    { label: 'Mon', v: 0.45 },
    { label: 'Tue', v: 0.62 },
    { label: 'Wed', v: 0.38 },
    { label: 'Thu', v: 0.8 },
    { label: 'Fri', v: 0.7 },
    { label: 'Sat', v: 0.5 },
    { label: 'Sun', v: 0.33 },
  ];
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <View style={styles.kpiGrid}>
        <KpiCard label="KEYS ISSUED" value="312" delta="+18" spark={[3, 4, 5, 6, 5, 7, 8]} />
        <KpiCard label="ACTIVATIONS" value="267" delta="+11%" spark={[4, 5, 4, 6, 7, 6, 8]} />
        <KpiCard label="REVOKED" value="14" delta="-2" spark={[5, 4, 4, 3, 3, 2, 2]} />
        <KpiCard label="CONV. RATE" value="85%" delta="+3%" spark={[6, 6, 7, 7, 8, 8, 9]} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Keys analytics · 7 days</Text>
        <View style={styles.chartRow}>
          {bars.map((b) => (
            <View key={b.label} style={styles.chartCol}>
              <View style={styles.chartTrack}>
                <View
                  style={[
                    styles.chartBar,
                    { height: `${Math.round(b.v * 100)}%`, backgroundColor: colors.neon },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
    paddingBottom: 28,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  cardTitle: {
    color: base.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardHint: {
    color: base.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: base.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: base.textPrimary,
    fontWeight: '700',
    backgroundColor: base.actionRow,
  },
  primaryBtn: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#061018',
    fontWeight: '900',
    letterSpacing: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpi: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: {
    color: base.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  kpiDelta: {
    fontSize: 11,
    fontWeight: '800',
  },
  kpiValue: {
    color: base.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 28,
    marginTop: 4,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 3,
    minHeight: 4,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: base.textMuted,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  splitRow: {
    gap: 14,
  },
  splitCard: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLeft: {
    color: base.textPrimary,
    fontWeight: '600',
  },
  rowRight: {
    color: '#3DFF9A',
    fontWeight: '700',
  },
  warn: {
    color: '#FFC857',
  },
  listLine: {
    color: base.textMuted,
    fontSize: 13,
    lineHeight: 21,
    paddingVertical: 3,
  },
  keyRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: base.actionRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  keyText: {
    color: base.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
    fontSize: 13,
  },
  keyMeta: {
    color: base.textMuted,
    fontSize: 11,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  copyLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: base.actionRow,
  },
  mono: {
    color: base.textPrimary,
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  linkCopy: {
    color: '#6AA0F8',
    fontWeight: '800',
    fontSize: 12,
  },
  help: {
    color: base.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  userRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: base.actionRow,
  },
  userName: {
    color: base.textPrimary,
    fontWeight: '800',
  },
  userMeta: {
    color: base.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    color: '#3DFF9A',
    fontWeight: '800',
    fontSize: 12,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    gap: 8,
    marginTop: 4,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  chartTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  chartLabel: {
    color: base.textMuted,
    fontSize: 10,
    marginTop: 6,
    fontWeight: '700',
  },
});
