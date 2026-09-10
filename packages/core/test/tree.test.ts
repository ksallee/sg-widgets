import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSchemaService } from '../src/schema-service.js';
import { createStatusService } from '../src/status-service.js';
import type { TreeEngine } from '../src/tree.js';
import { createTree, hierarchyLoader, hierarchySearcher, resolveTreeFields } from '../src/tree.js';

const ROOT = '/Project/70';
const ASSETS = '/Project/70/Asset';
const SHOTS = '/Project/70/Shot';
const SEQUENCE = '/Project/70/Shot/sg_sequence/Sequence/100';
const SHOT = '/Project/70/Shot/sg_sequence/Sequence/100/id/862';
/** The project whose Shots are grouped by a field no row of it fills (064). */
const LOOSE_ROOT = '/Project/72';
const LOOSE_SHOTS = '/Project/72/Shot';

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

/** The same tree, with the two endpoints a search chains behind it. */
function searchTree(): { engine: TreeEngine; calls: string[] } {
  const client = new MockClient();
  const calls: string[] = [];
  const load = hierarchyLoader(client);
  const engine = createTree({
    rootPath: ROOT,
    loader: (path) => {
      calls.push(path);
      return load(path);
    },
    searcher: hierarchySearcher(client, ROOT, { schema: createSchemaService(client) }),
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

describe('searching', () => {
  it('opens the tree onto every hit and marks it', async () => {
    const { engine } = searchTree();
    await engine.load();
    await engine.search('sh010_0010');
    const snap = engine.snapshot();
    expect(paths(engine)).toContain(SHOT);
    expect(snap.matches).toContain(SHOT);
    expect(snap.cursor).toBe(SHOT);
    // The rest of the tree stays on show, so a hit keeps its context.
    expect(labels(engine)).toContain('Assets');
    expect(snap.rows.find((row) => row.node.path === ASSETS)?.match).toBe(false);
  });

  it('opens a branch two hits share once', async () => {
    const { engine, calls } = searchTree();
    await engine.load();
    calls.length = 0;
    await engine.search('sh010');
    expect(calls.filter((path) => path === SHOTS)).toHaveLength(1);
    expect(engine.snapshot().matches.length).toBeGreaterThan(1);
  });

  it('restores the expansion it opened onto when the text is cleared', async () => {
    const { engine } = searchTree();
    await engine.load();
    await engine.expand(ASSETS);
    await engine.search('sh010_0010');
    expect(paths(engine)).toContain(SHOT);
    await engine.search('');
    expect(paths(engine)).toContain(ASSETS);
    expect(paths(engine)).not.toContain(SHOT);
    expect(engine.snapshot().matches).toEqual([]);
  });

  it('marks nothing when the words match no row', async () => {
    const { engine } = searchTree();
    await engine.load();
    await engine.search('nothing matches this');
    expect(engine.snapshot().matches).toEqual([]);
    expect(engine.snapshot().searching).toBe(false);
  });

  it('marks the labels already loaded when there is no searcher', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(ASSETS);
    await engine.search('lantern');
    expect(engine.snapshot().matches.map((path) => engine.node(path)?.label)).toEqual(['propLantern']);
  });

  it('searches the types the levels already read stand for', async () => {
    const seen: string[][] = [];
    const client = new MockClient();
    const engine = createTree({
      rootPath: ROOT,
      loader: hierarchyLoader(client),
      searcher: (text, types) => {
        seen.push([...types].sort());
        return hierarchySearcher(client, ROOT, { schema: createSchemaService(client) })(text, types);
      },
    });
    await engine.load();
    await engine.search('sh010_0010');
    expect(seen[0]).toEqual(['Asset', 'Shot']);
  });
});

describe('expanding a branch', () => {
  it('opens every level under a node down to the depth asked for', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expandAll(SHOTS, 2);
    // Every sequence of the project, and every shot under each of them.
    expect(paths(engine)).toContain(SHOT);
    const shots = paths(engine).filter((path) => /\/Sequence\/\d+\/id\/\d+$/.test(path));
    expect(shots).toHaveLength(22);
  });

  it('stops at the depth asked for', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expandAll(SHOTS, 1);
    expect(paths(engine)).toContain(SEQUENCE);
    expect(paths(engine)).not.toContain(SHOT);
  });

  it('carries the loading flag on the node until every level is read', async () => {
    const { engine } = tree();
    await engine.load();
    const busy: boolean[] = [];
    const stop = engine.subscribe(() => {
      busy.push(engine.snapshot().rows.find((row) => row.node.path === SHOTS)?.loading ?? false);
    });
    await engine.expandAll(SHOTS, 2);
    stop();
    expect(busy[0]).toBe(true);
    expect(busy[busy.length - 1]).toBe(false);
  });

  it('opens every branch at the focus level on the asterisk', async () => {
    const { engine } = tree();
    await engine.load();
    await engine.expand(SHOTS);
    engine.focus(SEQUENCE);
    expect(engine.keyDown({ key: '*' })).toBe(true);
    await Promise.resolve();
    for (let i = 0; i < 20 && !paths(engine).includes(SHOT); i += 1) await new Promise((r) => setTimeout(r, 5));
    const opened = engine.snapshot().rows.filter((row) => row.node.path.includes('/Sequence/') && row.expanded);
    expect(opened.length).toBeGreaterThan(1);
  });
});

