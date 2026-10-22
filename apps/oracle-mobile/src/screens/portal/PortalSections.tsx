import { useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT_PRESETS, useTheme, hexToRgba } from '../../theme/ThemeContext';
import { portalFonts } from '../../theme/portalFonts';
import type { PortalSectionId } from './portalSections';

type Props = {
  section: PortalSectionId;
  fontsReady: boolean;
};

async function copyText(value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function useFf(ready: boolean) {
  return ready ? portalFonts : null;
}

function Surface({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: string;
}) {
  return (
    <View
      style={[
        styles.surface,
        accent ? { borderColor: hexToRgba(accent, 0.28) } : null,
      ]}
    >
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  fontsReady,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  fontsReady: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, f && { fontFamily: f.uiBold }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(148,163,184,0.45)"
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[
          styles.input,
          { borderColor: hexToRgba(colors.neon, 0.28) },
          f && { fontFamily: f.uiMed },
        ]}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  fontsReady,
  icon,
}: {
  label: string;
  onPress: () => void;
  fontsReady: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.primaryBtn, { backgroundColor: colors.neon }]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={16} color="#061018" /> : null}
      <Text style={[styles.primaryBtnText, f && { fontFamily: f.uiBold }]}>{label}</Text>
    </Pressable>
  );
}

export function PortalSectionBody({ section, fontsReady }: Props) {
  switch (section) {
    case 'dashboard':
      return <DashboardSection fontsReady={fontsReady} />;
    case 'create-keys':
      return <CreateKeysSection fontsReady={fontsReady} />;
    case 'expert-adviser':
      return <ExpertAdviserSection fontsReady={fontsReady} />;
    case 'reactivate-email':
      return <ReactivateEmailSection fontsReady={fontsReady} />;
    case 'affiliate-program':
      return <AffiliateProgramSection fontsReady={fontsReady} />;
    case 'manage-users':
      return <ManageUsersSection fontsReady={fontsReady} />;
    case 'affiliates':
      return <AffiliatesSection fontsReady={fontsReady} />;
    case 'color-changer':
      return <ColorChangerSection fontsReady={fontsReady} />;
    case 'reactivate-license':
      return <ReactivateLicenseSection fontsReady={fontsReady} />;
    case 'keys-analytics':
      return <KeysAnalyticsSection fontsReady={fontsReady} />;
    default:
      return null;
  }
}

