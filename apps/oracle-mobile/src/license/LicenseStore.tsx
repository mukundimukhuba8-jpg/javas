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
} from './types';

const KEYS_STORAGE = 'oracle.license.keys.v1';
const ACT_STORAGE = 'oracle.license.activations.v1';

type LicenseContextValue = {
  keys: LicenseKey[];
  activations: KeyActivation[];
  createKey: (input: { user: string; ea: string; plan: string }) => LicenseKey;
  activateKey: (
    email: string,
    rawKey: string,
  ) => { ok: boolean; reason?: string; key?: LicenseKey };
  hasActivatedKey: (email: string) => boolean;
  activationForEmail: (email: string) => KeyActivation | null;
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
    return parsed.filter((k) => k && typeof k.key === 'string' && typeof k.id === 'string');
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
    return parsed.filter((a) => a && typeof a.email === 'string' && typeof a.key === 'string');
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

  const createKey = useCallback((input: { user: string; ea: string; plan: string }) => {
    const entry: LicenseKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      key: generateLicenseKeyCode(),
      ea: input.ea,
      user: input.user.trim(),
      plan: input.plan,
      status: 'Active',
      createdAt: new Date().toISOString(),
      boundEmail: null,
    };
    setKeys((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const hasActivatedKey = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return activations.some((a) => a.email === n);
    },
    [activations],
  );

  const activationForEmail = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return activations.find((a) => a.email === n) ?? null;
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
      if (found.boundEmail && found.boundEmail !== n) {
        return { ok: false, reason: 'This key is already linked to another account.' };
      }

      // Already activated this key for this email
      if (activations.some((a) => a.email === n && a.key === keyCode)) {
        return { ok: true, key: found };
      }

      // Email already activated a different key — allow re-bind to this key
      setActivations((prev) => {
        const without = prev.filter((a) => a.email !== n);
        return [{ email: n, key: keyCode, activatedAt: new Date().toISOString() }, ...without];
      });
      setKeys((prev) =>
        prev.map((k) => {
          if (k.id === found.id) return { ...k, boundEmail: n };
          if (k.boundEmail === n && k.id !== found.id) return { ...k, boundEmail: null };
          return k;
        }),
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
    }),
    [keys, activations, createKey, activateKey, hasActivatedKey, activationForEmail],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicenses(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicenses must be used within LicenseProvider');
  return ctx;
}
