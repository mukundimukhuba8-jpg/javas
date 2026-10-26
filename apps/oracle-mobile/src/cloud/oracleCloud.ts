import {
  CLOUD_DOC_URL,
  CLOUD_FALLBACK_URLS,
  MAX_EA_IMAGE_CHARS,
  PREFER_HOST_CHARS,
} from './config';
import type { ReactivatedEmail } from '../access/types';
import type { ExpertAdvisor } from '../ea/types';
import { normalizeLicenseKey, toSlimKey, type KeyActivation, type LicenseKey } from '../license/types';

/** Portal mentor accounts — public Register lands here as status waiting. */
export type Mentor = {
  id: string;
  name?: string;
  email?: string;
  mentorName?: string;
  whatsapp?: string;
  instagram?: string;
  status: 'waiting' | 'approved';
  keysAllowed: number;
  keysUsed: number;
  registeredAt?: string;
};

/** Paid subscription requests awaiting admin approval (before license keys). */
export type SubscriptionPayment = {
  id: string;
  email: string;
  status: 'awaiting' | 'approved' | 'declined';
  paidAt: string;
  plan?: string;
};

export type OracleCloudStore = {
  keys: LicenseKey[];
  reactivated: ReactivatedEmail[];
  eas: ExpertAdvisor[];
  activations: KeyActivation[];
  mentors: Mentor[];
  subscriptions: SubscriptionPayment[];
  updatedAt: string;
};

const EMPTY: OracleCloudStore = {
  keys: [],
  reactivated: [],
  eas: [],
  activations: [],
  mentors: [],
  subscriptions: [],
  updatedAt: new Date(0).toISOString(),
};

function normalizeMentor(raw: unknown): Mentor | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<Mentor>;
  if (typeof m.id !== 'string' || !m.id) return null;
  const status = m.status === 'approved' ? 'approved' : 'waiting';
  return {
    id: m.id,
    name: typeof m.name === 'string' ? m.name : undefined,
    email: typeof m.email === 'string' ? m.email.trim().toLowerCase() : undefined,
    mentorName: typeof m.mentorName === 'string' ? m.mentorName : undefined,
    whatsapp: typeof m.whatsapp === 'string' ? m.whatsapp : undefined,
    instagram: typeof m.instagram === 'string' ? m.instagram : undefined,
    status,
    keysAllowed: typeof m.keysAllowed === 'number' && m.keysAllowed >= 0 ? m.keysAllowed : 0,
    keysUsed: typeof m.keysUsed === 'number' && m.keysUsed >= 0 ? m.keysUsed : 0,
    registeredAt: typeof m.registeredAt === 'string' ? m.registeredAt : undefined,
  };
}

function mergeMentors(a: Mentor[], b: Mentor[]): Mentor[] {
  const map = new Map<string, Mentor>();
  for (const m of [...b, ...a]) {
    if (!m?.id) continue;
    map.set(m.id, m);
  }
  return Array.from(map.values());
}

function normalizeSubscription(raw: unknown): SubscriptionPayment | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<SubscriptionPayment>;
  if (typeof s.id !== 'string' || !s.id) return null;
  if (typeof s.email !== 'string' || !s.email.trim()) return null;
  const status =
    s.status === 'approved' ? 'approved' : s.status === 'declined' ? 'declined' : 'awaiting';
  return {
    id: s.id,
    email: s.email.trim().toLowerCase(),
    status,
    paidAt: typeof s.paidAt === 'string' ? s.paidAt : new Date().toISOString(),
    plan: typeof s.plan === 'string' ? s.plan : undefined,
  };
}

function mergeSubscriptions(
  a: SubscriptionPayment[],
  b: SubscriptionPayment[],
): SubscriptionPayment[] {
  const map = new Map<string, SubscriptionPayment>();
  for (const s of [...b, ...a]) {
    if (!s?.id) continue;
    map.set(s.id, s);
  }
  return Array.from(map.values()).sort((x, y) => (y.paidAt || '').localeCompare(x.paidAt || ''));
}

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

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim();
    if (!text) return '';
    if (text.length > 240) return `${text.slice(0, 240)}…`;
    return text;
  } catch {
    return '';
  }
}

function cloudErrorMessage(prefix: string, res: Response, body: string): string {
  const detail = body ? `: ${body.replace(/^"|"$/g, '')}` : '';
  return `${prefix} (${res.status})${detail}`;
}

