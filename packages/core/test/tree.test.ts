import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSchemaService } from '../src/schema-service.js';
import { createStatusService } from '../src/status-service.js';
import type { TreeEngine } from '../src/tree.js';
import { createTree, hierarchyLoader, resolveTreeFields } from '../src/tree.js';

const ROOT = '/Project/70';
const ASSETS = '/Project/70/Asset';
const SHOTS = '/Project/70/Shot';
const SEQUENCE = '/Project/70/Shot/sg_sequence/Sequence/100';
const SHOT = '/Project/70/Shot/sg_sequence/Sequence/100/id/862';

/** A tree over the mock hierarchy, and the calls it made. */
function tree(options: { now?: () => number } = {}): { engine: TreeEngine; calls: string[] } {
  const client = new MockClient();
  const calls: string[] = [];
  const load = hierarchyLoader(client);
  const engine = createTree({
    rootPath: ROOT,
    loader: (path) => {
      calls.push(path);
      return load(path);
    },
    ...options,
  });
  return { engine, calls };
}

function labels(engine: TreeEngine): string[] {
  return engine.snapshot().rows.map((row) => row.node.label);
}

function paths(engine: TreeEngine): string[] {
  return engine.snapshot().rows.map((row) => row.node.path);
}

describe('loading a level', () => {
  it('reads the root and opens it', async () => {
    const { engine, calls } = tree();
    expect(engine.snapshot().status).toBe('idle');
    await engine.load();
    expect(calls).toEqual([ROOT]);
    expect(engine.snapshot().status).toBe('ready');
    expect(labels(engine)).toEqual(['Blue Moon Rising', 'Assets', 'Shots']);
    expect(engine.snapshot().rows[0]?.node.level).toBe(0);
    expect(engine.snapshot().rows[1]?.node.level).toBe(1);
  });

  it('reads a level once, however often it is opened', async () => {
    const { engine, calls } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.collapse(ASSETS);
    await engine.expand(ASSETS);
    expect(calls).toEqual([ROOT, ASSETS]);
    expect(labels(engine)).toContain('charAda');
  });

  it('never opens a node with nothing under it', async () => {
    const { engine, calls } = tree();
    await engine.load();
    await engine.expand(SHOTS);
    const empty = engine.childPaths(SHOTS).length;
    expect(empty).toBeGreaterThan(0);
    calls.length = 0;
    // A sequence says it has children, an unread path says it has none.
    await engine.expand('/Project/70/nowhere');
    expect(calls).toEqual([]);
  });

  it('carries a loading flag on the node being read, and nowhere else', async () => {
    const client = new MockClient();
    const load = hierarchyLoader(client);
    let release = (): void => {};
    const engine = createTree({
      rootPath: ROOT,
      loader: async (path) => {
        if (path === ASSETS) await new Promise<void>((resolve) => (release = resolve));
        return load(path);
      },
    });
    await engine.load();
    const opening = engine.expand(ASSETS);
    const row = engine.snapshot().rows.find((r) => r.node.path === ASSETS);
    expect(row?.loading).toBe(true);
    expect(engine.snapshot().rows.find((r) => r.node.path === SHOTS)?.loading).toBe(false);
    release();
    await opening;
    expect(engine.snapshot().rows.find((r) => r.node.path === ASSETS)?.loading).toBe(false);
  });

  it('holds the error a failed read threw and keeps the rows it had', async () => {
    const client = new MockClient();
    const load = hierarchyLoader(client);
    const engine = createTree({
      rootPath: ROOT,
      loader: (path) => (path === ASSETS ? Promise.reject(new Error('no')) : load(path)),
    });
    await engine.load();
    await engine.expand(ASSETS);
    expect(engine.snapshot().error?.message).toBe('no');
    expect(engine.snapshot().status).toBe('ready');
    expect(labels(engine)).toEqual(['Blue Moon Rising', 'Assets', 'Shots']);
  });

  it('reports a root that is not there', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: '/Project/999999999', loader: hierarchyLoader(client) });
    await engine.load();
    expect(engine.snapshot().status).toBe('error');
    expect(engine.snapshot().rows).toEqual([]);
  });

  it('tells a subscriber every time the state moves', async () => {
    const { engine } = tree();
    let seen = 0;
    const stop = engine.subscribe(() => (seen += 1));
    await engine.load();
    expect(seen).toBeGreaterThan(0);
    const before = seen;
    stop();
    await engine.expand(ASSETS);
    expect(seen).toBe(before);
  });
});

