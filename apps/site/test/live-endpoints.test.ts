/**
 * What the two launcher endpoints forward, and for whom.
 */
import { describe, expect, it } from 'vitest';
import { fromThisSite, siteFromBody } from '../src/pages/live/_launcher';
import { POST as sessionRequest } from '../src/pages/live/session-request';
import { POST as sessionPoll } from '../src/pages/live/session-poll';

const self = new URL('https://sg-widgets.vercel.app/live/session-request');

function call(body: unknown, origin: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  return new Request(self, { method: 'POST', headers, body: JSON.stringify(body) });
}

/** The handlers read `request` and `url` and nothing else of the context. */
function context(body: unknown, origin: string | null): never {
  return { request: call(body, origin), url: self } as never;
}

describe('the site a launcher call forwards to', () => {
  it('takes a site on either product domain', () => {
    expect(siteFromBody('https://studio.shotgunstudio.com')).toBe('https://studio.shotgunstudio.com');
    expect(siteFromBody('https://studio.shotgrid.autodesk.com/')).toBe('https://studio.shotgrid.autodesk.com');
  });

  it('refuses a host outside them', async () => {
    const answer = siteFromBody('https://example.com');
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(403);
  });

  it('refuses a host that only ends in one of them by accident', () => {
    expect(siteFromBody('https://notshotgunstudio.com')).toBeInstanceOf(Response);
  });

  it('refuses http, a missing value and a value that is not a url', () => {
    expect(siteFromBody('http://studio.shotgunstudio.com')).toBeInstanceOf(Response);
    expect(siteFromBody(undefined)).toBeInstanceOf(Response);
    expect(siteFromBody('studio.shotgunstudio.com')).toBeInstanceOf(Response);
  });
});

describe('the origin a launcher call comes from', () => {
  it('is this site', () => {
    expect(fromThisSite(call({}, 'https://sg-widgets.vercel.app'), self)).toBe(true);
    // The proxy terminates TLS, so the request the adapter builds may be http.
    expect(fromThisSite(call({}, 'https://sg-widgets.vercel.app'), new URL('http://sg-widgets.vercel.app/live/x'))).toBe(true);
  });

  it('is nothing else, and no origin is nothing else', () => {
    expect(fromThisSite(call({}, 'https://elsewhere.example'), self)).toBe(false);
    expect(fromThisSite(call({}, null), self)).toBe(false);
    expect(fromThisSite(call({}, 'null'), self)).toBe(false);
  });
});

describe('each endpoint', () => {
  const site = 'https://studio.shotgunstudio.com';
  const here = 'https://sg-widgets.vercel.app';

  it('answers 403 to a page on another site', async () => {
    const created = await sessionRequest(context({ siteUrl: site }, 'https://elsewhere.example'));
    expect(created.status).toBe(403);
    const polled = await sessionPoll(context({ siteUrl: site, id: 'abc' }, 'https://elsewhere.example'));
    expect(polled.status).toBe(403);
  });

  it('answers 403 to a site off the product domains', async () => {
    const created = await sessionRequest(context({ siteUrl: 'https://example.com' }, here));
    expect(created.status).toBe(403);
    const polled = await sessionPoll(context({ siteUrl: 'https://example.com', id: 'abc' }, here));
    expect(polled.status).toBe(403);
  });
});
