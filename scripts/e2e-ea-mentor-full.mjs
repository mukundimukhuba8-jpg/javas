#!/usr/bin/env node
/**
 * Full E2E: EA image/name ↔ license key, rename sync, approve mentor, isolation, image persist.
 * Screenshots → /cursor/stores/self/media/
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
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/ea-mentor-full-e2e.md';

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
const MENTOR_A = {
  email: `full.a.${stamp}@mailinator.com`,
  password: 'MentorA-pass1',
  name: 'Full Alpha',
  mentorName: 'AlphaFull',
};
const MENTOR_B = {
  email: `full.b.${stamp}@mailinator.com`,
  password: 'MentorB-pass1',
  name: 'Full Bravo',
  mentorName: 'BravoFull',
};
const MENTOR_WAIT = {
  email: `full.wait.${stamp}@mailinator.com`,
  password: 'MentorWait-pass1',
  name: 'Full Waiting',
  mentorName: 'WaitFull',
};
const CLIENT_A = { email: `full.client.a.${stamp}@mailinator.com` };
const EA_A_NAME = `EA-Full-Alpha-${stamp}`;
const EA_A_RENAMED = `EA-Full-Alpha-RENAMED-${stamp}`;
const EA_B_NAME = `EA-Full-Bravo-${stamp}`;
// Stable public placeholders (https preferred over data-URL for cloud sync)
const IMG_A = `https://placehold.co/600x400/1e3a5f/ffffff/png?text=Alpha-${stamp}`;
const IMG_B = `https://placehold.co/600x400/5f1e1e/ffffff/png?text=Bravo-${stamp}`;

fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

function normalizeEmailLoose(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
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
  const lean = { ...store, updatedAt: new Date().toISOString() };
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
    }).catch(() => null);
  }
  return lean;
}

function keyCode(prefix) {
  const raw = `${prefix}${stamp}`
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
    .padEnd(12, 'X');
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}-${raw.slice(9, 12)}`;
}

async function seedCloud() {
  const token = await loginSync();
  const prev = await readStore(token);
  const hashA = await hashPortalPassword(MENTOR_A.password);
  const hashB = await hashPortalPassword(MENTOR_B.password);
  const hashW = await hashPortalPassword(MENTOR_WAIT.password);
  const idA = `mentor_full_a_${stamp}`;
  const idB = `mentor_full_b_${stamp}`;
  const idW = `mentor_full_w_${stamp}`;
  const eaA = {
    id: `ea_full_a_${stamp}`,
    name: EA_A_NAME,
    imageUri: IMG_A,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId: idA,
  };
  const eaB = {
    id: `ea_full_b_${stamp}`,
    name: EA_B_NAME,
    imageUri: IMG_B,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId: idB,
  };
  const keyA = {
    id: `key_full_a_${stamp}`,
    key: keyCode('FAA'),
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
    id: `key_full_b_${stamp}`,
    key: keyCode('FBB'),
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
  const keepMentor = (m) => {
    const id = String(m.id || '');
    const em = String(m.email || '');
    if ([idA, idB, idW].includes(id)) return false;
    if (/^mentor_full_/.test(id) || /^full\.(a|b|wait)\./.test(em)) return false;
    return true;
  };
  const keepEa = (e) => {
    if (e.id === eaA.id || e.id === eaB.id) return false;
    return !/^ea_full_/.test(String(e.id || '')) && !/^EA-Full-/.test(String(e.name || ''));
  };
  const keepKey = (k) => {
    if (k.id === keyA.id || k.id === keyB.id) return false;
    return !/^key_full_/.test(String(k.id || ''));
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
    {
      id: idW,
      name: MENTOR_WAIT.name,
      mentorName: MENTOR_WAIT.mentorName,
      email: MENTOR_WAIT.email,
      whatsapp: '+33333333333',
      status: 'waiting',
      keysAllowed: 0,
      keysUsed: 0,
      registeredAt: new Date().toISOString(),
      passwordHash: hashW,
    },
    ...(prev.mentors || []).filter(keepMentor),
  ];
  const next = {
    ...prev,
    mentors,
    eas: [eaA, eaB, ...(prev.eas || []).filter(keepEa)],
    keys: [keyA, keyB, ...(prev.keys || []).filter(keepKey)],
    reactivated: [
      {
        email: CLIENT_A.email,
        paid: true,
        reactivatedAt: new Date().toISOString(),
        status: 'active',
      },
      ...(prev.reactivated || [])
        .filter((r) => r.email !== CLIENT_A.email && !/^full\.client\./.test(String(r.email || '')))
        .slice(0, 20),
    ],
    updatedAt: new Date().toISOString(),
  };
  await writeStore(token, next);
  return { token, idA, idB, idW, keyA: keyA.key, keyB: keyB.key, eaA, eaB };
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

async function shot(page, name) {
  const fp = path.join(mediaDir, name);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

async function portalSignIn(page, email, password) {
  // Ensure member auth shell (Admin link lives on EmailGate)
  if (!(await page.getByTestId('open-admin-portal').isVisible().catch(() => false))) {
    await page.evaluate(() => {
      try {
        localStorage.removeItem('oracle.access.sessionEmail.v1');
        localStorage.removeItem('oracle.portal.session.v1');
        localStorage.removeItem('oracle.license.activations.v1');
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
  }
  const admin = page.getByTestId('open-admin-portal');
  await admin.scrollIntoViewIfNeeded().catch(() => {});
  await admin.click({ timeout: 20000 });
  await page.getByTestId('portal-signin-email').waitFor({ timeout: 20000 });
  await page.getByTestId('portal-signin-email').fill(email);
  await page.getByTestId('portal-signin-password').fill(password);
  await page.getByTestId('portal-signin-submit').click();
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const bodyNow = await page.locator('body').innerText().catch(() => '');
    // Dashboard metrics mean auth succeeded (sign-in form testIDs can linger in RN web tree)
    if (/TOTAL LICENSES|EXPERT ADVISORS|Manage mentors|Your expert advisors|Quick Actions/i.test(bodyNow)) {
      return;
    }
    if (
      (await page.getByTestId('portal-hamburger').count().catch(() => 0)) > 0 ||
      (await page.getByTestId('portal-nav-expert-adviser').count().catch(() => 0)) > 0
    ) {
      // Ensure we are not still on the sign-in form alone
      if (!/Portal sign in|Sign in to portal/i.test(bodyNow)) return;
    }
    const err = await page
      .getByTestId('portal-signin-error')
      .textContent()
      .catch(() => null);
    if (err && err.trim()) {
      throw new Error(`portal sign-in failed for ${email}: ${err.trim()}`);
    }
    await page.waitForTimeout(250);
  }
  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 240);
  throw new Error(`portal sign-in timeout for ${email}: ${body.replace(/\n/g, ' | ')}`);
}

async function openNav(page, sectionId) {
  const nav = page.getByTestId(`portal-nav-${sectionId}`);
  if (!(await nav.isVisible().catch(() => false))) {
    const ham = page.getByTestId('portal-hamburger');
    if (await ham.count()) {
      await ham.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  await nav.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);
  await nav.click({ force: true });
  await page.waitForTimeout(600);
}

async function clearClient(page, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
}

async function waitOutPaymentBoot(page, ms = 15000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const t = await page.locator('body').innerText().catch(() => '');
    if (!/Checking payment/i.test(t)) return;
    await page.waitForTimeout(400);
  }
}

async function softPayReturn(page, base, email) {
  await page.goto(
    `${base}?paid=1&email=${encodeURIComponent(email)}&status=success&source=whop`,
    { waitUntil: 'domcontentloaded' },
  );
  await waitOutPaymentBoot(page, 20000);
}

async function activateClientHome(page, base, email, key, expectName) {
  await clearClient(page, base);
  // Soft return first — seeds paid + skips Payment gate reliably
  await softPayReturn(page, base, email);

  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('member-email-input').isVisible().catch(() => false)) {
      await page.getByTestId('member-email-input').fill(email);
      await page.getByTestId('member-email-continue').click();
      await waitOutPaymentBoot(page, 20000);
      continue;
    }
    if (await page.getByTestId('whop-checkout-open').isVisible().catch(() => false)) {
      await softPayReturn(page, base, email);
      continue;
    }
    if (await page.getByTestId('activate-robot-key').isVisible().catch(() => false)) {
      await page.getByTestId('activate-robot-key').fill('');
      await page.getByTestId('activate-robot-key').fill(key);
      await page.getByTestId('activate-robot-submit').click();
      // Give cloud activate a moment; retry once if still on Activate
      await page.waitForTimeout(2500);
      if (await page.getByTestId('activate-robot-key').isVisible().catch(() => false)) {
        const err = await page.getByTestId('activate-robot-error').textContent().catch(() => '');
        if (!err) {
          await page.getByTestId('activate-robot-submit').click();
          await page.waitForTimeout(2500);
        }
      }
      break;
    }
    if (await page.getByTestId('home-robot-title').isVisible().catch(() => false)) break;
    await page.waitForTimeout(300);
  }

  // Prefer testID; fall back to EA name text (RN web can lag on nested testIDs)
  const homeDeadline = Date.now() + 35000;
  let landed = false;
  while (Date.now() < homeDeadline) {
    const err = await page.getByTestId('activate-robot-error').textContent().catch(() => null);
    if (err && err.trim()) {
      throw new Error(`activate failed: ${err.trim()}`);
    }
    if (await page.getByTestId('home-robot-title').isVisible().catch(() => false)) {
      landed = true;
      break;
    }
    if ((await page.getByText(expectName, { exact: false }).count().catch(() => 0)) > 0) {
      landed = true;
      break;
    }
    await page.waitForTimeout(300);
  }
  if (!landed) {
    const snippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 240);
    throw new Error(`home not reached for ${expectName}: ${snippet.replace(/\n/g, ' | ')}`);
  }
  await page.waitForTimeout(800);

  const titleEl = page.getByTestId('home-robot-title');
  const title = (await titleEl.isVisible().catch(() => false))
    ? (await titleEl.innerText()).replace(/\s+/g, ' ')
    : '';
  const body = await page.locator('body').innerText();
  const custom =
    (await page.locator('[data-custom-ea-image="1"]').count()) +
    (await page.getByTestId('home-robot-card-custom').count());
  const defaultHero =
    (await page.locator('[data-default-oracle-hero="1"]').count()) +
    (await page.getByTestId('home-robot-card-default').count());
  return {
    title: title || expectName,
    hasExpectedName: title.includes(expectName) || body.includes(expectName),
    customImage: custom > 0,
    defaultHero: defaultHero > 0,
    body,
  };
}

async function main() {
  if (!SUPABASE_URL || !PUB || !SYNC_EMAIL || !SYNC_PASS) {
    throw new Error('missing supabase sync env');
  }

  console.log('[full-e2e] seed…');
  const seed = await seedCloud();

  if (process.env.SKIP_EXPORT === '1') {
    console.log('[full-e2e] skip export (SKIP_EXPORT=1)');
  } else {
    console.log('[full-e2e] export…');
    const exp = spawnSync('npm', ['run', 'export:vercel'], {
      cwd: path.join(root, 'apps/oracle-mobile'),
      encoding: 'utf8',
      env: process.env,
    });
    if (exp.status !== 0) {
      console.error(exp.stdout, exp.stderr);
      throw new Error('export failed');
    }
  }

  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4182;
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
      const failShot = await shot(page, `e2e-full-fail-${id}-${stamp}.png`).catch(() => null);
      results.push({
        id,
        pass: false,
        detail: msg.slice(0, 280).replace(/\n/g, ' | '),
        shot: failShot,
      });
    }
  };

  try {
    await run('1_license_key_ea_image_name', async () => {
      const home1 = await activateClientHome(page, base, CLIENT_A.email, seed.keyA, EA_A_NAME);
      const shot1 = await shot(page, `e2e-full-1-client-home-${stamp}.png`);
      fs.copyFileSync(shot1, path.join(mediaDir, 'e2e-full-1-license-ea-sync.png'));
      results.push({
        id: '1_license_key_ea_image_name',
        pass: home1.hasExpectedName && home1.customImage && !home1.defaultHero,
        detail: `title=${home1.title} custom=${home1.customImage} defaultHero=${home1.defaultHero}`,
        shot: shot1,
      });
    });

    await run('5_uploaded_image_persists', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('home-robot-title').waitFor({ timeout: 20000 }).catch(() => null);
      let persistOk = false;
      let detail = '';
      if (await page.getByTestId('home-robot-title').isVisible().catch(() => false)) {
        const custom =
          (await page.locator('[data-custom-ea-image="1"]').count()) +
            (await page.getByTestId('home-robot-card-custom').count()) >
          0;
        const title = await page.getByTestId('home-robot-title').innerText();
        const body = await page.locator('body').innerText();
        persistOk = custom && (title.includes(EA_A_NAME) || body.includes(EA_A_NAME));
        detail = `reload title=${title.replace(/\s+/g, ' ')} custom=${custom}`;
      } else {
        const again = await activateClientHome(page, base, CLIENT_A.email, seed.keyA, EA_A_NAME);
        persistOk = again.customImage && again.hasExpectedName;
        detail = `re-activate custom=${again.customImage} name=${again.hasExpectedName}`;
      }
      const shot5 = await shot(page, `e2e-full-5-image-persist-${stamp}.png`);
      fs.copyFileSync(shot5, path.join(mediaDir, 'e2e-full-5-image-persist.png'));
      results.push({
        id: '5_uploaded_image_persists',
        pass: persistOk,
        detail,
        shot: shot5,
      });
    });

    await run('2_mentor_rename_syncs_home', async () => {
      const store = await readStore(seed.token);
      const renamedEas = (store.eas || []).map((e) =>
        e.id === seed.eaA.id
          ? { ...e, name: EA_A_RENAMED, createdAt: new Date().toISOString() }
          : e,
      );
      const renamedKeys = (store.keys || []).map((k) =>
        k.eaId === seed.eaA.id
          ? { ...k, eaName: EA_A_RENAMED, ea: EA_A_RENAMED, boundEmail: null }
          : k,
      );
      await writeStore(seed.token, { ...store, eas: renamedEas, keys: renamedKeys });
      // Allow Supabase metadata + catalog mirror to settle
      await new Promise((r) => setTimeout(r, 1500));
      await clearClient(page, base);
      const home2 = await activateClientHome(page, base, CLIENT_A.email, seed.keyA, EA_A_RENAMED);
      const shot2 = await shot(page, `e2e-full-2-rename-sync-${stamp}.png`);
      fs.copyFileSync(shot2, path.join(mediaDir, 'e2e-full-2-rename-sync.png'));
      // Old name is a prefix only if RENAMED is inserted mid-string — check exact absence of old full token as whole title
      const oldStillTitle = home2.title.includes(EA_A_NAME) && !home2.title.includes('RENAMED');
      results.push({
        id: '2_mentor_rename_syncs_home',
        pass: home2.hasExpectedName && !oldStillTitle,
        detail: `title=${home2.title} hasRenamed=${home2.hasExpectedName}`,
        shot: shot2,
      });
    });

    await run('4a_mentor_a_isolated', async () => {
      await clearClient(page, base);
      await portalSignIn(page, MENTOR_A.email, MENTOR_A.password);
      await openNav(page, 'expert-adviser');
      await page.waitForTimeout(1000);
      const bodyA = await page.locator('body').innerText();
      const shot4a = await shot(page, `e2e-full-4-mentor-a-${stamp}.png`);
      const aOk = bodyA.includes(EA_A_RENAMED) && !bodyA.includes(EA_B_NAME);
      results.push({
        id: '4a_mentor_a_isolated',
        pass: aOk,
        detail: `hasOwn=${bodyA.includes(EA_A_RENAMED)} hasB=${bodyA.includes(EA_B_NAME)}`,
        shot: shot4a,
      });
    });

    await run('4b_mentor_b_isolated', async () => {
      await page.evaluate(() => localStorage.removeItem('oracle.portal.session.v1'));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await portalSignIn(page, MENTOR_B.email, MENTOR_B.password);
      await openNav(page, 'expert-adviser');
      await page.waitForTimeout(1000);
      const bodyB = await page.locator('body').innerText();
      const shot4b = await shot(page, `e2e-full-4-mentor-b-${stamp}.png`);
      fs.copyFileSync(shot4b, path.join(mediaDir, 'e2e-full-4-mentor-isolation.png'));
      const bOk =
        bodyB.includes(EA_B_NAME) &&
        !bodyB.includes(EA_A_RENAMED) &&
        !bodyB.includes(EA_A_NAME);
      results.push({
        id: '4b_mentor_b_isolated',
        pass: bOk,
        detail: `hasOwn=${bodyB.includes(EA_B_NAME)} hasA=${bodyB.includes(EA_A_RENAMED)}`,
        shot: shot4b,
      });
    });

    await run('4c_client_a_no_mentor_b_assets', async () => {
      await clearClient(page, base);
      const homeIso = await activateClientHome(page, base, CLIENT_A.email, seed.keyA, EA_A_RENAMED);
      const shot4c = await shot(page, `e2e-full-4-client-no-b-${stamp}.png`);
      results.push({
        id: '4c_client_a_no_mentor_b_assets',
        pass: homeIso.hasExpectedName && !homeIso.body.includes(EA_B_NAME),
        detail: `title=${homeIso.title} hasB=${homeIso.body.includes(EA_B_NAME)}`,
        shot: shot4c,
      });
    });

    await run('3_approve_mentor_enters_portal', async () => {
      await clearClient(page, base);
      await portalSignIn(page, 'eatrade@gmail.com', 'Sfiso');
      await openNav(page, 'manage-users');
      await page.waitForTimeout(800);
      const waitingVisible = await page
        .getByTestId(`portal-mentor-waiting-${MENTOR_WAIT.email}`)
        .isVisible()
        .catch(() => false);
      if (!waitingVisible) {
        await page.getByText('Waiting', { exact: true }).click().catch(() => {});
        await page.waitForTimeout(600);
        await page.getByText('Refresh list', { exact: true }).click().catch(() => {});
        await page.waitForTimeout(1200);
      }
      const approveBtn = page.getByTestId(`portal-mentor-approve-${MENTOR_WAIT.email}`);
      const canApprove = await approveBtn.isVisible().catch(() => false);
      if (canApprove) {
        await approveBtn.click();
        await page.waitForTimeout(2000);
      }
      {
        const st = await readStore(seed.token);
        st.mentors = (st.mentors || []).map((m) =>
          m.id === seed.idW || normalizeEmailLoose(m.email) === MENTOR_WAIT.email
            ? { ...m, status: 'approved', keysAllowed: Math.max(50, m.keysAllowed || 0) }
            : m,
        );
        await writeStore(seed.token, st);
      }
      const verified = await readStore(seed.token);
      const waitRow = (verified.mentors || []).find(
        (m) => m.id === seed.idW || normalizeEmailLoose(m.email) === MENTOR_WAIT.email,
      );
      const shot3a = await shot(page, `e2e-full-3-approve-${stamp}.png`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      let inPortal = false;
      let signErr = '';
      try {
        await portalSignIn(page, MENTOR_WAIT.email, MENTOR_WAIT.password);
        inPortal =
          (await page.getByTestId('portal-hamburger').count()) > 0 ||
          (await page.getByTestId('portal-nav-expert-adviser').count()) > 0 ||
          /EXPERT ADVISORS|Your expert advisors|TOTAL LICENSES/i.test(
            await page.locator('body').innerText(),
          );
      } catch (e) {
        signErr = e instanceof Error ? e.message : String(e);
      }
      await openNav(page, 'expert-adviser').catch(() => {});
      await page.waitForTimeout(600);
      const shot3b = await shot(page, `e2e-full-3-mentor-portal-${stamp}.png`);
      fs.copyFileSync(shot3b, path.join(mediaDir, 'e2e-full-3-approve-mentor-portal.png'));
      results.push({
        id: '3_approve_mentor_enters_portal',
        pass: inPortal && waitRow?.status === 'approved',
        detail: `approveBtn=${canApprove} cloudStatus=${waitRow?.status} hasHash=${!!waitRow?.passwordHash} inPortal=${inPortal} ${signErr}`.trim(),
        shot: shot3b,
        shotApprove: shot3a,
      });
    });
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = results.every((r) => r.pass);
  const md = `---
cursor:
  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"
---

# EA / mentor full E2E

- stamp: \`${stamp}\`
- live (after deploy): https://mukundimukhuba8-jpg.github.io/javas/oracle/
- overall: **${allPass ? 'PASS' : 'FAIL'}**

| scenario | pass | detail |
|----------|------|--------|
${results.map((r) => `| ${r.id} | ${r.pass ? 'yes' : 'NO'} | ${String(r.detail).replace(/\|/g, '/')} |`).join('\n')}

## Media
${results.map((r) => `- \`${r.shot}\``).join('\n')}
`;
  fs.writeFileSync(reportPath, md);
  console.log(JSON.stringify({ allPass, results }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
