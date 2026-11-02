#!/usr/bin/env node
/**
 * Remove E2E/test EAs, keys, mentors, and activations from the Oracle cloud catalog.
 * Keeps real user data. Secrets from env / store — never logged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(fp) {
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}
loadEnv(path.join(root, 'apps/oracle-mobile/.env'));
loadEnv('/cursor/stores/self/internal/supabase-credentials.env');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SYNC_EMAIL = process.env.ORACLE_SYNC_EMAIL || process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL;
const SYNC_PASS =
  process.env.ORACLE_SYNC_PASSWORD || process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD;
const SECRET = process.env.SUPABASE_SECRET_KEY;

function isJunkEa(e) {
  const name = String(e.name || '');
  const id = String(e.id || '');
  if (/^THE ORACLE$/i.test(name.trim())) return true;
  if (/^(EA-Full-|EA-Alpha-|EA-Bravo-)/i.test(name)) return true;
  if (/\bmvye[a-z0-9]+\b/i.test(name) || /\bmvto[a-z0-9]+\b/i.test(name)) return true;
  if (
    /\bmvye[a-z0-9]+\b/i.test(id) ||
    /\bmvto[a-z0-9]+\b/i.test(id) ||
    /mentor_full_|ea_full_|ea_a_|ea_b_/i.test(id)
  ) {
    return true;
  }
  return false;
}

function isJunkMentor(m) {
  const email = String(m.email || '').toLowerCase();
  const id = String(m.id || '');
  if (/@(mailinator\.com|example\.com)$/i.test(email)) return true;
  if (/^(full\.|mentor\.(a|b)\.|prove\.|clear@)/i.test(email)) return true;
  if (/mentor_full_|mentor_a_|mentor_b_/i.test(id)) return true;
  return false;
}

function isJunkKey(k, junkEaIds) {
  if (junkEaIds.has(k.eaId)) return true;
  const ea = String(k.eaName || k.ea || '');
  const key = String(k.key || '');
  if (isJunkEa({ name: ea, id: k.eaId || '' })) return true;
  if (/^(FAA-|FBB-|AAA-MVT|BBB-MVT|ORA-CLE)/i.test(key)) return true;
  if (!k.eaId && !ea.trim()) return true;
  return false;
}

async function api(method, p, { token, body } = {}) {
  const res = await fetch(`${SUPABASE_URL}${p}`, {
    method,
    headers: {
      apikey: PUB,
      Authorization: `Bearer ${token || PUB}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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

async function main() {
  if (!SUPABASE_URL || !PUB || !SYNC_EMAIL || !SYNC_PASS) {
    throw new Error('missing supabase sync env');
  }
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!login.ok || !login.json?.access_token) throw new Error(`login ${login.status}`);
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { token });
  const prev = user.json?.user_metadata?.oracle_store || {};
  const junkEas = (prev.eas || []).filter(isJunkEa);
  const junkEaIds = new Set(junkEas.map((e) => e.id));
  const junkKeys = (prev.keys || []).filter((k) => isJunkKey(k, junkEaIds));
  const removedKeyCodes = new Set(junkKeys.map((k) => String(k.key || '').toUpperCase()));
  const next = {
    ...prev,
    eas: (prev.eas || []).filter((e) => !junkEaIds.has(e.id)),
    keys: (prev.keys || []).filter((k) => !isJunkKey(k, junkEaIds)),
    activations: (prev.activations || []).filter(
      (a) =>
        !removedKeyCodes.has(String(a.key || '').toUpperCase()) &&
        !junkEaIds.has(a.eaId) &&
        !isJunkEa({ name: a.eaName || '', id: a.eaId || '' }),
    ),
    mentors: (prev.mentors || []).filter((m) => !isJunkMentor(m)),
    reactivated: (prev.reactivated || []).filter(
      (r) =>
        !/@(mailinator\.com|example\.com)$/i.test(String(r.email || '')) &&
        !/^(full\.|mentor\.|dbg\.|api\.shape\.|probe\.)/i.test(String(r.email || '')),
    ),
    updatedAt: new Date().toISOString(),
  };
  const put = await api('PUT', '/auth/v1/user', {
    token,
    body: { data: { oracle_store: next } },
  });
  if (!put.ok) throw new Error(`write ${put.status}: ${String(put.text).slice(0, 160)}`);
  if (SECRET) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/oracle/catalog.json`, {
      method: 'POST',
      headers: {
        apikey: SECRET,
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: JSON.stringify(next),
    }).catch(() => null);
  }
  console.log(
    JSON.stringify(
      {
        removedEas: junkEas.map((e) => e.name),
        removedKeys: junkKeys.length,
        after: {
          eas: next.eas.length,
          keys: next.keys.length,
          mentors: next.mentors.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
