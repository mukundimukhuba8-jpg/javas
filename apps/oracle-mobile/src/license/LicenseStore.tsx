import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { normalizeEmail } from '../access/types';
import {
  generateLicenseKeyCode,
  normalizeLicenseKey,
  type KeyActivation,
  type LicenseKey,
  type UnlockedRobot,
} from './types';

const KEYS_STORAGE = 'oracle.license.keys.v1';
const ACT_STORAGE = 'oracle.license.activations.v1';

type LicenseContextValue = {
  keys: LicenseKey[];
  activations: KeyActivation[];
  createKey: (input: {
    user: string;
    plan: string;
    eaId: string;
    eaName: string;
    eaImageUri: string | null;
  }) => LicenseKey;
  activateKey: (
    email: string,
    rawKey: string,
  ) => { ok: boolean; reason?: string; key?: LicenseKey };
  hasActivatedKey: (email: string) => boolean;
  activationForEmail: (email: string) => KeyActivation | null;
  unlockedRobotsForEmail: (email: string) => UnlockedRobot[];
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

function canUseStorage() {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined';
}

function loadKeys(): LicenseKey[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LicenseKey[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((k) => k && typeof k.key === 'string' && typeof k.id === 'string')
      .map((k) => ({
        ...k,
        eaId: typeof k.eaId === 'string' ? k.eaId : '',
        eaName: typeof k.eaName === 'string' ? k.eaName : typeof k.ea === 'string' ? k.ea : '',
        eaImageUri: k.eaImageUri ?? null,
        ea: typeof k.ea === 'string' ? k.ea : typeof k.eaName === 'string' ? k.eaName : '',
      }));
  } catch {
    return [];
  }
}

function loadActivations(): KeyActivation[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(ACT_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KeyActivation[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.email === 'string' && typeof a.key === 'string')
      .map((a) => ({
        ...a,
        eaId: typeof a.eaId === 'string' ? a.eaId : '',
        eaName: typeof a.eaName === 'string' ? a.eaName : '',
        eaImageUri: a.eaImageUri ?? null,
      }));
  } catch {
    return [];
  }
}

function persistKeys(keys: LicenseKey[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

function persistActivations(list: KeyActivation[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(ACT_STORAGE, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<LicenseKey[]>(() => loadKeys());
  const [activations, setActivations] = useState<KeyActivation[]>(() => loadActivations());

  useEffect(() => {
    persistKeys(keys);
  }, [keys]);

  useEffect(() => {
    persistActivations(activations);
  }, [activations]);

  const createKey = useCallback(
    (input: {
      user: string;
      plan: string;
      eaId: string;
      eaName: string;
      eaImageUri: string | null;
    }) => {
      const entry: LicenseKey = {
        id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key: generateLicenseKeyCode(),
        eaId: input.eaId,
        eaName: input.eaName,
        eaImageUri: input.eaImageUri,
        ea: input.eaName,
        user: input.user.trim(),
        plan: input.plan,
        status: 'Active',
        createdAt: new Date().toISOString(),
        boundEmail: null,
      };
      setKeys((prev) => [entry, ...prev]);
      return entry;
    },
    [],
  );

  const hasActivatedKey = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return activations.some((a) => a.email === n && !!a.eaId);
    },
    [activations],
  );

  const activationForEmail = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return activations.find((a) => a.email === n && !!a.eaId) ?? null;
    },
    [activations],
  );

  const unlockedRobotsForEmail = useCallback(
    (email: string): UnlockedRobot[] => {
      const n = normalizeEmail(email);
      const mine = activations.filter((a) => a.email === n && a.eaId);
      const byEa = new Map<string, UnlockedRobot>();
      for (const a of mine) {
        // Prefer newest activation for each EA
        if (!byEa.has(a.eaId)) {
          byEa.set(a.eaId, {
            id: a.eaId,
            name: a.eaName,
            imageUri: a.eaImageUri,
            key: a.key,
          });
        }
      }
      return Array.from(byEa.values());
    },
    [activations],
  );

  const activateKey = useCallback(
    (email: string, rawKey: string) => {
      const n = normalizeEmail(email);
      if (!n) return { ok: false, reason: 'Sign in again, then enter your robot key.' };

      const keyCode = normalizeLicenseKey(rawKey);
      const compact = keyCode.replace(/-/g, '');
      if (compact.length !== 12) {
        return { ok: false, reason: 'Enter a valid key (XXX-XXX-XXX-XXX).' };
      }

      const found = keys.find((k) => normalizeLicenseKey(k.key) === keyCode);
      if (!found) {
        return { ok: false, reason: 'Invalid robot key. Check with your mentor.' };
      }
      if (found.status !== 'Active') {
        return { ok: false, reason: 'This key is expired. Contact your mentor.' };
      }
      if (!found.eaId || !found.eaName) {
        return {
          ok: false,
          reason: 'This key is not linked to an EA. Ask your admin to create the key against an expert advisor.',
        };
      }
      if (found.boundEmail && found.boundEmail !== n) {
        return { ok: false, reason: 'This key is already linked to another account.' };
      }

      const already = activations.some((a) => a.email === n && a.key === keyCode);
      if (already) {
        return { ok: true, key: found };
      }

      const activation: KeyActivation = {
        email: n,
        key: keyCode,
        activatedAt: new Date().toISOString(),
        eaId: found.eaId,
        eaName: found.eaName,
        eaImageUri: found.eaImageUri,
      };
      setActivations((prev) => [activation, ...prev.filter((a) => !(a.email === n && a.key === keyCode))]);
      setKeys((prev) =>
        prev.map((k) => (k.id === found.id ? { ...k, boundEmail: n } : k)),
      );
      return { ok: true, key: { ...found, boundEmail: n } };
    },
    [activations, keys],
  );

  const value = useMemo(
    () => ({
      keys,
      activations,
      createKey,
      activateKey,
      hasActivatedKey,
      activationForEmail,
      unlockedRobotsForEmail,
    }),
    [
      keys,
      activations,
      createKey,
      activateKey,
      hasActivatedKey,
      activationForEmail,
      unlockedRobotsForEmail,
    ],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicenses(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicenses must be used within LicenseProvider');
  return ctx;
}
