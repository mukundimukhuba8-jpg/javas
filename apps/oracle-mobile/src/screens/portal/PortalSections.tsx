import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NeonBorder } from '../../components/NeonBorder';
import { ACCENT_PRESETS, useTheme } from '../../theme/ThemeContext';
import { colors as base, radii } from '../../theme';
import type { PortalSectionId } from './portalSections';

type Props = {
  section: PortalSectionId;
};

function Card({ children }: { children: ReactNode }) {
  return (
    <NeonBorder radius={18} fill={base.cardFill} style={styles.card}>
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
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
        style={[styles.input, { borderColor: colors.neon }]}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.primaryBtn, { backgroundColor: colors.neon }]}
      accessibilityRole="button"
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { borderColor: colors.neon }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <View style={styles.statRow}>
        <Stat label="ACTIVE KEYS" value="1,284" />
        <Stat label="USERS" value="846" />
      </View>
      <View style={styles.statRow}>
        <Stat label="MRR" value="$18.4k" />
        <Stat label="EA UPTIME" value="99.2%" />
      </View>
      <Card>
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
      <Card>
        <Text style={styles.cardTitle}>Recent admin actions</Text>
        {[
          'Created 12 Pro keys · 2m ago',
          'Reactivated license ORC-9F2A · 18m ago',
          'Updated affiliate rate to 25% · 1h ago',
          'Disabled user marco@ea.io · 3h ago',
        ].map((line) => (
          <Text key={line} style={styles.listLine}>
            • {line}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function CreateKeysSection() {
  const [plan, setPlan] = useState('Pro');
  const [qty, setQty] = useState('1');
  const [days, setDays] = useState('30');
  const [keys, setKeys] = useState<string[]>(['ORC-A91K-7MQ2-PL4X', 'ORC-B22N-88KD-ZQ1C']);
  const { colors } = useTheme();

  const generate = () => {
    const n = Math.max(1, Math.min(20, Number(qty) || 1));
    const created = Array.from({ length: n }, () => {
      const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      return `ORC-${chunk()}-${chunk()}-${chunk()}`;
    });
    setKeys((prev) => [...created, ...prev].slice(0, 20));
  };

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.cardTitle}>Issue license keys</Text>
        <Field label="PLAN" value={plan} onChangeText={setPlan} placeholder="Pro / Elite / Trial" />
        <Field label="QUANTITY" value={qty} onChangeText={setQty} placeholder="1" />
        <Field label="VALIDITY (DAYS)" value={days} onChangeText={setDays} placeholder="30" />
        <PrimaryButton label="GENERATE KEYS" onPress={generate} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Recently created</Text>
        {keys.map((k) => (
          <View key={k} style={[styles.keyRow, { borderColor: colors.neon }]}>
            <Text style={styles.keyText}>{k}</Text>
            <Text style={styles.keyMeta}>{plan} · {days}d</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function ExpertAdviserSection() {
  const [name, setName] = useState('The Oracle EA');
  const [version, setVersion] = useState('2.4.1');
  const [enabled, setEnabled] = useState(true);
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.cardTitle}>EXPERT ADVISER</Text>
        <Field label="EA NAME" value={name} onChangeText={setName} />
        <Field label="VERSION" value={version} onChangeText={setVersion} />
        <Pressable
          style={[styles.toggleRow, { borderColor: colors.neon }]}
          onPress={() => setEnabled((v) => !v)}
        >
          <Text style={styles.rowLeft}>Distribution enabled</Text>
          <Text style={{ color: enabled ? '#3DFF9A' : base.textMuted, fontWeight: '800' }}>
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
        <PrimaryButton label="SAVE EA SETTINGS" onPress={() => undefined} />
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
        <PrimaryButton label="UPLOAD BUILD (STUB)" onPress={() => undefined} />
      </Card>
    </ScrollView>
  );
}

function ReactivateEmailSection() {
  const [email, setEmail] = useState('');
  const [log, setLog] = useState<string[]>(['sent → alex@trade.io · delivered']);

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.cardTitle}>Reactivate email</Text>
        <Field
          label="USER EMAIL"
          value={email}
          onChangeText={setEmail}
          placeholder="user@domain.com"
        />
        <PrimaryButton
          label="SEND REACTIVATION"
          onPress={() => {
            if (!email.trim()) return;
            setLog((prev) => [`sent → ${email.trim()} · queued`, ...prev].slice(0, 12));
            setEmail('');
          }}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Delivery log</Text>
        {log.map((line) => (
          <Text key={line + Math.random()} style={styles.listLine}>
            • {line}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function AffiliateProgramSection() {
  const [rate, setRate] = useState('25');
  const [cookie, setCookie] = useState('30');
  const link = 'https://oracle.app/r/SUPERADMIN';

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.cardTitle}>Affiliate program</Text>
        <Field label="COMMISSION %" value={rate} onChangeText={setRate} />
        <Field label="COOKIE DAYS" value={cookie} onChangeText={setCookie} />
        <Text style={styles.fieldLabel}>REFERRAL LINK</Text>
        <Text style={styles.mono}>{link}</Text>
        <PrimaryButton label="SAVE PROGRAM" onPress={() => undefined} />
      </Card>
      <View style={styles.statRow}>
        <Stat label="CLICKS" value="4,921" />
        <Stat label="CONVERSIONS" value="318" />
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
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.cardTitle}>Manage users</Text>
        <Field label="SEARCH" value={q} onChangeText={setQ} placeholder="Name or email" />
        {users.map((u) => (
          <View key={u.email} style={[styles.userRow, { borderColor: colors.neon }]}>
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
    <ScrollView contentContainerStyle={styles.stack}>
      <Card>
        <Text style={styles.cardTitle}>Affiliates</Text>
        {rows.map((r) => (
          <View key={r.id} style={[styles.userRow, { borderColor: colors.neon }]}>
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
    <ScrollView contentContainerStyle={styles.stack}>
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
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
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
          onPress={() => {
            if (!key.trim()) return;
            setHistory((prev) => [`${key.trim()} · reactivated · success`, ...prev].slice(0, 10));
            setKey('');
          }}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>History</Text>
        {history.map((h) => (
          <Text key={h + Math.random()} style={styles.listLine}>
            • {h}
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
    <ScrollView contentContainerStyle={styles.stack}>
      <View style={styles.statRow}>
        <Stat label="KEYS ISSUED" value="312" />
        <Stat label="ACTIVATIONS" value="267" />
      </View>
      <View style={styles.statRow}>
        <Stat label="REVOKED" value="14" />
        <Stat label="CONV. RATE" value="85%" />
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
    gap: 12,
    paddingBottom: 16,
  },
  card: {
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: base.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
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
    paddingVertical: 11,
    color: base.textPrimary,
    fontWeight: '700',
    backgroundColor: base.actionRow,
  },
  primaryBtn: {
    borderRadius: radii.pill,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#061018',
    fontWeight: '900',
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: base.cardFill,
  },
  statLabel: {
    color: base.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statValue: {
    color: base.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
    lineHeight: 20,
  },
  keyRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: base.actionRow,
  },
  keyText: {
    color: base.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  keyMeta: {
    color: base.textMuted,
    marginTop: 2,
    fontSize: 12,
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
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
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
    height: 140,
    gap: 8,
    marginTop: 8,
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
