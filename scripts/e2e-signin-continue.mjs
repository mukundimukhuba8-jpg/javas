#!/usr/bin/env node
/** Prove Sign in Continue advances (Payment or Activate) — not stuck. */
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
  '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/signin-continue-fix-results.md';

function loadEnv(fp) {
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}
loadEnv(path.join(root, 'apps/oracle-mobile/.env'));
loadEnv('/cursor/stores/self/internal/supabase-credentials.env');
fs.mkdirSync(mediaDir, { recursive: true });

const stamp = Date.now().toString(36);
const EMAIL = `MUKUNDI.CONTINUE.${stamp}@GMAIL.COM`; // all-caps like user report

function staticServer(dir, port) {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
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
  const exp = spawnSync('npm', ['run', 'export:vercel'], {
    cwd: path.join(root, 'apps/oracle-mobile'),
    encoding: 'utf8',
    env: process.env,
  });
  if (exp.status !== 0) throw new Error('export failed');

  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4191;
  const server = staticServer(dist, port);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let pass = false;
  let detail = '';
  let shot = '';

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('member-email-input').waitFor({ timeout: 30000 });
    await page.getByTestId('member-email-input').fill(EMAIL);
    await page.getByTestId('member-email-continue').click();

    // Must leave Sign in title within 15s → Payment or Activate
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const pay = await page.getByTestId('whop-checkout-open').isVisible().catch(() => false);
      const act = await page.getByTestId('activate-robot-key').isVisible().catch(() => false);
      const title = await page.locator('body').innerText();
      if (pay || act) {
        pass = true;
        detail = pay ? 'advanced to Payment' : 'advanced to Activate';
        break;
      }
      if (title.includes('Checking access')) {
        detail = 'still checking…';
      }
      await page.waitForTimeout(250);
    }
    shot = path.join(mediaDir, `signin-continue-fixed-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    if (!pass) {
      const body = await page.locator('body').innerText();
      detail = `STUCK on Sign in. body=${body.slice(0, 240).replace(/\n/g, ' | ')}`;
    }
  } finally {
    await browser.close();
    server.close();
  }

  const md = [
    '---',
    'cursor:',
    '  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"',
    '---',
    '',
    '# Sign in Continue fix',
    '',
    `- email (caps): ${EMAIL}`,
    `- result: **${pass ? 'PASS' : 'FAIL'}** — ${detail}`,
    `- screenshot: \`${shot}\``,
    `- live: https://mukundimukhuba8-jpg.github.io/javas/oracle/`,
    '',
  ].join('\n');
  fs.writeFileSync(report, md);
  console.log(JSON.stringify({ pass, detail, shot }, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
