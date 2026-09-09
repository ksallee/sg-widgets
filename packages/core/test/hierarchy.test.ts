import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { SgApiError } from '../src/client.js';
import { createQueryCache } from '../src/query.js';
import { breadcrumb, hydrate, pathRefs, scopeToProject } from '../src/search.js';
import type { EntityRef } from '../src/filter.js';

const client = (): MockClient => new MockClient();

/** The first Shot of the first Sequence, and the Task on it. */
async function sample(c: MockClient): Promise<{ shot: EntityRef; task: EntityRef }> {
  const shot = c.rowsOf('Shot')[0] as Record<string, unknown>;
  const task = c.rowsOf('Task').find((t) => (t['entity'] as EntityRef).id === Number(shot['id'])) as Record<string, unknown>;
  return { shot: { type: 'Shot', id: Number(shot['id']) }, task: { type: 'Task', id: Number(task['id']) } };
}

describe('expanding the tree', () => {
  it('answers one level at a time, entity types under a project', async () => {
    const c = client();
    const root = await c.hierarchyExpand('/Project/70');
    expect(root.ref).toEqual({ kind: 'entity', value: { type: 'Project', id: 70 } });
    expect(root.parentPath).toBe('/');
    expect(root.path).toBe('/Project/70');
    expect(root.hasChildren).toBe(true);
    expect(root.children.map((c2) => c2.label)).toEqual(['Assets', 'Shots']);
    // `value` is a bare schema name on an entity_type ref, not an object.
    expect(root.children[1]?.ref).toEqual({ kind: 'entity_type', value: 'Shot' });
  });

  it('walks Project > Sequence > Shot > Task one call per node', async () => {
    const c = client();
    const shots = await c.hierarchyExpand('/Project/70/Shot');
    const sequence = shots.children[0];
    expect(sequence?.ref).toMatchObject({ kind: 'entity' });
    const level = await c.hierarchyExpand(sequence?.path ?? '');
    const shot = level.children[0];
    expect(shot?.ref).toMatchObject({ kind: 'entity', value: { type: 'Shot' } });
    const shotNode = await c.hierarchyExpand(shot?.path ?? '');
    expect(shotNode.children.map((n) => n.label)).toEqual(['Tasks']);
    const tasks = await c.hierarchyExpand(shotNode.children[0]?.path ?? '');
    expect(tasks.children.length).toBeGreaterThan(0);
    expect(tasks.children[0]?.ref).toMatchObject({ kind: 'entity', value: { type: 'Task' } });
  });

  it('walks Project > Asset > Task too', async () => {
    const c = client();
    const assets = await c.hierarchyExpand('/Project/70/Asset');
    const asset = assets.children[0];
    expect(asset?.ref).toMatchObject({ kind: 'entity', value: { type: 'Asset' } });
    const node = await c.hierarchyExpand(asset?.path ?? '');
    const tasks = await c.hierarchyExpand(node.children[0]?.path ?? '');
    expect(tasks.children[0]?.ref).toMatchObject({ kind: 'entity', value: { type: 'Task' } });
  });

  it('refuses a project that is not there, the way code 107 does', async () => {
    await expect(client().hierarchyExpand('/Project/999999999')).rejects.toBeInstanceOf(SgApiError);
  });
});

