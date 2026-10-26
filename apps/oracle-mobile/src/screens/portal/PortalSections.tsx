import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT_PRESETS, useTheme } from '../../theme/ThemeContext';
import { portalFonts } from '../../theme/portalFonts';
import { useEas } from '../../ea/EaStore';
import { useAccess } from '../../access/AccessStore';
import { useLicenses } from '../../license/LicenseStore';
import { pickEaImageAsDataUrl } from '../../ea/pickEaImage';
import { assets } from '../../assets';
import type { PortalSectionId } from './portalSections';
import { ea } from './eaTradeTheme';

type Props = {
  section: PortalSectionId;
  fontsReady: boolean;
  onNavigate: (id: PortalSectionId) => void;
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

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function IconTile({
  color,
  soft,
  name,
}: {
  color: string;
  soft: string;
  name: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.iconTile, { backgroundColor: soft }]}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
}

function FieldLabel({ text, fontsReady }: { text: string; fontsReady: boolean }) {
  const f = useFf(fontsReady);
  return <Text style={[styles.fieldLabel, f && { fontFamily: f.uiBold }]}>{text}</Text>;
}

function Input({
  value,
  onChangeText,
  placeholder,
  fontsReady,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  fontsReady: boolean;
}) {
  const f = useFf(fontsReady);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={ea.textMuted}
      style={[styles.input, f && { fontFamily: f.uiMed }]}
    />
  );
}

function SelectRow({
  value,
  placeholder,
  onPress,
  fontsReady,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
  fontsReady: boolean;
}) {
  const f = useFf(fontsReady);
  return (
    <Pressable onPress={onPress} style={styles.select}>
      <Text
        style={[
          styles.selectText,
          f && { fontFamily: f.uiMed },
          !value && { color: ea.textMuted },
        ]}
      >
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-expand" size={16} color={ea.textSecondary} />
    </Pressable>
  );
}

