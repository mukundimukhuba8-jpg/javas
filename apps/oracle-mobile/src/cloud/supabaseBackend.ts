/**
 * Supabase-backed worldwide catalog.
 *
 * Client uses publishable key only (never the project secret).
 *
 * Write path preference:
 *   1. public.oracle_catalog (PostgREST) when the table exists + RLS allows
 *   2. Auth user_metadata.oracle_store via dedicated sync account
 *      (private-app tradeoff equivalent to permissive RLS — sync email/password
 *       are EXPO_PUBLIC so the static web app can R/W without a server)
 *   3. Public Storage object oracle/catalog.json (read fallback; writes need RLS)
 */
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  ORACLE_SYNC_EMAIL,
  ORACLE_SYNC_PASSWORD,
  STORAGE_CATALOG_URL,
} from './config';
import type { OracleCloudStore } from './oracleCloud';

type Session = { access_token: string; refresh_token?: string; expires_at?: number };

let cachedSession: Session | null = null;
let backendMode: 'table' | 'auth_metadata' | null = null;

const FETCH_MS = 8_000;

function configured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function fetchJsonTimed(
  url: string,
  init: RequestInit | undefined,
  label: string,
): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    ctrl &&
    setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
        /* ignore */
      }
    }, FETCH_MS);
  try {
    return await withTimeout(
      fetch(url, { ...(init || {}), signal: ctrl?.signal, cache: 'no-store' }),
      FETCH_MS + 500,
      label,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function restHeaders(token?: string): Record<string, string> {
  const key = SUPABASE_PUBLISHABLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${token || key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const t = (await res.text()).trim();
    return t.length > 220 ? `${t.slice(0, 220)}…` : t;
  } catch {
    return '';
  }
}

async function ensureSession(): Promise<Session> {
  if (cachedSession?.access_token) {
    const exp = cachedSession.expires_at || 0;
    if (!exp || exp * 1000 > Date.now() + 30_000) return cachedSession;
  }
  if (!ORACLE_SYNC_EMAIL || !ORACLE_SYNC_PASSWORD) {
    throw new Error('Supabase sync account is not configured');
  }
  const res = await fetchJsonTimed(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify({ email: ORACLE_SYNC_EMAIL, password: ORACLE_SYNC_PASSWORD }),
    },
    'Supabase auth',
  );
  if (!res.ok) {
    throw new Error(`Supabase auth failed (${res.status}): ${await readError(res)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error('Supabase auth returned no access_token');
  cachedSession = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in || 3600),
  };
  return cachedSession;
}

function emptyPayload(): OracleCloudStore {
  return {
    keys: [],
    reactivated: [],
    eas: [],
    activations: [],
    mentors: [],
    subscriptions: [],
    deletedEaIds: [],
    updatedAt: new Date(0).toISOString(),
  };
}

/** Upload endpoints that can use the project secret server-side (Vercel). */
function uploadApiCandidates(): string[] {
  const out: string[] = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Same-origin when running on Vercel
    out.push(`${window.location.origin}/api/oracle/upload-ea-image`);
  }
  out.push('https://javas-one.vercel.app/api/oracle/upload-ea-image');
  return Array.from(new Set(out));
}

async function uploadViaApiRoute(blob: Blob, eaId: string): Promise<string | null> {
  const body = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(body);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === 'function' ? btoa(binary) : '';
  if (!b64) return null;
  for (const endpoint of uploadApiCandidates()) {
    try {
      const res = await withTimeout(
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            eaId,
            contentType: blob.type || 'image/jpeg',
            dataBase64: b64,
          }),
        }),
        10_000,
        'EA image API upload',
      );
      if (!res.ok) continue;
      const json = (await res.json()) as { url?: string };
      if (typeof json.url === 'string' && /^https?:\/\//i.test(json.url)) return json.url;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Upload an EA image blob; returns public https URL or null. */
export async function uploadEaImageBlob(
  blob: Blob,
  eaId: string,
): Promise<string | null> {
  // Prefer server route (service role) — Storage RLS blocks client JWTs today
  const viaApi = await uploadViaApiRoute(blob, eaId);
  if (viaApi) return viaApi;

  if (!configured()) return null;
  try {
    const session = await ensureSession();
    const safeId = (eaId || 'ea').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'ea';
    const path = `ea-images/${safeId}-${Date.now().toString(36)}.jpg`;
    const url = `${SUPABASE_URL}/storage/v1/object/oracle/${path}`;
    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': blob.type || 'image/jpeg',
          'x-upsert': 'true',
        },
        body: blob,
      }),
      6_000,
      'Supabase image upload',
    );
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/oracle/${path}`;
  } catch {
    return null;
  }
}

async function fetchFromTable(): Promise<OracleCloudStore | null> {
  const res = await fetchJsonTimed(
    `${SUPABASE_URL}/rest/v1/oracle_catalog?id=eq.main&select=payload,updated_at`,
    { method: 'GET', headers: restHeaders() },
    'Supabase table read',
  );
  if (res.status === 404 || res.status === 406) return null;
  if (!res.ok) {
    const body = await readError(res);
    // PGRST205 table missing
    if (/PGRST205|Could not find the table/i.test(body)) return null;
    throw new Error(`Supabase table read failed (${res.status}): ${body}`);
  }
  const rows = (await res.json()) as Array<{ payload?: unknown; updated_at?: string }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    backendMode = 'table';
    return emptyPayload();
  }
  backendMode = 'table';
  const payload = rows[0]?.payload;
  if (payload && typeof payload === 'object') {
    return payload as OracleCloudStore;
  }
  return emptyPayload();
}

async function putToTable(store: OracleCloudStore): Promise<boolean> {
  const session = await ensureSession().catch(() => null);
  const token = session?.access_token;
  const body = JSON.stringify({
    id: 'main',
    payload: store,
    updated_at: store.updatedAt || new Date().toISOString(),
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/oracle_catalog?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...restHeaders(token || undefined),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body,
  });
  if (res.status === 404) return false;
  const err = await readError(res);
  if (!res.ok) {
    if (/PGRST205|Could not find the table/i.test(err)) return false;
    // RLS / grant failures → fall through to auth metadata
    if (res.status === 401 || res.status === 403) return false;
    throw new Error(`Supabase table write failed (${res.status}): ${err}`);
  }
  backendMode = 'table';
  return true;
}

async function fetchFromAuthMetadata(): Promise<OracleCloudStore> {
  const session = await ensureSession();
  const res = await fetchJsonTimed(
    `${SUPABASE_URL}/auth/v1/user`,
    { method: 'GET', headers: restHeaders(session.access_token) },
    'Supabase metadata read',
  );
  if (!res.ok) {
    throw new Error(`Supabase metadata read failed (${res.status}): ${await readError(res)}`);
  }
  const user = (await res.json()) as { user_metadata?: { oracle_store?: OracleCloudStore } };
  backendMode = 'auth_metadata';
  const store = user.user_metadata?.oracle_store;
  if (store && typeof store === 'object') return store;
  return emptyPayload();
}

async function putToAuthMetadata(store: OracleCloudStore): Promise<void> {
  const session = await ensureSession();
  const res = await fetchJsonTimed(
    `${SUPABASE_URL}/auth/v1/user`,
    {
      method: 'PUT',
      headers: restHeaders(session.access_token),
      body: JSON.stringify({ data: { oracle_store: store } }),
    },
    'Supabase metadata write',
  );
  if (!res.ok) {
    throw new Error(`Supabase metadata write failed (${res.status}): ${await readError(res)}`);
  }
  backendMode = 'auth_metadata';
}

async function fetchFromStoragePublic(): Promise<OracleCloudStore | null> {
  if (!STORAGE_CATALOG_URL) return null;
  try {
    const res = await fetchJsonTimed(
      STORAGE_CATALOG_URL,
      { method: 'GET', headers: { Accept: 'application/json' } },
      'Supabase storage read',
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json && typeof json === 'object') return json as OracleCloudStore;
  } catch {
    /* ignore */
  }
  return null;
}

/** Best-effort public Storage mirror (works once Storage RLS policies exist). */
async function mirrorToStorage(store: OracleCloudStore): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return;
  try {
    const session = await ensureSession().catch(() => null);
    const token = session?.access_token || SUPABASE_PUBLISHABLE_KEY;
    const url = `${SUPABASE_URL}/storage/v1/object/oracle/catalog.json`;
    await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: JSON.stringify(store),
    });
  } catch {
    /* optional mirror */
  }
}

