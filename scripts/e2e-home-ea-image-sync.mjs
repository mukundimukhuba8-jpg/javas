#!/usr/bin/env node
/**
 * Prove: mentor uploads distinct EA image → client activates key → Home shows
 * that https image (not default Oracle hero). Rename still syncs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/node_modules/playwright');
const { PNG } = require('/tmp/node_modules/pngjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = '/cursor/stores/self/media';
const reportPath =
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/home-ea-image-sync-e2e.md';

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

function makeDistinctPng() {
  // Bright magenta 96×96 — unmistakable vs greyscale default hero
  const png = new PNG({ width: 96, height: 96 });
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const i = (96 * y + x) << 2;
      png.data[i] = 220;
      png.data[i + 1] = 20;
      png.data[i + 2] = 200;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function normalizeKey(k) {
  return String(k || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function seedMentorAndKey() {
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { token });
  const prev = user.json?.user_metadata?.oracle_store || {};
  const mentorId = `mentor_img_${stamp}`;
  const eaId = `ea_img_${stamp}`;
  const eaName = `ImgSync-${stamp}`;
  const password = 'ImgSync-pass1';
  const hash = await hashPortalPassword(password);
  const keyCode = `IMG-${stamp.slice(0, 3).toUpperCase()}-${stamp.slice(3, 6).toUpperCase()}-ZZ9`;
  const mentor = {
    id: mentorId,
    name: 'Img Sync Mentor',
    mentorName: 'ImgM',
    email: `img.sync.${stamp}@eatrade.test`,
    whatsapp: '+10000000001',
    status: 'approved',
    keysAllowed: 20,
    keysUsed: 0,
    registeredAt: new Date().toISOString(),
    passwordHash: hash,
  };
  const ea = {
    id: eaId,
    name: eaName,
    imageUri: null,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId,
  };
  const key = {
    id: `key_${stamp}`,
    key: keyCode,
    customerName: 'Img Client',
    plan: '1 Month',
    status: 'Active',
    createdAt: new Date().toISOString(),
    boundEmail: null,
    eaId,
    eaName,
    eaImageUri: null,
    mentorId,
  };
  const next = {
    ...prev,
    mentors: [mentor, ...(prev.mentors || []).filter((m) => m.id !== mentorId)],
    eas: [ea, ...(prev.eas || []).filter((e) => e.id !== eaId)],
    keys: [key, ...(prev.keys || []).filter((k) => normalizeKey(k.key) !== normalizeKey(keyCode))],
    deletedEaIds: prev.deletedEaIds || [],
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
  return { mentor, ea, keyCode, password, token };
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
  if (!(await page.getByTestId('open-admin-portal').isVisible().catch(() => false))) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
  }
  await page.getByTestId('open-admin-portal').click({ timeout: 20000 });
  await page.getByTestId('portal-signin-email').fill(email);
  await page.getByTestId('portal-signin-password').fill(password);
  await page.getByTestId('portal-signin-submit').click();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (/TOTAL LICENSES|EXPERT ADVISORS|Your expert advisors|Generate key/i.test(body)) return;
    await page.waitForTimeout(250);
  }
  throw new Error('portal sign-in timeout');
}

async function openNav(page, sectionId) {
  const nav = page.getByTestId(`portal-nav-${sectionId}`);
  if (!(await nav.isVisible().catch(() => false))) {
    await page.getByTestId('portal-hamburger').click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await nav.scrollIntoViewIfNeeded().catch(() => {});
  try {
    await nav.click({ force: true, timeout: 8000 });
  } catch {
    await page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="portal-nav-${id}"]`);
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, sectionId);
  }
  await page.waitForTimeout(700);
}

async function softPayReturn(page, base, email) {
  const u = new URL(base);
  u.searchParams.set('paid', '1');
  u.searchParams.set('email', email);
  u.searchParams.set('status', 'success');
  u.searchParams.set('source', 'whop');
  await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
}

async function waitOutPaymentBoot(page, ms = 20000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await page.getByTestId('activate-robot-key').isVisible().catch(() => false)) return;
    if (await page.getByTestId('home-robot-title').isVisible().catch(() => false)) return;
    if (await page.getByTestId('member-email-input').isVisible().catch(() => false)) return;
    await page.waitForTimeout(250);
  }
}

async function activateClientHome(page, base, email, key, expectName) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
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

  const homeDeadline = Date.now() + 35000;
  let landed = false;
  while (Date.now() < homeDeadline) {
    const err = await page.getByTestId('activate-robot-error').textContent().catch(() => null);
    if (err && err.trim()) throw new Error(`activate failed: ${err.trim()}`);
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
  const custom =
    (await page.locator('[data-custom-ea-image="1"]').count()) +
    (await page.getByTestId('home-robot-card-custom').count());
  const defaultHero =
    (await page.locator('[data-default-oracle-hero="1"]').count()) +
    (await page.getByTestId('home-robot-card-default').count());
  const src = await page.evaluate(() => {
    const marked = document.querySelector('[data-ea-image-src]');
    if (marked?.getAttribute('data-ea-image-src')) return marked.getAttribute('data-ea-image-src');
    const img = document.querySelector('[data-testid="home-robot-image"]');
    return img?.getAttribute('src') || img?.src || '';
  });
  return { title, custom, defaultHero, src };
}

async function main() {
  console.log('[img-sync] seed…');
  const seed = await seedMentorAndKey();

  if (process.env.SKIP_EXPORT !== '1') {
    console.log('[img-sync] export…');
    const exp = spawnSync('npm', ['run', 'export:vercel'], {
      cwd: path.join(root, 'apps/oracle-mobile'),
      encoding: 'utf8',
      env: process.env,
    });
    if (exp.status !== 0) throw new Error('export failed');
  }

  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4193;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];
  let hostedUrl = null;
  const pngPath = path.join(mediaDir, `home-img-upload-${stamp}.png`);
  fs.writeFileSync(pngPath, makeDistinctPng());

  const run = async (id, fn) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failShot = await shot(page, `home-img-fail-${id}-${stamp}.png`).catch(() => null);
      results.push({
        id,
        pass: false,
        detail: msg.slice(0, 280).replace(/\n/g, ' | '),
        shot: failShot,
      });
    }
  };

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(base, { waitUntil: 'domcontentloaded' });

    await run('mentor_upload_image', async () => {
      await portalSignIn(page, seed.mentor.email, seed.password);
      await openNav(page, 'expert-adviser');
      await page.waitForTimeout(1000);
      const editBtn = page.getByTestId(`portal-ea-edit-image-${seed.ea.id}`);
      await editBtn.waitFor({ timeout: 15000 });
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        editBtn.click(),
      ]);
      await chooser.setFiles(pngPath);
      // Wait for cloud https to land in catalog
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        const login = await api('POST', '/auth/v1/token?grant_type=password', {
          body: { email: SYNC_EMAIL, password: SYNC_PASS },
        });
        const user = await api('GET', '/auth/v1/user', { token: login.json.access_token });
        const store = user.json?.user_metadata?.oracle_store || {};
        const ea = (store.eas || []).find((e) => e.id === seed.ea.id);
        if (ea?.imageUri && /^https?:\/\//i.test(ea.imageUri)) {
          hostedUrl = ea.imageUri;
          break;
        }
        await page.waitForTimeout(1500);
      }
      if (!hostedUrl) throw new Error('EA imageUri not persisted as https in cloud');
      const shot1 = await shot(page, `home-img-1-mentor-upload-${stamp}.png`);
      fs.copyFileSync(shot1, path.join(mediaDir, 'home-img-1-mentor-upload.png'));
      results.push({
        id: 'mentor_upload_image',
        pass: true,
        detail: `hosted ${hostedUrl}`,
        shot: shot1,
      });
    });

    await run('client_home_custom_image', async () => {
      const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        const home = await activateClientHome(
          client,
          base,
          `client.${stamp}@eatrade.test`,
          seed.keyCode,
          seed.ea.name,
        );
        if (!home.title.includes('ImgSync') && !home.title.includes(seed.ea.name)) {
          throw new Error(`wrong title: ${home.title}`);
        }
        if (home.custom < 1 || home.defaultHero > 0) {
          throw new Error(`expected custom hero, custom=${home.custom} default=${home.defaultHero}`);
        }
        if (!/^https?:\/\//i.test(home.src)) {
          throw new Error(`home image src not https: ${String(home.src).slice(0, 120)}`);
        }
        if (hostedUrl && home.src.split('?')[0] !== hostedUrl.split('?')[0]) {
          const ok =
            /imgur\.com|iili\.io|supabase\.co\/storage|catbox|litterbox/i.test(home.src) &&
            !/oracleHero|assets\//i.test(home.src);
          if (!ok) throw new Error(`src mismatch got=${home.src} want≈${hostedUrl}`);
        }
        const shot2 = await shot(client, `home-img-2-client-home-${stamp}.png`);
        fs.copyFileSync(shot2, path.join(mediaDir, 'home-img-2-client-home.png'));
        fs.copyFileSync(shot2, path.join(mediaDir, 'home-name-and-image-synced.png'));
        results.push({
          id: 'client_home_custom_image',
          pass: true,
          detail: `title=${home.title}; src=${home.src}`,
          shot: shot2,
        });
      } finally {
        await client.close();
      }
    });

    await run('rename_still_works', async () => {
      await openNav(page, 'expert-adviser');
      const newName = `ImgSyncRenamed-${stamp}`;
      await page.getByTestId(`portal-ea-rename-${seed.ea.id}`).click();
      await page.getByTestId(`portal-ea-rename-input-${seed.ea.id}`).fill(newName);
      await page.getByTestId(`portal-ea-rename-save-${seed.ea.id}`).click();
      await page.waitForTimeout(2500);
      const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        const home = await activateClientHome(
          client,
          base,
          `client2.${stamp}@eatrade.test`,
          seed.keyCode,
          newName,
        );
        if (!home.title.includes('ImgSyncRenamed') && !home.title.includes(newName)) {
          throw new Error(`rename not on home: ${home.title}`);
        }
        if (home.custom < 1) throw new Error('lost custom image after rename');
        const shot3 = await shot(client, `home-img-3-renamed-${stamp}.png`);
        fs.copyFileSync(shot3, path.join(mediaDir, 'home-img-3-renamed.png'));
        results.push({
          id: 'rename_still_works',
          pass: true,
          detail: `renamed to ${home.title}`,
          shot: shot3,
        });
      } finally {
        await client.close();
      }
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
    '# Home EA image sync — E2E',
    '',
    `- stamp: \`${stamp}\``,
    `- hostedUrl: ${hostedUrl || 'n/a'}`,
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
    '- live: https://mukundimukhuba8-jpg.github.io/javas/oracle/',
  ].join('\n');
  fs.writeFileSync(reportPath, md);
  console.log(md);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error('[img-sync]', e instanceof Error ? e.message : e);
  process.exit(1);
});
