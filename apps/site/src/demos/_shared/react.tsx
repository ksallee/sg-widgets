/**
 * React side of the demo client: a provider and a hook.
 *
 * A React demo wraps its tree in `<DemoClientProvider>` and every component below it
 * reads the client with `useSgClient()`. Widgets take the client however their own API
 * says; this is only how the *demo* gets hold of one.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { SgClient } from '@sg-widgets/core';
import { getDemoClient } from './client';

const SgClientContext = createContext<SgClient | null>(null);

export function DemoClientProvider({
  client,
  children,
}: {
  /** Defaults to the shared demo client. Pass one to give a demo its own fixtures. */
  client?: SgClient;
  children: ReactNode;
}) {
  return <SgClientContext.Provider value={client ?? getDemoClient()}>{children}</SgClientContext.Provider>;
}

export function useSgClient(): SgClient {
  const client = useContext(SgClientContext);
  if (!client) throw new Error('useSgClient() must be called inside <DemoClientProvider>.');
  return client;
}
