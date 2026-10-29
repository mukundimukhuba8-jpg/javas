#!/usr/bin/env node
/**
 * Bulletproof host build: Expo web → repo-root public/
 * Used by Vercel default (pnpm run build) and vercel.json.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'apps/oracle-mobile');
const dist = path.join(app, 'dist-web-pages');
const pub = path.join(root, 'public');

function run(cmd, args, cwd, env = {}) {
  console.log(`[build-oracle-public] $ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: false,
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
  }
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function main() {
  if (!fs.existsSync(app)) {
    throw new Error(`missing ${app}`);
  }

  // Optional monorepo package builds — never block Oracle static deploy on Vercel
  if (process.env.SKIP_MONOREPO_BUILD !== '1') {
    try {
      run(
        'pnpm',
        ['-r', '--filter', './packages/*', '--filter', './services/*', '--filter', './apps/*', 'run', 'build'],
        root,
      );
    } catch (e) {
      console.warn('[build-oracle-public] monorepo build skipped/failed:', e.message);
      if (process.env.VERCEL !== '1' && process.env.REQUIRE_MONOREPO_BUILD === '1') throw e;
    }
  }

  run('npm', ['install', '--legacy-peer-deps'], app);
  run('npm', ['run', 'export:web'], app, {
    VERCEL: '1',
    EXPO_BASE_URL: '/',
    CI: '1',
  });

  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`export missing index.html in ${dist}`);
  }

  copyDir(dist, pub);
  if (!fs.existsSync(path.join(pub, 'index.html'))) {
    throw new Error('public/index.html missing after copy');
  }

  console.log('[build-oracle-public] ok →', pub);
  console.log('[build-oracle-public] files:', fs.readdirSync(pub).join(', '));
}

try {
  main();
} catch (e) {
  console.error('[build-oracle-public]', e instanceof Error ? e.message : e);
  process.exit(1);
}
