/**
 * React side of the demo context: a provider and a hook.
 *
 * A React demo wraps its tree in `<DemoContextProvider>` and every component below it
 * reads the context with `useSgContext()`. Widgets take the context however their own
 * API says; this is only how the *demo* gets hold of one.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { getDemoContext, type DemoContext } from './client';

const SgContextContext = createContext<DemoContext | null>(null);

export function DemoContextProvider({
  context,
  children,
}: {
  /** Defaults to the shared demo context. Pass one to give a demo its own fixtures. */
  context?: DemoContext;
  children: ReactNode;
}) {
  return <SgContextContext.Provider value={context ?? getDemoContext()}>{children}</SgContextContext.Provider>;
}

export function useSgContext(): DemoContext {
  const context = useContext(SgContextContext);
  if (!context) throw new Error('useSgContext() must be called inside <DemoContextProvider>.');
  return context;
}