export function supabaseConfigured(): boolean {
  return configured();
}

export function getSupabaseBackendMode(): string | null {
  return backendMode;
}

/** Prefer https image URLs from either side — Auth lean must never erase Storage images. */
function mergeEaHttpsImages(
  primary: OracleCloudStore,
  secondary: OracleCloudStore | null,
): OracleCloudStore {
  if (!secondary?.eas?.length) return primary;
  const byId = new Map(secondary.eas.map((e) => [e.id, e]));
  return {
    ...primary,
    eas: (primary.eas || []).map((e) => {
      const other = byId.get(e.id);
      const a = typeof e.imageUri === 'string' ? e.imageUri : '';
      const b = typeof other?.imageUri === 'string' ? other.imageUri : '';
      if (/^https?:\/\//i.test(a)) return e;
      if (/^https?:\/\//i.test(b)) return { ...e, imageUri: b };
      return e;
    }),
  };
}

export async function supabaseFetchStore(): Promise<OracleCloudStore> {
  if (!configured()) throw new Error('Supabase is not configured');

  const run = async () => {
    // Prefer table when available
    try {
      const fromTable = await fetchFromTable();
      if (fromTable) return fromTable;
    } catch {
      /* try auth / storage */
    }

    let authStore: OracleCloudStore | null = null;
    try {
      authStore = await fetchFromAuthMetadata();
    } catch {
      authStore = null;
    }
    const fromStorage = await fetchFromStoragePublic();
    if (authStore && fromStorage) return mergeEaHttpsImages(authStore, fromStorage);
    if (authStore) return authStore;
    if (fromStorage) return fromStorage;
    throw new Error('Cloud store unreachable');
  };

  return withTimeout(run(), 12_000, 'Supabase catalog fetch');
}

/** Auth user_metadata size budget — https image URLs are tiny; never drop them. */
const AUTH_METADATA_MAX_CHARS = 48_000;

function leanForAuthMetadata(store: OracleCloudStore): OracleCloudStore {
  const httpsOnly = (uri: string | null | undefined): string | null =>
    typeof uri === 'string' && /^https?:\/\//i.test(uri) ? uri : null;

  const lean: OracleCloudStore = {
    ...store,
    eas: (store.eas || []).map((e) => ({
      ...e,
      imageUri: httpsOnly(e.imageUri),
    })),
    activations: (store.activations || []).map((a) => ({ ...a, eaImageUri: null })),
    updatedAt: store.updatedAt || new Date().toISOString(),
  };

  const fit = (s: OracleCloudStore) => JSON.stringify(s).length <= AUTH_METADATA_MAX_CHARS;
  if (fit(lean)) return lean;

  // Trim collections first — keep https EA images (Home depends on them)
  lean.keys = lean.keys.slice(0, 60);
  lean.mentors = lean.mentors.slice(0, 60);
  lean.subscriptions = lean.subscriptions.slice(0, 40);
  lean.reactivated = lean.reactivated.slice(0, 40);
  lean.activations = lean.activations.slice(0, 40);
  lean.deletedEaIds = (lean.deletedEaIds || []).slice(-80);
  if (fit(lean)) return lean;

  lean.keys = lean.keys.slice(0, 30);
  lean.mentors = lean.mentors.slice(0, 30);
  lean.activations = lean.activations.slice(0, 20);
  return lean;
}

export async function supabasePutStore(store: OracleCloudStore): Promise<OracleCloudStore> {
  if (!configured()) throw new Error('Supabase is not configured');

  let wrote = false;
  try {
    wrote = await putToTable(store);
  } catch {
    wrote = false;
  }
  if (!wrote) {
    const lean = leanForAuthMetadata(store);
    const size = JSON.stringify(lean).length;
    if (size > AUTH_METADATA_MAX_CHARS) {
      throw new Error(
        `Cloud catalog too large for Auth sync (${size} chars). Apply oracle_catalog SQL migration or host EA images as https URLs.`,
      );
    }
    await putToAuthMetadata(lean);
    // Force fresh token next time (old JWT may omit new claims; GET /user still reads DB)
    cachedSession = null;
  }

  void mirrorToStorage(store);

  // Verify
  const verified = await supabaseFetchStore();
  return verified;
}
