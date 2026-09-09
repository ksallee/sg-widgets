/**
 * Live mode: the demos on this site, reading a real Flow PT site.
 *
 * The header's Mock/Live control writes `sg-demo:source`, and in `live` every
 * demo runs against `RestClient` instead of the mock. The browser calls
 * `/api/v1` itself: every path there answers an OPTIONS preflight with the
 * request origin echoed, `allow-credentials: true`, methods GET POST PUT PATCH
 * DELETE and headers authorization,content-type (probe 062). A request header
 * outside that set drops every CORS header from the answer, so browser calls
 * carry nothing but the ones `RestClient` already sends, and no response header
 * is exposed to script. `/internal_api/app_session_request` answers with no CORS
 * headers at all, so the launcher's two calls go through this site's own
 * endpoints under `/live/`, which hold nothing.
 *
 * The bearer comes from one of two places. In `astro dev`, `/live/dev-token`
 * mints one from the script key in `.env.local`, so local QA needs no login;
 * that endpoint is 404 in a production build. Otherwise it is minted in the
 * browser from a session token the person approved through the App Session
 * Launcher (probe 052), kept in `localStorage` under `sg-demo:session`.
 */
import { createSessionTokenAuth, createSgContext, RestClient, type QueryCache, type SgContext } from '@sg-widgets/core';

const KEYS = {
  source: 'sg-demo:source',
  site: 'sg-demo:site',
  session: 'sg-demo:session',
  project: 'sg-demo:project',
} as const;

export type DemoSource = 'mock' | 'live';

/** A person's approved session. `token` is a credential: it stays in this browser. */
export interface DemoSession {
  siteUrl: string;
  token: string;
  login: string;
}

export interface DemoProject {
  id: number;
  name?: string;
}

/** What the Connect panel shows and what the live client was built from. */
export interface LiveState {
  source: DemoSource;
  siteUrl: string;
  session: DemoSession | null;
  /** True when `/live/dev-token` answered, so live mode works without a login. */
  devToken: boolean;
  project: DemoProject | null;
  /** Why live mode cannot read the site, when it cannot. */
  problem: string | null;
}

/* Storage. Values are raw strings or JSON; tools/qa.mjs writes JSON, so a quoted
 * value reads as the string inside. Blocked storage is a fallback, never a throw. */

function raw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function text(key: string): string | null {
  const value = raw(key);
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}

function json<T>(key: string): T | null {
  const value = raw(key);
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Persisting the view is a convenience, not a requirement. */
  }
}

export function demoSource(): DemoSource {
  return text(KEYS.source) === 'live' ? 'live' : 'mock';
}

export function setDemoSource(source: DemoSource): void {
  write(KEYS.source, source);
}

/** The site the Connect panel offers: the last one used, else the build's own default. */
export function demoSiteUrl(): string {
  return text(KEYS.site) ?? (import.meta.env.PUBLIC_FPT_SITE_URL as string | undefined) ?? '';
}

export function setDemoSiteUrl(siteUrl: string): void {
  write(KEYS.site, siteUrl.replace(/\/+$/, ''));
}

export function demoSession(): DemoSession | null {
  const stored = json<DemoSession>(KEYS.session);
  return stored?.siteUrl && stored.token && stored.login ? stored : null;
}

export function setDemoSession(session: DemoSession | null): void {
  write(KEYS.session, session === null ? null : JSON.stringify(session));
}

export function demoProject(): DemoProject | null {
  const stored = json<DemoProject>(KEYS.project);
  return stored && Number.isFinite(stored.id) ? { id: Number(stored.id), name: stored.name } : null;
}

export function setDemoProject(project: DemoProject | null): void {
  write(KEYS.project, project === null ? null : JSON.stringify(project));
}

/* Auth. */

interface DevToken {
  accessToken: string;
  expiresIn: number;
  siteUrl: string;
}