describe('expanding to a path', () => {
  it('opens one level per call down to a seed', async () => {
    const { engine, calls } = tree();
    await engine.expandToPath(SHOT);
    expect(calls).toEqual([ROOT, SHOTS, SEQUENCE]);
    expect(paths(engine)).toContain(SHOT);
    expect(engine.snapshot().cursor).toBe(SHOT);
  });

  it('takes the incremental path a hierarchy search answers', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: ROOT, loader: hierarchyLoader(client) });
    const [found] = await client.hierarchySearch(ROOT, { type: 'Shot', id: 862 });
    await engine.expandToPath(found?.incrementalPath ?? []);
    expect(engine.snapshot().cursor).toBe(SHOT);
  });

  it('stops where the seed leaves the tree', async () => {
    const { engine } = tree();
    await engine.expandToPath('/Project/70/Shot/sg_sequence/Sequence/100/id/999999');
    expect(engine.snapshot().cursor).toBe(SEQUENCE);
  });
});

describe('checkboxes', () => {
  it('checks every loaded node under the one that was checked', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.setChecked(ASSETS, true);
    expect(engine.checkStateOf(ASSETS)).toBe('checked');
    for (const path of engine.childPaths(ASSETS)) expect(engine.checkStateOf(path)).toBe('checked');
  });

  it('reads mixed on a parent once one child is unchecked, and checked again when it comes back', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.setChecked(ASSETS, true);
    const first = engine.childPaths(ASSETS)[0] as string;
    engine.setChecked(first, false);
    expect(engine.checkStateOf(ASSETS)).toBe('mixed');
    expect(engine.checkStateOf(ROOT)).toBe('mixed');
    engine.setChecked(first, true);
    expect(engine.checkStateOf(ASSETS)).toBe('checked');
  });

  it('checks a level read after its branch was checked', async () => {
    const { engine } = tree();
    await engine.load();
    engine.setChecked(ASSETS, true);
    expect(engine.checkStateOf(ASSETS)).toBe('checked');
    await engine.expand(ASSETS);
    for (const path of engine.childPaths(ASSETS)) expect(engine.checkStateOf(path)).toBe('checked');
  });

  it('checks the parent once every child of it is checked', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    for (const path of engine.childPaths(ASSETS)) engine.setChecked(path, true);
    expect(engine.checkStateOf(ASSETS)).toBe('checked');
  });

  it('reports the rows the checked nodes stand for, and not the folders', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.setChecked(ASSETS, true);
    const refs = engine.checkedRefs();
    expect(refs.every((ref) => ref.type === 'Asset')).toBe(true);
    expect(refs).toHaveLength(engine.childPaths(ASSETS).length);
  });

  it('unchecks a branch and everything under it', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.toggleChecked(ASSETS);
    engine.toggleChecked(ASSETS);
    expect(engine.snapshot().checked).toEqual([]);
    expect(engine.checkedRefs()).toEqual([]);
  });
});

describe('selection', () => {
  it('holds one node at a time', async () => {
    const { engine } = tree();
    await engine.load();
    engine.select(ASSETS);
    engine.select(SHOTS);
    expect(engine.snapshot().selected).toEqual([SHOTS]);
  });

  it('adds and drops nodes when the mode is multiple', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: ROOT, loader: hierarchyLoader(client), selection: 'multiple' });
    await engine.load();
    engine.select(ASSETS);
    engine.select(SHOTS, { additive: true });
    expect(engine.snapshot().selected).toEqual([ASSETS, SHOTS]);
    engine.select(ASSETS, { additive: true });
    expect(engine.snapshot().selected).toEqual([SHOTS]);
  });

  it('selects nothing when the mode is none', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: ROOT, loader: hierarchyLoader(client), selection: 'none' });
    await engine.load();
    engine.select(ASSETS);
    expect(engine.snapshot().selected).toEqual([]);
  });
});