/** Safari often surfaces network/CORS failures as TypeError "Load failed". */
function normalizeNetworkError(e: unknown, fallback: string): Error {
  if (e instanceof Error) {
    const msg = e.message || fallback;
    if (/^load failed$/i.test(msg) || /failed to fetch/i.test(msg) || /networkerror/i.test(msg)) {
      return new Error(
        `${fallback}: network/CORS or cloud quota. ${msg}`,
      );
    }
    return e;
  }
  return new Error(fallback);
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchJson(url: string): Promise<unknown> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (e) {
      lastErr = normalizeNetworkError(e, 'Cloud read failed');
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const body = await readErrorBody(res);
      lastErr = new Error(cloudErrorMessage('Cloud read failed', res, body));
      if (isTransientStatus(res.status) || /exceeded allowed number of requests/i.test(body)) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }
    return res.json();
  }
  throw lastErr || new Error('Cloud read failed');
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
    mentors: Array.isArray((o as { mentors?: unknown }).mentors)
      ? ((o as { mentors: unknown[] }).mentors.map(normalizeMentor).filter(Boolean) as Mentor[])
      : [],
    subscriptions: Array.isArray((o as { subscriptions?: unknown }).subscriptions)
      ? ((o as { subscriptions: unknown[] }).subscriptions
          .map(normalizeSubscription)
          .filter(Boolean) as SubscriptionPayment[])
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
    const qualities = [0.82, 0.7, 0.58, 0.45, 0.35, 0.25, 0.18];
    for (const maxEdge of [960, 720, 560, 420, 320]) {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, w, h);
      for (const q of qualities) {
        const out = canvas.toDataURL('image/jpeg', q);
        if (out.length <= maxChars) return out;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function blobFromDataUrl(dataUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    return null;
  }
}

async function uploadLitterbox(blob: Blob): Promise<string | null> {
  try {
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

async function uploadCatbox(blob: Blob): Promise<string | null> {
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', blob, 'ea.jpg');
    const up = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
    const text = (await up.text()).trim();
    if (text.startsWith('https://')) return text;
  } catch {
    /* ignore */
  }
  return null;
}

async function upload0x0(blob: Blob): Promise<string | null> {
  try {
    const form = new FormData();
    form.append('file', blob, 'ea.jpg');
    const up = await fetch('https://0x0.st', { method: 'POST', body: form });
    const text = (await up.text()).trim();
    if (text.startsWith('https://')) return text;
  } catch {
    /* ignore */
  }
  return null;
}

async function uploadToFreeHost(dataUrl: string): Promise<string | null> {
  const blob = await blobFromDataUrl(dataUrl);
  if (!blob) return null;
  return (
    (await uploadLitterbox(blob)) ||
    (await uploadCatbox(blob)) ||
    (await upload0x0(blob))
  );
}

/**
 * Cloud-safe EA image: https URL preferred, else compressed JPEG data URL under quota.
 * Never silently drop a user upload when compression or hosting can save it.
 */
export async function cloudFriendlyImage(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  if (/^https?:\/\//i.test(uri)) return uri;
  if (!uri.startsWith('data:')) return null;

  // Small enough to keep inline
  if (uri.length <= PREFER_HOST_CHARS) return uri;

  // Prefer a durable https URL for larger photos
  let working = uri;
  if (uri.length > MAX_EA_IMAGE_CHARS) {
    const pre = await compressDataUrl(uri, Math.min(MAX_EA_IMAGE_CHARS, PREFER_HOST_CHARS * 2));
    if (pre) working = pre;
  }

  const hosted = await uploadToFreeHost(working);
  if (hosted) return hosted;

  const compressed = await compressDataUrl(uri, MAX_EA_IMAGE_CHARS);
  if (compressed) {
    if (compressed.length > PREFER_HOST_CHARS) {
      const hosted2 = await uploadToFreeHost(compressed);
      if (hosted2) return hosted2;
    }
    return compressed;
  }

  // Last resort: tiny thumbnail so Home never falls back to the built-in hero
  const thumb = await compressDataUrl(uri, PREFER_HOST_CHARS);
  return thumb;
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

function slimStoreForWrite(store: OracleCloudStore, stripInlineImages: boolean): OracleCloudStore {
  return {
    keys: store.keys.map((k) => toSlimKey({ ...k, boundEmail: linkedEmailOf(k) })),
    reactivated: store.reactivated,
    eas: store.eas.map((e) => {
      const imageUri = capImage(e.imageUri ?? null);
      if (!stripInlineImages) return { ...e, imageUri };
      // Keep https refs; drop bulky data-URLs so mentor/key writes stay under quota
      if (imageUri && /^https?:\/\//i.test(imageUri)) return { ...e, imageUri };
      return { ...e, imageUri: null };
    }),
    activations: store.activations.map((a) => ({ ...a, eaImageUri: null })),
    mentors: Array.isArray(store.mentors) ? store.mentors : [],
    subscriptions: Array.isArray(store.subscriptions) ? store.subscriptions : [],
    updatedAt: new Date().toISOString(),
  };
}

async function putCloudStore(store: OracleCloudStore): Promise<OracleCloudStore> {
  const url = resolveWriteUrl();
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const stripInlineImages = attempt > 0;
    const payload = slimStoreForWrite(store, stripInlineImages);
    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        throw normalizeNetworkError(e, 'Cloud write failed');
      }
      if (!res.ok && res.status !== 200 && res.status !== 201 && res.status !== 204) {
        const body = await readErrorBody(res);
        throw new Error(cloudErrorMessage('Cloud write failed', res, body));
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
    mentors: mergeMentors(local.mentors || [], remote.mentors || []),
    subscriptions: mergeSubscriptions(local.subscriptions || [], remote.subscriptions || []),
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
      mentors: patch.mentors ? mergeMentors(patch.mentors, remote.mentors || []) : remote.mentors || [],
      subscriptions: patch.subscriptions
        ? mergeSubscriptions(patch.subscriptions, remote.subscriptions || [])
        : remote.subscriptions || [],
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
  const hadUpload = typeof ea.imageUri === 'string' && ea.imageUri.trim().length > 0;
  const imageUri = await cloudFriendlyImage(ea.imageUri);
  if (hadUpload && !imageUri) {
    throw new Error('Could not save EA image to cloud (compress/host failed). Try a smaller photo.');
  }
  const store = await patchCloudStore({
    eas: [{ ...ea, imageUri: imageUri || ea.imageUri || null }],
  });
  const saved = store.eas.find((e) => e.id === ea.id);
  if (hadUpload && saved && !saved.imageUri) {
    throw new Error('Cloud write dropped the EA image. Retry upload.');
  }
  return store;
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
      mentors: remote.mentors || [],
      subscriptions: remote.subscriptions || [],
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
      mentors: Array.isArray(store.mentors) ? store.mentors : [],
      subscriptions: Array.isArray(store.subscriptions) ? store.subscriptions : [],
      updatedAt: new Date().toISOString(),
    };
    await putCloudStore(payload);
    return payload;
  });
}

/** Replace the mentors list in cloud (approve / quota updates). */
export async function pushMentorsToCloud(mentors: Mentor[]): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    const remote = await fetchCloudPrimary();
    return putCloudStore({
      ...remote,
      mentors: mentors.map((m) => normalizeMentor(m)!).filter(Boolean),
    });
  });
}

