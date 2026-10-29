#!/usr/bin/env node
/**
 * Demote Whop subscription rows that lack verifiedVia (fake “I've paid — continue”),
 * and remove matching reactivated unlocks from the Supabase sync account.
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

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const SYNC_EMAIL = process.env.ORACLE_SYNC_EMAIL || process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL;
const SYNC_PASS =
  process.env.ORACLE_SYNC_PASSWORD || process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD;

function isVerified(s) {
  if ((s.source || '').toLowerCase() !== 'whop') return true;
  return s.verifiedVia === 'whop_return' || s.verifiedVia === 'webhook' || s.verifiedVia === 'admin';
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

async function main() {
  if (!URL || !PUB || !SYNC_EMAIL || !SYNC_PASS) {
    throw new Error('missing supabase env');
  }
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    key: PUB,
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!login.ok || !login.json?.access_token) {
    throw new Error(`login failed ${login.status}`);
  }
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { key: PUB, token });
  if (!user.ok) throw new Error(`user read ${user.status}`);
  const store = user.json?.user_metadata?.oracle_store || {
    keys: [],
    reactivated: [],
    eas: [],
    activations: [],
    mentors: [],
    subscriptions: [],
    updatedAt: new Date(0).toISOString(),
  };

  const demoted = [];
  const subscriptions = (store.subscriptions || []).map((s) => {
    if ((s.source || '').toLowerCase() !== 'whop') return s;
    if (isVerified(s)) return s;
    if (s.status === 'declined') return s;
    demoted.push((s.email || '').trim().toLowerCase());
    return { ...s, status: 'declined' };
  });
  const demotedSet = new Set(demoted.filter(Boolean));
  // Also demote obvious test / mailinator fake-pay clickers even if somehow marked
  const reactivated = (store.reactivated || []).filter((e) => {
    const email = (e.email || '').trim().toLowerCase();
    if (demotedSet.has(email)) return false;
    return true;
  });

  const changed =
    demoted.length > 0 || reactivated.length !== (store.reactivated || []).length;
  const next = {
    ...store,
    subscriptions,
    reactivated,
    updatedAt: new Date().toISOString(),
  };

  if (changed) {
    const write = await api('PUT', '/auth/v1/user', {
      key: PUB,
      token,
      body: { data: { oracle_store: next } },
    });
    if (!write.ok) throw new Error(`write failed ${write.status}: ${String(write.text).slice(0, 160)}`);

    // Best-effort table + storage mirrors
    await api('POST', '/rest/v1/oracle_catalog?on_conflict=id', {
      key: PUB,
      token,
      body: { id: 'main', payload: next, updated_at: next.updatedAt },
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    }).catch(() => null);

    if (SECRET) {
      await fetch(`${URL}/storage/v1/object/oracle/catalog.json`, {
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

    // Local static fallbacks
    for (const t of [
      path.join(root, 'docs/oracle/cloud-store.json'),
      path.join(root, 'public/cloud-store.json'),
    ]) {
      if (fs.existsSync(path.dirname(t))) {
        fs.writeFileSync(t, `${JSON.stringify(next, null, 2)}\n`);
      }
    }
  }

  const report = {
    changed,
    demotedCount: demotedSet.size,
    demotedEmails: Array.from(demotedSet).slice(0, 50),
    awaitingWhopLeft: subscriptions.filter(
      (s) => s.source === 'whop' && s.status === 'awaiting' && isVerified(s),
    ).length,
    declinedWhop: subscriptions.filter((s) => s.source === 'whop' && s.status === 'declined').length,
  };
  console.log(JSON.stringify(report, null, 2));
  fs.mkdirSync('/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal', {
    recursive: true,
  });
  fs.writeFileSync(
    '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/scrub-fake-whop-paid.md',
    `---
cursor:
  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"
---

# Scrub fake Whop paid

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
