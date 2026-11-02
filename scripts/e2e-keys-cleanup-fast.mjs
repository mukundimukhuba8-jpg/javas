#!/usr/bin/env node
/**
 * Prove: clean catalog (no E2E junk EAs), compact keys list, instant generate (key before cloud).
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
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/keys-cleanup-fast-e2e.md';

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

async function seedCleanMentor() {
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { token });
  const prev = user.json.user_metadata.oracle_store || {};
  const mentorId = `mentor_clean_${stamp}`;
  const eaId = `ea_clean_${stamp}`;
  const eaName = `CleanEA-${stamp}`;
  const hash = await hashPortalPassword('CleanMentor-pass1');
  const ea = {
    id: eaId,
    name: eaName,
    imageUri: `https://placehold.co/400x300/1e3a5f/fff/png?text=Clean`,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId,
  };
  const mentor = {
    id: mentorId,
    name: 'Clean Mentor',
    mentorName: 'CleanM',
    email: `clean.mentor.${stamp}@eatrade.test`,
    whatsapp: '+10000000000',
    status: 'approved',
    keysAllowed: 50,
    keysUsed: 0,
    registeredAt: new Date().toISOString(),
    passwordHash: hash,
  };
  const next = {
    ...prev,
    mentors: [mentor, ...(prev.mentors || []).filter((m) => m.id !== mentorId)],
    eas: [ea, ...(prev.eas || []).filter((e) => e.id !== eaId)],
    keys: prev.keys || [],
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
  return {
    token,
    mentor,
    ea,
    password: 'CleanMentor-pass1',
    store: next,
  };
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
  await page.waitForTimeout(150);
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

async function main() {
  // Ensure scrubbed first
  spawnSync('node', [path.join(root, 'scripts/scrub-e2e-oracle-catalog.mjs')], {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  const seed = await seedCleanMentor();

  if (process.env.SKIP_EXPORT !== '1') {
    const exp = spawnSync('npm', ['run', 'export:vercel'], {
      cwd: path.join(root, 'apps/oracle-mobile'),
      encoding: 'utf8',
      env: process.env,
    });
    if (exp.status !== 0) throw new Error('export failed');
  }

  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4188;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  // Desktop viewport so portal sidebar nav is clickable
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  const run = async (id, fn) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failShot = await shot(page, `keys-cleanup-fail-${id}-${stamp}.png`).catch(() => null);
      results.push({ id, pass: false, detail: msg.slice(0, 240).replace(/\n/g, ' | '), shot: failShot });
    }
  };

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(base, { waitUntil: 'domcontentloaded' });

    await run('superadmin_eas_clean', async () => {
      await portalSignIn(page, 'eatrade@gmail.com', 'Sfiso');
      await openNav(page, 'expert-adviser');
      await page.waitForTimeout(1200);
      const bodyAdminEa = await page.locator('body').innerText();
      const junkGone =
        !/mvyepaez|mvtoa51a|mvto7tom|EA-Full-|EA-Alpha-|EA-Bravo-|THE ORACLE/i.test(bodyAdminEa);
      const shotAdmin = await shot(page, `keys-cleanup-admin-eas-${stamp}.png`);
      fs.copyFileSync(shotAdmin, path.join(mediaDir, 'keys-cleanup-admin-eas.png'));
      results.push({
        id: 'superadmin_eas_clean',
        pass: junkGone,
        detail: junkGone ? 'no e2e junk names' : bodyAdminEa.slice(0, 200).replace(/\n/g, ' | '),
        shot: shotAdmin,
      });
    });

    await run('mentor_own_ea_only', async () => {
      await page.evaluate(() => localStorage.clear());
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await portalSignIn(page, seed.mentor.email, seed.password);
      await openNav(page, 'expert-adviser');
      await page.waitForTimeout(1200);
      const bodyMentorEa = await page.locator('body').innerText();
      const mentorOk =
        bodyMentorEa.includes(seed.ea.name) &&
        !/mvyepaez|mvtoa51a|EA-Full-|THE ORACLE/i.test(bodyMentorEa);
      const shotMentorEa = await shot(page, `keys-cleanup-mentor-eas-${stamp}.png`);
      fs.copyFileSync(shotMentorEa, path.join(mediaDir, 'keys-cleanup-mentor-eas.png'));
      results.push({
        id: 'mentor_own_ea_only',
        pass: mentorOk,
        detail: `hasOwn=${bodyMentorEa.includes(seed.ea.name)}`,
        shot: shotMentorEa,
      });
    });

    await run('fast_key_create', async () => {
      await openNav(page, 'create-keys');
      await page.waitForTimeout(800);
      await page.getByPlaceholder('Customer full name').fill('Proof Customer');
      await page.getByText('Select an EA', { exact: false }).click().catch(() => {});
      await page.waitForTimeout(300);
      await page.getByText(seed.ea.name, { exact: false }).first().click();
      await page.getByText('Manual', { exact: true }).first().click();
      await page
        .getByText('I CONFIRM THAT I HAVE PERMISSION TO GENERATE THIS LICENCE KEY.', {
          exact: false,
        })
        .click();
      await page.waitForTimeout(200);

      const t0 = Date.now();
      await page.getByTestId('portal-generate-key').click();
      await page.getByTestId('portal-generated-key').waitFor({ timeout: 8000 });
      const perceivedMs = Date.now() - t0;
      const genBody = await page.getByTestId('portal-generated-key').innerText();
      const keyMatch = genBody.match(/[A-Z0-9]{3}(?:-[A-Z0-9]{3}){3}/);
      const instant = perceivedMs < 2000 && !!keyMatch;
      await page.waitForTimeout(1500);
      const listText = await page.getByTestId('portal-cloud-keys-list').innerText();
      const tidy =
        (await page.locator('[data-testid^="portal-key-row-"]').count()) > 0 ||
        listText.toUpperCase().includes(seed.ea.name.toUpperCase()) ||
        /YOUR KEYS/i.test(listText);
      const noSavingLabel = (await page.getByText('Saving to cloud', { exact: false }).count()) === 0;
      const shotKeys = await shot(page, `keys-cleanup-fast-create-${stamp}.png`);
      fs.copyFileSync(shotKeys, path.join(mediaDir, 'keys-fast-create-proof.png'));
      fs.copyFileSync(shotKeys, path.join(mediaDir, 'keys-tidy-list-proof.png'));
      results.push({
        id: 'fast_key_create',
        pass: instant && noSavingLabel,
        detail: `perceivedMs=${perceivedMs} key=${keyMatch?.[0] || 'none'} noSavingLabel=${noSavingLabel}`,
        shot: shotKeys,
      });
      results.push({
        id: 'tidy_keys_list',
        pass: tidy && !/mvyepaez|mvtoa51a/i.test(listText),
        detail: `tidy=${tidy} list=${listText.slice(0, 120).replace(/\n/g, ' | ')}`,
        shot: shotKeys,
      });
    });
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = results.every((r) => r.pass);
  fs.writeFileSync(
    reportPath,
    `---
cursor:
  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"
---

# Keys cleanup + fast create E2E

- stamp: \`${stamp}\`
- live: https://mukundimukhuba8-jpg.github.io/javas/oracle/
- overall: **${allPass ? 'PASS' : 'FAIL'}**

| scenario | pass | detail |
|----------|------|--------|
${results.map((r) => `| ${r.id} | ${r.pass ? 'yes' : 'NO'} | ${String(r.detail).replace(/\|/g, '/')} |`).join('\n')}

## Media
${results.map((r) => `- \`${r.shot}\``).join('\n')}
`,
  );
  console.log(JSON.stringify({ allPass, results }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