describe('the keyboard', () => {
  it('walks the visible list with Down, Up, Home and End', async () => {
    const { engine } = tree();
    await engine.load();
    expect(engine.snapshot().cursor).toBe(ROOT);
    engine.keyDown({ key: 'ArrowDown' });
    expect(engine.snapshot().cursor).toBe(ASSETS);
    engine.keyDown({ key: 'ArrowDown' });
    expect(engine.snapshot().cursor).toBe(SHOTS);
    engine.keyDown({ key: 'ArrowDown' });
    expect(engine.snapshot().cursor).toBe(SHOTS);
    engine.keyDown({ key: 'ArrowUp' });
    expect(engine.snapshot().cursor).toBe(ASSETS);
    engine.keyDown({ key: 'End' });
    expect(engine.snapshot().cursor).toBe(SHOTS);
    engine.keyDown({ key: 'Home' });
    expect(engine.snapshot().cursor).toBe(ROOT);
  });

  it('opens a branch with Right and steps into it on the second press', async () => {
    const { engine } = tree();
    await engine.load();
    engine.focus(SHOTS);
    engine.keyDown({ key: 'ArrowRight' });
    // The key started the read; this joins it rather than starting another.
    await engine.expand(SHOTS);
    expect(engine.snapshot().rows.find((row) => row.node.path === SHOTS)?.expanded).toBe(true);
    engine.keyDown({ key: 'ArrowRight' });
    expect(engine.snapshot().cursor).toBe(SEQUENCE);
  });

  it('shuts a branch with Left and climbs to the parent from a closed one', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(SHOTS);
    engine.focus(SEQUENCE);
    engine.keyDown({ key: 'ArrowLeft' });
    expect(engine.snapshot().cursor).toBe(SHOTS);
    engine.keyDown({ key: 'ArrowLeft' });
    expect(engine.snapshot().rows.find((row) => row.node.path === SHOTS)?.expanded).toBe(false);
    engine.keyDown({ key: 'ArrowLeft' });
    expect(engine.snapshot().cursor).toBe(ROOT);
  });

  it('toggles the checkbox with Space and selects with Enter', async () => {
    const { engine } = tree();
    await engine.load();
    engine.focus(ASSETS);
    engine.keyDown({ key: ' ' });
    expect(engine.checkStateOf(ASSETS)).toBe('checked');
    engine.keyDown({ key: ' ' });
    expect(engine.checkStateOf(ASSETS)).toBe('unchecked');
    engine.keyDown({ key: 'Enter' });
    expect(engine.snapshot().selected).toEqual([ASSETS]);
  });

  it('leaves a key it does not use to the caller', async () => {
    const { engine } = tree();
    await engine.load();
    expect(engine.keyDown({ key: 'Tab' })).toBe(false);
    expect(engine.keyDown({ key: 'a', ctrlKey: true })).toBe(false);
    expect(engine.keyDown({ key: 'ArrowDown' })).toBe(true);
  });
});