function ConfirmBox({
  label,
  checked,
  onToggle,
  fontsReady,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  fontsReady: boolean;
}) {
  const f = useFf(fontsReady);
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.confirmBox, checked && styles.confirmBoxOn]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Text style={[styles.confirmText, f && { fontFamily: f.uiMed }]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryBtn({
  label,
  onPress,
  icon,
  fontsReady,
  color = ea.primary,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  fontsReady: boolean;
  color?: string;
}) {
  const f = useFf(fontsReady);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.primaryBtn,
        { backgroundColor: color },
        Platform.select({
          web: { boxShadow: `0 0 22px ${color}66` } as object,
          default: {},
        }),
      ]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={16} color="#fff" /> : null}
      <Text style={[styles.primaryBtnText, f && { fontFamily: f.uiBold }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryBtn({
  label,
  onPress,
  fontsReady,
}: {
  label: string;
  onPress: () => void;
  fontsReady: boolean;
}) {
  const f = useFf(fontsReady);
  return (
    <Pressable onPress={onPress} style={styles.secondaryBtn} accessibilityRole="button">
      <Text style={[styles.secondaryBtnText, f && { fontFamily: f.uiBold }]}>{label}</Text>
    </Pressable>
  );
}

function FooterNote({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  return (
    <Text style={[styles.footerNote, f && { fontFamily: f.ui }]}>
      Copyright © 2026 All Rights Reserved. EA Trade.
    </Text>
  );
}

export function PortalSectionBody({ section, fontsReady, onNavigate }: Props) {
  switch (section) {
    case 'dashboard':
      return <DashboardSection fontsReady={fontsReady} onNavigate={onNavigate} />;
    case 'create-keys':
      return <CreateKeysSection fontsReady={fontsReady} onNavigate={onNavigate} />;
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
      return <KeysAnalyticsSection fontsReady={fontsReady} onNavigate={onNavigate} />;
    default:
      return null;
  }
}

function DashboardSection({
  fontsReady,
  onNavigate,
}: {
  fontsReady: boolean;
  onNavigate: (id: PortalSectionId) => void;
}) {
  const f = useFf(fontsReady);
  const { eas } = useEas();
  const userEaCount = eas.length;
  const kpis = [
    {
      label: 'TOTAL LICENSES',
      value: '0',
      sub: 'All-time keys issued',
      color: ea.purple,
      soft: ea.purpleSoft,
      icon: 'key' as const,
    },
    {
      label: 'ACTIVE NOW',
      value: '0',
      sub: 'Currently active users',
      color: ea.teal,
      soft: ea.tealSoft,
      icon: 'checkmark-circle' as const,
    },
    {
      label: 'EXPERT ADVISORS',
      value: String(userEaCount),
      sub: 'EAs on your account',
      color: ea.orange,
      soft: ea.orangeSoft,
      icon: 'hardware-chip' as const,
    },
    {
      label: 'LICENSE CAP',
      value: '0',
      sub: 'Maximum available',
      color: ea.purple,
      soft: ea.purpleSoft,
      icon: 'infinite' as const,
    },
  ];

  const actions: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    target: PortalSectionId;
  }[] = [
    { title: 'Generate Key', icon: 'key-outline', target: 'create-keys' },
    { title: 'Expert Advisors', icon: 'hardware-chip-outline', target: 'expert-adviser' },
    { title: 'Key analytics', icon: 'trending-up-outline', target: 'keys-analytics' },
    { title: 'Affiliate program', icon: 'git-network-outline', target: 'affiliate-program' },
    { title: 'Reactivate license', icon: 'refresh-outline', target: 'reactivate-license' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      {kpis.map((k) => (
        <Card key={k.label}>
          <View style={styles.kpiTop}>
            <IconTile color={k.color} soft={k.soft} name={k.icon} />
          </View>
          <Text style={[styles.kpiLabel, f && { fontFamily: f.uiBold }]}>{k.label}</Text>
          <Text style={[styles.kpiValue, f && { fontFamily: f.display }]}>{k.value}</Text>
          <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>{k.sub}</Text>
        </Card>
      ))}

      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.purple} soft={ea.purpleSoft} name="flash" />
          <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Quick Actions</Text>
        </View>
        <View style={styles.actionList}>
          {actions.map((a) => (
            <Pressable
              key={a.title}
              onPress={() => onNavigate(a.target)}
              style={styles.actionRow}
              accessibilityRole="button"
              accessibilityLabel={a.title}
            >
              <IconTile color={ea.purple} soft={ea.purpleSoft} name={a.icon} />
              <Text style={[styles.actionTitle, f && { fontFamily: f.uiMed }]}>{a.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={ea.textMuted} />
            </Pressable>
          ))}
        </View>
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function CreateKeysSection({
  fontsReady,
  onNavigate,
}: {
  fontsReady: boolean;
  onNavigate: (id: PortalSectionId) => void;
}) {
  const f = useFf(fontsReady);
  const { createKey, keys: catalogKeys } = useLicenses();
  const { eas: storedEas } = useEas();
  const [name, setName] = useState('');
  const [eaId, setEaId] = useState<string | null>(null);
  const [plan, setPlan] = useState('30 days');
  const [emailOk, setEmailOk] = useState(false);
  const [permOk, setPermOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eaOpen, setEaOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const selectedEa = storedEas.find((e) => e.id === eaId) ?? null;
  const plans = ['7 days', '30 days', '90 days', '1 year', 'Lifetime'];

  const generate = async () => {
    if (!name.trim() || !permOk || saving) return;
    if (storedEas.length === 0) {
      setFormError('Create an expert advisor first (EXPERT ADVISER), then generate a key for it.');
      return;
    }
    if (!selectedEa) {
      setFormError('Select an expert advisor. Keys must be tied to an EA with name and image.');
      return;
    }
    setFormError(null);
    setGenerated(null);
    setSavedOk(false);
    setSaving(true);
    try {
      const result = await createKey({
        user: name.trim(),
        plan,
        eaId: selectedEa.id,
        eaName: selectedEa.name,
      });
      if (result.saved) {
        setGenerated(result.key.key);
        setSavedOk(true);
        setFormError(null);
      } else {
        setGenerated(null);
        setSavedOk(false);
        setFormError(
          result.error || 'Cloud save failed — key was NOT published. Try again.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.primary} soft={ea.primarySoft} name="key" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Generate key</Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              The key is tied to a selected EA (name + image). Activating it loads that robot on
              Home.
            </Text>
          </View>
        </View>

        {storedEas.length === 0 ? (
          <Text style={[{ color: ea.orange, fontSize: 13, lineHeight: 18 }, f && { fontFamily: f.ui }]}>
            No expert advisors yet. Go to EXPERT ADVISER, create one with a name and image, then
            return here.
          </Text>
        ) : null}

        <FieldLabel text="CUSTOMER / USER NAME" fontsReady={fontsReady} />
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Customer full name"
          fontsReady={fontsReady}
        />

        <FieldLabel text="EXPERT ADVISOR" fontsReady={fontsReady} />
        <SelectRow
          value={selectedEa?.name ?? ''}
          placeholder="Select an EA"
          fontsReady={fontsReady}
          onPress={() => {
            setEaOpen((v) => !v);
            setPlanOpen(false);
          }}
        />
        {eaOpen
          ? storedEas.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setEaId(item.id);
                  setEaOpen(false);
                  setFormError(null);
                }}
                style={styles.optionRow}
              >
                <Text style={[styles.optionText, f && { fontFamily: f.uiMed }]}>{item.name}</Text>
              </Pressable>
            ))
          : null}

        <FieldLabel text="PLAN DURATION" fontsReady={fontsReady} />
        <SelectRow
          value={plan}
          placeholder="Select a plan"
          fontsReady={fontsReady}
          onPress={() => {
            setPlanOpen((v) => !v);
            setEaOpen(false);
          }}
        />
        {planOpen
          ? plans.map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setPlan(item);
                  setPlanOpen(false);
                }}
                style={styles.optionRow}
              >
                <Text style={[styles.optionText, f && { fontFamily: f.uiMed }]}>{item}</Text>
              </Pressable>
            ))
          : null}

        <ConfirmBox
          label="SEND LICENSE KEY VIA EMAIL AFTER GENERATION"
          checked={emailOk}
          onToggle={() => setEmailOk((v) => !v)}
          fontsReady={fontsReady}
        />
        <ConfirmBox
          label="I CONFIRM THAT I HAVE PERMISSION TO GENERATE THIS LICENCE KEY."
          checked={permOk}
          onToggle={() => setPermOk((v) => !v)}
          fontsReady={fontsReady}
        />

        {formError ? (
          <Text style={[{ color: ea.red, fontSize: 13 }, f && { fontFamily: f.ui }]}>{formError}</Text>
        ) : null}

        <PrimaryBtn
          label={saving ? 'Saving to cloud…' : 'Generate key'}
          icon="sparkles"
          onPress={generate}
          fontsReady={fontsReady}
        />
        <SecondaryBtn
          label="View all keys"
          onPress={() => onNavigate('keys-analytics')}
          fontsReady={fontsReady}
        />

        {generated ? (
          <View style={styles.keyResult}>
            <Text style={[styles.fieldLabel, f && { fontFamily: f.uiBold }]}>GENERATED KEY</Text>
            <Text style={[styles.keyMono, f && { fontFamily: f.monoBold }]}>{generated}</Text>
            <Text
              style={[
                styles.kpiSub,
                f && { fontFamily: f.ui },
                { color: savedOk ? ea.green : ea.red },
              ]}
            >
              {savedOk
                ? `Saved to cloud ✓ · works on any device · ${name || 'Customer'} · ${selectedEa?.name ?? 'EA'} · ${plan}`
                : `Not saved to cloud — Activate on other devices will not find this key.`}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 8, gap: 6 }}>
          <Text style={[styles.fieldLabel, f && { fontFamily: f.uiBold }]}>
            CLOUD KEYS ({catalogKeys.length})
          </Text>
          {catalogKeys.length === 0 ? (
            <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>No keys in cloud yet</Text>
          ) : (
            catalogKeys.slice(0, 8).map((k) => (
              <Text key={k.id} style={[styles.keyMono, f && { fontFamily: f.monoBold }, { fontSize: 13 }]}>
                {k.key} · {k.eaName}
              </Text>
            ))
          )}
        </View>
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function ExpertAdviserSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const { eas, addEa, updateEaImage, removeEa, selectEa } = useEas();
  const [eaName, setEaName] = useState('');
  const [selfHost, setSelfHost] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const onPickImage = async () => {
    setPicking(true);
    try {
      const dataUrl = await pickEaImageAsDataUrl();
      if (dataUrl) setImageUri(dataUrl);
    } finally {
      setPicking(false);
    }
  };

  const onEditRowImage = async (id: string) => {
    setEditingId(id);
    try {
      const dataUrl = await pickEaImageAsDataUrl();
      if (dataUrl) updateEaImage(id, dataUrl);
    } finally {
      setEditingId(null);
    }
  };

  const resetForm = () => {
    setEaName('');
    setConfirm(false);
    setSelfHost(false);
    setImageUri(null);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.primary} soft={ea.primarySoft} name="add" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>
              New expert advisor
            </Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              Each EA gets its own image on Home and a secret licence code for customers.
            </Text>
          </View>
        </View>

        <FieldLabel text="EA NAME" fontsReady={fontsReady} />
        <Input
          value={eaName}
          onChangeText={setEaName}
          placeholder="e.g. MyEA v2.0"
          fontsReady={fontsReady}
        />
        <Text style={[styles.help, f && { fontFamily: f.ui }]}>
          Include a version label if you ship multiple builds.
        </Text>

        <FieldLabel text="EA IMAGE" fontsReady={fontsReady} />
        <Pressable
          onPress={onPickImage}
          style={styles.imagePicker}
          accessibilityRole="button"
          accessibilityLabel="Upload EA image"
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={28} color={ea.primary} />
              <Text style={[styles.imagePlaceholderText, f && { fontFamily: f.uiMed }]}>
                {picking ? 'Opening…' : 'Tap to upload or take a photo'}
              </Text>
            </View>
          )}
        </Pressable>
        {imageUri ? (
          <Pressable onPress={() => setImageUri(null)} accessibilityRole="button">
            <Text style={[styles.clearImage, f && { fontFamily: f.uiMed }]}>Remove image</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setSelfHost((v) => !v)}
          style={[styles.warnBox, selfHost && { backgroundColor: ea.redSoft }]}
        >
          <Text style={[styles.warnTitle, f && { fontFamily: f.uiBold }]}>SELF HOSTING</Text>
          <View style={styles.warnRow}>
            <Ionicons name="warning" size={16} color={ea.red} />
            <Text style={[styles.warnBody, f && { fontFamily: f.uiMed }]}>
              IF THIS IS SELECTED, YOU HAVE TO HOST YOUR OWN EA ON YOUR PC OR SERVER.
            </Text>
          </View>
        </Pressable>

        <ConfirmBox
          label="I CONFIRM I AM AUTHORISED TO ADD THIS EA"
          checked={confirm}
          onToggle={() => setConfirm((v) => !v)}
          fontsReady={fontsReady}
        />

        <PrimaryBtn
          label="Add EA"
          icon="hardware-chip"
          fontsReady={fontsReady}
          onPress={() => {
            if (!eaName.trim() || !confirm) return;
            addEa({
              name: eaName.trim(),
              imageUri,
              type: selfHost ? 'Self-host' : 'Standard',
            });
            resetForm();
          }}
        />
        <SecondaryBtn label="Cancel" onPress={resetForm} fontsReady={fontsReady} />
      </Card>

      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.teal} soft={ea.tealSoft} name="list" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>
              Your expert advisors
            </Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              Create EAs here, then issue keys against them. Tap photo or Edit image to replace the
              thumbnail.
            </Text>
          </View>
        </View>
        <View style={styles.tableHead}>
          <Text style={[styles.tableLabel, f && { fontFamily: f.uiBold }]}>EXPERT ADVISOR</Text>
          <Text style={[styles.tableLabel, f && { fontFamily: f.uiBold }]}>TYPE</Text>
        </View>
        {eas.length === 0 ? (
          <Text style={[styles.emptyState, f && { fontFamily: f.uiMed }]}>
            No expert advisors yet — add one above
          </Text>
        ) : (
          eas.map((item) => {
            const thumb = item.imageUri ? { uri: item.imageUri } : null;
            const busy = editingId === item.id;
            return (
              <Pressable
                key={item.id}
                style={styles.tableRow}
                onPress={() => selectEa(item.id)}
                accessibilityRole="button"
              >
                <Pressable
                  onPress={() => onEditRowImage(item.id)}
                  style={styles.eaThumbWrap}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit image for ${item.name}`}
                >
                  {thumb ? (
                    <Image source={thumb} style={styles.eaThumb} />
                  ) : (
                    <View style={[styles.eaThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="image-outline" size={18} color={ea.textMuted} />
                    </View>
                  )}
                  <View style={styles.eaThumbBadge}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eaName, f && { fontFamily: f.uiBold }]}>{item.name}</Text>
                  <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>
                    {item.imageUri ? 'Custom image' : 'No image yet'}
                  </Text>
                  <Pressable
                    onPress={() => onEditRowImage(item.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit image for ${item.name}`}
                  >
                    <Text style={[styles.editImageLink, f && { fontFamily: f.uiMed }]}>
                      {busy ? 'Opening…' : 'Edit image'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.typePill}>
                  <Text style={[styles.typePillText, f && { fontFamily: f.uiMed }]}>{item.type}</Text>
                </View>
                <Pressable
                  onPress={() => removeEa(item.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <Ionicons name="trash-outline" size={18} color={ea.textMuted} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function AffiliateProgramSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const link = 'https://www.eatrade.io/?ref=AFFNEW';
  const [copied, setCopied] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <Card>
        <Text style={[styles.softLabel, f && { fontFamily: f.uiMed }]}>Affiliate Dashboard</Text>
        <Text style={[styles.welcome, f && { fontFamily: f.display }]}>Welcome</Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Track referrals, monitor conversions, and grow your commission earnings with EA Trade. No
          affiliate activity yet.
        </Text>
        <View style={styles.commissionBox}>
          <Text style={[styles.commissionValue, f && { fontFamily: f.display }]}>0%</Text>
          <Text style={[styles.kpiLabel, f && { fontFamily: f.uiBold }]}>YOUR COMMISSION</Text>
          <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>5% - 10%</Text>
        </View>
      </Card>

      <Card style={{ borderColor: 'rgba(47,107,255,0.35)', borderWidth: 1 }}>
        <View style={styles.cardHeadRow}>
          <Ionicons name="link" size={18} color={ea.primary} />
          <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Your Referral Link</Text>
        </View>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Share this unique link. Full program details apply to every confirmed referral.
        </Text>
        <View style={styles.linkBox}>
          <Text style={[styles.linkMono, f && { fontFamily: f.mono }]} numberOfLines={2}>
            {link}
          </Text>
        </View>
        <PrimaryBtn
          label={copied ? 'Copied' : 'Copy Link'}
          icon="copy-outline"
          fontsReady={fontsReady}
          onPress={async () => {
            if (await copyText(link)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }
          }}
        />
        {[
          ['Share your link', 'Post on social, send to friends, or add to your bio.'],
          ['They join EA Trade', 'They visit the site and pay for membership when ready.'],
          ['You earn commission', 'Your commission rate applies once you have confirmed referrals.'],
        ].map(([title, body], i) => (
          <View key={title} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={[styles.stepNumText, f && { fontFamily: f.uiBold }]}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, f && { fontFamily: f.uiBold }]}>{title}</Text>
              <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>{body}</Text>
            </View>
          </View>
        ))}
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function AffiliatesSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const metrics = [
    { label: 'AVAILABLE BALANCE', value: 'R0.00', color: ea.primary, icon: 'wallet' as const },
    { label: 'PENDING WITHDRAWALS', value: 'R0.00', color: ea.text, icon: 'time' as const },
    { label: 'TOTAL PAID OUT', value: 'R0.00', color: ea.text, icon: 'cash' as const },
    { label: 'LINK CLICKS', value: '0', color: ea.text, icon: 'navigate' as const },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.primary} soft={ea.primarySoft} name="trending-up" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Commission tiers</Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              0 / 350 confirmed sales
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>
        <Text style={[styles.progressHint, f && { fontFamily: f.uiMed }]}>
          No confirmed sales yet
        </Text>
      </Card>

      {metrics.map((m) => (
        <Card key={m.label}>
          <IconTile color={ea.primary} soft={ea.primarySoft} name={m.icon} />
          <Text style={[styles.kpiLabel, f && { fontFamily: f.uiBold }]}>{m.label}</Text>
          <Text style={[styles.kpiValue, f && { fontFamily: f.display }, { color: m.color }]}>
            {m.value}
          </Text>
        </Card>
      ))}

      <Card>
        <View style={styles.cardHeadRow}>
          <Ionicons name="business" size={18} color={ea.primary} />
          <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Payout Methods</Text>
        </View>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Add where you want to receive funds. Bank payouts are in ZAR; crypto payouts supported.
        </Text>
        <Text style={[styles.emptyState, f && { fontFamily: f.uiMed }]}>
          No payout methods yet
        </Text>
        <SecondaryBtn label="+ Add Payout Method" onPress={() => undefined} fontsReady={fontsReady} />
      </Card>

      <Card>
        <View style={styles.cardHeadRow}>
          <Ionicons name="arrow-up-circle" size={18} color={ea.primary} />
          <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Request Withdrawal</Text>
        </View>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Pending → Processing → Paid. Withdrawals process within 1–3 business days.
        </Text>
        <View style={styles.divider} />
        <FieldLabel text="PAY TO" fontsReady={fontsReady} />
        <SelectRow
          value=""
          placeholder="Select payout method"
          fontsReady={fontsReady}
          onPress={() => undefined}
        />
        <PrimaryBtn label="Request withdrawal" fontsReady={fontsReady} onPress={() => undefined} />
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function formatKeyDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function KeysAnalyticsSection({
  fontsReady,
  onNavigate,
}: {
  fontsReady: boolean;
  onNavigate: (id: PortalSectionId) => void;
}) {
  const f = useFf(fontsReady);
  const { keys, unlinkKey } = useLicenses();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const activeCount = keys.filter((k) => k.status === 'Active').length;
  const expiredCount = keys.filter((k) => k.status === 'Expired').length;

  const filtered = keys.filter((k) => {
    if (filter === 'active' && k.status !== 'Active') return false;
    if (filter === 'expired' && k.status !== 'Expired') return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      k.key.toLowerCase().includes(s) ||
      k.ea.toLowerCase().includes(s) ||
      k.user.toLowerCase().includes(s)
    );
  });

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageIntro}>
        <Text style={[styles.pageTitle, f && { fontFamily: f.display }]}>Key analytics</Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Search, copy, and manage every licence key
        </Text>
        <View style={styles.topActions}>
          <View style={styles.outlinePill}>
            <Ionicons name="key-outline" size={14} color={ea.text} />
            <Text style={[styles.outlinePillText, f && { fontFamily: f.uiMed }]}>
              {keys.length} total
            </Text>
          </View>
          <Pressable
            onPress={() => onNavigate('create-keys')}
            style={[
              styles.newKeyBtn,
              Platform.select({
                web: { boxShadow: `0 0 18px ${ea.primaryGlow}` } as object,
                default: {},
              }),
            ]}
          >
            <Text style={[styles.newKeyBtnText, f && { fontFamily: f.uiBold }]}>+ New key</Text>
          </Pressable>
        </View>
      </View>

      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color="#fff" soft={ea.purpleSoft} name="stats-chart" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>All licence keys</Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              Filter by status or search user, key, or EA.
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={ea.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search user, key, EA..."
            placeholderTextColor={ea.textMuted}
            style={[styles.searchInput, f && { fontFamily: f.uiMed }]}
          />
        </View>

        <View style={styles.filterRow}>
          {(
            [
              ['all', `All ${keys.length}`],
              ['active', `Active ${activeCount}`],
              ['expired', `Expired ${expiredCount}`],
            ] as const
          ).map(([id, label]) => {
            const on = filter === id;
            return (
              <Pressable
                key={id}
                onPress={() => setFilter(id)}
                style={[styles.filterPill, on && styles.filterPillOn]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    f && { fontFamily: f.uiBold },
                    on && { color: '#fff' },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <Text style={[styles.emptyState, f && { fontFamily: f.uiMed }]}>No keys yet</Text>
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={styles.keyCard}>
              <View style={styles.keyCardTop}>
                <Text style={[styles.softLabel, f && { fontFamily: f.uiMed }]}>Key</Text>
                <View
                  style={[
                    styles.statusPill,
                    item.status === 'Active' ? styles.statusActive : styles.statusExpired,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      f && { fontFamily: f.uiBold },
                      { color: item.status === 'Active' ? ea.green : ea.orange },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <View style={styles.eaNameRow}>
                <Ionicons name="hardware-chip" size={14} color={ea.primary} />
                <Text style={[styles.eaName, f && { fontFamily: f.uiBold }]}>
                  {item.eaName || item.ea}
                </Text>
              </View>
              <View style={styles.keyCopyRow}>
                <View style={styles.keyBox}>
                  <Text style={[styles.keyMono, f && { fontFamily: f.monoBold }]}>{item.key}</Text>
                </View>
                <Pressable
                  onPress={async () => {
                    if (await copyText(item.key)) {
                      setCopied(item.id);
                      setTimeout(() => setCopied((c) => (c === item.id ? null : c)), 1400);
                    }
                  }}
                  style={styles.copySquare}
                  accessibilityRole="button"
                  accessibilityLabel={`Copy ${item.key}`}
                >
                  <Ionicons
                    name={copied === item.id ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color="#fff"
                  />
                </Pressable>
              </View>
              <View style={styles.keyMetaRow}>
                <Ionicons name="calendar-outline" size={12} color={ea.textMuted} />
                <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>
                  {formatKeyDate(item.createdAt)} · {item.user}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Text style={[styles.kpiSub, f && { fontFamily: f.uiMed }, { flex: 1 }]}>
                  {item.boundEmail?.trim()
                    ? `Linked to ${item.boundEmail.trim().toLowerCase()}`
                    : 'Unassigned'}
                </Text>
                {item.boundEmail?.trim() ? (
                  <Pressable
                    disabled={unlinking === item.id}
                    onPress={async () => {
                      setUnlinking(item.id);
                      await unlinkKey(item.key);
                      setUnlinking(null);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: ea.orange,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Unlink ${item.key}`}
                  >
                    <Text
                      style={[
                        { color: ea.orange, fontSize: 12, fontWeight: '700' },
                        f && { fontFamily: f.uiBold },
                      ]}
                    >
                      {unlinking === item.id ? '…' : 'Unlink'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function ReactivateLicenseSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const [key, setKey] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageIntro}>
        <Text style={[styles.pageTitle, f && { fontFamily: f.display }]}>
          Reactivate License Key
        </Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Reactivate a license key to restore user access.
        </Text>
      </View>
      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.primary} soft={ea.primarySoft} name="key" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>
              Reactivate License Key
            </Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              Enter the key below to restore access for the assigned user.
            </Text>
          </View>
        </View>
        <Text style={[styles.fieldLabelWhite, f && { fontFamily: f.uiBold }]}>License Key</Text>
        <Input
          value={key}
          onChangeText={setKey}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          fontsReady={fontsReady}
        />
        <Text style={[styles.help, f && { fontFamily: f.ui }]}>
          Use the full key including dashes.
        </Text>
        <ConfirmBox
          label="I confirm that I have permission to reactivate this license key."
          checked={confirm}
          onToggle={() => setConfirm((v) => !v)}
          fontsReady={fontsReady}
        />
        <View style={styles.btnRow}>
          <View style={{ flex: 1 }}>
            <PrimaryBtn
              label="Reactivate Key"
              icon="sync"
              fontsReady={fontsReady}
              onPress={() => {
                if (!key.trim() || !confirm) return;
                setDone(key.trim());
                setKey('');
                setConfirm(false);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryBtn
              label="Cancel"
              fontsReady={fontsReady}
              onPress={() => {
                setKey('');
                setConfirm(false);
              }}
            />
          </View>
        </View>
        {done ? (
          <Text style={[styles.successLine, f && { fontFamily: f.uiMed }]}>
            Reactivated {done} successfully.
          </Text>
        ) : null}
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function ReactivateEmailSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const { reactivated, reactivate, removeReactivated } = useAccess();
  const [email, setEmail] = useState('');
  const [paid, setPaid] = useState(true);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onReactivate = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      setConfirmMsg(null);
      return;
    }
    const entry = await reactivate(trimmed, paid);
    setConfirmMsg(
      `${entry.email} reactivated worldwide · ${entry.paid ? 'paid' : 'not paid'} · status active`,
    );
    setError(null);
    setEmail('');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageIntro}>
        <Text style={[styles.pageTitle, f && { fontFamily: f.display }]}>Reactivate email</Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Grant app access for an email. Reactivated addresses can pass the access check.
        </Text>
      </View>
      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.primary} soft={ea.primarySoft} name="mail" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Reactivate access</Text>
            <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
              Mark paid or not paid, then reactivate. Synced to the shared cloud store.
            </Text>
          </View>
        </View>
        <FieldLabel text="USER EMAIL" fontsReady={fontsReady} />
        <Input
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="user@domain.com"
          fontsReady={fontsReady}
        />
        <FieldLabel text="PAYMENT STATUS" fontsReady={fontsReady} />
        <View style={styles.btnRow}>
          <Pressable
            onPress={() => setPaid(true)}
            style={[styles.confirmBox, { flex: 1 }, paid && styles.confirmBoxOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: paid }}
          >
            <Text style={[styles.confirmText, f && { fontFamily: f.uiMed }]}>Paid</Text>
          </Pressable>
          <Pressable
            onPress={() => setPaid(false)}
            style={[styles.confirmBox, { flex: 1 }, !paid && styles.confirmBoxOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: !paid }}
          >
            <Text style={[styles.confirmText, f && { fontFamily: f.uiMed }]}>Not paid</Text>
          </Pressable>
        </View>
        <PrimaryBtn
          label="Reactivate"
          icon="checkmark-circle-outline"
          fontsReady={fontsReady}
          onPress={onReactivate}
        />
        {error ? (
          <Text style={[{ color: ea.red, fontSize: 13 }, f && { fontFamily: f.ui }]}>{error}</Text>
        ) : null}
        {confirmMsg ? (
          <Text style={[styles.successLine, f && { fontFamily: f.uiMed }]}>{confirmMsg}</Text>
        ) : null}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Reactivated emails</Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Active list used by the access gate. Empty until you reactivate someone.
        </Text>
        {reactivated.length === 0 ? (
          <Text style={[styles.emptyState, f && { fontFamily: f.uiMed }]}>
            No reactivated emails yet
          </Text>
        ) : (
          reactivated.map((entry) => (
            <View key={entry.email} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, f && { fontFamily: f.uiBold }]}>
                  {entry.email}
                </Text>
                <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>
                  {entry.paid ? 'Paid' : 'Not paid'} · {entry.status} ·{' '}
                  {new Date(entry.reactivatedAt).toLocaleString()}
                </Text>
              </View>
              <View style={[styles.statusPill, styles.statusActive]}>
                <Text
                  style={[
                    styles.statusPillText,
                    f && { fontFamily: f.uiBold },
                    { color: ea.green },
                  ]}
                >
                  Active
                </Text>
              </View>
              <SecondaryBtn
                label="Remove"
                fontsReady={fontsReady}
                onPress={() => removeReactivated(entry.email)}
              />
            </View>
          ))
        )}
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function ManageUsersSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const [q, setQ] = useState('');
  const users = useMemo(() => [] as { name: string; email: string; role: string; status: string }[], []);
  const filtered = users.filter(
    (u) =>
      !q.trim() ||
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageIntro}>
        <Text style={[styles.pageTitle, f && { fontFamily: f.display }]}>Manage users</Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Search accounts, roles, and access status.
        </Text>
      </View>
      <Card>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={ea.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Name or email"
            placeholderTextColor={ea.textMuted}
            style={[styles.searchInput, f && { fontFamily: f.uiMed }]}
          />
        </View>
        {filtered.length === 0 ? (
          <Text style={[styles.emptyState, f && { fontFamily: f.uiMed }]}>No users yet</Text>
        ) : (
          filtered.map((u) => (
            <View key={u.email} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, f && { fontFamily: f.uiBold }]}>{u.name}</Text>
                <Text style={[styles.kpiSub, f && { fontFamily: f.ui }]}>
                  {u.email} · {u.role}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  u.status === 'Active' ? styles.statusActive : styles.statusExpired,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    f && { fontFamily: f.uiBold },
                    { color: u.status === 'Active' ? ea.green : ea.orange },
                  ]}
                >
                  {u.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

function ColorChangerSection({ fontsReady }: { fontsReady: boolean }) {
  const f = useFf(fontsReady);
  const { accent, setAccent } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      <View style={styles.pageIntro}>
        <Text style={[styles.pageTitle, f && { fontFamily: f.display }]}>Color changer</Text>
        <Text style={[styles.cardSub, f && { fontFamily: f.ui }]}>
          Update the live Oracle app accent outside this portal shell.
        </Text>
      </View>
      <Card>
        <View style={styles.cardHeadRow}>
          <IconTile color={ea.purple} soft={ea.purpleSoft} name="color-palette" />
          <Text style={[styles.cardTitle, f && { fontFamily: f.uiBold }]}>Accent presets</Text>
        </View>
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
        <Text style={[styles.kpiSub, f && { fontFamily: f.mono }]}>Active: {accent}</Text>
      </Card>
      <FooterNote fontsReady={fontsReady} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: ea.card,
    borderRadius: ea.radius,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: ea.border,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendBadge: {
    backgroundColor: ea.greenSoft,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trendText: {
    color: ea.green,
    fontSize: 12,
    fontWeight: '700',
  },
  kpiLabel: {
    color: ea.label,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginTop: 2,
  },
  kpiValue: {
    color: ea.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: -2,
  },
  kpiSub: {
    color: ea.textMuted,
    fontSize: 13,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    color: ea.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSub: {
    color: ea.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  actionList: { gap: 8, marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ea.cardElevated,
    borderRadius: 14,
    padding: 12,
  },
  actionTitle: {
    color: ea.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  fieldLabel: {
    color: ea.label,
    fontSize: 11,
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  fieldLabelWhite: {
    color: ea.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: ea.input,
    borderWidth: 1,
    borderColor: ea.borderStrong,
    borderRadius: ea.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: ea.text,
    fontSize: 15,
  },
  select: {
    backgroundColor: ea.input,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: ea.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: ea.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionRow: {
    backgroundColor: ea.cardElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: { color: ea.text, fontSize: 14 },
  confirmBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(47,107,255,0.45)',
    backgroundColor: 'rgba(47,107,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  confirmBoxOn: {
    backgroundColor: 'rgba(47,107,255,0.2)',
    borderColor: ea.primary,
  },
  confirmText: {
    color: ea.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 16,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: ea.cardElevated,
    borderWidth: 1,
    borderColor: ea.borderStrong,
  },
  secondaryBtnText: {
    color: ea.text,
    fontSize: 15,
    fontWeight: '700',
  },
  keyResult: {
    backgroundColor: ea.input,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: ea.borderStrong,
  },
  keyMono: {
    color: ea.cyanLink,
    fontSize: 16,
    letterSpacing: 0.6,
  },
  help: {
    color: ea.textMuted,
    fontSize: 12,
    marginTop: -4,
  },
  warnBox: {
    borderWidth: 1.5,
    borderColor: ea.red,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  warnTitle: {
    color: ea.red,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  warnRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  warnBody: {
    color: ea.red,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ea.border,
    paddingTop: 12,
  },
  tableLabel: {
    color: ea.label,
    fontSize: 11,
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  eaNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eaName: { color: ea.primary, fontSize: 15, fontWeight: '700' },
  typePill: {
    borderWidth: 1,
    borderColor: ea.borderStrong,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: { color: ea.textSecondary, fontSize: 12 },
  greenBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 14,
    padding: 12,
  },
  greenBannerText: {
    color: ea.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  softLabel: { color: ea.textSecondary, fontSize: 13 },
  welcome: {
    color: ea.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ea.input,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: ea.border,
  },
  emailPillText: { color: ea.text, fontSize: 13 },
  commissionBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(47,107,255,0.45)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    gap: 2,
    backgroundColor: 'rgba(47,107,255,0.06)',
  },
  commissionValue: {
    color: ea.primary,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
  },
  linkBox: {
    backgroundColor: ea.input,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ea.border,
  },
  linkMono: {
    color: ea.cyanLink,
    fontSize: 13,
    lineHeight: 18,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: ea.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: ea.primary, fontWeight: '800', fontSize: 13 },
  stepTitle: { color: ea.text, fontSize: 15, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A30',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ea.primary,
    borderRadius: 4,
  },
  progressHint: {
    color: ea.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ea.cardElevated,
    borderRadius: 14,
    padding: 12,
  },
  payoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  defaultPill: {
    backgroundColor: ea.greenSoft,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultPillText: { color: ea.green, fontSize: 11, fontWeight: '700' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ea.border,
  },
  pageIntro: { gap: 6 },
  pageTitle: {
    color: ea.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  outlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: ea.borderStrong,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: ea.card,
  },
  outlinePillText: { color: ea.text, fontSize: 13, fontWeight: '600' },
  newKeyBtn: {
    backgroundColor: ea.primary,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  newKeyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ea.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ea.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: ea.text,
    fontSize: 14,
    padding: 0,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterPill: {
    borderWidth: 1,
    borderColor: ea.borderStrong,
    borderRadius: ea.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: ea.input,
  },
  filterPillOn: {
    backgroundColor: ea.primary,
    borderColor: ea.primary,
  },
  filterPillText: {
    color: ea.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  keyCard: {
    backgroundColor: ea.cardElevated,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: ea.border,
  },
  keyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: ea.radiusPill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusActive: { backgroundColor: ea.greenSoft },
  statusExpired: { backgroundColor: ea.orangeSoft },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  keyCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyBox: {
    flex: 1,
    backgroundColor: ea.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  copySquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ea.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnRow: { flexDirection: 'row', gap: 10 },
  successLine: { color: ea.green, fontSize: 13 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ea.cardElevated,
    borderRadius: 14,
    padding: 12,
  },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    color: ea.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyState: {
    color: ea.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 18,
  },
  imagePicker: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(47,107,255,0.4)',
    backgroundColor: ea.input,
    minHeight: 160,
  },
  imagePreview: {
    width: '100%',
    height: 180,
  },
  imagePlaceholder: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  imagePlaceholderText: {
    color: ea.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  clearImage: {
    color: ea.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  eaThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  eaThumb: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: '#111',
  },
  eaThumbBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(47,107,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editImageLink: {
    color: ea.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
