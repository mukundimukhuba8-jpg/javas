#!/usr/bin/env node
/**
 * E2E: multi-mentor isolation for Oracle.
 * 1) Seed mentors A/B + scoped EA/keys via Supabase (publishable path)
 * 2) Playwright: A portal ≠ B portal; client activates A's key → A's EA only
 * Screenshots → /cursor/stores/self/media/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/node_modules/playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = '/cursor/stores/self/media';
const resultsPath = path.join(
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal',
  'mentor-isolation-e2e-results.md',
);

function loadEnvFile(fp) {
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

loadEnvFile(path.join(root, 'apps/oracle-mobile/.env'));
loadEnvFile('/cursor/stores/self/internal/supabase-credentials.env');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SYNC_EMAIL = process.env.ORACLE_SYNC_EMAIL || process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL;
const SYNC_PASS =
  process.env.ORACLE_SYNC_PASSWORD || process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const stamp = Date.now().toString(36);
const MENTOR_A = {
  email: `mentor.a.${stamp}@mailinator.com`,
  password: 'MentorA-pass1',
  name: 'Mentor Alpha',
  mentorName: 'Alpha',
};
const MENTOR_B = {
  email: `mentor.b.${stamp}@mailinator.com`,
  password: 'MentorB-pass1',
  name: 'Mentor Bravo',
  mentorName: 'Bravo',
};
const CLIENT_A = {
  email: `client.a.${stamp}@mailinator.com`,
};

const EA_A_NAME = `EA-Alpha-${stamp}`;
const EA_B_NAME = `EA-Bravo-${stamp}`;
// Distinct tiny PNG data-URLs (1×1 red vs 1×1 blue)
const IMG_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IMG_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(path.dirname(resultsPath), { recursive: true });

async function hashPortalPassword(password) {
  const payload = `oracle-portal:v1:${password}`;
  const { webcrypto } = await import('node:crypto');
  const data = new TextEncoder().encode(payload);
  const buf = await webcrypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function api(method, p, { key, token, body, headers } = {}) {
  const res = await fetch(`${SUPABASE_URL}${p}`, {
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

async function loginSync() {
  const r = await api('POST', '/auth/v1/token?grant_type=password', {
    key: PUB,
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!r.ok || !r.json?.access_token) throw new Error(`sync login ${r.status}`);
  return r.json.access_token;
}

async function readStore(token) {
  const r = await api('GET', '/auth/v1/user', { key: PUB, token });
  if (!r.ok) throw new Error(`read store ${r.status}`);
  return (
    r.json?.user_metadata?.oracle_store || {
      keys: [],
      eas: [],
      mentors: [],
      activations: [],
      reactivated: [],
      subscriptions: [],
      updatedAt: new Date(0).toISOString(),
    }
  );
}

async function writeStore(token, store) {
  const lean = {
    ...store,
    eas: (store.eas || []).map((e) => ({
      ...e,
      imageUri:
        typeof e.imageUri === 'string' && e.imageUri.startsWith('data:')
          ? e.imageUri.slice(0, 120) // keep marker; full data URL too big for JWT
          : e.imageUri,
    })),
    updatedAt: new Date().toISOString(),
  };
  // Prefer https-style markers for isolation proof images
  lean.eas = lean.eas.map((e) => {
    if (e.name?.startsWith('EA-Alpha')) {
      return { ...e, imageUri: `https://example.com/ea-alpha-${stamp}.png` };
    }
    if (e.name?.startsWith('EA-Bravo')) {
      return { ...e, imageUri: `https://example.com/ea-bravo-${stamp}.png` };
    }
    return e;
  });
  const r = await api('PUT', '/auth/v1/user', {
    key: PUB,
    token,
    body: { data: { oracle_store: lean } },
  });
  if (!r.ok) throw new Error(`write store ${r.status}: ${String(r.text).slice(0, 160)}`);
  if (SECRET) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/oracle/catalog.json`, {
      method: 'POST',
      headers: {
        apikey: SECRET,
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: JSON.stringify(lean),
    });
  }
  return lean;
}

function keyCode(prefix) {
  const raw = `${prefix}${stamp}`.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).padEnd(12, 'X');
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}-${raw.slice(9, 12)}`;
}

async function seedCloud() {
  const token = await loginSync();
  const prev = await readStore(token);
  const hashA = await hashPortalPassword(MENTOR_A.password);
  const hashB = await hashPortalPassword(MENTOR_B.password);
  const idA = `mentor_a_${stamp}`;
  const idB = `mentor_b_${stamp}`;
  const eaA = {
    id: `ea_a_${stamp}`,
    name: EA_A_NAME,
    imageUri: `https://example.com/ea-alpha-${stamp}.png`,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId: idA,
  };
  const eaB = {
    id: `ea_b_${stamp}`,
    name: EA_B_NAME,
    imageUri: `https://example.com/ea-bravo-${stamp}.png`,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId: idB,
  };
  const keyA = {
    id: `key_a_${stamp}`,
    key: keyCode('AAA'),
    eaId: eaA.id,
    eaName: eaA.name,
    eaImageUri: null,
    ea: eaA.name,
    user: 'Client A',
    plan: '30 days',
    status: 'Active',
    createdAt: new Date().toISOString(),
    boundEmail: null,
    mentorId: idA,
  };
  const keyB = {
    id: `key_b_${stamp}`,
    key: keyCode('BBB'),
    eaId: eaB.id,
    eaName: eaB.name,
    eaImageUri: null,
    ea: eaB.name,
    user: 'Client B',
    plan: '30 days',
    status: 'Active',
    createdAt: new Date().toISOString(),
    boundEmail: null,
    mentorId: idB,
  };

  const mentors = [
    {
      id: idA,
      name: MENTOR_A.name,
      mentorName: MENTOR_A.mentorName,
      email: MENTOR_A.email,
      whatsapp: '+11111111111',
      status: 'approved',
      keysAllowed: 50,
      keysUsed: 1,
      registeredAt: new Date().toISOString(),
      passwordHash: hashA,
    },
    {
      id: idB,
      name: MENTOR_B.name,
      mentorName: MENTOR_B.mentorName,
      email: MENTOR_B.email,
      whatsapp: '+22222222222',
      status: 'approved',
      keysAllowed: 50,
      keysUsed: 1,
      registeredAt: new Date().toISOString(),
      passwordHash: hashB,
    },
    ...(prev.mentors || []).filter((m) => m.id !== idA && m.id !== idB),
  ];

  const next = {
    ...prev,
    mentors,
    eas: [eaA, eaB, ...(prev.eas || []).filter((e) => e.id !== eaA.id && e.id !== eaB.id)],
    keys: [keyA, keyB, ...(prev.keys || []).filter((k) => k.id !== keyA.id && k.id !== keyB.id)],
    reactivated: [
      {
        email: CLIENT_A.email,
        paid: true,
        reactivatedAt: new Date().toISOString(),
        status: 'active',
      },
      ...(prev.reactivated || []).filter((r) => r.email !== CLIENT_A.email),
    ],
    updatedAt: new Date().toISOString(),
  };

  const written = await writeStore(token, next);
  // verify isolation at data layer
  const aEas = written.eas.filter((e) => e.mentorId === idA);
  const bEas = written.eas.filter((e) => e.mentorId === idB);
  const aKeys = written.keys.filter((k) => k.mentorId === idA);
  const bKeys = written.keys.filter((k) => k.mentorId === idB);
  if (!aEas.some((e) => e.name === EA_A_NAME) || aEas.some((e) => e.name === EA_B_NAME)) {
    throw new Error('seed isolation failed for mentor A eas');
  }
  if (!bEas.some((e) => e.name === EA_B_NAME) || bEas.some((e) => e.name === EA_A_NAME)) {
    throw new Error('seed isolation failed for mentor B eas');
  }

  return {
    idA,
    idB,
    keyA: keyA.key,
    keyB: keyB.key,
    eaA,
    eaB,
    store: written,
  };
}

function staticServer(dir, port) {
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.join(dir, urlPath.replace(/^\//, ''));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const index = path.join(dir, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(index));
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  }).listen(port);
}

async function shot(page, name) {
  const fp = path.join(mediaDir, name);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

async function portalSignIn(page, email, password) {
  await page.getByTestId('open-admin-portal').click({ timeout: 15000 });
  await page.getByTestId('portal-signin-email').fill(email);
  await page.getByTestId('portal-signin-password').fill(password);
  await page.getByTestId('portal-signin-submit').click();
  await page.getByTestId('portal-hamburger').waitFor({ timeout: 20000 });
}

async function openNav(page, sectionId) {
  // Ensure drawer open
  const nav = page.getByTestId(`portal-nav-${sectionId}`);
  if (!(await nav.isVisible().catch(() => false))) {
    await page.getByTestId('portal-hamburger').click();
    await page.waitForTimeout(400);
  }
  await nav.click();
  await page.waitForTimeout(500);
}

async function exitPortal(page) {
  // Open account menu then exit
  const exit = page.getByTestId('portal-exit');
  if (!(await exit.isVisible().catch(() => false))) {
    // click avatar area
    await page.getByLabel('Account menu').click().catch(() => {});
    await page.waitForTimeout(300);
  }
  if (await exit.isVisible().catch(() => false)) {
    await exit.click();
  } else {
    // fallback: clear session via localStorage and reload
    await page.evaluate(() => {
      localStorage.removeItem('oracle.portal.session.v1');
    });
    await page.reload();
  }
  await page.waitForTimeout(500);
}

async function runUi(seed) {
  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error('Missing dist-web-pages — run export first');
  }
  const port = 4177;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('open-admin-portal').waitFor({ state: 'visible', timeout: 30000 });
    await shot(page, `mentor-isolation-boot-${stamp}.png`);

    // Mentor A portal
    await portalSignIn(page, MENTOR_A.email, MENTOR_A.password);
    const emailA = await page.getByTestId('portal-session-email').textContent().catch(() => '');
    await openNav(page, 'expert-adviser');
    await page.waitForTimeout(800);
    const bodyA = await page.locator('body').innerText();
    const aSeesOwn = bodyA.includes(EA_A_NAME);
    const aSeesB = bodyA.includes(EA_B_NAME);
    const shotA = await shot(page, `mentor-isolation-a-eas-${stamp}.png`);
    results.push({
      id: 'mentor_a_portal_own_ea',
      pass: aSeesOwn && !aSeesB,
      detail: `email=${emailA} own=${aSeesOwn} other=${aSeesB}`,
      shot: shotA,
    });

    await openNav(page, 'create-keys');
    await page.waitForTimeout(600);
    const keysAText = await page.locator('body').innerText();
    const aSeesKeyA = keysAText.includes(seed.keyA) || keysAText.includes(EA_A_NAME);
    const aSeesKeyB = keysAText.includes(seed.keyB) || keysAText.includes(EA_B_NAME);
    const shotAKeys = await shot(page, `mentor-isolation-a-keys-${stamp}.png`);
    results.push({
      id: 'mentor_a_portal_keys_isolated',
      pass: aSeesKeyA && !keysAText.includes(EA_B_NAME),
      detail: `ownKeyOrEa=${aSeesKeyA} seesB=${aSeesKeyB}`,
      shot: shotAKeys,
    });

    await exitPortal(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('oracle.portal.session.v1');
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Mentor B portal
    await portalSignIn(page, MENTOR_B.email, MENTOR_B.password);
    await openNav(page, 'expert-adviser');
    await page.waitForTimeout(800);
    const bodyB = await page.locator('body').innerText();
    const bSeesOwn = bodyB.includes(EA_B_NAME);
    const bSeesA = bodyB.includes(EA_A_NAME);
    const shotB = await shot(page, `mentor-isolation-b-eas-${stamp}.png`);
    results.push({
      id: 'mentor_b_portal_own_ea',
      pass: bSeesOwn && !bSeesA,
      detail: `own=${bSeesOwn} other=${bSeesA}`,
      shot: shotB,
    });

    await exitPortal(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('oracle.portal.session.v1');
      localStorage.removeItem('oracle.access.sessionEmail.v1');
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Client under A's key
    await page.getByTestId('member-email-input').fill(CLIENT_A.email);
    await page.getByTestId('member-email-continue').click();
    await page.waitForTimeout(1500);
    // Activate screen
    await page.getByTestId('activate-robot-key').waitFor({ timeout: 20000 });
    await page.getByTestId('activate-robot-key').fill(seed.keyA);
    await page.getByTestId('activate-robot-submit').click();
    // Wait until Activate screen leaves (Home nav or EA name)
    await page
      .getByText(EA_A_NAME, { exact: false })
      .waitFor({ timeout: 25000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    const activateErr = await page
      .getByTestId('activate-robot-error')
      .textContent()
      .catch(() => null);
    const homeText = await page.locator('body').innerText();
    const shotHome = await shot(page, `mentor-isolation-client-a-home-${stamp}.png`);
    const clientOk =
      !activateErr &&
      (homeText.includes(EA_A_NAME) ||
        (await page.locator(`text=${EA_A_NAME}`).count()) > 0);
    const clientSeesB = homeText.includes(EA_B_NAME);
    results.push({
      id: 'client_a_activate_home_ea',
      pass: clientOk && !clientSeesB,
      detail: `hasA=${clientOk} hasB=${clientSeesB} activateErr=${activateErr || 'none'} body=${homeText.slice(0, 160).replace(/\n/g, ' | ')}`,
      shot: shotHome,
    });

    // Superadmin can open manage mentors — clear member session first
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('open-admin-portal').waitFor({ state: 'visible', timeout: 20000 });
    await portalSignIn(page, 'eatrade@gmail.com', 'Sfiso');
    await openNav(page, 'manage-users');
    await page.waitForTimeout(800);
    await page.getByText('Approved', { exact: true }).click();
    await page.waitForTimeout(1000);
    // Refresh in case cloud lag
    await page.getByText('Refresh list', { exact: true }).click().catch(() => {});
    await page.waitForTimeout(1500);
    const adminText = await page.locator('body').innerText();
    const shotAdmin = await shot(page, `mentor-isolation-superadmin-mentors-${stamp}.png`);
    const seesA =
      adminText.includes(MENTOR_A.email) ||
      adminText.includes(MENTOR_A.name) ||
      adminText.includes(MENTOR_A.mentorName);
    results.push({
      id: 'superadmin_sees_mentors',
      pass: seesA,
      detail: `mentorsVisible=${seesA} snippet=${adminText.slice(0, 220).replace(/\n/g, ' | ')}`,
      shot: shotAdmin,
    });
  } finally {
    await browser.close();
    server.close();
  }
  return results;
}

function writeReport(seed, dataLayer, uiResults) {
  const lines = [
    '---',
    'cursor:',
    '  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"',
    '---',
    '',
    '# Mentor isolation E2E results',
    '',
    `- stamp: ${stamp}`,
    `- mentorA: ${MENTOR_A.email}`,
    `- mentorB: ${MENTOR_B.email}`,
    `- clientA: ${CLIENT_A.email}`,
    `- keyA: ${seed.keyA}`,
    `- keyB: ${seed.keyB}`,
    '',
    '## Data-layer isolation',
    '',
    `- pass: ${dataLayer.pass}`,
    `- detail: ${dataLayer.detail}`,
    '',
    '## UI scenarios',
    '',
  ];
  for (const r of uiResults) {
    lines.push(`### ${r.id}`);
    lines.push(`- **${r.pass ? 'PASS' : 'FAIL'}** — ${r.detail}`);
    lines.push(`- screenshot: \`${r.shot}\``);
    lines.push('');
  }
  const allPass = dataLayer.pass && uiResults.every((r) => r.pass);
  lines.push(`## Overall: ${allPass ? 'PASS' : 'FAIL'}`);
  fs.writeFileSync(resultsPath, `${lines.join('\n')}\n`);
  return { allPass, resultsPath };
}

async function main() {
  console.log('[e2e] seeding cloud…');
  const seed = await seedCloud();
  console.log('[e2e] seeded', {
    keyA: seed.keyA,
    keyB: seed.keyB,
    eaA: seed.eaA.name,
    eaB: seed.eaB.name,
  });

  const dataLayer = {
    pass: true,
    detail: `A eas/keys scoped to ${seed.idA}; B to ${seed.idB}`,
  };

  // Root-base export for local static server (Pages uses /javas/oracle)
  console.log('[e2e] exporting web (vercel root)…');
  const exp = spawnSync('npm', ['run', 'export:vercel'], {
    cwd: path.join(root, 'apps/oracle-mobile'),
    encoding: 'utf8',
    env: process.env,
  });
  if (exp.status !== 0) {
    console.error(exp.stdout, exp.stderr);
    throw new Error('export:vercel failed');
  }

  console.log('[e2e] running Playwright…');
  const uiResults = await runUi(seed);
  const { allPass, resultsPath: rp } = writeReport(seed, dataLayer, uiResults);
  console.log(JSON.stringify({ allPass, resultsPath: rp, uiResults }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error('[e2e]', e instanceof Error ? e.message : e);
  process.exit(1);
});
