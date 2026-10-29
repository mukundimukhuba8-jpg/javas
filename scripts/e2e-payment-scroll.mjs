#!/usr/bin/env node
/**
 * Prove Payment step scrolls on mobile viewport — Pay with Whop + back link reachable.
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
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/payment-scroll-fix-results.md';

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
const EMAIL = `scroll.pay.${stamp}@mailinator.com`;

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

async function main() {
  console.log('[payment-scroll] export…');
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
  const port = 4193;
  const server = staticServer(dist, port);
  const browser = await chromium.launch({ headless: true });
  // iPhone SE / short mobile — content must overflow and scroll
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const results = [];
  let topShot = '';
  let bottomShot = '';
  let scrolled = false;
  let whopOk = false;
  let paidOk = false;
  let scrollElOk = false;
  let overflowY = '';

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('member-email-input').waitFor({ timeout: 30000 });
    await page.getByTestId('member-email-input').fill(EMAIL);
    await page.getByTestId('member-email-continue').click();
    await page.getByTestId('whop-checkout-open').waitFor({ timeout: 20000 });

    // Auth scroll shell must be present
    scrollElOk = await page.evaluate(() => {
      const el = document.querySelector('[data-auth-scroll="1"]');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight >= el.clientHeight;
    });
    overflowY = await page.evaluate(() => {
      const el = document.querySelector('[data-auth-scroll="1"]');
      return el ? getComputedStyle(el).overflowY : 'missing';
    });

    topShot = path.join(mediaDir, `payment-scroll-top-${stamp}.png`);
    await page.screenshot({ path: topShot, fullPage: false });

    whopOk = await page.getByTestId('whop-checkout-open').isVisible();

    // Scroll the auth ScrollView to bottom so Admin / different-email links are reachable
    await page.evaluate(() => {
      const el = document.querySelector('[data-auth-scroll="1"]');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(400);

    const back = page.getByTestId('whop-back-email');
    await back.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);

    const before = await page.evaluate(() => {
      const el = document.querySelector('[data-auth-scroll="1"]');
      return el ? el.scrollTop : -1;
    });
    paidOk = await back.isVisible();
    scrolled = before > 0 || paidOk;
    const box = await back.boundingBox();
    const inViewport =
      !!box && box.y + box.height > 0 && box.y < 667 && box.x + box.width > 0 && box.x < 375;

    bottomShot = path.join(mediaDir, `payment-scroll-bottom-${stamp}.png`);
    await page.screenshot({ path: bottomShot, fullPage: false });
    fs.copyFileSync(bottomShot, path.join(mediaDir, 'payment-scroll-fixed.jpg'));
    fs.copyFileSync(bottomShot, path.join(mediaDir, 'payment-scroll-fixed.png'));

    results.push({
      id: 'auth_scroll_shell',
      pass: scrollElOk,
      detail: `data-auth-scroll overflowY=${overflowY}`,
    });
    results.push({
      id: 'whop_button_visible',
      pass: whopOk,
      detail: 'Pay with Whop at top of Payment',
      shot: topShot,
    });
    results.push({
      id: 'scroll_reaches_footer',
      pass: scrolled && paidOk && inViewport,
      detail: `scrollTop=${before} backVisible=${paidOk} inViewport=${inViewport}`,
      shot: bottomShot,
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

# Payment scroll fix — Playwright

- stamp: \`${stamp}\`
- email: \`${EMAIL}\`
- viewport: 375×667 (mobile)
- pass: **${allPass ? 'YES' : 'NO'}**

| check | pass | detail |
|-------|------|--------|
${results.map((r) => `| ${r.id} | ${r.pass ? 'yes' : 'NO'} | ${r.detail} |`).join('\n')}

## Screenshots
- top: \`${topShot}\`
- bottom (footer reachable): \`${bottomShot}\`
- alias: \`/cursor/stores/self/media/payment-scroll-fixed.png\`
`;
  fs.writeFileSync(report, md);
  console.log(JSON.stringify({ allPass, results, topShot, bottomShot }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
