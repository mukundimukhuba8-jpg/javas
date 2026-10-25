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

/** Single shared store for Create keys + Activate — never diverge. */
export const KEYS_STORAGE = 'oracle.license.keys.v1';
export const ACT_STORAGE = 'oracle.license.activations.v1';

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
  // Web bundle constant-folds Platform.OS; also allow any environment with localStorage.
  const isWeb = Platform.OS === 'web' || Platform.OS === ('web' as string);
  return (isWeb || typeof document !== 'undefined') && typeof localStorage !== 'undefined';
}

function normalizeKeyRecord(k: LicenseKey): LicenseKey {
  return {
    ...k,
    key: normalizeLicenseKey(k.key),
    eaId: typeof k.eaId === 'string' ? k.eaId : '',
    eaName: typeof k.eaName === 'string' ? k.eaName : typeof k.ea === 'string' ? k.ea : '',
    eaImageUri: k.eaImageUri ?? null,
    ea: typeof k.ea === 'string' ? k.ea : typeof k.eaName === 'string' ? k.eaName : '',
  };
}

/** Module-level cache so Create keys + Activate share one source even if a provider remounts. */
let memoryKeys: LicenseKey[] = [];
let memoryActivations: KeyActivation[] = [];
let hydrated = false;

function loadKeysFromDisk(): LicenseKey[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LicenseKey[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((k) => k && typeof k.key === 'string' && typeof k.id === 'string')
      .map(normalizeKeyRecord);
  } catch {
    return [];
  }
}

function loadActivationsFromDisk(): KeyActivation[] {
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
        key: normalizeLicenseKey(a.key),
        eaId: typeof a.eaId === 'string' ? a.eaId : '',
        eaName: typeof a.eaName === 'string' ? a.eaName : '',
        eaImageUri: a.eaImageUri ?? null,
      }));
  } catch {
    return [];
  }
}

function mergeKeys(primary: LicenseKey[], secondary: LicenseKey[]): LicenseKey[] {
  const map = new Map<string, LicenseKey>();
  for (const k of secondary) map.set(k.id, k);
  for (const k of primary) map.set(k.id, k);
  // Prefer newest by createdAt when same key code appears under different ids
  const byCode = new Map<string, LicenseKey>();
  for (const k of map.values()) {
    const code = normalizeLicenseKey(k.key);
    const prev = byCode.get(code);
    if (!prev || (k.createdAt || '') >= (prev.createdAt || '')) byCode.set(code, k);
  }
  return Array.from(byCode.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}

/** Persist keys; on quota failure, strip bulky images and retry. */
function persistKeysToDisk(keys: LicenseKey[]): boolean {
  if (!canUseStorage()) {
    memoryKeys = keys;
    return true;
  }
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
    memoryKeys = keys;
    return true;
  } catch {
    try {
      const slim = keys.map((k) => ({ ...k, eaImageUri: null }));
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(slim));
      memoryKeys = slim;
      return true;
    } catch {
      // Keep memory even if disk fails — Activate still works in-session
      memoryKeys = keys;
      return false;
    }
  }
}

function persistActivationsToDisk(list: KeyActivation[]): boolean {
  if (!canUseStorage()) {
    memoryActivations = list;
    return true;
  }
  try {
    localStorage.setItem(ACT_STORAGE, JSON.stringify(list));
    memoryActivations = list;
    return true;
  } catch {
    try {
      const slim = list.map((a) => ({ ...a, eaImageUri: null }));
      localStorage.setItem(ACT_STORAGE, JSON.stringify(slim));
      memoryActivations = slim;
      return true;
    } catch {
      memoryActivations = list;
      return false;
    }
  }
}

function hydrateMemory() {
  const diskKeys = loadKeysFromDisk();
  const diskActs = loadActivationsFromDisk();
  memoryKeys = mergeKeys(memoryKeys, diskKeys);
  // activations: prefer memory, then disk
  const actMap = new Map<string, KeyActivation>();
  for (const a of diskActs) actMap.set(`${a.email}::${normalizeLicenseKey(a.key)}`, a);
  for (const a of memoryActivations) actMap.set(`${a.email}::${normalizeLicenseKey(a.key)}`, a);
  memoryActivations = Array.from(actMap.values());
  hydrated = true;
  return { keys: memoryKeys, activations: memoryActivations };
}

