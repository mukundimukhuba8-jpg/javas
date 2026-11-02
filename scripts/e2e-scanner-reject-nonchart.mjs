#!/usr/bin/env node
/**
 * Prove: non-chart photo → reject (no BUY/SELL); chart-like fixture → signal path.
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
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/scanner-reject-nonchart-e2e.md';

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

function normalizeKey(k) {
  return String(k || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function seedScanKey() {
  const login = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: SYNC_EMAIL, password: SYNC_PASS },
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const token = login.json.access_token;
  const user = await api('GET', '/auth/v1/user', { token });
  const prev = user.json?.user_metadata?.oracle_store || {};
  const mentorId = `mentor_scan_${stamp}`;
  const eaId = `ea_scan_${stamp}`;
  const keyCode = `SCN-${stamp.slice(0, 3).toUpperCase()}-${stamp.slice(3, 6).toUpperCase()}-ZZ1`;
  const ea = {
    id: eaId,
    name: `ScanEA-${stamp}`,
    imageUri: null,
    type: 'Standard',
    createdAt: new Date().toISOString(),
    mentorId,
  };
  const key = {
    id: `key_scan_${stamp}`,
    key: keyCode,
    customerName: 'Scan Client',
    plan: '1 Month',
    status: 'Active',
    createdAt: new Date().toISOString(),
    boundEmail: null,
    eaId,
    eaName: ea.name,
    eaImageUri: null,
    mentorId,
  };
  const next = {
    ...prev,
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
  return { keyCode, ea };
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

async function softPay(page, base, email) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(
    `${base}?paid=1&email=${encodeURIComponent(email)}&status=success&source=whop`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForTimeout(1200);
  if (await page.getByTestId('member-email-input').isVisible().catch(() => false)) {
    await page.getByTestId('member-email-input').fill(email);
    await page.getByTestId('member-email-continue').click();
    await page.waitForTimeout(1500);
  }
}

async function reachHomeWithKey(page, base, email, keyCode) {
  await softPay(page, base, email);
  const deadline = Date.now() + 50000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('member-email-input').isVisible().catch(() => false)) {
      await page.getByTestId('member-email-input').fill(email);
      await page.getByTestId('member-email-continue').click();
      await page.waitForTimeout(1200);
      continue;
    }
    if (await page.getByTestId('whop-checkout-open').isVisible().catch(() => false)) {
      await softPay(page, base, email);
      continue;
    }
    if (await page.getByTestId('activate-robot-key').isVisible().catch(() => false)) {
      await page.getByTestId('activate-robot-key').fill('');
      await page.getByTestId('activate-robot-key').fill(keyCode);
      await page.getByTestId('activate-robot-submit').click();
      await page.waitForTimeout(2500);
      const err = await page.getByTestId('activate-robot-error').textContent().catch(() => '');
      if (err && err.trim() && /invalid|not found|expired|deleted/i.test(err)) {
        throw new Error(`activate failed: ${err.trim()}`);
      }
      continue;
    }
    if (await page.getByTestId('nav-scanner').isVisible().catch(() => false)) return;
    if (await page.getByTestId('home-robot-title').isVisible().catch(() => false)) return;
    await page.waitForTimeout(400);
  }
  throw new Error('could not reach home/scanner after activate');
}

async function openScanner(page) {
  const nav = page.getByTestId('nav-scanner');
  await nav.waitFor({ timeout: 20000 });
  await nav.click();
  await page.waitForTimeout(600);
  await page.getByTestId('scanner-upload').waitFor({ timeout: 15000 });
}

async function makeNonChartPng(page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 360;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a3a6e';
    ctx.fillRect(0, 0, 480, 360);
    ctx.fillStyle = '#c8d0dc';
    for (let y = 200; y < 360; y += 40) {
      for (let x = 0; x < 480; x += 40) {
        ctx.fillRect(x + 1, y + 1, 38, 38);
      }
    }
    const foot = (ox, oy) => {
      ctx.fillStyle = '#d4a07a';
      ctx.beginPath();
      ctx.ellipse(ox, oy, 55, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(ox - 35 + i * 18, oy + 40, 12, 28);
      }
    };
    foot(170, 160);
    foot(310, 165);
    return c.toDataURL('image/png');
  });
  const b64 = dataUrl.split(',')[1];
  const fp = path.join(mediaDir, `scanner-nonchart-${stamp}.png`);
  fs.writeFileSync(fp, Buffer.from(b64, 'base64'));
  return fp;
}

async function makeChartPng(page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 720;
    c.height = 420;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, 720, 420);
    ctx.strokeStyle = 'rgba(100,140,200,0.25)';
    for (let y = 80; y < 400; y += 40) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(640, y);
      ctx.stroke();
    }
    for (let i = 0; i < 28; i++) {
      const x = 36 + i * 22;
      const up = i % 3 !== 0;
      ctx.fillStyle = up ? '#22c55e' : '#ef4444';
      const h = 36 + ((i * 17) % 90);
      const y = 220 - h / 2;
      ctx.fillRect(x, y, 12, h);
      ctx.fillRect(x + 5, y - 12, 2, h + 24);
    }
    ctx.fillStyle = '#e8eefc';
    ctx.font = 'bold 32px monospace';
    ctx.fillText('EURUSD', 24, 40);
    ctx.font = '20px monospace';
    ctx.fillText('H1  BID 1.08542  ASK 1.08548', 24, 68);
    ctx.fillText('1.08620', 650, 120);
    ctx.fillText('1.08500', 650, 220);
    ctx.fillText('1.08380', 650, 320);
    ctx.fillText('VOLUME 12450', 24, 400);
    return c.toDataURL('image/png');
  });
  const b64 = dataUrl.split(',')[1];
  const fp = path.join(mediaDir, `scanner-chart-${stamp}.png`);
  fs.writeFileSync(fp, Buffer.from(b64, 'base64'));
  return fp;
}

async function uploadViaChooser(page, filePath) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15000 }),
    page.getByTestId('scanner-upload').click(),
  ]);
  await chooser.setFiles(filePath);
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

  const seed = await seedScanKey();
  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4195;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = [];
  const email = `scan.reject.${stamp}@eatrade.test`;

  const run = async (id, fn) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const failShot = await shot(page, `scanner-fail-${id}-${stamp}.png`).catch(() => null);
      results.push({
        id,
        pass: false,
        detail: msg.slice(0, 280).replace(/\n/g, ' | '),
        shot: failShot,
      });
    }
  };

  try {
    await reachHomeWithKey(page, base, email, seed.keyCode);
    const nonChart = await makeNonChartPng(page);
    const chart = await makeChartPng(page);

    await run('reject_non_chart', async () => {
      await openScanner(page);
      await uploadViaChooser(page, nonChart);
      await page.getByTestId('scanner-reject-card').waitFor({ timeout: 90000 });
      const msg = await page.getByTestId('scanner-reject-message').innerText();
      if (!/No chart detected/i.test(msg)) throw new Error(`bad reject msg: ${msg}`);
      const signalCount = await page.getByTestId('scanner-signal-card').count();
      const sellCount = await page.getByText('SELL', { exact: true }).count();
      const buyCount = await page.getByText('BUY', { exact: true }).count();
      if (signalCount > 0 || sellCount > 0 || buyCount > 0) {
        throw new Error('invented signal on non-chart');
      }
      const body = await page.locator('body').innerText();
      if (/TAKE PROFIT|STOP LOSS|model confidence/i.test(body)) {
        throw new Error('TP/SL shown for non-chart');
      }
      const shot1 = await shot(page, `scanner-reject-nonchart-${stamp}.png`);
      fs.copyFileSync(shot1, path.join(mediaDir, 'scanner-reject-nonchart.png'));
      fs.copyFileSync(shot1, path.join(mediaDir, 'scanner-fake-chart-feet-fixed.png'));
      results.push({
        id: 'reject_non_chart',
        pass: true,
        detail: msg.replace(/\n/g, ' '),
        shot: shot1,
      });
    });

    await run('accept_chart_fixture', async () => {
      await page.getByTestId('scanner-reject-retry').click().catch(() => null);
      await page.waitForTimeout(400);
      if (!(await page.getByTestId('scanner-upload').isVisible().catch(() => false))) {
        await openScanner(page);
      }
      await uploadViaChooser(page, chart);
      await page.getByTestId('scanner-signal-card').waitFor({ timeout: 120000 });
      const dir = await page.getByTestId('scanner-signal-direction').innerText();
      if (!/^(BUY|SELL)$/.test(dir.trim())) throw new Error(`no direction: ${dir}`);
      const rejectStill = await page.getByTestId('scanner-reject-card').count();
      if (rejectStill > 0) throw new Error('chart fixture wrongly rejected');
      const shot2 = await shot(page, `scanner-accept-chart-${stamp}.png`);
      fs.copyFileSync(shot2, path.join(mediaDir, 'scanner-accept-chart.png'));
      results.push({
        id: 'accept_chart_fixture',
        pass: true,
        detail: `direction=${dir.trim()}`,
        shot: shot2,
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
    '# Scanner reject non-chart — E2E',
    '',
    `- stamp: \`${stamp}\``,
    `- key: \`${seed.keyCode}\``,
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
  console.error('[scanner-e2e]', e instanceof Error ? e.message : e);
  process.exit(1);
});
