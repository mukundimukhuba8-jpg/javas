import { CLOUD_DOC_URL, MAX_EA_IMAGE_CHARS } from './config';
import type { ReactivatedEmail } from '../access/types';
import type { ExpertAdvisor } from '../ea/types';
import { normalizeLicenseKey, toSlimKey, type KeyActivation, type LicenseKey } from '../license/types';

export type OracleCloudStore = {
  keys: LicenseKey[];
  reactivated: ReactivatedEmail[];
  eas: ExpertAdvisor[];
  activations: KeyActivation[];
  updatedAt: string;
};

const EMPTY: OracleCloudStore = {
  keys: [],
  reactivated: [],
  eas: [],
  activations: [],
  updatedAt: new Date(0).toISOString(),
};

function resolveUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __ORACLE_CLOUD_URL?: string };
    if (w.__ORACLE_CLOUD_URL && typeof w.__ORACLE_CLOUD_URL === 'string') {
      return w.__ORACLE_CLOUD_URL;
    }
  }
  return CLOUD_DOC_URL;
}

function stripId<T extends Record<string, unknown>>(obj: T): Omit<T, '_id'> {
  const { _id: _drop, ...rest } = obj as T & { _id?: string };
  void _drop;
  return rest;
}

function normalizeStore(raw: unknown): OracleCloudStore {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const o = raw as Partial<OracleCloudStore> & { _id?: string };
  return {
    keys: Array.isArray(o.keys) ? o.keys.map((k) => toSlimKey(k as LicenseKey)) : [],
    reactivated: Array.isArray(o.reactivated)
      ? o.reactivated.filter(
          (e): e is ReactivatedEmail =>
            !!e && typeof (e as ReactivatedEmail).email === 'string',
        )
      : [],
    eas: Array.isArray(o.eas)
      ? o.eas
          .filter((e): e is ExpertAdvisor => !!e && typeof e.id === 'string' && typeof e.name === 'string')
          .map((e) => ({
            ...e,
            imageUri: capImage(e.imageUri ?? null),
          }))
      : [],
    activations: Array.isArray(o.activations)
      ? o.activations
          .filter((a): a is KeyActivation => !!a && typeof a.email === 'string' && typeof a.key === 'string')
          .map((a) => ({
            email: a.email,
            key: normalizeLicenseKey(a.key),
            activatedAt: a.activatedAt || new Date().toISOString(),
            eaId: a.eaId || '',
            eaName: a.eaName || '',
            eaImageUri: null,
          }))
      : [],
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  };
}

function capImage(uri: string | null): string | null {
  if (!uri) return null;
  if (uri.length <= MAX_EA_IMAGE_CHARS) return uri;
  return null;
}

/** Upload oversized data URLs to a free temp host; return https URL or null. */
export async function cloudFriendlyImage(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  if (!uri.startsWith('data:')) {
    return uri.length <= MAX_EA_IMAGE_CHARS ? uri : null;
  }
  if (uri.length <= MAX_EA_IMAGE_CHARS) return uri;
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72h');
    form.append('fileToUpload', blob, 'ea.png');
    const up = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: form,
    });
    const text = (await up.text()).trim();
    if (text.startsWith('https://')) return text;
  } catch {
    /* ignore */
  }
  return null;
}

