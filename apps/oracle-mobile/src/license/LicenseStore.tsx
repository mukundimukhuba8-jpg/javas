import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { normalizeEmail } from '../access/types';
import {
  generateLicenseKeyCode,
  normalizeLicenseKey,
  toSlimKey,
  type KeyActivation,
  type LicenseKey,
  type UnlockedRobot,
} from './types';

/**
 * Dedicated slim catalog — never stores EA images.
 * v2 avoids legacy records that embedded multi‑MB data URLs and blew the quota.
 */
export const KEYS_STORAGE = 'oracle.license.catalog.v2';
/** Legacy key (may contain images) — migrated once into v2. */
const KEYS_STORAGE_LEGACY = 'oracle.license.keys.v1';
export const ACT_STORAGE = 'oracle.license.activations.v1';
const EA_STORAGE = 'oracle.eas.v1';

type LicenseContextValue = {
  keys: LicenseKey[];
  activations: KeyActivation[];
  createKey: (input: {
    user: string;
    plan: string;
    eaId: string;
    eaName: string;
    eaImageUri?: string | null;
  }) => { key: LicenseKey; saved: boolean; error?: string };
  activateKey: (
    email: string,
    rawKey: string,
  ) => { ok: boolean; reason?: string; key?: LicenseKey; catalogCount?: number };
  hasActivatedKey: (email: string) => boolean;
  activationForEmail: (email: string) => KeyActivation | null;
  unlockedRobotsForEmail: (email: string) => UnlockedRobot[];
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

/** Module singleton — Create keys + Activate share one catalog. */
let memoryKeys: LicenseKey[] = [];
let memoryActivations: KeyActivation[] = [];
let hydrated = false;

function parseKeyArray(raw: string | null): LicenseKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LicenseKey[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((k) => k && typeof k.key === 'string' && typeof k.id === 'string')
      .map(toSlimKey);
  } catch {
    return [];
  }
}

function loadKeysFromDisk(): LicenseKey[] {
  if (!canUseStorage()) return [];
  const v2 = parseKeyArray(localStorage.getItem(KEYS_STORAGE));
  if (v2.length > 0) return v2;
  // One-time migrate legacy (strip images)
  const legacy = parseKeyArray(localStorage.getItem(KEYS_STORAGE_LEGACY));
  if (legacy.length > 0) {
    persistKeysToDisk(legacy);
    try {
      localStorage.removeItem(KEYS_STORAGE_LEGACY);
    } catch {
      /* ignore */
    }
  }
  return legacy;
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
        email: a.email,
        key: normalizeLicenseKey(a.key),
        activatedAt: a.activatedAt || new Date().toISOString(),
        eaId: typeof a.eaId === 'string' ? a.eaId : '',
        eaName: typeof a.eaName === 'string' ? a.eaName : '',
        eaImageUri: null,
      }));
  } catch {
    return [];
  }
}

function mergeKeys(primary: LicenseKey[], secondary: LicenseKey[]): LicenseKey[] {
  const byCode = new Map<string, LicenseKey>();
  for (const k of [...secondary, ...primary].map(toSlimKey)) {
    const code = normalizeLicenseKey(k.key);
    const prev = byCode.get(code);
    if (!prev || (k.createdAt || '') >= (prev.createdAt || '')) byCode.set(code, k);
  }
  return Array.from(byCode.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}

/** Strip EA images from localStorage to free quota for the slim key catalog. */
function freeEaImageQuota(): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(EA_STORAGE);
    if (!raw) return;
    const eas = JSON.parse(raw) as Array<{ imageUri?: string | null }>;
    if (!Array.isArray(eas)) return;
    const stripped = eas.map((e) => ({ ...e, imageUri: null }));
    localStorage.setItem(EA_STORAGE, JSON.stringify(stripped));
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(KEYS_STORAGE_LEGACY);
  } catch {
    /* ignore */
  }
}

function persistKeysToDisk(keys: LicenseKey[]): { ok: boolean; error?: string } {
  const slim = keys.map(toSlimKey);
  memoryKeys = slim;
  if (!canUseStorage()) return { ok: true };

  const payload = JSON.stringify(slim);
  try {
    localStorage.setItem(KEYS_STORAGE, payload);
    // Round-trip verify
    const read = parseKeyArray(localStorage.getItem(KEYS_STORAGE));
    const ok = slim.every((k) =>
      read.some((r) => normalizeLicenseKey(r.key) === normalizeLicenseKey(k.key)),
    );
    if (!ok) return { ok: false, error: 'Key catalog write could not be verified.' };
    return { ok: true };
  } catch (e1) {
    // Free space from EA images and retry once
    freeEaImageQuota();
    try {
      localStorage.setItem(KEYS_STORAGE, payload);
      const read = parseKeyArray(localStorage.getItem(KEYS_STORAGE));
      const ok = slim.every((k) =>
        read.some((r) => normalizeLicenseKey(r.key) === normalizeLicenseKey(k.key)),
      );
      if (!ok) return { ok: false, error: 'Key catalog write failed after freeing space.' };
      return { ok: true };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : 'localStorage quota exceeded';
      return { ok: false, error: msg };
    }
  }
}

