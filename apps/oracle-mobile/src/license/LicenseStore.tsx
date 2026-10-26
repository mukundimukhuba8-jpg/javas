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
  attachCloudDebug,
  fetchCloudPrimary,
  linkedEmailOf,
  mergeKeysCloud,
  pushActivationToCloud,
  pushKeyToCloud,
  unlinkKeyInCloud,
} from '../cloud/oracleCloud';
import {
  generateLicenseKeyCode,
  normalizeLicenseKey,
  toSlimKey,
  type KeyActivation,
  type LicenseKey,
  type UnlockedRobot,
} from './types';

/**
 * Local cache only — source of truth is the shared cloud store.
 * Kept so offline/dev still has a last-known catalog.
 */
export const KEYS_STORAGE = 'oracle.license.catalog.v2';
const KEYS_STORAGE_LEGACY = 'oracle.license.keys.v1';
export const ACT_STORAGE = 'oracle.license.activations.v1';

type CreateKeyResult = { key: LicenseKey; saved: boolean; error?: string };
type ActivateKeyResult = {
  ok: boolean;
  reason?: string;
  key?: LicenseKey;
  catalogCount?: number;
};

type LicenseContextValue = {
  keys: LicenseKey[];
  activations: KeyActivation[];
  cloudReady: boolean;
  cloudError: string | null;
  refreshCloud: () => Promise<void>;
  createKey: (input: {
    user: string;
    plan: string;
    eaId: string;
    eaName: string;
    eaImageUri?: string | null;
  }) => Promise<CreateKeyResult>;
  activateKey: (email: string, rawKey: string) => Promise<ActivateKeyResult>;
  unlinkKey: (keyCode: string) => Promise<{ ok: boolean; error?: string }>;
  hasActivatedKey: (email: string) => boolean;
  activationForEmail: (email: string) => KeyActivation | null;
  unlockedRobotsForEmail: (email: string) => UnlockedRobot[];
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

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
  const legacy = parseKeyArray(localStorage.getItem(KEYS_STORAGE_LEGACY));
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

function persistKeysToDisk(keys: LicenseKey[]): void {
  const slim = keys.map(toSlimKey);
  memoryKeys = slim;
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(slim));
  } catch {
    /* ignore quota — cloud is source of truth */
  }
}

function persistActivationsToDisk(list: KeyActivation[]): void {
  const slim = list.map((a) => ({ ...a, eaImageUri: null }));
  memoryActivations = slim;
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(ACT_STORAGE, JSON.stringify(slim));
  } catch {
    /* ignore */
  }
}

function hydrateMemory() {
  const diskKeys = loadKeysFromDisk();
  const diskActs = loadActivationsFromDisk();
  memoryKeys = mergeKeysCloud(memoryKeys, diskKeys);
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
  else memoryKeys = mergeKeysCloud(memoryKeys, loadKeysFromDisk());
  return memoryKeys;
}

