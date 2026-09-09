/**
 * The client every demo on this site runs against.
 *
 * By default demos never talk to a real Flow PT site: they need rows that are
 * identical on every run, look right in a screenshot, and cannot fail in CI.
 * `MockClient` from `@sg-widgets/core` is that site -- fixtures generated from a
 * seed, shaped exactly as the REST API returns them -- and `createQueryCache`
 * wraps it the way a real app is expected to, so demos exercise the deduping and
 * caching path rather than a shortcut. `latencyMs` is deliberately non-zero: a
 * widget's loading state is part of what a reviewer is here to look at.
 *
 * The header's Connect control swaps that for a real site; see `./live`. Every
 * function here answers the live client in that mode, so a demo asks for its
 * client once and does not care which site it got.
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
import { demoProject, isLive, liveClient, liveContext } from './live';

/** The project the mock fixtures are built around. */
const MOCK_PROJECT_ID = 70;

let singleton: SgClient | undefined;

/** The one client every demo on this site shares. */
export function getDemoClient(): SgClient {
  if (isLive()) return liveClient();
  singleton ??= createQueryCache(new MockClient({ seed: 1, latencyMs: 150 }));
  return singleton;
}

/** A context, and the project a demo on it should read. */
export interface DemoContext extends SgContext {
  /** True when the rows come from a real site. */
  live: boolean;
  /** The project to scope to: the Connect panel's pick in live mode, the mock's own otherwise. */
  projectId: number;
  /** The same, for a demo that names a second mock project of its own. */
  projectFor(mockId: number): number;
}

function scoped(context: SgContext, live: boolean): DemoContext {
  const picked = demoProject()?.id;
  const projectFor = (mockId: number): number => (live && picked !== undefined ? picked : mockId);
  return { ...context, live, projectId: projectFor(MOCK_PROJECT_ID), projectFor };
}

/**
 * A context of its own, for a demo whose fixtures differ from the shared site's.
 * `counts` scales a type: the table demo needs more Versions than the 60 the
 * default site has, so its virtualisation has something to virtualise. Live mode
 * has one site and one set of rows, so the options are ignored there.
 */
export function createDemoContext(options: MockClientOptions = {}): DemoContext {
  if (isLive()) return scoped(liveContext(), true);
  return scoped(createSgContext({ client: new MockClient({ seed: 1, latencyMs: 150, ...options }) }), false);
}

/**
 * A demo's own mock client, for a demo that arms a failure with `failNext` or
 * wants different fixtures. The shared one is never armed: a failure on it would
 * land in whichever demo asked next. This one stays on the mock in live mode --
 * an armed failure is a fixture, not something to ask a site for.
 */
export function createDemoClient(options: MockClientOptions = {}): { mock: MockClient; client: SgClient } {
  const mock = new MockClient({ seed: 1, latencyMs: 150, ...options });
  return { mock, client: createQueryCache(mock) };
}
