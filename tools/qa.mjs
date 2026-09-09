#!/usr/bin/env node
// Drive the docs site headless and print only what was asked for.
//
//   node tools/qa.mjs --url http://127.0.0.1:4321/widgets/ --shot out.png
//   node tools/qa.mjs --start --path /widgets/status-badge/ --drive drive.js --dark --reduced-motion
//
// --start builds nothing: it runs `astro dev` on a free port with its own .astro dir, so two agents
// never share a server. Without it, --url (or --path on --base, default http://127.0.0.1:4321) is used.
//
// The drive file is the body of an async function receiving ({wait, $, $$, harness}). `harness.set`
// writes the demo toolbar's localStorage keys (framework: svelte|react|both, theme: light|dark,
// motion: normal|reduced, palette: default|stone|..., radius: default|none|sm|md|lg|xl) and the
// toolbar re-reads them at once; the flags below set them for the initial load. Whatever the body
// returns is printed as JSON under `result`, next to `console` (errors and warnings only) and
// `shot`/`video` paths.
//
// --live runs the demos against the site named by the repo's .env.local instead of the mock, through
// the dev-only /live/dev-token endpoint, so it needs a dev server (--start, or --url on one).
// --project <id> scopes the project-aware demos to one project of that site. Exit code is 1 when the page threw, a console error was logged, or the result carries
// `verdict` starting with FAIL.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = resolve(ROOT, 'apps/site');

function args(argv) {
  const a = { base: 'http://127.0.0.1:4321', path: '/', viewport: '1200x900', timeout: 30000 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    switch (k) {
      case '--url': a.url = next(); break;
      case '--base': a.base = next(); break;
      case '--path': a.path = next(); break;
      case '--start': a.start = true; break;
      case '--drive': a.drive = next(); break;
      case '--shot': a.shot = next(); break;
      case '--video': a.video = next(); break;
      case '--viewport': a.viewport = next(); break;
      case '--timeout': a.timeout = Number(next()); break;
      case '--dark': a.dark = true; break;
      case '--reduced-motion': a.reducedMotion = true; break;
      case '--framework': a.framework = next(); break;
      case '--live': a.live = true; break;
      case '--project': a.project = next(); break;
      case '--keep': a.keep = true; break;
      case '--headed': a.headed = true; break;
      default: throw new Error(`unknown flag ${k}`);
    }
  }
  return a;
}

// Each checkout starts its search at its own port so two worktrees never race for one.
function portBase() {
  let h = 0;
  for (const ch of ROOT) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 4400 + (h % 400);
}

function freePort(start = portBase()) {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once('error', () => res(freePort(start + 1)));
    s.listen(start, '127.0.0.1', () => s.close(() => res(start)));
  });
}

async function startSite(port) {
  const proc = spawn('./node_modules/.bin/astro', ['dev', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: SITE,
    env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Nothing reads the child's output, and an unread pipe fills at 64KB and blocks
  // the writer, so astro dev would stop answering mid-run. Drain both.
  proc.stdout.resume();
  proc.stderr.resume();
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) return proc;
    } catch {}
    if (proc.exitCode !== null) throw new Error(`astro dev exited ${proc.exitCode}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  proc.kill();
  throw new Error('astro dev did not become ready in 60s');
}

function boot(ctx) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const harness = {
    set(prefs) {
      for (const [k, v] of Object.entries(prefs)) localStorage.setItem('sg-demo:' + k, JSON.stringify(v));
      window.dispatchEvent(new StorageEvent('storage'));
    },
  };
  const fn = new Function('ctx', 'return (async () => { const {wait, $, $$, harness} = ctx; ' + ctx.drive + ' })()');
  return fn({ wait, $, $$, harness });
}

async function main() {
  const a = args(process.argv.slice(2));
  const [vw, vh] = a.viewport.split('x').map(Number);
  let proc = null;
  let url = a.url;
  if (a.start) {
    const port = await freePort();
    proc = await startSite(port);
    url = `http://127.0.0.1:${port}${a.path}`;
  } else if (!url) {
    url = a.base.replace(/\/$/, '') + a.path;
  }
  const drive = a.drive ? (a.drive === '-' ? readFileSync(0, 'utf8') : readFileSync(a.drive, 'utf8')) : 'return {};';

  const browser = await chromium.launch({ headless: !a.headed });
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    colorScheme: a.dark ? 'dark' : 'light',
    reducedMotion: a.reducedMotion ? 'reduce' : 'no-preference',
    ...(a.video ? { recordVideo: { dir: dirname(resolve(a.video)), size: { width: vw, height: vh } } } : {}),
  });
  // Demo.astro stores raw strings under these keys; keep them in sync with its KEYS table.
  const prefs = {};
  if (a.framework) prefs.framework = a.framework;
  // Live mode reads the site through /live/dev-token, which only `astro dev` answers.
  if (a.live) prefs.source = 'live';
  if (a.project) prefs.project = JSON.stringify({ id: Number(a.project) });
  if (a.dark) prefs.theme = 'dark';
  if (a.reducedMotion) prefs.motion = 'reduced';
  if (Object.keys(prefs).length) {
    await ctx.addInitScript((p) => {
      for (const [k, v] of Object.entries(p)) localStorage.setItem('sg-demo:' + k, v);
    }, prefs);
  }
  const page = await ctx.newPage();
  const consoleLog = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleLog.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleLog.push(`pageerror: ${e.message}`));

  const out = { url };
  let failed = false;
  try {
    // A cold `astro dev` answers the first request for a route it has not synced yet
    // with its 404 page, then restarts itself once the sync lands, so a retry has to
    // survive the server being down for a moment as well.
    let response = await page.goto(url, { waitUntil: 'networkidle', timeout: a.timeout });
    for (let attempt = 0; attempt < 10 && (response === null || response.status() === 404); attempt++) {
      await page.waitForTimeout(1000);
      try {
        response = await page.goto(url, { waitUntil: 'networkidle', timeout: a.timeout });
      } catch {
        response = null;
      }
    }
    out.result = await page.evaluate(boot, { drive });
    if (a.shot) {
      mkdirSync(dirname(resolve(a.shot)), { recursive: true });
      await page.screenshot({ path: a.shot, fullPage: false });
      out.shot = a.shot;
    }
  } catch (e) {
    out.error = String(e?.message ?? e);
    failed = true;
  }
  out.console = consoleLog;
  const video = a.video ? page.video() : null;
  await ctx.close();
  if (video) {
    const src = await video.path();
    const { renameSync } = await import('node:fs');
    renameSync(src, resolve(a.video));
    out.video = a.video;
  }
  await browser.close();
  if (proc && !a.keep) proc.kill();
  if (proc && a.keep) out.server = url;
  if (consoleLog.some((l) => l.startsWith('error') || l.startsWith('pageerror'))) failed = true;
  if (typeof out.result?.verdict === 'string' && out.result.verdict.startsWith('FAIL')) failed = true;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { process.stderr.write(String(e?.stack ?? e) + '\n'); process.exit(2); });
