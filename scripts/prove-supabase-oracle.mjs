#!/usr/bin/env node
/**
 * Prove Oracle ↔ Supabase sync (publishable path + optional secret Storage mirror).
 * Does not print secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, 'apps/oracle-mobile/.env'));
loadEnvFile('/cursor/stores/self/internal/supabase-credentials.env');

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const SYNC_EMAIL = process.env.ORACLE_SYNC_EMAIL || process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL;
const SYNC_PASS =
  process.env.ORACLE_SYNC_PASSWORD || process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD;

if (!URL || !PUB) {
  console.error('[prove] missing SUPABASE_URL or publishable key');
  process.exit(1);
}

async function api(method, pathName, { key, token, body, headers } = {}) {
  const res = await fetch(`${URL}${pathName}`, {
    method,
    headers: {
      apikey: key || PUB,
      Authorization: `Bearer ${token || key || PUB}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function login() {
  const r = await api('POST', '/auth/v1/token?grant_type=password', {
    key: PUB,
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!r.ok || !r.json?.access_token) {
    throw new Error(`login failed ${r.status}`);
  }
  return r.json.access_token;
}

async function readAuthStore(token) {
  const r = await api('GET', '/auth/v1/user', { key: PUB, token });
  if (!r.ok) throw new Error(`user read ${r.status}`);
  return r.json?.user_metadata?.oracle_store || null;
}

async function writeAuthStore(token, store) {
  const r = await api('PUT', '/auth/v1/user', {
    key: PUB,
    token,
    body: { data: { oracle_store: store } },
  });
  if (!r.ok) throw new Error(`user write ${r.status}: ${String(r.text).slice(0, 160)}`);
}

async function tryTableRead() {
  const r = await api(
    'GET',
    '/rest/v1/oracle_catalog?id=eq.main&select=payload',
    { key: PUB },
  );
  if (!r.ok) return { exists: false, status: r.status, detail: String(r.text).slice(0, 120) };
  return { exists: true, payload: r.json?.[0]?.payload || null };
}

async function tryTableWrite(token, store) {
  const r = await api('POST', '/rest/v1/oracle_catalog?on_conflict=id', {
    key: PUB,
    token,
    body: { id: 'main', payload: store, updated_at: store.updatedAt },
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return { ok: r.ok, status: r.status, detail: String(r.text).slice(0, 120) };
}

async function mirrorStorage(store) {
  if (!SECRET) {
    console.log('[prove] skip Storage mirror (no secret in env)');
    return false;
  }
  const r = await api('POST', '/storage/v1/object/oracle/catalog.json', {
    key: SECRET,
    token: SECRET,
    body: store,
    headers: { 'Content-Type': 'application/json', 'x-upsert': 'true' },
  });
  // Storage may want raw body; retry with text
  if (!r.ok) {
    const res = await fetch(`${URL}/storage/v1/object/oracle/catalog.json`, {
      method: 'POST',
      headers: {
        apikey: SECRET,
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: JSON.stringify(store),
    });
    console.log('[prove] Storage mirror', res.status);
    return res.ok;
  }
  console.log('[prove] Storage mirror', r.status);
  return r.ok;
}

function writeLocalFallback(store) {
  const targets = [
    path.join(root, 'docs/oracle/cloud-store.json'),
    path.join(root, 'public/cloud-store.json'),
  ];
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, `${JSON.stringify(store, null, 2)}\n`);
  }
  console.log('[prove] wrote local cloud-store.json fallbacks');
}

async function main() {
  console.log('[prove] project', URL.replace(/^https:\/\//, '').split('.')[0]);

  // Attempt DDL (may exit 2 if no DB password / PAT — non-fatal here)
  const apply = spawnSync('node', [path.join(root, 'scripts/apply-supabase-schema.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  console.log('[prove] apply-schema exit', apply.status);
  if (apply.stdout) process.stdout.write(apply.stdout);
  if (apply.stderr) process.stderr.write(apply.stderr);

  const tableBefore = await tryTableRead();
  console.log(
    '[prove] oracle_catalog table',
    tableBefore.exists ? 'present' : `missing (${tableBefore.status})`,
  );

  const token = await login();
  console.log('[prove] sync login ok');

  const stamp = new Date().toISOString();
  const mentorId = `mentor_prove_${Date.now().toString(36)}`;
  const keyCode = `ORACLE-PROVE-${Date.now().toString(36).toUpperCase()}`;

  const prev = (await readAuthStore(token)) || {
    keys: [],
    reactivated: [],
    eas: [],
    activations: [],
    mentors: [],
    subscriptions: [],
    updatedAt: stamp,
  };

  const next = {
    ...prev,
    keys: [
      {
        id: `key_${Date.now().toString(36)}`,
        key: keyCode,
        boundEmail: null,
        createdAt: stamp,
      },
      ...(prev.keys || []).filter((k) => k && k.key !== keyCode),
    ],
    mentors: [
      {
        id: mentorId,
        name: 'Prove Mentor',
        mentorName: 'Prove',
        email: `prove.${Date.now()}@example.com`,
        whatsapp: '+10000000000',
        status: 'waiting',
        keysAllowed: 0,
        keysUsed: 0,
        registeredAt: stamp,
      },
      ...(prev.mentors || []).filter((m) => m && m.id !== mentorId),
    ],
    updatedAt: stamp,
  };

  let mode = 'auth_metadata';
  if (tableBefore.exists) {
    const tw = await tryTableWrite(token, next);
    console.log('[prove] table write', tw.ok ? 'ok' : `fail ${tw.status}`);
    if (tw.ok) mode = 'table';
  }

  if (mode !== 'table') {
    await writeAuthStore(token, next);
    console.log('[prove] auth_metadata write ok');
  }

  const verified =
    mode === 'table'
      ? (await tryTableRead()).payload
      : await readAuthStore(token);

  const hasKey = (verified?.keys || []).some((k) => k.key === keyCode);
  const hasMentor = (verified?.mentors || []).some((m) => m.id === mentorId);
  if (!hasKey || !hasMentor) {
    throw new Error(`verification failed key=${hasKey} mentor=${hasMentor}`);
  }
  console.log('[prove] verified key+mentor via', mode);

  await mirrorStorage(verified);
  writeLocalFallback(verified);

  // Public storage read check
  const pub = await fetch(`${URL}/storage/v1/object/public/oracle/catalog.json`);
  console.log('[prove] public catalog HTTP', pub.status);

  console.log(
    JSON.stringify({
      ok: true,
      mode,
      key: keyCode,
      mentorId,
      tablePresent: Boolean(tableBefore.exists),
      mentors: (verified.mentors || []).length,
      keys: (verified.keys || []).length,
    }),
  );
}

main().catch((e) => {
  console.error('[prove]', e instanceof Error ? e.message : e);
  process.exit(1);
});
