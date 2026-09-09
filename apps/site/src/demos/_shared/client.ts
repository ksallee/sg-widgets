/**
 * The client every demo on this site runs against.
 *
 * Demos never talk to a real Flow PT site: they need rows that are identical on every
 * run, look right in a screenshot, and cannot fail in CI. `MockClient` from
 * `@sg-widgets/core` is that site -- fixtures generated from a seed, shaped exactly as
 * the REST API returns them -- and `createQueryCache` wraps it the way a real app is
 * expected to, so demos exercise the deduping and caching path rather than a
 * shortcut. `latencyMs` is deliberately non-zero: a widget's loading state is part of
 * what a reviewer is here to look at.
 *
 * This lives in the site, not in the packages: choosing fixtures is a docs concern.
 */
import {
  createQueryCache,
  createSgContext,
  MockClient,
  type MockClientOptions,
  type SgClient,
  type SgContext,
} from '@sg-widgets/core';

let singleton: SgClient | undefined;

/** The one client every demo on this site shares. */
export function getDemoClient(): SgClient {
  singleton ??= createQueryCache(new MockClient({ seed: 1, latencyMs: 150 }));
  return singleton;
}

/**
 * A context of its own, for a demo whose fixtures differ from the shared site's.
 * `counts` scales a type: the table demo needs more Versions than the 60 the
 * default site has, so its virtualisation has something to virtualise.
 */
export function createDemoContext(options: MockClientOptions = {}): SgContext {
  return createSgContext({ client: new MockClient({ seed: 1, latencyMs: 150, ...options }) });
}

/**
 * A demo's own client, for a demo that arms a failure with `failNext` or wants
 * different fixtures. The shared one is never armed: a failure on it would land
 * in whichever demo asked next.
 */
export function createDemoClient(options: MockClientOptions = {}): { mock: MockClient; client: SgClient } {
  const mock = new MockClient({ seed: 1, latencyMs: 150, ...options });
  return { mock, client: createQueryCache(mock) };
}