function DashboardSection({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
  const kpis = [
    { label: 'Users', value: '2,846', delta: '+4.2%', spark: [4, 5, 5, 7, 6, 8, 9] },
    { label: 'Keys issued', value: '12,480', delta: '+8.1%', spark: [3, 4, 6, 5, 8, 7, 10] },
    { label: 'Active licenses', value: '9,214', delta: '+2.6%', spark: [6, 6, 7, 7, 8, 8, 9] },
    { label: 'Affiliates', value: '318', delta: '+12', spark: [2, 3, 3, 4, 5, 6, 7] },
    { label: 'Revenue · 30d', value: '$84.2k', delta: '+11%', spark: [5, 6, 5, 8, 7, 9, 10] },
    { label: 'Activations', value: '1,902', delta: '+6.4%', spark: [4, 6, 5, 7, 6, 8, 8] },
  ];
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
    <ScrollView
      contentContainerStyle={styles.stack}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.lead, f && { fontFamily: f.ui }]}>
        Live console snapshot across licenses, affiliates, and activation volume.
      </Text>

      <View style={styles.kpiGrid}>
        {kpis.map((k) => {
          const max = Math.max(...k.spark, 1);
          const up = k.delta.trim().startsWith('+');
          return (
            <View
              key={k.label}
              style={[styles.kpi, { borderColor: hexToRgba(colors.neon, 0.2) }]}
            >
              <View style={styles.kpiTop}>
                <Text style={[styles.kpiLabel, f && { fontFamily: f.uiMed }]}>{k.label}</Text>
                <Text
                  style={[
                    styles.kpiDelta,
                    f && { fontFamily: f.uiBold },
                    { color: up ? '#3DFF9A' : '#FF8A8A' },
                  ]}
                >
                  {k.delta}
                </Text>
              </View>
              <Text style={[styles.kpiValue, f && { fontFamily: f.display }]}>{k.value}</Text>
              <View style={styles.sparkRow}>
                {k.spark.map((v, i) => (
                  <View
                    key={`${k.label}-${i}`}
                    style={[
                      styles.sparkBar,
                      {
                        height: 5 + (v / max) * 20,
                        backgroundColor: hexToRgba(colors.neon, 0.25 + (v / max) * 0.6),
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <Surface accent={colors.neon}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
            Activations · 7 days
          </Text>
          <Text style={[styles.cardHint, f && { fontFamily: f.uiMed }, { color: colors.neon }]}>
            Live feed
          </Text>
        </View>
        <View style={styles.chartRow}>
          {week.map((b) => (
            <View key={b.label} style={styles.chartCol}>
              <View style={styles.chartTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: Math.max(8, Math.round(b.v * 120)),
                      backgroundColor: colors.neon,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, f && { fontFamily: f.uiMed }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Surface>

      <View style={styles.split}>
        <Surface>
          <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>System health</Text>
          {[
            ['License API', 'Operational'],
            ['Email relay', 'Operational'],
            ['MT5 bridge', 'Degraded'],
            ['Affiliate payouts', 'Operational'],
          ].map(([name, status]) => (
            <View key={name} style={styles.rowBetween}>
              <Text style={[styles.rowLeft, f && { fontFamily: f.uiMed }]}>{name}</Text>
              <Text
                style={[
                  styles.rowRight,
                  f && { fontFamily: f.uiBold },
                  status === 'Degraded' && styles.warn,
                ]}
              >
                {status}
              </Text>
            </View>
          ))}
        </Surface>
        <Surface>
          <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
            Recent actions
          </Text>
          {[
            'Created 12 Pro keys · 2m ago',
            'Reactivated ORC-9F2A · 18m ago',
            'Affiliate rate → 25% · 1h ago',
            'Disabled marco@ea.io · 3h ago',
          ].map((line) => (
            <Text key={line} style={[styles.listLine, f && { fontFamily: f.ui }]}>
              {line}
            </Text>
          ))}
        </Surface>
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

function CreateKeysSection({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
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
      createdAt: 'seed',
    },
  ]);
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

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.lead, f && { fontFamily: f.ui }]}>
        Issue license keys for a plan, duration, and optional user email. Keys stay in local
        session memory.
      </Text>

      <Surface accent={colors.neon}>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
          Key generator
        </Text>

        <Text style={[styles.fieldLabel, f && { fontFamily: f.uiBold }]}>Plan</Text>
        <View style={styles.chipRow}>
          {plans.map((p) => {
            const selected = plan === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPlan(p)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.neon : 'rgba(255,255,255,0.1)',
                    backgroundColor: selected
                      ? hexToRgba(colors.neon, 0.14)
                      : 'rgba(255,255,255,0.02)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    f && { fontFamily: f.uiBold },
                    selected && { color: colors.neon },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="User email"
          value={email}
          onChangeText={setEmail}
          placeholder="trader@domain.com"
          fontsReady={fontsReady}
          keyboardType="email-address"
        />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Field
              label="Duration (days)"
              value={days}
              onChangeText={setDays}
              placeholder="30"
              fontsReady={fontsReady}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Quantity"
              value={qty}
              onChangeText={setQty}
              placeholder="1"
              fontsReady={fontsReady}
              keyboardType="numeric"
            />
          </View>
        </View>
        <PrimaryButton
          label="Generate keys"
          onPress={generate}
          fontsReady={fontsReady}
          icon="key-outline"
        />
      </Surface>

      <Surface>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
            Generated keys
          </Text>
          <Text style={[styles.cardHint, f && { fontFamily: f.uiMed }]}>
            {keys.length} ready
          </Text>
        </View>
        {keys.map((item) => {
          const copied = copiedId === item.id;
          return (
            <View
              key={item.id}
              style={[styles.keyRow, { borderColor: hexToRgba(colors.neon, 0.28) }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.keyText, f && { fontFamily: f.monoBold }]}>{item.key}</Text>
                <Text style={[styles.keyMeta, f && { fontFamily: f.ui }]}>
                  {item.plan} · {item.days}d · {item.email} · {item.createdAt}
                </Text>
              </View>
              <Pressable
                onPress={async () => {
                  if (await copyText(item.key)) {
                    setCopiedId(item.id);
                    setTimeout(
                      () => setCopiedId((cur) => (cur === item.id ? null : cur)),
                      1600,
                    );
                  }
                }}
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
                  size={14}
                  color={copied ? '#061018' : colors.neon}
                />
                <Text
                  style={[
                    styles.copyLabel,
                    f && { fontFamily: f.uiBold },
                    { color: copied ? '#061018' : colors.neon },
                  ]}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </Surface>
    </ScrollView>
  );
}

function ExpertAdviserSection({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
  const [name, setName] = useState('The Oracle EA');
  const [version, setVersion] = useState('2.4.1');
  const [enabled, setEnabled] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Surface accent={colors.neon}>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
          Expert adviser
        </Text>
        <Field label="EA name" value={name} onChangeText={setName} fontsReady={fontsReady} />
        <Field label="Version" value={version} onChangeText={setVersion} fontsReady={fontsReady} />
        <Pressable
          style={[styles.toggleRow, { borderColor: hexToRgba(colors.neon, 0.28) }]}
          onPress={() => setEnabled((v) => !v)}
        >
          <Text style={[styles.rowLeft, f && { fontFamily: f.uiMed }]}>Distribution enabled</Text>
          <Text
            style={[
              { color: enabled ? '#3DFF9A' : 'rgba(148,163,184,0.6)', fontWeight: '700' },
              f && { fontFamily: f.uiBold },
            ]}
          >
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
        <PrimaryButton label="Save EA settings" onPress={() => undefined} fontsReady={fontsReady} />
      </Surface>
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>Build pipeline</Text>
        {[
          ['oracle-ea-2.4.1.ex5', 'Published'],
          ['oracle-ea-2.4.0.ex5', 'Archived'],
          ['oracle-ea-2.5.0-beta.ex5', 'Staging'],
        ].map(([file, status]) => (
          <View key={file} style={styles.rowBetween}>
            <Text style={[styles.rowLeft, f && { fontFamily: f.mono }]}>{file}</Text>
            <Text style={[styles.rowRight, f && { fontFamily: f.uiBold }]}>{status}</Text>
          </View>
        ))}
      </Surface>
    </ScrollView>
  );
}

function ReactivateEmailSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const [email, setEmail] = useState('');
  const [log, setLog] = useState<string[]>(['sent → alex@trade.io · delivered']);

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
          Reactivate email
        </Text>
        <Text style={[styles.lead, f && { fontFamily: f.ui }]}>
          Resend activation for a stalled account. Delivery is simulated locally.
        </Text>
        <Field
          label="User email"
          value={email}
          onChangeText={setEmail}
          placeholder="user@domain.com"
          fontsReady={fontsReady}
          keyboardType="email-address"
        />
        <PrimaryButton
          label="Send reactivation"
          fontsReady={fontsReady}
          icon="mail-outline"
          onPress={() => {
            if (!email.trim()) return;
            setLog((prev) => [`sent → ${email.trim()} · queued`, ...prev].slice(0, 12));
            setEmail('');
          }}
        />
      </Surface>
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>Delivery log</Text>
        {log.map((line, i) => (
          <Text key={`${line}-${i}`} style={[styles.listLine, f && { fontFamily: f.ui }]}>
            {line}
          </Text>
        ))}
      </Surface>
    </ScrollView>
  );
}

function AffiliateProgramSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const [rate, setRate] = useState('25');
  const [cookie, setCookie] = useState('30');
  const [copied, setCopied] = useState(false);
  const link = 'https://oracle.app/r/SUPERADMIN';

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
          Affiliate program
        </Text>
        <Field
          label="Commission %"
          value={rate}
          onChangeText={setRate}
          fontsReady={fontsReady}
          keyboardType="numeric"
        />
        <Field
          label="Cookie days"
          value={cookie}
          onChangeText={setCookie}
          fontsReady={fontsReady}
          keyboardType="numeric"
        />
        <Text style={[styles.fieldLabel, f && { fontFamily: f.uiBold }]}>Referral link</Text>
        <View style={styles.linkRow}>
          <Text style={[styles.mono, f && { fontFamily: f.mono }]} numberOfLines={1}>
            {link}
          </Text>
          <Pressable
            onPress={async () => {
              if (await copyText(link)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }
            }}
          >
            <Text style={[styles.linkCopy, f && { fontFamily: f.uiBold }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>
        <PrimaryButton label="Save program" onPress={() => undefined} fontsReady={fontsReady} />
      </Surface>
    </ScrollView>
  );
}

function ManageUsersSection({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
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

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>Manage users</Text>
        <Field
          label="Search"
          value={q}
          onChangeText={setQ}
          placeholder="Name or email"
          fontsReady={fontsReady}
        />
        {users.map((u) => (
          <View
            key={u.email}
            style={[styles.userRow, { borderColor: hexToRgba(colors.neon, 0.22) }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, f && { fontFamily: f.uiBold }]}>{u.name}</Text>
              <Text style={[styles.userMeta, f && { fontFamily: f.ui }]}>
                {u.email} · {u.role}
              </Text>
            </View>
            <Text
              style={[
                styles.badge,
                f && { fontFamily: f.uiBold },
                u.status !== 'Active' && styles.warn,
              ]}
            >
              {u.status}
            </Text>
          </View>
        ))}
      </Surface>
    </ScrollView>
  );
}

function AffiliatesSection({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
  const rows = [
    { id: 'AF-104', name: 'North Desk', earned: '$2,840', rate: '25%' },
    { id: 'AF-231', name: 'Signal Lab', earned: '$1,120', rate: '20%' },
    { id: 'AF-088', name: 'Prime Media', earned: '$6,455', rate: '30%' },
    { id: 'AF-412', name: 'FX Growth', earned: '$910', rate: '15%' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>Affiliates</Text>
        {rows.map((r) => (
          <View
            key={r.id}
            style={[styles.userRow, { borderColor: hexToRgba(colors.neon, 0.22) }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, f && { fontFamily: f.uiBold }]}>
                {r.name} · {r.id}
              </Text>
              <Text style={[styles.userMeta, f && { fontFamily: f.ui }]}>Rate {r.rate}</Text>
            </View>
            <Text style={[styles.badge, f && { fontFamily: f.uiBold }]}>{r.earned}</Text>
          </View>
        ))}
      </Surface>
    </ScrollView>
  );
}

function ColorChangerSection({ fontsReady }: { fontsReady: boolean }) {
  const { accent, setAccent, colors } = useTheme();
  const f = useFf(fontsReady);

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>Color changer</Text>
        <Text style={[styles.lead, f && { fontFamily: f.ui }]}>
          Update the live app accent used on borders, CTAs, and portal chrome.
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
                accessibilityLabel={p.label}
              >
                {selected ? <Ionicons name="checkmark" size={18} color="#000" /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.mono, f && { fontFamily: f.mono }, { color: colors.neon }]}>
          Active: {accent}
        </Text>
      </Surface>
    </ScrollView>
  );
}

function ReactivateLicenseSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const [key, setKey] = useState('');
  const [history, setHistory] = useState(['ORC-9F2A-… · reactivated · success']);

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
          Reactivate license key
        </Text>
        <Field
          label="License key"
          value={key}
          onChangeText={setKey}
          placeholder="ORC-XXXX-XXXX-XXXX"
          fontsReady={fontsReady}
        />
        <PrimaryButton
          label="Reactivate"
          fontsReady={fontsReady}
          icon="refresh-outline"
          onPress={() => {
            if (!key.trim()) return;
            setHistory((prev) => [`${key.trim()} · reactivated · success`, ...prev].slice(0, 10));
            setKey('');
          }}
        />
      </Surface>
      <Surface>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>History</Text>
        {history.map((h, i) => (
          <Text key={`${h}-${i}`} style={[styles.listLine, f && { fontFamily: f.ui }]}>
            {h}
          </Text>
        ))}
      </Surface>
    </ScrollView>
  );
}

function KeysAnalyticsSection({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const f = useFf(fontsReady);
  const bars = [
    { label: 'Mon', v: 0.45 },
    { label: 'Tue', v: 0.62 },
    { label: 'Wed', v: 0.38 },
    { label: 'Thu', v: 0.8 },
    { label: 'Fri', v: 0.7 },
    { label: 'Sat', v: 0.5 },
    { label: 'Sun', v: 0.33 },
  ];
  const stats: { label: string; value: string; delta: string }[] = [
    { label: 'Keys issued', value: '312', delta: '+18' },
    { label: 'Activations', value: '267', delta: '+11%' },
    { label: 'Revoked', value: '14', delta: '-2' },
    { label: 'Conv. rate', value: '85%', delta: '+3%' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <View style={styles.kpiGrid}>
        {stats.map((s) => (
          <View
            key={s.label}
            style={[styles.kpi, { borderColor: hexToRgba(colors.neon, 0.2) }]}
          >
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, f && { fontFamily: f.uiMed }]}>{s.label}</Text>
              <Text style={[styles.kpiDelta, f && { fontFamily: f.uiBold }, { color: '#3DFF9A' }]}>
                {s.delta}
              </Text>
            </View>
            <Text style={[styles.kpiValue, f && { fontFamily: f.display }]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <Surface accent={colors.neon}>
        <Text style={[styles.cardTitle, f && { fontFamily: f.displaySemi }]}>
          Keys analytics · 7 days
        </Text>
        <View style={styles.chartRow}>
          {bars.map((b) => (
            <View key={b.label} style={styles.chartCol}>
              <View style={styles.chartTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: Math.max(8, Math.round(b.v * 120)),
                      backgroundColor: colors.neon,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, f && { fontFamily: f.uiMed }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
    paddingBottom: 36,
  },
  lead: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 2,
  },
  surface: {
    backgroundColor: '#0E121C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardHint: {
    color: 'rgba(148,163,184,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  field: { gap: 6 },
  fieldLabel: {
    color: 'rgba(148,163,184,0.75)',
    fontSize: 11,
    letterSpacing: 0.3,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontWeight: '600',
    backgroundColor: '#0A0D14',
    fontSize: 14,
  },
  primaryBtn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    marginTop: 2,
  },
  primaryBtnText: {
    color: '#061018',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpi: {
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#0E121C',
    gap: 6,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: {
    color: 'rgba(148,163,184,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  kpiDelta: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiValue: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 26,
    marginTop: 2,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: 'rgba(226,232,240,0.65)',
    fontWeight: '700',
    fontSize: 12,
  },
  split: { gap: 14 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLeft: { color: '#E2E8F0', fontWeight: '600', fontSize: 13 },
  rowRight: { color: '#3DFF9A', fontWeight: '700', fontSize: 12 },
  warn: { color: '#FFC857' },
  listLine: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 13,
    lineHeight: 21,
    paddingVertical: 2,
  },
  keyRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#0A0D14',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  keyText: {
    color: '#F8FAFC',
    fontSize: 13,
    letterSpacing: 0.4,
  } as TextStyle,
  keyMeta: {
    color: 'rgba(148,163,184,0.7)',
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
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0A0D14',
  },
  mono: {
    color: '#F8FAFC',
    fontSize: 12,
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkCopy: {
    color: '#6AA0F8',
    fontWeight: '700',
    fontSize: 12,
  },
  userRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A0D14',
  },
  userName: { color: '#F8FAFC', fontWeight: '700' },
  userMeta: { color: 'rgba(148,163,184,0.7)', fontSize: 12, marginTop: 2 },
  badge: { color: '#3DFF9A', fontWeight: '700', fontSize: 12 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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
  chartCol: { flex: 1, alignItems: 'center', height: '100%' },
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
    color: 'rgba(148,163,184,0.7)',
    fontSize: 10,
    marginTop: 6,
    fontWeight: '600',
  },
});