async function mintDevToken(): Promise<DevToken | null> {
  if (!import.meta.env.DEV) return null;
  try {
    // JSON, not a bare POST: Astro refuses a cross-site form submission and reads a
    // request with no content type as one.
    const res = await fetch('/live/dev-token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as DevToken;
    return body.accessToken && body.siteUrl ? body : null;
  } catch {
    return null;
  }
}

/** A bearer a minute before the old one dies, the rule `createSessionTokenAuth` follows. */
const EXPIRY_SKEW_MS = 60_000;

function devTokenAuth(first: DevToken): () => Promise<string> {
  let token = first.accessToken;
  let expiresAt = Date.now() + Math.max(first.expiresIn * 1000 - EXPIRY_SKEW_MS, 0);
  return async () => {
    if (Date.now() < expiresAt) return token;
    const next = await mintDevToken();
    if (!next) throw new Error('The dev token endpoint stopped answering.');
    token = next.accessToken;
    expiresAt = Date.now() + Math.max(next.expiresIn * 1000 - EXPIRY_SKEW_MS, 0);
    return token;
  };
}

/* The live context, built once per page load. */

let state: LiveState = { source: 'mock', siteUrl: '', session: null, devToken: false, project: null, problem: null };
let context: SgContext | null = null;
let ready: Promise<LiveState> | null = null;

async function resolve(): Promise<LiveState> {
  const source = demoSource();
  const project = demoProject();
  if (source !== 'live') return { source, siteUrl: demoSiteUrl(), session: null, devToken: false, project, problem: null };

  const dev = await mintDevToken();
  const session = demoSession();
  // The dev endpoint knows its own site, and it is the one its key opens.
  const siteUrl = dev?.siteUrl ?? session?.siteUrl ?? demoSiteUrl();
  if (dev) setDemoSiteUrl(dev.siteUrl);

  let token: (() => Promise<string>) | null = null;
  if (dev) token = devTokenAuth(dev);
  else if (session && session.siteUrl === siteUrl) token = createSessionTokenAuth({ siteUrl, sessionToken: session.token });

  // Live mode never silently answers with fixtures: with no site or no login every
  // read fails, and the widgets show the error state they show for any refusal.
  const problem = !siteUrl ? 'Live mode needs a site url.' : token ? null : 'Live mode needs a login.';
  const refuse = (): Promise<string> => Promise.reject(new Error(problem ?? 'Live mode is not ready.'));
  context = createSgContext({ client: new RestClient({ siteUrl, token: token ?? refuse }) });
  return { source, siteUrl, session, devToken: dev !== null, project, problem };
}

/**
 * Settle the source and its auth. The header control and the islands both wait on this,
 * so a demo is built against a client that is already able to read.
 */
export function prepareDemoSource(): Promise<LiveState> {
  ready ??= resolve().then((next) => {
    state = next;
    return next;
  });
  return ready;
}

export function liveState(): LiveState {
  return state;
}

export function isLive(): boolean {
  return state.source === 'live' && context !== null;
}

/** The one live context every demo on the page shares, so two demos cost one read. */
export function liveContext(): SgContext {
  if (!context) throw new Error('Live mode is not ready. Await prepareDemoSource() first.');
  return context;
}

export function liveClient(): QueryCache {
  return liveContext().client;
}

/* The App Session Launcher, through this site's endpoints. */

async function launcher<T>(path: string, body: Record<string, unknown>): Promise<{ status: number; body: T }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const answer = (await res.json().catch(() => null)) as T;
  return { status: res.status, body: answer };
}

/** Opens the approval page and resolves when the person has approved it. */
export async function logIn(siteUrl: string, open: (url: string) => void): Promise<DemoSession> {
  const site = siteUrl.replace(/\/+$/, '');
  const created = await launcher<{ id?: string; url?: string; message?: string }>('/live/session-request', {
    siteUrl: site,
    appName: 'sg-widgets docs',
    machineId: 'sg-widgets-docs',
  });
  if (created.status !== 200 || !created.body?.id || !created.body.url) {
    throw new Error(created.body?.message ?? 'The site did not offer an approval page.');
  }
  open(created.body.url);

  // A pending request lives about five minutes, then the poll turns 404 (probe 052).
  const deadline = Date.now() + 300_000;
  for (;;) {
    await new Promise((done) => setTimeout(done, 2000));
    const polled = await launcher<{ approved?: boolean; sessionToken?: string; userLogin?: string }>('/live/session-poll', {
      siteUrl: site,
      id: created.body.id,
    });
    if (polled.status === 404) {
      throw new Error('The approval page expired or was refused. Log in again.');
    }
    if (polled.status !== 200) throw new Error('The site stopped answering the approval poll.');
    if (polled.body?.approved && polled.body.sessionToken && polled.body.userLogin) {
      const session: DemoSession = { siteUrl: site, token: polled.body.sessionToken, login: polled.body.userLogin };
      setDemoSession(session);
      setDemoSiteUrl(site);
      return session;
    }
    if (Date.now() > deadline) throw new Error('Nobody approved the request. Log in again.');
  }
}

export function logOut(): void {
  setDemoSession(null);
}
