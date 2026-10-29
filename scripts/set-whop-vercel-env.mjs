#!/usr/bin/env node
/**
 * Push WHOP_* (and optional Supabase sync) env to Vercel from the local store.
 * Requires: VERCEL_TOKEN + linked project (or --token / project flags).
 * Never prints secret values.
 *
 * Usage:
 *   VERCEL_TOKEN=… node scripts/set-whop-vercel-env.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(fp, into = {}) {
  if (!fs.existsSync(fp)) return into;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) into[k] = v;
  }
  return into;
}

const store = {};
loadEnvFile('/cursor/stores/self/internal/whop-credentials.env', store);
loadEnvFile('/cursor/stores/self/internal/supabase-credentials.env', store);

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error(
    '[whop-env] No VERCEL_TOKEN. Paste WHOP_WEBHOOK_SECRET in Vercel → Settings → Environment Variables, or re-run with a token.',
  );
  console.error('[whop-env] Keys present in store:', Object.keys(store).filter((k) => k.startsWith('WHOP_')).join(', ') || '(none)');
  process.exit(2);
}

const toSet = [
  'WHOP_WEBHOOK_SECRET',
  'WHOP_PLAN_ID',
  'WHOP_API_KEY',
  'WHOP_COMPANY_ID',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'ORACLE_SYNC_EMAIL',
  'ORACLE_SYNC_PASSWORD',
];

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let set = 0;
let skipped = 0;
for (const key of toSet) {
  const val = store[key] || process.env[key];
  if (!val) {
    skipped += 1;
    console.log(`[whop-env] skip ${key} (missing)`);
    continue;
  }
  // vercel env add NAME production — pipe value on stdin
  const r = spawnSync(
    npx,
    ['--yes', 'vercel@39', 'env', 'add', key, 'production', '--force', '--token', token],
    {
      cwd: root,
      input: `${val}\n`,
      encoding: 'utf8',
      env: process.env,
    },
  );
  if (r.status !== 0) {
    console.error(`[whop-env] failed ${key}:`, (r.stderr || r.stdout || '').slice(0, 200));
    process.exit(r.status || 1);
  }
  console.log(`[whop-env] set ${key} (len=${val.length})`);
  set += 1;
}
console.log(`[whop-env] done set=${set} skipped=${skipped}`);