describe('type-ahead', () => {
  it('jumps to the node whose label starts with what was typed', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.focus(ROOT);
    for (const char of 'prop') engine.keyDown({ key: char });
    expect(engine.snapshot().cursor).toBe('/Project/70/Asset/id/1228');
  });

  it('walks the matches when the same letter is pressed again', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.focus(ROOT);
    engine.keyDown({ key: 'p' });
    expect(engine.snapshot().cursor).toBe('/Project/70/Asset/id/1228');
    engine.keyDown({ key: 'p' });
    expect(engine.snapshot().cursor).toBe('/Project/70/Asset/id/1229');
  });

  it('starts a new buffer once the old one has gone stale', async () => {
    let clock = 0;
    const { engine } = tree({ now: () => clock });
    await engine.load();
    await engine.expand(ASSETS);
    engine.focus(ROOT);
    engine.keyDown({ key: 'e' });
    expect(engine.snapshot().cursor).toBe('/Project/70/Asset/id/1230');
    clock += 5000;
    engine.keyDown({ key: 'v' });
    expect(engine.snapshot().cursor).toBe('/Project/70/Asset/id/1232');
  });

  it('stays where it is when nothing matches', async () => {
    const { engine } = tree();
    await engine.load();
    expect(engine.keyDown({ key: 'z' })).toBe(false);
    expect(engine.snapshot().cursor).toBe(ROOT);
  });
});

describe('the filter', () => {
  it('keeps the matches and the ancestors that lead to them', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.setFilter('lantern');
    expect(labels(engine)).toEqual(['Blue Moon Rising', 'Assets', 'propLantern']);
  });

  it('opens a shut branch that leads to a match, and closes again when cleared', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    engine.collapse(ASSETS);
    expect(labels(engine)).toEqual(['Blue Moon Rising', 'Assets', 'Shots']);
    engine.setFilter('charAda');
    expect(labels(engine)).toEqual(['Blue Moon Rising', 'Assets', 'charAda']);
    engine.setFilter('');
    expect(labels(engine)).toEqual(['Blue Moon Rising', 'Assets', 'Shots']);
  });

  it('never asks the server for a branch that was never opened', async () => {
    const { engine, calls } = tree();
    await engine.load();
    calls.length = 0;
    engine.setFilter('sh010_0010');
    expect(calls).toEqual([]);
    expect(labels(engine)).toEqual([]);
  });
});

describe('the hierarchy loader', () => {
  it('reads the fields of the rows a level stands for, one read per type', async () => {
    const client = new MockClient();
    let reads = 0;
    const counting = new Proxy(client, {
      get(target, key: keyof MockClient) {
        if (key !== 'search') return Reflect.get(target, key);
        return (...args: Parameters<MockClient['search']>) => {
          reads += 1;
          return target.search(...args);
        };
      },
    }) as MockClient;
    const engine = createTree({
      rootPath: ROOT,
      loader: hierarchyLoader(counting, { fields: ['sg_status_list', 'description'] }),
    });
    await engine.load();
    await engine.expand(ASSETS);
    const first = engine.node(engine.childPaths(ASSETS)[0] as string);
    expect(typeof first?.values['sg_status_list']).toBe('string');
    // One read for the project at the root, one for the assets of the level below it.
    expect(reads).toBe(2);
  });

  it('leaves a folder that stands for no row without values', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: ROOT, loader: hierarchyLoader(client, { fields: ['sg_status_list'] }) });
    await engine.load();
    expect(engine.node(ASSETS)?.entity).toBeNull();
    expect(engine.node(ASSETS)?.values).toEqual({});
    expect(engine.node(ROOT)?.entity).toEqual({ type: 'Project', id: 70 });
  });
});

describe('what a row draws with', () => {
  it('finds the status field of a type that has one and skips the one that has not', async () => {
    const client = new MockClient();
    const plan = await resolveTreeFields(createSchemaService(client), createStatusService(client), [
      'Shot',
      'Project',
    ]);
    expect(plan.status['Shot']?.name).toBe('sg_status_list');
    // Project's `sg_status` is a plain `list`, so it carries no Status row.
    expect(plan.status['Project']).toBeNull();
    expect(plan.statuses?.['ip']?.code).toBe('ip');
  });

  it('reads no Status table when nothing on show is a status', async () => {
    const client = new MockClient();
    const plan = await resolveTreeFields(createSchemaService(client), createStatusService(client), ['Project'], 'code');
    expect(plan.secondary['Project']?.name).toBe('code');
    expect(plan.statuses).toBeNull();
  });
});