let writeChain: Promise<void> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function fetchCloudStore(): Promise<OracleCloudStore> {
  const url = resolveUrl();
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Cloud store read failed (${res.status})`);
  }
  const json = await res.json();
  return normalizeStore(json);
}

async function putCloudStore(store: OracleCloudStore): Promise<OracleCloudStore> {
  const url = resolveUrl();
  const payload = {
    keys: store.keys.map(toSlimKey),
    reactivated: store.reactivated,
    eas: store.eas.map((e) => ({ ...e, imageUri: capImage(e.imageUri ?? null) })),
    activations: store.activations.map((a) => ({ ...a, eaImageUri: null })),
    updatedAt: new Date().toISOString(),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // crudcrud PUT returns empty body on success sometimes
    if (res.status !== 200 && res.status !== 201 && res.status !== 204) {
      throw new Error(`Cloud store write failed (${res.status})`);
    }
  }
  return { ...payload };
}

export function mergeKeysCloud(a: LicenseKey[], b: LicenseKey[]): LicenseKey[] {
  const byCode = new Map<string, LicenseKey>();
  for (const k of [...b, ...a].map(toSlimKey)) {
    const code = normalizeLicenseKey(k.key);
    const prev = byCode.get(code);
    if (!prev || (k.createdAt || '') >= (prev.createdAt || '')) byCode.set(code, k);
  }
  return Array.from(byCode.values()).sort((x, y) =>
    (y.createdAt || '').localeCompare(x.createdAt || ''),
  );
}

function mergeReactivated(a: ReactivatedEmail[], b: ReactivatedEmail[]): ReactivatedEmail[] {
  const map = new Map<string, ReactivatedEmail>();
  for (const e of [...b, ...a]) {
    if (!e?.email) continue;
    const prev = map.get(e.email);
    if (!prev || (e.reactivatedAt || '') >= (prev.reactivatedAt || '')) map.set(e.email, e);
  }
  return Array.from(map.values()).filter((e) => e.status === 'active');
}

function mergeEas(a: ExpertAdvisor[], b: ExpertAdvisor[]): ExpertAdvisor[] {
  const map = new Map<string, ExpertAdvisor>();
  for (const e of [...b, ...a]) {
    if (!e?.id) continue;
    const prev = map.get(e.id);
    if (!prev || (e.createdAt || '') >= (prev.createdAt || '')) {
      map.set(e.id, { ...e, imageUri: capImage(e.imageUri ?? null) });
    } else if (prev && !prev.imageUri && e.imageUri) {
      map.set(e.id, { ...prev, imageUri: capImage(e.imageUri) });
    }
  }
  return Array.from(map.values());
}

function mergeActivations(a: KeyActivation[], b: KeyActivation[]): KeyActivation[] {
  const map = new Map<string, KeyActivation>();
  for (const act of [...b, ...a]) {
    const k = `${act.email}::${normalizeLicenseKey(act.key)}`;
    const prev = map.get(k);
    if (!prev || (act.activatedAt || '') >= (prev.activatedAt || '')) {
      map.set(k, { ...act, key: normalizeLicenseKey(act.key), eaImageUri: null });
    }
  }
  return Array.from(map.values());
}

export function mergeStores(local: Partial<OracleCloudStore>, remote: OracleCloudStore): OracleCloudStore {
  return {
    keys: mergeKeysCloud(local.keys || [], remote.keys),
    reactivated: mergeReactivated(local.reactivated || [], remote.reactivated),
    eas: mergeEas(local.eas || [], remote.eas),
    activations: mergeActivations(local.activations || [], remote.activations),
    updatedAt: new Date().toISOString(),
  };
}

/** Fetch remote, merge patch, write back (serialized). */
export async function patchCloudStore(
  patch: Partial<OracleCloudStore>,
): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    let remote = EMPTY;
    try {
      remote = await fetchCloudStore();
    } catch {
      remote = EMPTY;
    }
    const next = mergeStores(patch, remote);
    // Prefer explicit patch arrays when provided (already merged by caller)
    if (patch.keys) next.keys = mergeKeysCloud(patch.keys, remote.keys);
    if (patch.reactivated) next.reactivated = mergeReactivated(patch.reactivated, remote.reactivated);
    if (patch.eas) next.eas = mergeEas(patch.eas, remote.eas);
    if (patch.activations) next.activations = mergeActivations(patch.activations, remote.activations);
    try {
      await putCloudStore(next);
      return next;
    } catch (e) {
      // Retry once after fresh fetch
      try {
        const again = await fetchCloudStore();
        const retry = mergeStores(next, again);
        await putCloudStore(retry);
        return retry;
      } catch {
        throw e;
      }
    }
  });
}

export async function pushKeyToCloud(key: LicenseKey): Promise<OracleCloudStore> {
  return patchCloudStore({ keys: [toSlimKey(key)] });
}

export async function pushReactivatedToCloud(entry: ReactivatedEmail): Promise<OracleCloudStore> {
  return patchCloudStore({ reactivated: [entry] });
}

export async function pushEaToCloud(ea: ExpertAdvisor): Promise<OracleCloudStore> {
  const imageUri = await cloudFriendlyImage(ea.imageUri);
  return patchCloudStore({ eas: [{ ...ea, imageUri }] });
}

export async function pushActivationToCloud(
  activation: KeyActivation,
  boundKey: LicenseKey,
): Promise<OracleCloudStore> {
  return patchCloudStore({
    activations: [{ ...activation, eaImageUri: null }],
    keys: [toSlimKey(boundKey)],
  });
}

export function attachCloudDebug() {
  if (typeof window === 'undefined') return;
  (window as unknown as { __ORACLE_CLOUD?: object }).__ORACLE_CLOUD = {
    url: resolveUrl(),
    fetch: fetchCloudStore,
    patch: patchCloudStore,
  };
}

void stripId;