describe('a level whose grouping field has no rows', () => {
  it('answers the ungrouped rows in place of the empty child', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: LOOSE_ROOT, loader: hierarchyLoader(client) });
    await engine.load();
    await engine.expand(LOOSE_SHOTS);
    expect(labels(engine)).toEqual(['Night Ferry', 'Assets', 'Shots', 'nf_0010', 'nf_0020', 'nf_0030']);
  });

  it('follows a seed path spelling the bucket the way the search endpoint does', async () => {
    const client = new MockClient();
    const engine = createTree({ rootPath: LOOSE_ROOT, loader: hierarchyLoader(client) });
    const [found] = await client.hierarchySearch(LOOSE_ROOT, { type: 'Shot', id: 892 });
    expect(found?.incrementalPath[2]).toBe(`${LOOSE_SHOTS}/sg_sequence/__none__`);
    await engine.expandToPath(found?.incrementalPath ?? []);
    expect(engine.node(engine.snapshot().cursor ?? '')?.entity).toEqual({ type: 'Shot', id: 892 });
  });

  it('places a hit under it when the tree is searched', async () => {
    const client = new MockClient();
    const engine = createTree({
      rootPath: LOOSE_ROOT,
      loader: hierarchyLoader(client),
      searcher: hierarchySearcher(client, LOOSE_ROOT, { schema: createSchemaService(client) }),
    });
    await engine.load();
    await engine.search('nf_0020');
    const marked = engine.snapshot().matches.map((path) => engine.node(path)?.label);
    expect(marked).toEqual(['nf_0020']);
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

describe('controlled expansion and selection', () => {
  it('reports the open paths and opens exactly the ones it is given', async () => {
    const { engine } = tree();
    await engine.load();
    expect(engine.snapshot().expanded).toEqual([ROOT]);

    await engine.setExpanded([SHOTS, SEQUENCE]);
    expect(engine.snapshot().expanded).toEqual([ROOT, SHOTS, SEQUENCE]);
    expect(paths(engine)).toContain(SHOT);

    // The list it is given is the whole truth: what is not in it shuts.
    await engine.setExpanded([ASSETS]);
    expect(engine.snapshot().expanded).toEqual([ROOT, ASSETS]);
    expect(paths(engine)).not.toContain(SHOT);
  });

  it('selects exactly the paths it is given, one at a time in single mode', async () => {
    const { engine } = tree();
    await engine.load();
    engine.setSelected([SHOTS, ASSETS]);
    expect(engine.snapshot().selected).toEqual([SHOTS]);
    engine.setSelected([]);
    expect(engine.snapshot().selected).toEqual([]);
  });
});

describe('a disabled node', () => {
  /** The tree with its Assets branch disabled. */
  function disabledTree(): TreeEngine {
    const client = new MockClient();
    return createTree({
      rootPath: ROOT,
      loader: hierarchyLoader(client),
      disabled: (node) => node.path === ASSETS,
    });
  }

  it('is skipped by the arrows and never takes the cursor', async () => {
    const engine = disabledTree();
    await engine.load();
    expect(engine.snapshot().rows[1]?.disabled).toBe(true);
    expect(engine.snapshot().cursor).toBe(ROOT);
    // Assets sits between the root and Shots, and Down steps over it.
    engine.keyDown({ key: 'ArrowDown' });
    expect(engine.snapshot().cursor).toBe(SHOTS);
    engine.keyDown({ key: 'ArrowUp' });
    expect(engine.snapshot().cursor).toBe(ROOT);
    engine.focus(ASSETS);
    expect(engine.snapshot().cursor).toBe(ROOT);
  });

  it('refuses selection and its checkbox', async () => {
    const engine = disabledTree();
    await engine.load();
    engine.select(ASSETS);
    expect(engine.snapshot().selected).toEqual([]);
    engine.setChecked(ASSETS, true);
    expect(engine.snapshot().checked).toEqual([]);
    engine.setSelected([ASSETS]);
    expect(engine.snapshot().selected).toEqual([]);
  });

  it('is skipped by type-ahead', async () => {
    const engine = disabledTree();
    await engine.load();
    // "Assets" is the only row starting with a, and it is disabled.
    expect(engine.keyDown({ key: 'a' })).toBe(false);
    expect(engine.snapshot().cursor).toBe(ROOT);
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
