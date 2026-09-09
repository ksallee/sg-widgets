/**
 * Svelte side of the demo client: `setContext`/`getContext` helpers.
 *
 * The root component of a demo calls `setDemoClient()` during init; anything below it
 * reads the client with `getSgClient()`. Both must run during component
 * initialisation, which is Svelte's own rule for context.
 */
import { getContext, setContext } from 'svelte';
import type { SgClient } from '@sg-widgets/core';
import { getDemoClient } from './client';

const KEY = Symbol('sg-widgets:demo-client');

/** Call in the root component of a demo. Defaults to the shared demo client. */
export function setDemoClient(client: SgClient = getDemoClient()): SgClient {
  setContext(KEY, client);
  return client;
}

export function getSgClient(): SgClient {
  const client = getContext<SgClient | undefined>(KEY);
  if (!client) throw new Error('getSgClient(): the demo root must call setDemoClient() during init.');
  return client;
}
