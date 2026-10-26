import {
  CLOUD_DOC_URL,
  CLOUD_FALLBACK_URLS,
  MAX_EA_IMAGE_CHARS,
} from './config';
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

function resolveWriteUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __ORACLE_CLOUD_URL?: string };
    if (w.__ORACLE_CLOUD_URL && typeof w.__ORACLE_CLOUD_URL === 'string') {
      return w.__ORACLE_CLOUD_URL;
    }
  }
  return CLOUD_DOC_URL;
}

function resolveReadUrls(): string[] {
  const primary = resolveWriteUrl();
  const extras = CLOUD_FALLBACK_URLS.filter((u) => u !== primary);
  return [primary, ...extras];
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Cloud read failed (${res.status}) at ${url}`);
  return res.json();
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
  // Always keep compact https/http refs
  if (/^https?:\/\//i.test(uri)) return uri;
  if (uri.length <= MAX_EA_IMAGE_CHARS) return uri;
  return null;
}

/** Compress a data URL to JPEG under maxChars (browser canvas). */
async function compressDataUrl(dataUrl: string, maxChars: number): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = dataUrl;
    });
    const maxEdge = 720;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.72, 0.55, 0.4, 0.28]) {
      const out = canvas.toDataURL('image/jpeg', q);
      if (out.length <= maxChars) return out;
    }
    const last = canvas.toDataURL('image/jpeg', 0.22);
    return last.length <= maxChars ? last : null;
  } catch {
    return null;
  }
}

async function uploadToFreeHost(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72h');
    form.append('fileToUpload', blob, 'ea.jpg');
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

/**
 * Cloud-safe EA image: https URL, or compressed data URL under quota.
 * Never silently drop a user upload when compression can save it.
 */
export async function cloudFriendlyImage(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  if (/^https?:\/\//i.test(uri)) return uri;
  if (!uri.startsWith('data:')) return null;

  if (uri.length <= MAX_EA_IMAGE_CHARS) return uri;

  const hosted = await uploadToFreeHost(uri);
  if (hosted) return hosted;

  const compressed = await compressDataUrl(uri, MAX_EA_IMAGE_CHARS);
  if (compressed) return compressed;

  const mid = await compressDataUrl(uri, Math.floor(MAX_EA_IMAGE_CHARS * 1.5));
  if (mid) {
    const again = await uploadToFreeHost(mid);
    if (again) return again;
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

/** Live catalog Activate/Create use — primary write URL only (no stale Pages merge). */
export async function fetchCloudPrimary(): Promise<OracleCloudStore> {
  const url = resolveWriteUrl();
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return normalizeStore(await fetchJson(url));
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('Cloud store unreachable');
}

/**
 * Prefer primary. Fallbacks only if primary is completely down
 * (so a stale Pages snapshot cannot hide newly written keys).
 */
export async function fetchCloudStore(): Promise<OracleCloudStore> {
  try {
    return await fetchCloudPrimary();
  } catch (primaryErr) {
    const errors: string[] = [
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    ];
    for (const url of CLOUD_FALLBACK_URLS) {
      try {
        return normalizeStore(await fetchJson(url));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    throw new Error(errors[0] || 'Cloud store unreachable');
  }
}

/** Treat blank / whitespace as unlinked. */
export function linkedEmailOf(key: Pick<LicenseKey, 'boundEmail'> | null | undefined): string | null {
  const raw = key?.boundEmail;
  if (typeof raw !== 'string') return null;
  const n = raw.trim().toLowerCase();
  return n || null;
}

async function putCloudStore(store: OracleCloudStore): Promise<OracleCloudStore> {
  const url = resolveWriteUrl();
  const payload: OracleCloudStore = {
    keys: store.keys.map((k) => toSlimKey({ ...k, boundEmail: linkedEmailOf(k) })),
    reactivated: store.reactivated,
    eas: store.eas.map((e) => ({ ...e, imageUri: capImage(e.imageUri ?? null) })),
    activations: store.activations.map((a) => ({ ...a, eaImageUri: null })),
    updatedAt: new Date().toISOString(),
  };
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok && res.status !== 200 && res.status !== 201 && res.status !== 204) {
        throw new Error(`Cloud store write failed (${res.status})`);
      }
      // Confirm round-trip on primary — never trust PUT alone
      const verified = await fetchCloudPrimary();
      return verified;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('Cloud store write failed');
}

export function mergeKeysCloud(a: LicenseKey[], b: LicenseKey[]): LicenseKey[] {
  const byCode = new Map<string, LicenseKey>();
  for (const k of [...b, ...a].map(toSlimKey)) {
    const code = normalizeLicenseKey(k.key);
    const slim = { ...k, boundEmail: linkedEmailOf(k) };
    const prev = byCode.get(code);
    if (!prev || (slim.createdAt || '') >= (prev.createdAt || '')) byCode.set(code, slim);
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

function preferEaImage(a: string | null | undefined, b: string | null | undefined): string | null {
  const A = capImage(a ?? null);
  const B = capImage(b ?? null);
  if (A && B) {
    if (/^https?:\/\//i.test(A)) return A;
    if (/^https?:\/\//i.test(B)) return B;
    return A.length >= B.length ? A : B;
  }
  return A || B;
}

function mergeEas(a: ExpertAdvisor[], b: ExpertAdvisor[]): ExpertAdvisor[] {
  const map = new Map<string, ExpertAdvisor>();
  for (const e of [...b, ...a]) {
    if (!e?.id) continue;
    const prev = map.get(e.id);
    const incomingImg = capImage(e.imageUri ?? null);
    if (!prev) {
      map.set(e.id, { ...e, imageUri: incomingImg });
      continue;
    }
    const newer = (e.createdAt || '') >= (prev.createdAt || '') ? e : prev;
    const older = newer === e ? prev : e;
    // Never let a null/tiny stub overwrite a real uploaded picture
    map.set(e.id, {
      ...newer,
      name: newer.name || older.name,
      imageUri: preferEaImage(newer.imageUri, older.imageUri),
    });
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

/** Fetch primary, merge patch, write back, return verified primary snapshot. */
export async function patchCloudStore(
  patch: Partial<OracleCloudStore>,
): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    let remote = EMPTY;
    try {
      remote = await fetchCloudPrimary();
    } catch {
      remote = EMPTY;
    }
    const next: OracleCloudStore = {
      keys: patch.keys ? mergeKeysCloud(patch.keys, remote.keys) : remote.keys,
      reactivated: patch.reactivated
        ? mergeReactivated(patch.reactivated, remote.reactivated)
        : remote.reactivated,
      eas: patch.eas ? mergeEas(patch.eas, remote.eas) : remote.eas,
      activations: patch.activations
        ? mergeActivations(patch.activations, remote.activations)
        : remote.activations,
      updatedAt: new Date().toISOString(),
    };
    return putCloudStore(next);
  });
}

/** Persist a new key and confirm it is present on the primary cloud document. */
export async function pushKeyToCloud(key: LicenseKey): Promise<OracleCloudStore> {
  const slim = toSlimKey({ ...key, boundEmail: null });
  const store = await patchCloudStore({ keys: [slim] });
  const code = normalizeLicenseKey(slim.key);
  const found = store.keys.some((k) => normalizeLicenseKey(k.key) === code);
  if (!found) {
    throw new Error('Cloud write did not persist the new key (verification failed).');
  }
  return store;
}

export async function pushReactivatedToCloud(entry: ReactivatedEmail): Promise<OracleCloudStore> {
  return patchCloudStore({ reactivated: [entry] });
}

export async function pushEaToCloud(ea: ExpertAdvisor): Promise<OracleCloudStore> {
  const imageUri = await cloudFriendlyImage(ea.imageUri);
  return patchCloudStore({ eas: [{ ...ea, imageUri }] });
}

/**
 * Bind / rebind a key to the activating email.
 * Always overwrites boundEmail and replaces activations for that key code
 * so mentors can reuse the same key without "already linked" friction.
 */
export async function pushActivationToCloud(
  activation: KeyActivation,
  boundKey: LicenseKey,
): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    let remote = EMPTY;
    try {
      remote = await fetchCloudPrimary();
    } catch {
      remote = EMPTY;
    }
    const code = normalizeLicenseKey(activation.key);
    const bound = toSlimKey({ ...boundKey, boundEmail: linkedEmailOf(boundKey) || activation.email });
    const keys = remote.keys.some((k) => normalizeLicenseKey(k.key) === code)
      ? remote.keys.map((k) => (normalizeLicenseKey(k.key) === code ? bound : toSlimKey(k)))
      : [bound, ...remote.keys.map(toSlimKey)];
    const next: OracleCloudStore = {
      keys,
      reactivated: remote.reactivated,
      eas: remote.eas,
      activations: [
        {
          email: activation.email,
          key: code,
          activatedAt: activation.activatedAt || new Date().toISOString(),
          eaId: activation.eaId,
          eaName: activation.eaName,
          eaImageUri: null,
        },
        ...remote.activations.filter((a) => normalizeLicenseKey(a.key) !== code),
      ],
      updatedAt: new Date().toISOString(),
    };
    return putCloudStore(next);
  });
}

/** Wipe every key's boundEmail (one-shot unlock for the whole catalog). */
export async function clearAllKeyBindingsInCloud(): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    const remote = await fetchCloudPrimary();
    const next: OracleCloudStore = {
      ...remote,
      keys: remote.keys.map((k) => toSlimKey({ ...k, boundEmail: null })),
      updatedAt: new Date().toISOString(),
    };
    return putCloudStore(next);
  });
}

/** Full replace (no merge) — used to unlink keys / clear test bindings. */
export async function replaceCloudStore(store: OracleCloudStore): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    const payload: OracleCloudStore = {
      keys: store.keys.map((k) => toSlimKey({ ...k, boundEmail: linkedEmailOf(k) })),
      reactivated: store.reactivated,
      eas: store.eas.map((e) => ({ ...e, imageUri: capImage(e.imageUri ?? null) })),
      activations: store.activations.map((a) => ({ ...a, eaImageUri: null })),
      updatedAt: new Date().toISOString(),
    };
    await putCloudStore(payload);
    return payload;
  });
}

/** Clear boundEmail + activations for one key code. */
export async function unlinkKeyInCloud(keyCode: string): Promise<OracleCloudStore> {
  const code = normalizeLicenseKey(keyCode);
  const remote = await fetchCloudPrimary();
  const next: OracleCloudStore = {
    ...remote,
    keys: remote.keys.map((k) =>
      normalizeLicenseKey(k.key) === code ? { ...k, boundEmail: null } : k,
    ),
    activations: remote.activations.filter((a) => normalizeLicenseKey(a.key) !== code),
    updatedAt: new Date().toISOString(),
  };
  return replaceCloudStore(next);
}

export function attachCloudDebug() {
  if (typeof window === 'undefined') return;
  (window as unknown as { __ORACLE_CLOUD?: object }).__ORACLE_CLOUD = {
    url: resolveWriteUrl(),
    readUrls: resolveReadUrls(),
    fetch: fetchCloudPrimary,
    fetchFallback: fetchCloudStore,
    patch: patchCloudStore,
    pushKey: pushKeyToCloud,
    clearBindings: clearAllKeyBindingsInCloud,
  };
}

void stripId;
void CLOUD_DOC_URL;
