/**
 * Session-token auth, and the App Session Launcher that produces one.
 *
 * A person reaches the REST API with no script key and no password: request a
 * session, show them the url, poll until they approve, then spend the session
 * token at the token endpoint (probe 052). The session token is the credential
 * and the bearer is disposable: it lasts 600s, and every mint pushes the
 * session's own expiry out, so a token spent once a window never expires.
 *
 * `POST /auth/access_token` is form-encoded. `application/json` is 415 naming
 * the one legal content type.
 */
import { SgApiError } from './client.js';

/** Mint a bearer a minute before the old one dies: one call, and no refresh path to get wrong. */
const EXPIRY_SKEW_MS = 60_000;

export interface SessionTokenAuthOptions {
  /** Site root, e.g. `https://studio.shotgrid.autodesk.com`. */
  siteUrl: string;
  /** The launcher's `sessionToken`. A credential for the person who approved: store it where a key would be stored. */
  sessionToken: string;
  fetch?: typeof fetch;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (value === null || typeof value !== 'object') return false;
  const t = value as TokenResponse;
  return typeof t.access_token === 'string' && typeof t.expires_in === 'number';
}

/**
 * A `token()` for `RestClientOptions`. It mints a bearer, holds it until shortly
 * before it expires, refreshes with the refresh token, and re-mints from the
 * session token when the refresh is refused.
 */
export function createSessionTokenAuth(options: SessionTokenAuthOptions): () => Promise<string> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const url = `${options.siteUrl.replace(/\/+$/, '')}/api/v1/auth/access_token`;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt = 0;
  let pending: Promise<string> | null = null;

  async function post(form: Record<string, string>): Promise<TokenResponse> {
    const res = await fetchFn(url, {
      method: 'POST',
      // The only content type the endpoint accepts.
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const title = (body as { errors?: Array<{ title?: string }> } | null)?.errors?.[0]?.title;
      throw new SgApiError(res.status, body, title);
    }
    if (!isTokenResponse(body)) throw new SgApiError(res.status, body, 'Token response has no access_token');
    return body;
  }

  function keep(token: TokenResponse): string {
    accessToken = token.access_token;
    refreshToken = token.refresh_token ?? null;
    expiresAt = Date.now() + Math.max(token.expires_in * 1000 - EXPIRY_SKEW_MS, 0);
    return accessToken;
  }

  async function mint(): Promise<string> {
    if (refreshToken) {
      try {
        return keep(await post({ grant_type: 'refresh_token', refresh_token: refreshToken }));
      } catch {
        // A refused refresh is not fatal: minting from the session token does not consume it.
        refreshToken = null;
      }
    }
    return keep(await post({ grant_type: 'session_token', session_token: options.sessionToken }));
  }

  return function token(): Promise<string> {
    if (accessToken && Date.now() < expiresAt) return Promise.resolve(accessToken);
    // Concurrent callers share one mint.
    if (pending) return pending;
    const promise = mint().finally(() => {
      if (pending === promise) pending = null;
    });
    pending = promise;
    return promise;
  };
}

/** Why the launcher stopped. */
export type AppSessionFailure = 'not_found' | 'timeout';

export class AppSessionError extends Error {
  constructor(
    public readonly reason: AppSessionFailure,
    message: string,
  ) {
    super(message);
    this.name = 'AppSessionError';
  }
}

export interface RequestAppSessionOptions {
  siteUrl: string;
  /** The name shown to the person approving. */
  appName: string;
  /** Any string identifying this machine. The poll does not check it. */
  machineId: string;
  fetch?: typeof fetch;
}

export interface AppSessionRequest {
  id: string;
  /** The approval page. Show it to the person; opening a browser is the caller's business. */
  url: string;
}

/** The `/internal_api` surface answers `{"message": ...}`, never the `errors[]` envelope. */
async function internalApi(fetchFn: typeof fetch, url: string, method: string, form?: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const init: RequestInit = { method, headers: { Accept: 'application/json' } };
  if (form) {
    init.headers = { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams(form).toString();
  }
  const res = await fetchFn(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new SgApiError(res.status, body, (body as { message?: string } | null)?.message);
  return { status: res.status, body };
}

/** Step one: ask the site for an approval page. Takes no token and no cookie. */
export async function requestAppSession(options: RequestAppSessionOptions): Promise<AppSessionRequest> {
  const site = options.siteUrl.replace(/\/+$/, '');
  const { status, body } = await internalApi(options.fetch ?? globalThis.fetch, `${site}/internal_api/app_session_request`, 'POST', {
    appName: options.appName,
    machineId: options.machineId,
  });
  const answer = body as { sessionRequestId?: string; url?: string } | null;
  if (!answer?.sessionRequestId || !answer.url) {
    throw new SgApiError(status, body, 'App session request returned no sessionRequestId');
  }
  return { id: answer.sessionRequestId, url: answer.url };
}

export interface PollAppSessionOptions {
  siteUrl: string;
  /** `sessionRequestId` from `requestAppSession`. */
  id: string;
  fetch?: typeof fetch;
  /** Gap between polls. Default 2000. */
  intervalMs?: number;
  /** Give up after this long. Default 300000, the life of a pending request. */
  timeoutMs?: number;
}

export interface AppSession {
  sessionToken: string;
  /** On an Autodesk Identity site this is the person's email address. Treat it as identifying. */
  userLogin: string;
}

/**
 * Step two: poll until the person approves. The token is handed out once, so poll
 * from one place and keep the response that holds it. A 404 is forgotten, denied
 * or a mistyped id alike, so the only answer is to request a new session.
 */
export async function pollAppSession(options: PollAppSessionOptions): Promise<AppSession> {
  const site = options.siteUrl.replace(/\/+$/, '');
  const fetchFn = options.fetch ?? globalThis.fetch;
  const intervalMs = options.intervalMs ?? 2000;
  const deadline = Date.now() + (options.timeoutMs ?? 300_000);
  const url = `${site}/internal_api/app_session_request/${options.id}`;

  for (;;) {
    let body: { approved?: boolean; sessionToken?: string; userLogin?: string } | null;
    try {
      body = (await internalApi(fetchFn, url, 'PUT')).body as typeof body;
    } catch (error) {
      if (error instanceof SgApiError && error.status === 404) {
        throw new AppSessionError('not_found', 'The app session request is gone. Request a new one and show the person the new url.');
      }
      throw error;
    }
    if (body?.approved && body.sessionToken && body.userLogin) {
      return { sessionToken: body.sessionToken, userLogin: body.userLogin };
    }
    if (Date.now() + intervalMs > deadline) {
      throw new AppSessionError('timeout', 'Nobody approved the app session request. Request a new one and show the person the new url.');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
