import { afterEach, describe, expect, it, vi } from 'vitest';
import { SgApiError } from '../src/client.js';
import { AppSessionError, createSessionTokenAuth, pollAppSession, requestAppSession } from '../src/session-auth.js';

const SITE = 'https://studio.example.com';

interface Call {
  url: string;
  method: string;
  body: Record<string, string>;
  headers: Record<string, string>;
}

/** A `fetch` fake answering scripted responses, shaped like the corpus bodies. */
function faked(answers: Array<{ status?: number; body: unknown }>): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const answer = answers[Math.min(i, answers.length - 1)];
    i += 1;
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: Object.fromEntries(new URLSearchParams(String(init?.body ?? ''))),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(answer?.body ?? null), { status: answer?.status ?? 200 });
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}

/** The token endpoint's 200, `expires_in` 600. */
function minted(n: number): { body: unknown } {
  return { body: { token_type: 'Bearer', access_token: `access${n}`, expires_in: 600, refresh_token: `refresh${n}` } };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('session token auth', () => {
  it('mints a bearer, form-encoded, at the session_token grant', async () => {
    const { fetch, calls } = faked([minted(1)]);
    const token = createSessionTokenAuth({ siteUrl: SITE, sessionToken: 'sess', fetch });
    expect(await token()).toBe('access1');
    expect(calls[0]?.url).toBe(`${SITE}/api/v1/auth/access_token`);
    expect(calls[0]?.method).toBe('POST');
    // `application/json` is 415 naming the one legal content type.
    expect(calls[0]?.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0]?.body).toEqual({ grant_type: 'session_token', session_token: 'sess' });
  });

  it('holds the bearer, then refreshes a minute before it expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { fetch, calls } = faked([minted(1), minted(2)]);
    const token = createSessionTokenAuth({ siteUrl: SITE, sessionToken: 'sess', fetch });
    expect(await token()).toBe('access1');

    vi.setSystemTime(539_000);
    expect(await token()).toBe('access1');
    expect(calls).toHaveLength(1);

    vi.setSystemTime(541_000);
    expect(await token()).toBe('access2');
    expect(calls[1]?.body).toEqual({ grant_type: 'refresh_token', refresh_token: 'refresh1' });
  });

  it('shares one mint between concurrent callers', async () => {
    const { fetch, calls } = faked([minted(1)]);
    const token = createSessionTokenAuth({ siteUrl: SITE, sessionToken: 'sess', fetch });
    expect(await Promise.all([token(), token(), token()])).toEqual(['access1', 'access1', 'access1']);
    expect(calls).toHaveLength(1);
  });

  it('re-mints from the session token when the refresh is refused', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { fetch, calls } = faked([
      minted(1),
      { status: 400, body: { errors: [{ status: 400, title: 'Missing or invalid authentication arguments' }] } },
      minted(3),
    ]);
    const token = createSessionTokenAuth({ siteUrl: SITE, sessionToken: 'sess', fetch });
    await token();
    vi.setSystemTime(600_000);
    expect(await token()).toBe('access3');
    expect(calls.map((c) => c.body['grant_type'])).toEqual(['session_token', 'refresh_token', 'session_token']);
  });

  it('reports a refused session token as an SgApiError', async () => {
    const { fetch } = faked([{ status: 400, body: { errors: [{ status: 400, title: 'Unsupported grant_type' }] } }]);
    const token = createSessionTokenAuth({ siteUrl: SITE, sessionToken: 'stale', fetch });
    const error = await token().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SgApiError);
    expect((error as SgApiError).status).toBe(400);
    expect((error as SgApiError).message).toBe('Unsupported grant_type');
  });
});

describe('app session launcher', () => {
  it('asks for a request and hands back the id and the url a person opens', async () => {
    const { fetch, calls } = faked([{ body: { sessionRequestId: 'abc', url: `${SITE}/app_session_request/abc?sticky_id=abc` } }]);
    const request = await requestAppSession({ siteUrl: SITE, appName: 'my tool', machineId: 'host-1', fetch });
    expect(request).toEqual({ id: 'abc', url: `${SITE}/app_session_request/abc?sticky_id=abc` });
    // Outside `/api/v1`, no token and no cookie.
    expect(calls[0]?.url).toBe(`${SITE}/internal_api/app_session_request`);
    expect(calls[0]?.body).toEqual({ appName: 'my tool', machineId: 'host-1' });
  });

  it('reports the missing-params 400, which is not the errors[] envelope', async () => {
    const { fetch } = faked([{ status: 400, body: { message: 'Missing params: appName, machineId' } }]);
    const error = await requestAppSession({ siteUrl: SITE, appName: '', machineId: '', fetch }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SgApiError);
    expect((error as SgApiError).message).toBe('Missing params: appName, machineId');
  });

  it('polls until approved and keeps the one response holding the token', async () => {
    const { fetch, calls } = faked([
      { body: { approved: false } },
      { body: { approved: false } },
      { body: { approved: true, sessionToken: 'sess', userLogin: 'person@example.com' } },
    ]);
    const session = await pollAppSession({ siteUrl: SITE, id: 'abc', fetch, intervalMs: 0 });
    expect(session).toEqual({ sessionToken: 'sess', userLogin: 'person@example.com' });
    expect(calls).toHaveLength(3);
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.url).toBe(`${SITE}/internal_api/app_session_request/abc`);
  });

  it('says to request again on the 404, which forgotten, denied and mistyped all read', async () => {
    const { fetch } = faked([{ status: 404, body: { message: 'Not Found' } }]);
    const error = await pollAppSession({ siteUrl: SITE, id: 'gone', fetch, intervalMs: 0 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppSessionError);
    expect((error as AppSessionError).reason).toBe('not_found');
    expect((error as AppSessionError).message).toMatch(/Request a new one/);
  });

  it('gives up when nobody approves', async () => {
    const { fetch } = faked([{ body: { approved: false } }]);
    const error = await pollAppSession({ siteUrl: SITE, id: 'abc', fetch, intervalMs: 5, timeoutMs: 0 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppSessionError);
    expect((error as AppSessionError).reason).toBe('timeout');
  });
});
