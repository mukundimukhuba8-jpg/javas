#!/usr/bin/env node
/** Prove Payment has Check payment status; soft return still unlocks without API keys. */
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
fs.mkdirSync(mediaDir, { recursive: true });

const stamp = Date.now().toString(36);
const EMAIL = `api.shape.${stamp}@mailinator.com`;

function staticServer(dir, port) {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
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

  // Unit-ish: verify handler reports not configured without keys
  const prevKey = process.env.WHOP_API_KEY;
  delete process.env.WHOP_API_KEY;
  delete process.env.WHOP_COMPANY_ID;
  const { default: verifyHandler } = await import(path.join(root, 'api/whop/verify.js'));
  const captured = { status: 0, body: '' };
  await verifyHandler(
    { method: 'GET', url: '/api/whop/verify?email=a@b.com', headers: { host: 'localhost' } },
    {
      setHeader() {},
      end(s) {
        captured.body = s;
      },
      set statusCode(v) {
        captured.status = v;
      },
      get statusCode() {
        return captured.status;
      },
    },
  );
  if (prevKey) process.env.WHOP_API_KEY = prevKey;
  const verifyJson = JSON.parse(captured.body || '{}');
  const apiShapeOk = verifyJson.configured === false && verifyJson.paid === false;

  const dist = path.join(root, 'apps/oracle-mobile/dist-web-pages');
  const port = 4197;
  const server = staticServer(dist, port);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = [{ id: 'api_verify_unconfigured', pass: apiShapeOk, detail: JSON.stringify(verifyJson) }];

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('member-email-input').fill(EMAIL);
    await page.getByTestId('member-email-continue').click();
    await page.getByTestId('whop-checkout-open').waitFor({ timeout: 20000 });
    const checkVisible = await page.getByTestId('whop-check-payment').isVisible();
    const noFake = (await page.getByTestId('whop-confirm-paid').count()) === 0;
    const shot = path.join(mediaDir, `whop-api-shape-payment-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    fs.copyFileSync(shot, path.join(mediaDir, 'whop-api-check-payment.png'));
    results.push({
      id: 'check_payment_button',
      pass: checkVisible && noFake,
      detail: `check=${checkVisible} noFake=${noFake}`,
      shot,
    });

    await page.getByTestId('whop-check-payment').click();
    await page.waitForTimeout(800);
    const info = await page.locator('body').innerText();
    const explainsMissing =
      /not configured|return url|finish checkout|checking whop/i.test(info);
    results.push({
      id: 'check_without_api_keys',
      pass: explainsMissing && !(await page.getByTestId('activate-robot-key').isVisible().catch(() => false)),
      detail: info.slice(0, 180).replace(/\n/g, ' | '),
    });

    await page.goto(
      `${base}?paid=1&email=${encodeURIComponent(EMAIL)}&status=success&source=whop`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.getByTestId('activate-robot-key').waitFor({ timeout: 30000 });
    const actShot = path.join(mediaDir, `whop-api-shape-activate-${stamp}.png`);
    await page.screenshot({ path: actShot, fullPage: true });
    results.push({
      id: 'soft_return_still_unlocks_without_api',
      pass: await page.getByTestId('activate-robot-key').isVisible(),
      shot: actShot,
    });
  } finally {
    await browser.close();
    server.close();
  }

  const allPass = results.every((r) => r.pass);
  const report =
    '/cursor/stores/bc-01a15341-33bb-7e32-8923-443f9670a118/internal/whop-api-verify-feasibility.md';
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(
    report,
    `---
cursor:
  subagentId: "bc-1def9913-de51-5b43-b923-e6382cf24902"
---

# Whop API verify — feasibility + shipped

## Feasibility
- **Cannot** confirm real Whop charges with public info alone.
- **Needs** from Whop dashboard: \`WHOP_API_KEY\`, \`WHOP_COMPANY_ID\` (\`biz_\`), \`WHOP_WEBHOOK_SECRET\` (\`ws_\`).
- Plan id known: \`plan_HXXGXZqh48JQs\`.
- No Whop secrets were in the store (only commented placeholders added).

## Shipped
- \`GET /api/whop/verify?email=\` + \`POST /api/whop/webhook\` (Vercel)
- Client: Sign in Continue + return + **Check payment status** call verify when endpoint available
- Soft return still unlocks when API keys are **not** configured
- Docs: \`docs/oracle/WHOP.md\`, \`.env.example\` placeholders

## Playwright
| check | pass | detail |
|-------|------|--------|
${results.map((r) => `| ${r.id} | ${r.pass ? 'yes' : 'NO'} | ${(r.detail || '').replace(/\|/g, '/')} |`).join('\n')}

Overall: **${allPass ? 'PASS' : 'FAIL'}**
`,
  );
  console.log(JSON.stringify({ allPass, results }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
