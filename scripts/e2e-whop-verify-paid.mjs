#!/usr/bin/env node
/**
 * Prove: no “I've paid” unlock; forged return stays on Payment; real return URL unlocks.
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
const report =
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/whop-verify-paid-e2e.md';

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
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(path.dirname(report), { recursive: true });

const stamp = Date.now().toString(36);
const EMAIL = `verify.pay.${stamp}@mailinator.com`;

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

async function main() {
  console.log('[whop-verify] export…');
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
  const port = 4195;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = [];

  try {
    // 1) Reach Payment — no I've paid button
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('member-email-input').waitFor({ timeout: 30000 });
    await page.getByTestId('member-email-input').fill(EMAIL);
    await page.getByTestId('member-email-continue').click();
    await page.getByTestId('whop-checkout-open').waitFor({ timeout: 20000 });
    const hasFakeBtn = await page.getByTestId('whop-confirm-paid').count();
    const bodyPay = await page.locator('body').innerText();
    const noIvePaidCopy = !/i['’]ve paid/i.test(bodyPay);
    const payShot = await shot(page, `whop-verify-payment-only-${stamp}.png`);
    results.push({
      id: 'no_ive_paid_button',
      pass: hasFakeBtn === 0 && noIvePaidCopy,
      detail: `confirmPaidCount=${hasFakeBtn} noCopy=${noIvePaidCopy}`,
      shot: payShot,
    });

    // 2) Without return URL, stay on Payment (reload clean — still unpaid)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('member-email-input').waitFor({ timeout: 30000 }).catch(() => null);
    // Session should not be Activate
    const onActivateEarly = await page.getByTestId('activate-robot-key').isVisible().catch(() => false);
    results.push({
      id: 'no_unlock_without_return',
      pass: !onActivateEarly,
      detail: `activateVisible=${onActivateEarly}`,
    });

    // 3) Forged / incomplete return → Payment + error, not Activate
    await page.goto(`${base}?paid=1&email=${encodeURIComponent(EMAIL)}&status=success`, {
      waitUntil: 'domcontentloaded',
    });
    // missing source=whop
    await page.waitForTimeout(1500);
    const forgedActivate = await page.getByTestId('activate-robot-key').isVisible().catch(() => false);
    const forgedPay = await page.getByTestId('whop-checkout-open').isVisible().catch(() => false);
    const forgedErr = await page.getByTestId('member-pay-error').isVisible().catch(() => false);
    const forgedShot = await shot(page, `whop-verify-forged-return-${stamp}.png`);
    results.push({
      id: 'forged_return_stays_payment',
      pass: !forgedActivate && (forgedPay || forgedErr),
      detail: `activate=${forgedActivate} pay=${forgedPay} err=${forgedErr}`,
      shot: forgedShot,
    });

    // 4) Valid soft-verify return URL unlocks Activate
    await page.goto(
      `${base}?paid=1&email=${encodeURIComponent(EMAIL)}&status=success&source=whop`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.getByTestId('activate-robot-key').waitFor({ timeout: 30000 });
    const okActivate = await page.getByTestId('activate-robot-key').isVisible();
    const okShot = await shot(page, `whop-verify-valid-return-${stamp}.png`);
    fs.copyFileSync(okShot, path.join(mediaDir, 'whop-verify-valid-return.png'));
    fs.copyFileSync(payShot, path.join(mediaDir, 'whop-verify-no-fake-paid.png'));
    fs.copyFileSync(forgedShot, path.join(mediaDir, 'whop-verify-forged-blocked.png'));
    results.push({
      id: 'valid_return_unlocks_activate',
      pass: okActivate,
      detail: 'paid=1&status=success&source=whop → Activate',
      shot: okShot,
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

# Whop verify-paid E2E

- email: \`${EMAIL}\`
- pass: **${allPass ? 'YES' : 'NO'}**

| check | pass | detail |
|-------|------|--------|
${results.map((r) => `| ${r.id} | ${r.pass ? 'yes' : 'NO'} | ${r.detail} |`).join('\n')}
`;
  fs.writeFileSync(report, md);
  console.log(JSON.stringify({ allPass, results }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
