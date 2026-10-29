#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql to the Oracle project.
 *
 * Auth (first match wins):
 *   1. DATABASE_URL / SUPABASE_DB_URL  (postgres connection string)
 *   2. SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF (pooler)
 *   3. SUPABASE_ACCESS_TOKEN (sbp_… Management API migrations)
 *
 * Never logs secret values. Loads optional credential files if present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase/migrations');

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

function sqlFiles() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(migrationsDir, f));
}

function combinedSql() {
  return sqlFiles()
    .map((f) => `-- file: ${path.basename(f)}\n${fs.readFileSync(f, 'utf8')}`)
    .join('\n\n');
}

async function applyViaManagement(token, ref, query) {
  const url = `https://api.supabase.com/v1/projects/${ref}/database/migrations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, name: 'oracle_catalog' }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management migrations HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  console.log('[apply-schema] applied via Management API migrations');
  return true;
}

function applyViaPsql(databaseUrl, query) {
  const tmp = path.join(root, '.tmp-oracle-schema.sql');
  fs.writeFileSync(tmp, query);
  try {
    const r = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', tmp], {
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      throw new Error(r.stderr || r.stdout || `psql exit ${r.status}`);
    }
    console.log('[apply-schema] applied via psql');
    return true;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function applyViaPsycopg(databaseUrl, query) {
  const script = `
import sys, psycopg
url = sys.argv[1]
sql = open(sys.argv[2], encoding='utf-8').read()
with psycopg.connect(url) as conn:
  conn.execute(sql)
  conn.commit()
print('ok')
`;
  const tmpSql = path.join(root, '.tmp-oracle-schema.sql');
  const tmpPy = path.join(root, '.tmp-oracle-schema.py');
  fs.writeFileSync(tmpSql, query);
  fs.writeFileSync(tmpPy, script);
  try {
    const r = spawnSync('python3', [tmpPy, databaseUrl, tmpSql], { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(r.stderr || r.stdout || `psycopg exit ${r.status}`);
    }
    console.log('[apply-schema] applied via psycopg');
    return true;
  } finally {
    for (const f of [tmpSql, tmpPy]) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}

function buildPoolerUrl() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  if (!ref || !password) return null;
  const region = process.env.SUPABASE_POOLER_REGION || 'eu-west-1';
  const enc = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres?sslmode=require`;
}

async function main() {
  const query = combinedSql();
  if (!query.trim()) {
    console.error('[apply-schema] no migrations in', migrationsDir);
    process.exit(1);
  }
  console.log('[apply-schema] migrations:', sqlFiles().map((f) => path.basename(f)).join(', '));

  const databaseUrl =
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || buildPoolerUrl();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF || 'wugjvgasptydqnmirlzx';

  const errors = [];

  if (databaseUrl) {
    try {
      if (spawnSync('psql', ['--version'], { encoding: 'utf8' }).status === 0) {
        applyViaPsql(databaseUrl, query);
        return;
      }
    } catch (e) {
      errors.push(`psql: ${e instanceof Error ? e.message : e}`);
    }
    try {
      await applyViaPsycopg(databaseUrl, query);
      return;
    } catch (e) {
      errors.push(`psycopg: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    errors.push('No DATABASE_URL / SUPABASE_DB_PASSWORD');
  }

  if (token && token.startsWith('sbp_')) {
    try {
      await applyViaManagement(token, ref, query);
      return;
    } catch (e) {
      errors.push(`management: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    errors.push('No SUPABASE_ACCESS_TOKEN (sbp_…)');
  }

  console.error('[apply-schema] could not apply DDL. Provide DB password or Management PAT.');
  for (const e of errors) console.error(' -', e);
  console.error(
    '[apply-schema] Fallback: paste supabase/migrations/*.sql into the Supabase SQL editor, then re-run prove.',
  );
  process.exit(2);
}

main().catch((e) => {
  console.error('[apply-schema]', e instanceof Error ? e.message : e);
  process.exit(1);
});
