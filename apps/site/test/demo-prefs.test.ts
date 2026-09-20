/**
 * The framework pick, with and without `PUBLIC_SG_DEMO_BOTH`.
 *
 * `both` is the two-pane stage, which is development-only. A published page offers the
 * two frameworks, opens on React, and reads a stored `both` as React.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Load demo-prefs against one environment and one set of stored keys. */
async function load(both: boolean, stored: Record<string, string> = {}) {
  vi.stubEnv('PUBLIC_SG_DEMO_BOTH', both ? '1' : '');
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  });
  vi.resetModules();
  return import('../src/components/demo-prefs');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the framework pick', () => {
  it('offers the two frameworks and opens on React', async () => {
    const { frameworks, defaultFramework, prefs } = await load(false);
    expect(frameworks).toEqual(['svelte', 'react']);
    expect(defaultFramework).toBe('react');
    expect(prefs.framework).toBe('react');
  });

  it('reads a stored `both` as React', async () => {
    const { prefs } = await load(false, { 'sg-demo:framework': 'both' });
    expect(prefs.framework).toBe('react');
  });

  it('refuses `both`', async () => {
    const { prefs, setPref } = await load(false);
    setPref('framework', 'both');
    expect(prefs.framework).toBe('react');
  });

  it('keeps a stored framework', async () => {
    const { prefs } = await load(false, { 'sg-demo:framework': 'svelte' });
    expect(prefs.framework).toBe('svelte');
  });

  it('adds `both` when PUBLIC_SG_DEMO_BOTH is set', async () => {
    const { frameworks, defaultFramework, prefs } = await load(true, { 'sg-demo:framework': 'both' });
    expect(frameworks).toEqual(['svelte', 'react', 'both']);
    expect(defaultFramework).toBe('both');
    expect(prefs.framework).toBe('both');
  });
});