function attachDebug() {
  if (typeof window === 'undefined') return;
  attachCloudDebug();
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
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const applyCloud = useCallback(async () => {
    try {
      // Primary only — Keys analytics must match what Activate reads
      const store = await fetchCloudPrimary();
      memoryKeys = mergeKeysCloud(store.keys, []);
      persistKeysToDisk(memoryKeys);
      setKeys(memoryKeys);
      memoryActivations = store.activations.map((a) => ({ ...a, eaImageUri: null }));
      persistActivationsToDisk(memoryActivations);
      setActivations(memoryActivations);
      setCloudReady(true);
      setCloudError(null);
      attachDebug();
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : 'Cloud sync failed');
      setCloudReady(false);
    }
  }, []);

  useEffect(() => {
    void applyCloud();
    const id = setInterval(() => {
      void applyCloud();
    }, 60000);
    return () => clearInterval(id);
  }, [applyCloud]);

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
    async (input: {
      user: string;
      plan: string;
      eaId: string;
      eaName: string;
      eaImageUri?: string | null;
    }): Promise<CreateKeyResult> => {
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
      void input.eaImageUri;

      try {
        // Await confirmed primary cloud write + GET verification before success
        const cloud = await pushKeyToCloud(entry);
        const code = normalizeLicenseKey(entry.key);
        if (!cloud.keys.some((k) => normalizeLicenseKey(k.key) === code)) {
          throw new Error('Key missing from cloud after write.');
        }
        memoryKeys = cloud.keys.map(toSlimKey);
        persistKeysToDisk(memoryKeys);
        setKeys(memoryKeys);
        setCloudReady(true);
        setCloudError(null);
        attachDebug();
        return { key: entry, saved: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Cloud save failed';
        setCloudError(msg);
        // Do not keep an unsaved key in the shared catalog view
        try {
          const cloud = await fetchCloudPrimary();
          memoryKeys = cloud.keys.map(toSlimKey);
          persistKeysToDisk(memoryKeys);
          setKeys(memoryKeys);
        } catch {
          /* keep prior */
        }
        attachDebug();
        return {
          key: entry,
          saved: false,
          error: `Cloud save failed — key was NOT published. ${msg}`,
        };
      }
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

  const activateKey = useCallback(
    async (email: string, rawKey: string): Promise<ActivateKeyResult> => {
      const n = normalizeEmail(email);
      if (!n) return { ok: false, reason: 'Sign in again, then enter your robot key.' };

      const keyCode = normalizeLicenseKey(rawKey);
      const compact = keyCode.replace(/-/g, '');
      if (compact.length !== 12) {
        return { ok: false, reason: 'Enter a valid key (XXX-XXX-XXX-XXX).' };
      }

      // Fresh primary cloud catalog on every Activate attempt (no stale cache / Pages merge)
      let catalog: LicenseKey[] = [];
      try {
        const store = await fetchCloudPrimary();
        catalog = store.keys.map(toSlimKey);
        memoryKeys = catalog;
        persistKeysToDisk(catalog);
        memoryActivations = store.activations.map((a) => ({ ...a, eaImageUri: null }));
        persistActivationsToDisk(memoryActivations);
        setActivations(memoryActivations);
        setKeys(catalog);
        setCloudReady(true);
        setCloudError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Cloud unreachable';
        setCloudError(msg);
        return {
          ok: false,
          catalogCount: 0,
          reason: `Could not load the license catalog from the cloud. ${msg}`,
        };
      }

      const catalogCount = catalog.length;
      const found = catalog.find((k) => normalizeLicenseKey(k.key) === keyCode);
      if (!found) {
        return {
          ok: false,
          catalogCount,
          reason:
            catalogCount === 0
              ? 'No license keys found. Ask your admin to generate a key in Create keys.'
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
      // Link only after successful Activate. Empty/null ⇒ unassigned (never "already linked").
      const linked = linkedEmailOf(found);
      if (linked && linked !== n) {
        return {
          ok: false,
          catalogCount,
          reason: 'This key is already linked to another account.',
        };
      }

      // Same email re-activating their own key succeeds.
      const already = memoryActivations.some(
        (a) => a.email === n && normalizeLicenseKey(a.key) === keyCode,
      );
      if (already || linked === n) {
        const selfBound = { ...found, boundEmail: n };
        return { ok: true, key: selfBound, catalogCount };
      }

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

      // Bound only here — never on Create keys
      const bound = { ...found, boundEmail: n };
      const nextKeys = catalog.map((k) => (k.id === found.id ? bound : k));
      persistKeysToDisk(nextKeys);
      setKeys(memoryKeys);

      try {
        await pushActivationToCloud(activation, bound);
        setCloudReady(true);
      } catch (e) {
        setCloudError(e instanceof Error ? e.message : 'Cloud activation sync failed');
      }

      return { ok: true, key: bound, catalogCount };
    },
    [keys],
  );

  const unlinkKey = useCallback(async (keyCode: string) => {
    const code = normalizeLicenseKey(keyCode);
    try {
      const store = await unlinkKeyInCloud(code);
      memoryKeys = mergeKeysCloud(store.keys, memoryKeys).map((k) =>
        normalizeLicenseKey(k.key) === code ? { ...k, boundEmail: null } : k,
      );
      // Force unbound on this code even if a stale fallback reintroduced a link
      memoryKeys = memoryKeys.map((k) =>
        normalizeLicenseKey(k.key) === code ? { ...k, boundEmail: null } : k,
      );
      memoryActivations = memoryActivations.filter((a) => normalizeLicenseKey(a.key) !== code);
      persistKeysToDisk(memoryKeys);
      persistActivationsToDisk(memoryActivations);
      setKeys(memoryKeys);
      setActivations(memoryActivations);
      setCloudReady(true);
      setCloudError(null);
      return { ok: true };
    } catch (e) {
      // Local unlink even if cloud write fails
      memoryKeys = memoryKeys.map((k) =>
        normalizeLicenseKey(k.key) === code ? { ...k, boundEmail: null } : k,
      );
      memoryActivations = memoryActivations.filter((a) => normalizeLicenseKey(a.key) !== code);
      persistKeysToDisk(memoryKeys);
      persistActivationsToDisk(memoryActivations);
      setKeys([...memoryKeys]);
      setActivations([...memoryActivations]);
      const msg = e instanceof Error ? e.message : 'Unlink failed';
      setCloudError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  const value = useMemo(
    () => ({
      keys,
      activations,
      cloudReady,
      cloudError,
      refreshCloud: applyCloud,
      createKey,
      activateKey,
      unlinkKey,
      hasActivatedKey,
      activationForEmail,
      unlockedRobotsForEmail,
    }),
    [
      keys,
      activations,
      cloudReady,
      cloudError,
      applyCloud,
      createKey,
      activateKey,
      unlinkKey,
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
