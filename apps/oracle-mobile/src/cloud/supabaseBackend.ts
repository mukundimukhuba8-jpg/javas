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
    updatedAt: new Date(0).toISOString(),
  };
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

    try {
      return await fetchFromAuthMetadata();
    } catch (authErr) {
      const fromStorage = await fetchFromStoragePublic();
      if (fromStorage) return fromStorage;
      throw authErr instanceof Error ? authErr : new Error(String(authErr));
    }
  };

  return withTimeout(run(), 12_000, 'Supabase catalog fetch');
}

/** Auth JWTs embed user_metadata — keep catalog lean (https images only). */
const AUTH_METADATA_MAX_CHARS = 12_000;

function leanForAuthMetadata(store: OracleCloudStore): OracleCloudStore {
  const lean: OracleCloudStore = {
    ...store,
    eas: (store.eas || []).map((e) => ({
      ...e,
      imageUri:
        typeof e.imageUri === 'string' && /^https?:\/\//i.test(e.imageUri) ? e.imageUri : null,
    })),
    activations: (store.activations || []).map((a) => ({ ...a, eaImageUri: null })),
    updatedAt: store.updatedAt || new Date().toISOString(),
  };
  let raw = JSON.stringify(lean);
  if (raw.length <= AUTH_METADATA_MAX_CHARS) return lean;
  // Drop EA image URLs if still too large
  lean.eas = lean.eas.map((e) => ({ ...e, imageUri: null }));
  raw = JSON.stringify(lean);
  if (raw.length <= AUTH_METADATA_MAX_CHARS) return lean;
  // Keep newest keys/mentors only
  lean.keys = lean.keys.slice(0, 80);
  lean.mentors = lean.mentors.slice(0, 80);
  lean.subscriptions = lean.subscriptions.slice(0, 80);
  lean.reactivated = lean.reactivated.slice(0, 80);
  lean.activations = lean.activations.slice(0, 80);
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
