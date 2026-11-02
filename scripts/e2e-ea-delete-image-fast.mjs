#!/usr/bin/env node
/**
 * Prove: create EA → image preview fast → delete sticks worldwide (reload + 2nd session).
 * Also asserts CleanEA-* ghosts are gone and Unlimited remains.
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
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/ea-delete-image-fast-e2e.md';

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

async function fetchCloudStore() {
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!login.ok) throw new Error(`cloud login ${login.status}`);
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { token });
  return {
    token,
    store: user.json?.user_metadata?.oracle_store || {},
  };
}

/** Small valid 1×1 PNG for setInputFiles (image/*). */
function tinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64',
  );
}

function staticServer(dir, port) {
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
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
  if (!SUPABASE_URL || !PUB || !SYNC_EMAIL || !SYNC_PASS) {
    throw new Error('missing supabase sync env');
  }

  console.log('[ea-del] scrub…');
  spawnSync('node', [path.join(root, 'scripts/scrub-e2e-oracle-catalog.mjs')], {
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (process.env.SKIP_EXPORT !== '1') {
    console.log('[ea-del] export…');
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
  const port = 4191;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];
  const eaName = `ProveDel-${stamp}`;
  let previewMs = null;
  let deletedId = null;

  const run = async (id, fn) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failShot = await shot(page, `ea-del-fail-${id}-${stamp}.png`).catch(() => null);
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

    await run('ghosts_gone_unlimited_kept', async () => {
      await portalSignIn(page, 'eatrade@gmail.com', 'Sfiso');
      await openNav(page, 'expert-adviser');
      await page.waitForTimeout(1500);
      const body = await page.locator('body').innerText();
      const ghostsGone = !/CleanEA-mvzqcdpo|CleanEA-mvzqbedh|CleanEA-/i.test(body);
      const unlimitedOk = /Unlimited/i.test(body);
      const shot1 = await shot(page, `ea-del-1-ghosts-gone-${stamp}.png`);
      fs.copyFileSync(shot1, path.join(mediaDir, 'ea-del-1-ghosts-gone.png'));
      if (!ghostsGone) throw new Error('CleanEA ghosts still visible');
      if (!unlimitedOk) throw new Error('Unlimited missing');
      results.push({
        id: 'ghosts_gone_unlimited_kept',
        pass: true,
        detail: 'CleanEA gone; Unlimited kept',
        shot: shot1,
      });
    });

    await run('create_upload_image_fast', async () => {
      await openNav(page, 'expert-adviser');
      await page.getByTestId('portal-ea-new-name').fill(eaName);
      // Confirm checkbox
      await page.getByTestId('portal-ea-confirm').click();

      const pngPath = path.join(mediaDir, `ea-del-upload-${stamp}.png`);
      fs.writeFileSync(pngPath, tinyPngBuffer());

      const t0 = Date.now();
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.getByTestId('portal-ea-pick-image').click(),
      ]);
      await fileChooser.setFiles(pngPath);

      // Preview must appear quickly (optimistic compress — not full cloud round-trip)
      await page.getByTestId('portal-ea-image-preview').waitFor({ state: 'visible', timeout: 4000 });
      previewMs = Date.now() - t0;
      if (previewMs > 3500) {
        throw new Error(`image preview too slow: ${previewMs}ms`);
      }

      await page.getByTestId('portal-ea-add').click();
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText();
      if (!body.includes(eaName)) throw new Error('created EA not listed');
      const shot2 = await shot(page, `ea-del-2-created-image-${stamp}.png`);
      fs.copyFileSync(shot2, path.join(mediaDir, 'ea-del-2-created-image.png'));
      results.push({
        id: 'create_upload_image_fast',
        pass: true,
        detail: `preview ${previewMs}ms; EA listed`,
        shot: shot2,
      });
    });

    await run('delete_sticks_reload', async () => {
      // Find row by name → delete
      const nameEl = page.locator(`[data-testid^="portal-ea-name-"]`, { hasText: eaName }).first();
      await nameEl.waitFor({ state: 'visible', timeout: 10000 });
      const nameTestId = await nameEl.getAttribute('data-testid');
      deletedId = nameTestId.replace('portal-ea-name-', '');
      await page.getByTestId(`portal-ea-delete-${deletedId}`).click();
      await page.waitForTimeout(800);
      let body = await page.locator('body').innerText();
      if (body.includes(eaName)) throw new Error('EA still visible after delete');

      // Give cloud write a moment, then hard reload with cleared local catalog only
      await page.waitForTimeout(2500);
      await page.evaluate(() => {
        localStorage.removeItem('oracle.eas.v1');
        localStorage.removeItem('oracle.eas.selected.v1');
        // Keep tombstones — simulates same browser after delete
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      // May need re-open portal section
      const stillPortal = await page.locator('body').innerText();
      if (!/Your expert advisors|EXPERT ADVISOR/i.test(stillPortal)) {
        await openNav(page, 'expert-adviser').catch(() => {});
      } else {
        await openNav(page, 'expert-adviser');
      }
      await page.waitForTimeout(2000);
      body = await page.locator('body').innerText();
      if (body.includes(eaName)) throw new Error('EA resurrected after reload');
      if (/CleanEA-/i.test(body)) throw new Error('CleanEA ghosts returned');

      const { store } = await fetchCloudStore();
      const cloudNames = (store.eas || []).map((e) => e.name);
      const tombstoned = (store.deletedEaIds || []).includes(deletedId);
      if (cloudNames.includes(eaName)) throw new Error('EA still in cloud catalog');
      if (!tombstoned) throw new Error('missing cloud tombstone for deleted EA');

      const shot3 = await shot(page, `ea-del-3-after-reload-${stamp}.png`);
      fs.copyFileSync(shot3, path.join(mediaDir, 'ea-del-3-after-reload.png'));
      results.push({
        id: 'delete_sticks_reload',
        pass: true,
        detail: `tombstone ${deletedId}; cloud eas=${cloudNames.join(',') || '(none extra)'}`,
        shot: shot3,
      });
    });

    await run('second_session_gone', async () => {
      const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await page2.goto(base, { waitUntil: 'domcontentloaded' });
        await page2.evaluate(() => localStorage.clear());
        await page2.goto(base, { waitUntil: 'domcontentloaded' });
        await portalSignIn(page2, 'eatrade@gmail.com', 'Sfiso');
        await openNav(page2, 'expert-adviser');
        await page2.waitForTimeout(2000);
        const body = await page2.locator('body').innerText();
        if (body.includes(eaName)) throw new Error('deleted EA visible in fresh session');
        if (/CleanEA-/i.test(body)) throw new Error('CleanEA in fresh session');
        if (!/Unlimited/i.test(body)) throw new Error('Unlimited missing in fresh session');
        const shot4 = await shot(page2, `ea-del-4-second-session-${stamp}.png`);
        fs.copyFileSync(shot4, path.join(mediaDir, 'ea-del-4-second-session.png'));
        // Copy bug-style proof that ghosts are gone
        fs.copyFileSync(shot4, path.join(mediaDir, 'eas-ghost-after-delete-fixed.png'));
        results.push({
          id: 'second_session_gone',
          pass: true,
          detail: 'fresh session: ProveDel gone, Unlimited kept',
          shot: shot4,
        });
      } finally {
        await page2.close();
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
    '# EA delete + image upload fast — E2E',
    '',
    `- stamp: \`${stamp}\``,
    `- previewMs: ${previewMs != null ? previewMs : results.find((r) => r.id === 'create_upload_image_fast')?.detail || 'n/a'}`,
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
  console.error('[ea-del]', e instanceof Error ? e.message : e);
  process.exit(1);
});
