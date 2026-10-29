#!/usr/bin/env node
/**
 * Static Expo web export for GitHub Pages and Vercel.
 *
 * Base path:
 *   - Vercel (VERCEL=1) or EXPO_BASE_URL=/  → assets at /
 *   - EXPO_BASE_URL=/javas/oracle           → GitHub Pages path
 *   - default: /javas/oracle (Pages)
 *
 * Output: dist-web-pages/
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');
const outDir = path.join(appRoot, 'dist-web-pages');
const appJsonPath = path.join(appRoot, 'app.json');

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

/** Load publishable Supabase env for Metro inlining. Never load secret into EXPO_PUBLIC_*. */
function loadSupabasePublishableEnv() {
  loadEnvFile(path.join(appRoot, '.env'));
  loadEnvFile(path.join(repoRoot, '.env'));
  loadEnvFile('/cursor/stores/self/internal/supabase-credentials.env');

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const pub =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  const syncEmail =
    process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL || process.env.ORACLE_SYNC_EMAIL || '';
  const syncPass =
    process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD || process.env.ORACLE_SYNC_PASSWORD || '';

  if (url) process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  if (pub) process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = pub;
  if (syncEmail) process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL = syncEmail;
  if (syncPass) process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD = syncPass;

  // Hard guarantee: never promote secret → public
  delete process.env.EXPO_PUBLIC_SUPABASE_SECRET_KEY;
  delete process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  console.log(
    `[export-web] supabase url=${process.env.EXPO_PUBLIC_SUPABASE_URL ? 'yes' : 'no'} publishable=${process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? 'yes' : 'no'} sync=${process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL ? 'yes' : 'no'}`,
  );
}

function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_BASE_URL || process.env.EXPO_PUBLIC_BASE;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    const v = fromEnv.trim();
    if (v === '/' || v === '') return '/';
    return v.replace(/\/$/, '');
  }
  // Vercel / most hosts serve at domain root
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') return '/';
  return '/javas/oracle';
}

function patchAppJson(baseUrl) {
  const raw = fs.readFileSync(appJsonPath, 'utf8');
  const json = JSON.parse(raw);
  json.expo = json.expo || {};
  if (baseUrl === '/') {
    // Root deploy — omit baseUrl so assets resolve from /
    if (json.expo.experiments) {
      delete json.expo.experiments.baseUrl;
      if (Object.keys(json.expo.experiments).length === 0) delete json.expo.experiments;
    }
  } else {
    json.expo.experiments = { ...(json.expo.experiments || {}), baseUrl };
  }
  json.expo.userInterfaceStyle = 'dark';
  json.expo.web = { ...(json.expo.web || {}), backgroundColor: '#000000', bundler: 'metro' };
  fs.writeFileSync(appJsonPath, `${JSON.stringify(json, null, 2)}\n`);
  return raw;
}