describe('finding a row in the tree', () => {
  it('answers the breadcrumb to a shot, project first and the row last', async () => {
    const c = client();
    const { shot } = await sample(c);
    const [path] = await c.hierarchySearch('/Project/70', shot);
    expect(path?.ref).toEqual(shot);
    expect(path?.projectId).toBe(70);
    expect(path?.incrementalPath[0]).toBe('/Project/70');
    expect(path?.incrementalPath[1]).toBe('/Project/70/Shot');
    expect(path?.incrementalPath[2]).toMatch(/^\/Project\/70\/Shot\/sg_sequence\/Sequence\/\d+$/);
    expect(path?.incrementalPath.at(-1)).toBe(`/Project/70/Shot/sg_sequence/Sequence/100/id/${shot.id}`);
    // `path_label` holds neither the project nor the row itself.
    expect(path?.pathLabel).toBe('Shots > sh010');
    expect(breadcrumb(path!)).toEqual(['Shots', 'sh010', path?.label]);
  });

  it('reaches a task through its shot', async () => {
    const c = client();
    const { task } = await sample(c);
    const [path] = await c.hierarchySearch('/Project/70', task);
    expect(path?.pathLabel).toBe('Shots > sh010 > sh010_0010 > Tasks');
    expect(pathRefs(path?.incrementalPath ?? [])).toEqual([
      { type: 'Project', id: 70 },
      { type: 'Sequence', id: 100 },
      { type: 'Shot', id: 862 },
      { type: 'Task', id: task.id },
    ]);
  });

  it('answers nothing for a row outside the root, and for a type the tree has no place for', async () => {
    const c = client();
    const { shot } = await sample(c);
    expect(await c.hierarchySearch('/Project/71', shot)).toEqual([]);
    expect(await c.hierarchySearch('/Project/70', { type: 'HumanUser', id: 20 })).toEqual([]);
  });
});

describe('pathRefs', () => {
  it('reads a leaf under a grouping as the type the folder named', () => {
    expect(pathRefs('/Project/70/Shot/sg_sequence/Sequence/23/id/862')).toEqual([
      { type: 'Project', id: 70 },
      { type: 'Sequence', id: 23 },
      { type: 'Shot', id: 862 },
    ]);
    expect(pathRefs('/Project/70/Asset/id/1226')).toEqual([
      { type: 'Project', id: 70 },
      { type: 'Asset', id: 1226 },
    ]);
    expect(pathRefs('/Project/70')).toEqual([{ type: 'Project', id: 70 }]);
    expect(pathRefs('/')).toEqual([]);
  });
});

describe('hydrating a text search', () => {
  it('fills the thumbnail and the project a text search does not answer', async () => {
    const c = client();
    const rows = await c.textSearch('sh010_0010', { Shot: null });
    const hits = await hydrate(c, rows);
    expect(hits[0]?.ref).toMatchObject({ type: 'Shot', name: 'sh010_0010' });
    expect(hits[0]?.image).toMatch(/^https:/);
    expect(hits[0]?.project).toEqual({ type: 'Project', id: 70, name: 'Blue Moon Rising' });
    // The linked row `_text_search` matched the words against survives on the hit.
    expect(hits[0]?.status).toBeTypeOf('string');
  });

  it('leaves a type with no image and no project alone', async () => {
    const c = client();
    const rows = await c.textSearch('ada', { HumanUser: null });
    const hits = await hydrate(c, rows);
    expect(hits[0]?.project).toBeNull();
    expect(hits[0]?.image).toMatch(/^https:/);
  });

  it('reads once per type, not once per row', async () => {
    const c = createQueryCache(new MockClient(), { ttlMs: 0 });
    let searches = 0;
    const counted = { ...c, search: (...a: Parameters<typeof c.search>) => (searches += 1, c.search(...a)) };
    const rows = await c.textSearch('sh010', { Shot: null, Task: null });
    await hydrate(counted, rows);
    expect(rows.length).toBeGreaterThan(2);
    expect(searches).toBe(2);
  });
});

describe('scoping to a project', () => {
  it('adds the condition only to types that have a project field', async () => {
    const c = client();
    const schema = { field: async (type: string, name: string) => (await c.fields(type))[name] };
    const scoped = await scopeToProject(schema, { Shot: null, Project: null, Step: null }, 70);
    expect(scoped['Shot']).toEqual([['project', 'is', { type: 'Project', id: 70 }]]);
    // Project has no `project` field and Step has none either; the path would 400.
    expect(scoped['Project']).toEqual([]);
    expect(scoped['Step']).toEqual([]);
  });

  it('keeps the conditions the caller gave', async () => {
    const c = client();
    const schema = { field: async (type: string, name: string) => (await c.fields(type))[name] };
    const scoped = await scopeToProject(schema, { Task: [['sg_status_list', 'is', 'ip']] }, 71);
    expect(scoped['Task']).toEqual([
      ['sg_status_list', 'is', 'ip'],
      ['project', 'is', { type: 'Project', id: 71 }],
    ]);
  });
});