/** Public read used by Activate — always merges disk + memory. */
export function readLicenseKeys(): LicenseKey[] {
  if (!hydrated) hydrateMemory();
  else memoryKeys = mergeKeys(memoryKeys, loadKeysFromDisk());
  return memoryKeys;
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => hydrateMemory(), []);
  const [keys, setKeys] = useState<LicenseKey[]>(() => initial.keys);
  const [activations, setActivations] = useState<KeyActivation[]>(() => initial.activations);

  // Keep React state in sync if another tab writes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEYS_STORAGE && e.key !== ACT_STORAGE) return;
      const next = hydrateMemory();
      setKeys(next.keys);
      setActivations(next.activations);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
        key: normalizeLicenseKey(generateLicenseKeyCode()),
        eaId: input.eaId,
        eaName: input.eaName,
        // Prefer not bloating storage; Home resolves live EA image by eaId when possible
        eaImageUri: input.eaImageUri,
        ea: input.eaName,
        user: input.user.trim(),
        plan: input.plan,
        status: 'Active',
        createdAt: new Date().toISOString(),
        boundEmail: null,
      };
      const next = mergeKeys([entry], readLicenseKeys());
      persistKeysToDisk(next);
      setKeys(next);
      return entry;
    },
    [],
  );

  const hasActivatedKey = useCallback((email: string) => {
    const n = normalizeEmail(email);
    const acts = memoryActivations.length ? memoryActivations : loadActivationsFromDisk();
    return acts.some((a) => a.email === n && !!a.eaId);
  }, [activations]);

  const activationForEmail = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return (
        memoryActivations.find((a) => a.email === n && !!a.eaId) ??
        loadActivationsFromDisk().find((a) => a.email === n && !!a.eaId) ??
        null
      );
    },
    [activations],
  );

  const unlockedRobotsForEmail = useCallback(
    (email: string): UnlockedRobot[] => {
      const n = normalizeEmail(email);
      const acts =
        memoryActivations.length > 0 ? memoryActivations : loadActivationsFromDisk();
      const mine = acts.filter((a) => a.email === n && a.eaId);
      const byEa = new Map<string, UnlockedRobot>();
      for (const a of mine) {
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

  const activateKey = useCallback((email: string, rawKey: string) => {
    const n = normalizeEmail(email);
    if (!n) return { ok: false, reason: 'Sign in again, then enter your robot key.' };

    const keyCode = normalizeLicenseKey(rawKey);
    const compact = keyCode.replace(/-/g, '');
    if (compact.length !== 12) {
      return { ok: false, reason: 'Enter a valid key (XXX-XXX-XXX-XXX).' };
    }

    // Always re-read shared store (disk + memory) — never rely on a stale React closure alone
    const catalog = readLicenseKeys();
    setKeys(catalog);

    const found = catalog.find((k) => normalizeLicenseKey(k.key) === keyCode);
    if (!found) {
      return {
        ok: false,
        reason:
          catalog.length === 0
            ? 'No license keys found. Ask your admin to generate a key in Create keys (same browser).'
            : 'Invalid robot key. Check with your mentor.',
      };
    }
    if (found.status !== 'Active') {
      return { ok: false, reason: 'This key is expired. Contact your mentor.' };
    }
    if (!found.eaId || !found.eaName) {
      return {
        ok: false,
        reason:
          'This key is not linked to an EA. Ask your admin to create the key against an expert advisor.',
      };
    }
    if (found.boundEmail && found.boundEmail !== n) {
      return { ok: false, reason: 'This key is already linked to another account.' };
    }

    const already = memoryActivations.some(
      (a) => a.email === n && normalizeLicenseKey(a.key) === keyCode,
    );
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
    const nextActs = [
      activation,
      ...memoryActivations.filter(
        (a) => !(a.email === n && normalizeLicenseKey(a.key) === keyCode),
      ),
    ];
    persistActivationsToDisk(nextActs);
    setActivations(nextActs);

    const nextKeys = catalog.map((k) =>
      k.id === found.id ? { ...k, boundEmail: n } : k,
    );
    persistKeysToDisk(nextKeys);
    setKeys(nextKeys);

    return { ok: true, key: { ...found, boundEmail: n } };
  }, []);

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