function persistActivationsToDisk(list: KeyActivation[]): void {
  const slim = list.map((a) => ({ ...a, eaImageUri: null }));
  memoryActivations = slim;
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(ACT_STORAGE, JSON.stringify(slim));
  } catch {
    freeEaImageQuota();
    try {
      localStorage.setItem(ACT_STORAGE, JSON.stringify(slim));
    } catch {
      /* keep memory */
    }
  }
}

function hydrateMemory() {
  const diskKeys = loadKeysFromDisk();
  const diskActs = loadActivationsFromDisk();
  memoryKeys = mergeKeys(memoryKeys, diskKeys);
  const actMap = new Map<string, KeyActivation>();
  for (const a of diskActs) actMap.set(`${a.email}::${normalizeLicenseKey(a.key)}`, a);
  for (const a of memoryActivations) {
    actMap.set(`${a.email}::${normalizeLicenseKey(a.key)}`, a);
  }
  memoryActivations = Array.from(actMap.values());
  hydrated = true;
  return { keys: memoryKeys, activations: memoryActivations };
}

export function readLicenseKeys(): LicenseKey[] {
  if (!hydrated) hydrateMemory();
  else memoryKeys = mergeKeys(memoryKeys, loadKeysFromDisk());
  return memoryKeys;
}

function attachDebug() {
  if (typeof window === 'undefined') return;
  (window as unknown as { __ORACLE_LICENSE?: object }).__ORACLE_LICENSE = {
    storageKey: KEYS_STORAGE,
    read: () => readLicenseKeys(),
    dump: () => ({
      keys: readLicenseKeys(),
      activations: memoryActivations,
      raw: canUseStorage() ? localStorage.getItem(KEYS_STORAGE) : null,
    }),
  };
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => {
    const h = hydrateMemory();
    attachDebug();
    return h;
  }, []);
  const [keys, setKeys] = useState<LicenseKey[]>(() => initial.keys);
  const [activations, setActivations] = useState<KeyActivation[]>(() => initial.activations);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEYS_STORAGE && e.key !== ACT_STORAGE && e.key !== KEYS_STORAGE_LEGACY) return;
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
      eaImageUri?: string | null;
    }) => {
      const entry = toSlimKey({
        id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key: normalizeLicenseKey(generateLicenseKeyCode()),
        eaId: input.eaId,
        eaName: input.eaName,
        eaImageUri: null,
        ea: input.eaName,
        user: input.user.trim(),
        plan: input.plan,
        status: 'Active',
        createdAt: new Date().toISOString(),
        boundEmail: null,
      });
      // ignore input.eaImageUri on purpose — never persist images on keys
      void input.eaImageUri;

      const next = mergeKeys([entry], readLicenseKeys());
      const result = persistKeysToDisk(next);
      setKeys(memoryKeys);
      attachDebug();
      return { key: entry, saved: result.ok, error: result.error };
    },
    [],
  );

  const hasActivatedKey = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      const acts = memoryActivations.length ? memoryActivations : loadActivationsFromDisk();
      return acts.some((a) => a.email === n && !!a.eaId);
    },
    [activations],
  );

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
      const acts = memoryActivations.length > 0 ? memoryActivations : loadActivationsFromDisk();
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

    const catalog = readLicenseKeys();
    setKeys(catalog);
    const catalogCount = catalog.length;

    const found = catalog.find((k) => normalizeLicenseKey(k.key) === keyCode);
    if (!found) {
      return {
        ok: false,
        catalogCount,
        reason:
          catalogCount === 0
            ? 'No license keys saved yet (0 in catalog). Generate a key in Admin → Create keys on this same browser, then try again.'
            : `Invalid robot key. Catalog has ${catalogCount} key(s) but not this one. Generate a new key and use it immediately.`,
      };
    }
    if (found.status !== 'Active') {
      return { ok: false, catalogCount, reason: 'This key is expired. Contact your mentor.' };
    }
    if (!found.eaId || !found.eaName) {
      return {
        ok: false,
        catalogCount,
        reason:
          'This key is not linked to an EA. Ask your admin to create the key against an expert advisor.',
      };
    }
    if (found.boundEmail && found.boundEmail !== n) {
      return {
        ok: false,
        catalogCount,
        reason: 'This key is already linked to another account.',
      };
    }

    const already = memoryActivations.some(
      (a) => a.email === n && normalizeLicenseKey(a.key) === keyCode,
    );
    if (already) return { ok: true, key: found, catalogCount };

    const activation: KeyActivation = {
      email: n,
      key: keyCode,
      activatedAt: new Date().toISOString(),
      eaId: found.eaId,
      eaName: found.eaName,
      eaImageUri: null,
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
    setKeys(memoryKeys);

    return { ok: true, key: { ...found, boundEmail: n }, catalogCount };
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
