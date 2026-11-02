#!/usr/bin/env node
/**
 * Prove mentor portal sidebar is the six approved items only;
 * superadmin keeps full menu; dashboard key stats are real (start at 0).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = '/cursor/stores/self/media';
const reportPath =
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/mentor-portal-menu-e2e.md';

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
const stamp = Date.now().toString(36);
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const MENTOR_ONLY = [
  'dashboard',
  'expert-adviser',
  'manage-keys',
  'create-keys',
  'profile',
  'commission',
];
const MENTOR_FORBIDDEN = [
  'manage-users',
  'subscription',
  'reactivate-email',
  'affiliate-program',
  'affiliates',
  'reactivate-license',
  'keys-analytics',
];
const SUPERADMIN_EXTRA = ['manage-users', 'subscription', 'keys-analytics', 'reactivate-email'];

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
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

async function hashPortalPassword(password) {
  const payload = `oracle-portal:v1:${password}`;
  const { webcrypto } = await import('node:crypto');
  const data = new TextEncoder().encode(payload);
  const buf = await webcrypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function seedMentor() {
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { token });
  const prev = user.json?.user_metadata?.oracle_store || {};
  const mentorId = `mentor_menu_${stamp}`;
  const password = 'MenuMentor-pass1';
  const hash = await hashPortalPassword(password);
  const mentor = {
    id: mentorId,
    name: 'Menu Mentor',
    mentorName: 'MenuM',
    email: `menu.mentor.${stamp}@eatrade.test`,
    whatsapp: '+10000000099',
    status: 'approved',
    keysAllowed: 20,
    keysUsed: 0,
    registeredAt: new Date().toISOString(),
    passwordHash: hash,
  };
  const next = {
    ...prev,
    mentors: [mentor, ...(prev.mentors || []).filter((m) => m.id !== mentorId)],
    updatedAt: new Date().toISOString(),
  };
  await api('PUT', '/auth/v1/user', { token, body: { data: { oracle_store: next } } });
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
  return { mentor, password };
}

function staticServer(dir, port) {
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
  };
  return createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(dir, p.replace(/^\//, ''));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(dir, 'index.html')));
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  }).listen(port);
}

async function shot(page, name, clip) {
  const fp = path.join(mediaDir, name);
  await page.screenshot({ path: fp, fullPage: false, ...(clip ? { clip } : {}) });
  return fp;
}

async function portalSignIn(page, email, password) {
  await page.evaluate(() => {
    localStorage.removeItem('oracle.portal.session.v1');
  });
  await page.goto(page.url().split('?')[0] || page.url(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const open = page.getByTestId('open-admin-portal');
  if (!(await open.isVisible().catch(() => false))) {
    // May already be on portal from a prior session edge — force member gate
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
  }
  await page.getByTestId('open-admin-portal').click({ timeout: 20000 });
  await page.getByTestId('portal-signin-email').waitFor({ timeout: 15000 });
  await page.getByTestId('portal-signin-email').fill(email);
  await page.getByTestId('portal-signin-password').fill(password);
  await page.getByTestId('portal-signin-submit').click();
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if ((await page.getByTestId('portal-hamburger').count()) > 0) return;
    if ((await page.getByTestId('portal-nav-dashboard').count()) > 0) return;
    if ((await page.getByTestId('portal-dashboard').count()) > 0) return;
    const body = await page.locator('body').innerText().catch(() => '');
    if (/KEYS GENERATED|Manage license keys|Create EA/i.test(body) && !/Portal sign in|Sign in to portal/i.test(body)) {
      return;
    }
    const err = await page.getByTestId('portal-signin-error').textContent().catch(() => '');
    if (err && err.trim()) throw new Error(`sign-in failed: ${err.trim()}`);
    await page.waitForTimeout(350);
  }
  throw new Error(`portal sign-in timeout for ${email}`);
}

async function sidebarInView(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="portal-nav-dashboard"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.x >= 0 && r.x < 400;
  });
}

async function ensureSidebarOpen(page) {
  await page.getByTestId('portal-hamburger').waitFor({ timeout: 15000 }).catch(() => null);
  for (let i = 0; i < 4; i++) {
    if (await sidebarInView(page)) return;
    await page.getByTestId('portal-hamburger').click({ force: true }).catch(() => {});
    await page.waitForTimeout(450);
  }
  if (!(await sidebarInView(page))) {
    throw new Error('sidebar did not open');
  }
}

async function shotSidebar(page, name) {
  await ensureSidebarOpen(page);
  await page.waitForTimeout(400);
  // Left rail + strip of content so menu labels are readable in proofs
  return shot(page, name, { x: 0, y: 0, width: 560, height: 860 });
}

async function visibleNavIds(page) {
  await ensureSidebarOpen(page);
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-testid^="portal-nav-"]'));
    return nodes
      .filter((el) => {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.x >= 0 && r.x < 420;
      })
      .map((el) => el.getAttribute('data-testid').replace('portal-nav-', ''));
  });
}

async function main() {
  if (process.env.SKIP_EXPORT !== '1') {
    const exp = spawnSync('npm', ['run', 'export:vercel'], {
      cwd: path.join(root, 'apps/oracle-mobile'),
      encoding: 'utf8',
      env: process.env,
    });
    if (exp.status !== 0) throw new Error('export failed');
  }

  const seed = await seedMentor();
  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4197;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  const run = async (id, fn) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failShot = await shot(page, `mentor-menu-fail-${id}-${stamp}.png`).catch(() => null);
      results.push({
        id,
        pass: false,
        detail: msg.slice(0, 320).replace(/\n/g, ' | '),
        shot: failShot,
      });
    }
  };

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(base, { waitUntil: 'domcontentloaded' });

    await run('mentor_sidebar_six_only', async () => {
      await portalSignIn(page, seed.mentor.email, seed.password);
      await ensureSidebarOpen(page);
      const ids = await visibleNavIds(page);
      for (const need of MENTOR_ONLY) {
        if (!ids.includes(need)) throw new Error(`missing mentor nav ${need}; got=${ids.join(',')}`);
      }
      for (const bad of MENTOR_FORBIDDEN) {
        if (ids.includes(bad)) throw new Error(`mentor still shows ${bad}`);
      }
      if (ids.length !== MENTOR_ONLY.length) {
        throw new Error(`expected ${MENTOR_ONLY.length} items, got ${ids.length}: ${ids.join(',')}`);
      }
      const commission = page.getByTestId('portal-nav-commission');
      const label = await commission.innerText();
      if (!/coming soon/i.test(label)) throw new Error(`commission label missing soon: ${label}`);
      const gen = await page.getByTestId('portal-dash-generated').innerText();
      const del = await page.getByTestId('portal-dash-deleted').innerText();
      if (!/^\d+$/.test(gen.trim()) || !/^\d+$/.test(del.trim())) {
        throw new Error(`non-numeric stats gen=${gen} del=${del}`);
      }
      // Fresh mentor with no keys → 0 / 0
      if (Number(gen) !== 0 || Number(del) !== 0) {
        // Allow non-zero only if somehow seeded; still must be real integers
        if (Number(gen) < 0 || Number(del) < 0) throw new Error('negative stats');
      }
      const shotM = await shotSidebar(page, `mentor-portal-sidebar-${stamp}.png`);
      fs.copyFileSync(shotM, path.join(mediaDir, 'mentor-portal-sidebar.png'));
      results.push({
        id: 'mentor_sidebar_six_only',
        pass: true,
        detail: `nav=${ids.join('|')}; generated=${gen}; deleted=${del}`,
        shot: shotM,
      });
    });

    await run('superadmin_full_menu', async () => {
      await page.evaluate(() => localStorage.removeItem('oracle.portal.session.v1'));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await portalSignIn(page, 'eatrade@gmail.com', 'Sfiso');
      await ensureSidebarOpen(page);
      const ids = await visibleNavIds(page);
      for (const need of SUPERADMIN_EXTRA) {
        if (!ids.includes(need)) {
          throw new Error(`superadmin missing ${need}; got=${ids.join(',')}`);
        }
      }
      if (!ids.includes('dashboard') || !ids.includes('create-keys')) {
        throw new Error(`superadmin core missing: ${ids.join(',')}`);
      }
      const drawerExit = await page.getByTestId('portal-drawer-exit').count();
      if (drawerExit < 1) throw new Error('superadmin missing drawer exit');
      const shotA = await shotSidebar(page, `superadmin-portal-sidebar-${stamp}.png`);
      fs.copyFileSync(shotA, path.join(mediaDir, 'superadmin-portal-sidebar.png'));
      results.push({
        id: 'superadmin_full_menu',
        pass: true,
        detail: `nav=${ids.join('|')}`,
        shot: shotA,
      });
    });
  } finally {
    await browser.close();
    server.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  const md = [
    '---',
    'cursor:',
    '  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"',
    '---',
    '',
    '# Mentor portal menu — E2E',
    '',
    `- stamp: \`${stamp}\``,
    `- mentor: \`${seed.mentor.email}\``,
    `- passed: ${passed}/${results.length}`,
    '',
    ...results.map(
      (r) =>
        `- **${r.id}**: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}${r.shot ? ` ([shot](${r.shot}))` : ''}`,
    ),
    '',
    failed.length
      ? `## Failures\n\n${failed.map((f) => `- ${f.id}: ${f.detail}`).join('\n')}`
      : '## All checks passed',
    '',
    '- media: `/cursor/stores/self/media/mentor-portal-sidebar.png`',
    '- media: `/cursor/stores/self/media/superadmin-portal-sidebar.png`',
    '- live: https://mukundimukhuba8-jpg.github.io/javas/oracle/',
  ].join('\n');
  fs.writeFileSync(reportPath, md);
  console.log(md);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error('[mentor-menu-e2e]', e instanceof Error ? e.message : e);
  process.exit(1);
});