function runExport() {
  const env = { ...process.env, CI: '1' };
  const localExpo = path.join(appRoot, 'node_modules', '.bin', 'expo');
  const cmd = fs.existsSync(localExpo) ? localExpo : 'npx';
  const args = fs.existsSync(localExpo)
    ? ['export', '--platform', 'web', '--output-dir', 'dist-web-pages']
    : ['--no-install', 'expo', 'export', '--platform', 'web', '--output-dir', 'dist-web-pages'];
  const r = spawnSync(cmd, args, {
    cwd: appRoot,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (r.status !== 0) {
    throw new Error(`expo export failed with status ${r.status ?? 'unknown'}`);
  }
}

function patchIndexHtml(baseUrl, forPages) {
  const indexPath = path.join(outDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const darkCss = `
    <style id="expo-reset">
      html, body, #root {
        height: 100%;
        min-height: 100%;
        background-color: #000000 !important;
        color: #FFFFFF;
      }
      html { background: #000000; }
      body {
        margin: 0;
        overflow: hidden !important;
        background-color: #000000 !important;
        color: #FFFFFF;
        overscroll-behavior: none;
      }
      #root {
        display: flex;
        height: 100% !important;
        max-height: 100%;
        flex: 1;
        background-color: #000000 !important;
      }
      [data-auth-scroll="1"] {
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y;
        overscroll-behavior: contain;
      }
      input, textarea { color-scheme: dark; caret-color: #fff; }
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      select:-webkit-autofill {
        -webkit-text-fill-color: #FFFFFF !important;
        caret-color: #FFFFFF !important;
        transition: background-color 99999s ease-out 0s;
        box-shadow: 0 0 0px 1000px #0C0E14 inset !important;
        background-color: #0C0E14 !important;
      }
    </style>`;
  html = html.replace(/<style id="expo-reset">[\s\S]*?<\/style>/, darkCss.trim());
  if (!html.includes('Cache-Control')) {
    html = html.replace(
      '<meta charset="utf-8" />',
      '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />\n    <meta charset="utf-8" />',
    );
  }
  const v = String(Date.now());
  html = html.replace(/(src="[^"]+\.js)(\?v=\d+)?"/g, `$1?v=${v}"`);
  if (forPages) {
    html = html.replace(/\/_expo\//g, '/expo/').replace(/\/javas\/oracle\/_expo\//g, '/javas/oracle/expo/');
  }
  fs.writeFileSync(indexPath, html);
}

function postProcessForPages() {
  const underscored = path.join(outDir, '_expo');
  const expoDir = path.join(outDir, 'expo');
  if (fs.existsSync(underscored)) {
    if (fs.existsSync(expoDir)) fs.rmSync(expoDir, { recursive: true, force: true });
    fs.renameSync(underscored, expoDir);
    const jsDir = path.join(expoDir, 'static/js/web');
    if (fs.existsSync(jsDir)) {
      for (const name of fs.readdirSync(jsDir)) {
        if (!name.endsWith('.js')) continue;
        const fp = path.join(jsDir, name);
        let js = fs.readFileSync(fp, 'utf8');
        if (js.includes('/_expo/')) {
          js = js.replace(/\/_expo\//g, '/expo/');
          fs.writeFileSync(fp, js);
        }
      }
    }
  }
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
}

function copyCloudStoreFallback() {
  const candidates = [
    path.join(repoRoot, 'docs/oracle/cloud-store.json'),
    path.join(appRoot, 'cloud-store.json'),
  ];
  for (const src of candidates) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(outDir, 'cloud-store.json'));
      return;
    }
  }
}

function assertNoSecretInBundle() {
  const jsDirCandidates = [
    path.join(outDir, 'expo/static/js/web'),
    path.join(outDir, '_expo/static/js/web'),
  ];
  const needle = process.env.SUPABASE_SECRET_KEY || '';
  if (!needle || needle.length < 12) return;
  for (const jsDir of jsDirCandidates) {
    if (!fs.existsSync(jsDir)) continue;
    for (const name of fs.readdirSync(jsDir)) {
      if (!name.endsWith('.js')) continue;
      const js = fs.readFileSync(path.join(jsDir, name), 'utf8');
      if (js.includes(needle)) {
        throw new Error('Refusing to ship: SUPABASE_SECRET_KEY found in web bundle');
      }
    }
  }
}

function main() {
  loadSupabasePublishableEnv();
  const baseUrl = resolveBaseUrl();
  const forPages = baseUrl !== '/' && baseUrl.includes('/javas/');
  console.log(`[export-web] baseUrl=${baseUrl} host=${forPages ? 'pages' : 'vercel-root'}`);

  const previous = patchAppJson(baseUrl);
  try {
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    runExport();
    if (forPages) postProcessForPages();
    patchIndexHtml(baseUrl, forPages);
    copyCloudStoreFallback();
    fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    assertNoSecretInBundle();

    const indexHtml = path.join(outDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      throw new Error(`missing index.html in ${outDir}`);
    }
    console.log('[export-web] ok →', outDir);
    console.log('[export-web] files:', fs.readdirSync(outDir).join(', '));
  } catch (err) {
    console.error('[export-web]', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(appJsonPath, previous.endsWith('\n') ? previous : `${previous}\n`);
  }
}

main();