export type MentorRegistrationInput = {
  name: string;
  mentorName: string;
  email: string;
  whatsapp: string;
  instagram: string;
};

/** Append a public signup as status waiting — never auto-approves. */
export async function registerMentorWaiting(
  input: MentorRegistrationInput,
): Promise<{ ok: true; store: OracleCloudStore } | { ok: false; reason: string }> {
  const name = input.name.trim();
  const mentorName = input.mentorName.trim();
  const email = input.email.trim().toLowerCase();
  const whatsapp = input.whatsapp.trim();
  const instagram = input.instagram.trim();
  if (!name || !mentorName || !email || !whatsapp) {
    return { ok: false, reason: 'Name, mentor name, email, and WhatsApp are required.' };
  }
  if (!email.includes('@')) {
    return { ok: false, reason: 'Enter a valid email.' };
  }

  try {
    const mentor: Mentor = {
      id: `mentor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      mentorName,
      email,
      whatsapp,
      ...(instagram ? { instagram } : {}),
      status: 'waiting',
      keysAllowed: 0,
      keysUsed: 0,
      registeredAt: new Date().toISOString(),
    };
    const store = await enqueueWrite(async () => {
      const remote = await fetchCloudPrimary();
      const existing = (remote.mentors || []).find(
        (m) => (m.email || '').trim().toLowerCase() === email,
      );
      if (existing) {
        throw new Error(
          existing.status === 'approved'
            ? 'This email is already an approved mentor.'
            : 'This email is already waiting for approval.',
        );
      }
      const verified = await putCloudStore({
        ...remote,
        mentors: [...(remote.mentors || []), mentor],
      });
      const saved = (verified.mentors || []).some(
        (m) => (m.email || '').trim().toLowerCase() === email && m.status === 'waiting',
      );
      if (!saved) {
        throw new Error('Cloud write did not persist the mentor (verification failed).');
      }
      return verified;
    });
    return { ok: true, store };
  } catch (e) {
    const err = normalizeNetworkError(e, 'Could not save registration');
    return { ok: false, reason: err.message };
  }
}

/** Replace subscription payment requests (approve / decline). */
export async function pushSubscriptionsToCloud(
  subscriptions: SubscriptionPayment[],
): Promise<OracleCloudStore> {
  return enqueueWrite(async () => {
    const remote = await fetchCloudPrimary();
    return putCloudStore({
      ...remote,
      subscriptions: subscriptions.map((s) => normalizeSubscription(s)!).filter(Boolean),
    });
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
    pushEa: pushEaToCloud,
    clearBindings: clearAllKeyBindingsInCloud,
    cloudFriendlyImage,
  };
}

void stripId;
void CLOUD_DOC_URL;
