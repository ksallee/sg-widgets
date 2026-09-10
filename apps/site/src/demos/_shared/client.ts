/**
 * The context every demo on this site runs against.
 *
 * By default demos never talk to a real Flow PT site: they need rows that are
 * identical on every run, look right in a screenshot, and cannot fail in CI.
 * `MockClient` from `@sg-widgets/core` is that site -- fixtures generated from a
 * seed, shaped exactly as the REST API returns them -- and `createSgContext`
 * wraps it the way a real app is expected to, so demos exercise the caching path
 * a widget's contract assumes rather than a shortcut. `latencyMs` is deliberately
 * non-zero: a widget's loading state is part of what a reviewer is here to look at.
 *
 * The header's Connect control swaps that for a real site; see `./live`. Every
 * function here answers the live context in that mode, so a demo asks for its
 * context once and does not care which site it got.
 *
 * This lives in the site, not in the packages: choosing fixtures is a docs concern.
 */
import {
  createSgContext,
  MockClient,
  MOCK_NOW,
  type MockClientOptions,
  type SgClient,
  type SgContext,
} from '@sg-widgets/core';
import { demoProject, isLive, liveContext } from './live';

/** The project the mock fixtures are built around. */
const MOCK_PROJECT_ID = 70;

/**
 * The options every mock client on this site is built with. The clock is pinned to the
 * day the fixtures are dated around, so a relative or calendar date filter lands on rows
 * and answers the same thing on every run.
 */
const MOCK: MockClientOptions = { seed: 1, latencyMs: 150, now: MOCK_NOW };

/**
 * Calls that reached the mock, by method name, published as `window.sgDemoReads`.
 * A drive under `tools/drives` reads it to check what a page cost: "two status
 * pickers, one statuses read" is a claim only a count can settle. Live mode counts
 * nothing -- the site answers there, and its requests are on the network panel.
 */
const reads: Record<string, number> = {};

function counting(mock: MockClient): SgClient {
  return new Proxy(mock, {
    get(target, key, receiver): unknown {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function' || typeof key !== 'string') return value;
      return (...args: unknown[]): unknown => {
        reads[key] = (reads[key] ?? 0) + 1;
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as SgClient;
}

if (typeof window !== 'undefined') (window as unknown as { sgDemoReads: typeof reads }).sgDemoReads = reads;

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
  return scoped(createSgContext({ client: counting(new MockClient({ ...MOCK, ...options })) }), false);
}

let singleton: DemoContext | undefined;

/** The one context every demo on this site shares: one cache, one schema read, one status table. */
export function getDemoContext(): DemoContext {
  if (isLive()) return scoped(liveContext(), true);
  singleton ??= createDemoContext();
  return singleton;
}

/**
 * A demo's own mock and the context over it, for a demo that arms a failure with `failNext` or
 * wants different fixtures. The shared one is never armed: a failure on it would
 * land in whichever demo asked next. This one stays on the mock in live mode --
 * an armed failure is a fixture, not something to ask a site for.
 */
export function createDemoClient(options: MockClientOptions = {}): {
  mock: MockClient;
  context: DemoContext;
  client: SgClient;
} {
  const mock = new MockClient({ ...MOCK, ...options });
  const context = scoped(createSgContext({ client: counting(mock) }), false);
  return { mock, context, client: context.client };
}
