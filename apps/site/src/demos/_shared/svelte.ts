/**
 * Svelte side of the demo context: `setContext`/`getContext` helpers.
 *
 * The root component of a demo calls `setDemoContext()` during init; anything below it
 * reads the context with `getSgContext()`. Both must run during component
 * initialisation, which is Svelte's own rule for context.
 */
import { getContext, setContext } from 'svelte';
import { getDemoContext, type DemoContext } from './client';

const KEY = Symbol('sg-widgets:demo-context');

/** Call in the root component of a demo. Defaults to the shared demo context. */
export function setDemoContext(context: DemoContext = getDemoContext()): DemoContext {
  setContext(KEY, context);
  return context;
}

export function getSgContext(): DemoContext {
  const context = getContext<DemoContext | undefined>(KEY);
  if (!context) throw new Error('getSgContext(): the demo root must call setDemoContext() during init.');
  return context;
}
