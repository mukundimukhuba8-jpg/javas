#!/usr/bin/env node
/**
 * E2E: Whop payment gate → Activate, and portal Subscription shows paid.
 * Mocks Whop return via ?paid=1&email=… (no real charge in CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/node_modules/playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = '/cursor/stores/self/media';
const reportPath =
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/whop-payment-e2e-results.md';

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

fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const stamp = Date.now().toString(36);
const CLIENT = `whop.client.${stamp}@mailinator.com`;

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
  };
  return createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.join(dir, urlPath.replace(/^\//, ''));
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

async function main() {
  console.log('[whop-e2e] export…');
  const exp = spawnSync('npm', ['run', 'export:vercel'], {
    cwd: path.join(root, 'apps/oracle-mobile'),
    encoding: 'utf8',
    env: process.env,
  });
  if (exp.status !== 0) {
    console.error(exp.stdout, exp.stderr);
    throw new Error('export failed');
  }

  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4188;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('member-email-input').waitFor({ timeout: 30000 });
    const boot = await shot(page, `whop-flow-signin-${stamp}.png`);

    await page.getByTestId('member-email-input').fill(CLIENT);
    await page.getByTestId('member-email-continue').click();
    await page.getByTestId('whop-checkout-open').waitFor({ timeout: 20000 });
    const payStep = await shot(page, `whop-flow-payment-step-${stamp}.png`);
    const payVisible = await page.getByTestId('whop-checkout-open').isVisible();
    results.push({
      id: 'email_to_payment_step',
      pass: payVisible,
      detail: `payment UI for ${CLIENT}`,
      shot: payStep,
    });

    // Mock Whop return URL (no real charge)
    const returnUrl = `${base}?paid=1&email=${encodeURIComponent(CLIENT)}&status=success&source=whop`;
    await page.goto(returnUrl, { waitUntil: 'domcontentloaded' });
    // Should land on Activate after AccessProvider handles return
    await page.getByTestId('activate-robot-key').waitFor({ timeout: 30000 });
    const activateShot = await shot(page, `whop-flow-activate-after-pay-${stamp}.png`);
    const onActivate = await page.getByTestId('activate-robot-key').isVisible();
    results.push({
      id: 'mock_return_to_activate',
      pass: onActivate,
      detail: `returnUrl handled → Activate`,
      shot: activateShot,
    });
    results.push({
      id: 'boot_signin_shot',
      pass: true,
      detail: 'signin',
      shot: boot,
    });

    // Portal subscription list
    await page.evaluate(() => localStorage.clear());
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('open-admin-portal').waitFor({ timeout: 20000 });
    await page.getByTestId('open-admin-portal').click();
    await page.getByTestId('portal-signin-email').fill('eatrade@gmail.com');
    await page.getByTestId('portal-signin-password').fill('Sfiso');
    await page.getByTestId('portal-signin-submit').click();
    await page.getByTestId('portal-hamburger').waitFor({ timeout: 20000 });
    const nav = page.getByTestId('portal-nav-subscription');
    if (!(await nav.isVisible().catch(() => false))) {
      await page.getByTestId('portal-hamburger').click();
      await page.waitForTimeout(400);
    }
    await nav.click();
    await page.waitForTimeout(1200);
    // Default tab is awaiting (Paid · awaiting)
    const body = await page.locator('body').innerText();
    const subShot = await shot(page, `whop-flow-portal-subscription-${stamp}.png`);
    const listed = body.includes(CLIENT) || body.toLowerCase().includes('whop');
    results.push({
      id: 'portal_subscription_shows_paid',
      pass: body.includes(CLIENT),
      detail: `listed=${body.includes(CLIENT)} hasWhopLabel=${body.toLowerCase().includes('whop')} snippet=${body.slice(0, 200).replace(/\n/g, ' | ')}`,
      shot: subShot,
    });
    void listed;
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = results.every((r) => r.pass);
  const lines = [
    '---',
    'cursor:',
    '  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"',
    '---',
    '',
    '# Whop payment E2E',
    '',
    `- client: ${CLIENT}`,
    `- checkout: https://whop.com/checkout/plan_HXXGXZqh48JQs`,
    `- mock return: ?paid=1&email=…&status=success`,
    '',
  ];
  for (const r of results) {
    lines.push(`### ${r.id}`);
    lines.push(`- **${r.pass ? 'PASS' : 'FAIL'}** — ${r.detail}`);
    lines.push(`- \`${r.shot}\``);
    lines.push('');
  }
  lines.push(`## Overall: ${allPass ? 'PASS' : 'FAIL'}`);
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ allPass, reportPath, results }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error('[whop-e2e]', e instanceof Error ? e.message : e);
  process.exit(1);
});
