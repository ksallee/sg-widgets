import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { SgApiError } from '../src/client.js';
import type { EntityRow, SearchResult } from '../src/client.js';
import type { WireGroup } from '../src/filter.js';
import type { EntityRef, Operator } from '../src/index.js';
import { parseBgColor, statusFieldFor, usableStatuses } from '../src/index.js';

const client = (): MockClient => new MockClient();

/** One condition, wrapped in the `and` group `_search` wants. */
function only(path: string, operator: Operator, value: unknown): WireGroup {
  return { logical_operator: 'and', conditions: [[path, operator, value]] };
}

async function attrs(c: MockClient, type: string, filters: WireGroup | null, field: string): Promise<unknown[]> {
  const res = await c.search(type, { filters, fields: [field], page: { size: 500 } });
  return res.data.map((row) => row.attributes[field]);
}

async function count(c: MockClient, type: string, filters: WireGroup | null): Promise<number> {
  const res = await c.search(type, { filters, fields: ['id'], page: { size: 500 } });
  return res.data.length;
}

describe('fixtures', () => {
  it('has the sizes a demo needs, and stable ids across runs', () => {
    const c = client();
    expect(c.rowsOf('Project')).toHaveLength(2);
    expect(c.rowsOf('Sequence')).toHaveLength(6);
    expect(c.rowsOf('Shot')).toHaveLength(30);
    expect(c.rowsOf('Asset')).toHaveLength(10);
    expect(c.rowsOf('Version')).toHaveLength(60);
    expect(c.rowsOf('Task')).toHaveLength(40);
    expect(c.rowsOf('HumanUser')).toHaveLength(8);
    expect(c.rowsOf('ApiUser')).toHaveLength(2);

    const again = new MockClient({ seed: 1 });
    expect(again.rowsOf('Version').map((r) => r['code'])).toEqual(c.rowsOf('Version').map((r) => r['code']));
    // A different seed shuffles the generated values but keeps the shape.
    const other = new MockClient({ seed: 7 });
    expect(other.rowsOf('Version')).toHaveLength(60);
    expect(other.rowsOf('Version').map((r) => r['sg_status_list'])).not.toEqual(c.rowsOf('Version').map((r) => r['sg_status_list']));
  });

  it('has inactive people, logins, emails and thumbnails', () => {
    const users = client().rowsOf('HumanUser');
    expect(users.filter((u) => u['sg_status_list'] === 'dis').length).toBeGreaterThan(0);
    expect(users.filter((u) => u['sg_status_list'] === 'act').length).toBeGreaterThan(0);
    for (const u of users) {
      expect(String(u['login'])).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(String(u['email'])).toContain('@');
      expect(String(u['image'])).toMatch(/^https?:/);
    }
  });
});

describe('row shape', () => {
  it('returns only the requested fields, with entity fields under relationships', async () => {
    const res = await client().search('Version', { fields: ['code', 'sg_status_list', 'entity'], page: { size: 1 } });
    const row = res.data[0] as EntityRow;
    expect(Object.keys(row.attributes).sort()).toEqual(['code', 'sg_status_list']);
    // An entity link is `{type, id, name}`, and `name` is the target's cached_display_name (060).
    const link = row.relationships['entity']?.data as EntityRef;
    expect(link.type).toBe('Shot');
    expect(typeof link.id).toBe('number');
    expect(typeof link.name).toBe('string');
  });

  it('gives an empty relationships object when no entity field was asked for, and drops unknown names', async () => {
    const res = await client().search('Shot', { fields: ['code', 'sg_not_a_field'], page: { size: 1 } });
    const row = res.data[0] as EntityRow;
    expect(row.relationships).toEqual({});
    // A bogus `fields` name is dropped at HTTP 200; only a filter 400s (003_query).
    expect(Object.keys(row.attributes)).toEqual(['code']);
  });

  it('returns a dotted path flat under its literal key in attributes', async () => {
    const res = await client().search('Version', { fields: ['code', 'entity.Shot.code'], page: { size: 1 } });
    const row = res.data[0] as EntityRow;
    expect(row.attributes['entity.Shot.code']).toBe('sh010_0010');
  });

  it('drops a dotted path through a multi_entity field at 200', async () => {
    const res = await client().search('Shot', { fields: ['code', 'assets.Asset.code'], page: { size: 1 } });
    expect(Object.keys((res.data[0] as EntityRow).attributes)).toEqual(['code']);
  });
});

describe('filter operators on text', () => {
  const c = client();
  const codes = c.rowsOf('Shot').map((r) => String(r['code']));

  it('is / is_not', async () => {
    expect(await attrs(c, 'Shot', only('code', 'is', 'sh010_0010'), 'code')).toEqual(['sh010_0010']);
    expect(await count(c, 'Shot', only('code', 'is_not', 'sh010_0010'))).toBe(29);
    // Matching is case-insensitive on a text field (field_types/text).
    expect(await attrs(c, 'Shot', only('code', 'is', 'SH010_0010'), 'code')).toEqual(['sh010_0010']);
  });

  it('in / not_in', async () => {
    expect(await count(c, 'Shot', only('code', 'in', ['sh010_0010', 'sh010_0020']))).toBe(2);
    expect(await count(c, 'Shot', only('code', 'not_in', ['sh010_0010', 'sh010_0020']))).toBe(28);
    expect(await count(c, 'Shot', only('code', 'in', ['ZZZNOPE']))).toBe(0);
  });

  it('contains / not_contains / starts_with / ends_with', async () => {
    const contains = codes.filter((code) => code.includes('010_00')).length;
    expect(await count(c, 'Shot', only('code', 'contains', '010_00'))).toBe(contains);
    expect(await count(c, 'Shot', only('code', 'not_contains', '010_00'))).toBe(30 - contains);
    expect(await count(c, 'Shot', only('code', 'starts_with', 'sh01'))).toBe(codes.filter((code) => code.startsWith('sh01')).length);
    expect(await count(c, 'Shot', only('code', 'ends_with', '0010'))).toBe(codes.filter((code) => code.endsWith('0010')).length);
    expect(await count(c, 'Shot', only('code', 'contains', 'ZZZNOPE'))).toBe(0);
  });
});

describe('negation includes nulls', () => {
  const c = client();

  it('is_not and not_in match rows where the field is unset, comparisons do not', async () => {
    const departments = c.rowsOf('Version').map((r) => r['sg_department']);
    const nulls = departments.filter((d) => d === null).length;
    expect(nulls).toBeGreaterThan(0);

    const comp = departments.filter((d) => d === 'Comp').length;
    // 60 rows: every row that is not "Comp", the null ones included.
    expect(await count(c, 'Version', only('sg_department', 'is_not', 'Comp'))).toBe(60 - comp);
    expect(await count(c, 'Version', only('sg_department', 'not_in', ['Comp']))).toBe(60 - comp);
    expect(await count(c, 'Version', only('sg_department', 'not_contains', 'Comp'))).toBe(60 - comp);
    expect(await count(c, 'Version', only('sg_department', 'is', null))).toBe(nulls);

    // client_approved_at is null on every fixture row, so a comparison must return nothing.
    expect(await count(c, 'Version', only('client_approved_at', 'greater_than', '2000-01-01T00:00:00Z'))).toBe(0);
    expect(await count(c, 'Version', only('client_approved_at', 'is_not', '2000-01-01T00:00:00Z'))).toBe(60);
  });
});

describe('filter operators on status_list, list and number', () => {
  const c = client();

  it('is / is_not / in / not_in on a status list', async () => {
    const statuses = c.rowsOf('Shot').map((r) => r['sg_status_list']);
    const ip = statuses.filter((s) => s === 'ip').length;
    expect(await count(c, 'Shot', only('sg_status_list', 'is', 'ip'))).toBe(ip);
    expect(await count(c, 'Shot', only('sg_status_list', 'is_not', 'ip'))).toBe(30 - ip);
    const both = statuses.filter((s) => s === 'ip' || s === 'fin').length;
    expect(await count(c, 'Shot', only('sg_status_list', 'in', ['ip', 'fin']))).toBe(both);
    expect(await count(c, 'Shot', only('sg_status_list', 'not_in', ['ip', 'fin']))).toBe(30 - both);
    // The display label is not a filter value: `is "In Progress"` returns nothing (field_types/status_list).
    expect(await count(c, 'Shot', only('sg_status_list', 'is', 'In Progress'))).toBe(0);
  });

  it('filters a list case-insensitively where a write is case-sensitive', async () => {
    const characters = client().rowsOf('Asset').filter((a) => a['sg_asset_type'] === 'Character').length;
    expect(await count(c, 'Asset', only('sg_asset_type', 'is', 'character'))).toBe(characters);
  });

  it('greater_than / less_than / between on a number, inclusive and order-insensitive', async () => {
    const durations = c.rowsOf('Shot').map((r) => Number(r['sg_cut_duration']));
    expect(await count(c, 'Shot', only('sg_cut_duration', 'greater_than', 100))).toBe(durations.filter((d) => d > 100).length);
    expect(await count(c, 'Shot', only('sg_cut_duration', 'less_than', 100))).toBe(durations.filter((d) => d < 100).length);
    const inside = durations.filter((d) => d >= 100 && d <= 150).length;
    expect(await count(c, 'Shot', only('sg_cut_duration', 'between', [100, 150]))).toBe(inside);
    expect(await count(c, 'Shot', only('sg_cut_duration', 'between', [150, 100]))).toBe(inside);
    // A numeric string is coerced, the way the site coerces it (field_types/number).
    const first = durations[0] as number;
    expect(await count(c, 'Shot', only('sg_cut_duration', 'is', String(first)))).toBe(durations.filter((d) => d === first).length);
  });

  it('greater_than / less_than / between on a date', async () => {
    const due = c.rowsOf('Task').map((r) => String(r['due_date']));
    expect(await count(c, 'Task', only('due_date', 'greater_than', '2026-03-01'))).toBe(due.filter((d) => d > '2026-03-01').length);
    expect(await count(c, 'Task', only('due_date', 'between', ['2026-02-01', '2026-03-01']))).toBe(
      due.filter((d) => d >= '2026-02-01' && d <= '2026-03-01').length,
    );
  });
});

describe('filter operators on entity fields', () => {
  const c = client();

  it('is / in take {type, id} hashes', async () => {
    const shot = { type: 'Shot', id: 862 };
    const linked = c.rowsOf('Version').filter((v) => (v['entity'] as EntityRef).id === 862).length;
    expect(linked).toBeGreaterThan(0);
    expect(await count(c, 'Version', only('entity', 'is', shot))).toBe(linked);
    expect(await count(c, 'Version', only('entity', 'in', [shot]))).toBe(linked);
    expect(await count(c, 'Version', only('entity', 'is', { type: 'Shot', id: 99_999_999 }))).toBe(0);
    expect(await count(c, 'Version', only('entity', 'is_not', shot))).toBe(60 - linked);
  });

  it('type_is / type_is_not read the link type', async () => {
    const assets = c.rowsOf('Version').filter((v) => (v['entity'] as EntityRef).type === 'Asset').length;
    expect(assets).toBeGreaterThan(0);
    expect(await count(c, 'Version', only('entity', 'type_is', 'Asset'))).toBe(assets);
    expect(await count(c, 'Version', only('entity', 'type_is_not', 'Asset'))).toBe(60 - assets);
    // A name string in a type slot matches nothing (field_types/entity).
    expect(await count(c, 'Version', only('entity', 'type_is', 'sh010_0010'))).toBe(0);
  });

  it('name_is / name_contains read the target cached_display_name', async () => {
    const linked = c.rowsOf('Version').filter((v) => (v['entity'] as EntityRef).id === 862).length;
    expect(await count(c, 'Version', only('entity', 'name_is', 'sh010_0010'))).toBe(linked);
    expect(await count(c, 'Version', only('entity', 'name_contains', 'sh010_'))).toBeGreaterThan(linked);
    expect(await count(c, 'Version', only('entity', 'name_contains', 'ZZZNOPE'))).toBe(0);
  });
});

describe('dotted paths', () => {
  const c = client();

  it('filters one hop through an entity field', async () => {
    const linked = c.rowsOf('Version').filter((v) => (v['entity'] as EntityRef).id === 862).length;
    expect(await count(c, 'Version', only('entity.Shot.code', 'is', 'sh010_0010'))).toBe(linked);
    expect(await count(c, 'Version', only('entity.Shot.code', 'contains', '010_00'))).toBeGreaterThan(linked);
    expect(await count(c, 'Version', only('entity.Shot.code', 'is', 'ZZZNOPE'))).toBe(0);
  });

  it('scopes by project through project.Project.id', async () => {
    const inProject = c.rowsOf('Shot').filter((s) => (s['project'] as EntityRef).id === 70).length;
    expect(await count(c, 'Shot', only('project.Project.id', 'is', 70))).toBe(inProject);
    expect(await count(c, 'Shot', only('project.Project.name', 'contains', 'Harbour'))).toBe(30 - inProject);
  });

  it('a hop whose target type does not match the stored link matches nothing', async () => {
    // Versions linked to a Shot are not reachable through `entity.Asset.code`.
    const assets = c.rowsOf('Version').filter((v) => (v['entity'] as EntityRef).type === 'Asset').length;
    expect(await count(c, 'Version', only('entity.Asset.code', 'contains', 'char'))).toBeLessThanOrEqual(assets);
  });
});

describe('filter groups', () => {
  const c = client();

  it('nests and / or, and mixes leaves with sub-groups', async () => {
    const filters: WireGroup = {
      logical_operator: 'and',
      conditions: [
        ['project', 'is', { type: 'Project', id: 70 }],
        { logical_operator: 'or', conditions: [['sg_status_list', 'is', 'ip'], ['sg_status_list', 'is', 'fin']] },
      ],
    };
    const expected = c
      .rowsOf('Shot')
      .filter((s) => (s['project'] as EntityRef).id === 70 && (s['sg_status_list'] === 'ip' || s['sg_status_list'] === 'fin')).length;
    expect(await count(c, 'Shot', filters)).toBe(expected);

    const conjunction: WireGroup = { logical_operator: 'and', conditions: [['id', 'is', 862], ['id', 'is', 863]] };
    expect(await count(c, 'Shot', conjunction)).toBe(0);
    const disjunction: WireGroup = { logical_operator: 'or', conditions: [['id', 'is', 862], ['id', 'is', 863]] };
    expect(await count(c, 'Shot', disjunction)).toBe(2);
  });

  it('treats an empty group and a null filter as no filter', async () => {
    expect(await count(c, 'Shot', { logical_operator: 'and', conditions: [] })).toBe(30);
    expect(await count(c, 'Shot', null)).toBe(30);
  });
});

describe('filter errors', () => {
  const c = client();

  it('400s on an unknown field, an unfilterable type and an operator the type refuses', async () => {
    await expect(c.search('Shot', { filters: only('sg_not_a_field', 'is', 'x') })).rejects.toBeInstanceOf(SgApiError);
    await expect(c.search('Version', { filters: only('sg_uploaded_movie', 'is', 'x') })).rejects.toMatchObject({ status: 400 });
    await expect(c.search('Version', { filters: only('sg_status_list', 'contains', 're') })).rejects.toMatchObject({ status: 400 });
    // Project is site-wide: it has no `project` field at all.
    await expect(c.search('Project', { filters: only('project.Project.id', 'is', 70) })).rejects.toMatchObject({ status: 400 });
  });

  it('404s on a type the site does not have', async () => {
    await expect(c.fields('NotAType')).rejects.toMatchObject({ status: 404 });
  });
});

describe('pagination and sort', () => {
  const c = client();

  it('walks pages and stops on an empty one', async () => {
    const seen: number[] = [];
    let page = 1;
    let last: SearchResult | undefined;
    for (;;) {
      const res = await c.search('Shot', { fields: ['id'], page: { size: 7, number: page } });
      if (res.data.length === 0) break;
      for (const row of res.data) seen.push(row.id);
      last = res;
      page += 1;
      if (page > 20) throw new Error('paging did not terminate');
    }
    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);
    // 30 rows in pages of 7: the fifth page holds 2, so hasMore is false there (006_pagination).
    expect(last?.hasMore).toBe(false);
    expect(page).toBe(6);
  });

  it('defaults to id ascending and honours field and -field', async () => {
    const plain = await c.search('Shot', { fields: ['id'], page: { size: 500 } });
    expect(plain.data.map((r) => r.id)).toEqual([...plain.data.map((r) => r.id)].sort((a, b) => a - b));

    const ascending = await attrs(c, 'Shot', null, 'code');
    const sorted = await c.search('Shot', { fields: ['code'], sort: 'code', page: { size: 500 } });
    expect(sorted.data.map((r) => r.attributes['code'])).toEqual([...ascending].sort());
    const descending = await c.search('Shot', { fields: ['code'], sort: '-code', page: { size: 500 } });
    expect(descending.data.map((r) => r.attributes['code'])).toEqual([...ascending].sort().reverse());
  });

  it('ignores a sort on a field that does not exist', async () => {
    const plain = await c.search('Shot', { fields: ['id'], page: { size: 500 } });
    const bogus = await c.search('Shot', { fields: ['id'], sort: 'sg_not_a_field_at_all', page: { size: 500 } });
    expect(bogus.data.map((r) => r.id)).toEqual(plain.data.map((r) => r.id));
  });
});

describe('textSearch', () => {
  const c = client();

  it('matches every word, case-insensitively, anywhere in the name', async () => {
    const one = await c.textSearch('sh010', { Shot: null });
    expect(one.length).toBeGreaterThan(0);
    expect(one.every((row) => row.name.includes('sh010'))).toBe(true);

    expect((await c.textSearch('SH010_0010', { Shot: null })).map((r) => r.name)).toEqual(['sh010_0010']);
    // Both orders of two words return the rows holding both.
    expect((await c.textSearch('sh010 0010', { Shot: null })).map((r) => r.name)).toEqual(['sh010_0010']);
    expect((await c.textSearch('0010 sh010', { Shot: null })).map((r) => r.name)).toEqual(['sh010_0010']);
    // Every word has to match.
    expect(await c.textSearch('sh010 nomatch', { Shot: null })).toEqual([]);
  });

  it('matches on the name of the row it links to', async () => {
    // Task content is a step name; the shot code lives on `entity` (053_text_search_matching).
    const hits = await c.textSearch('sh010_0010', { Task: null });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((row) => row.type === 'Task')).toBe(true);
    expect(hits.some((row) => !row.name.includes('sh010_0010'))).toBe(true);
  });

  it('respects the per-type filter and returns the flattened row', async () => {
    const scoped = await c.textSearch('0010', {
      Shot: { logical_operator: 'and', conditions: [['project', 'is', { type: 'Project', id: 71 }]] },
    });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((row) => row.name.startsWith('hb'))).toBe(true);
    const row = scoped[0];
    expect(Object.keys(row ?? {}).sort()).toEqual(['id', 'image', 'name', 'projectId', 'status', 'type']);
  });

  it('caps page size at 25 and pages with page.number', async () => {
    const first = await c.textSearch('_', { Shot: null, Version: null, Task: null });
    expect(first).toHaveLength(25);
    const second = await c.textSearch('_', { Shot: null, Version: null, Task: null }, { number: 2 });
    expect(second).toHaveLength(25);
    expect(first.map((r) => `${r.type}:${r.id}`)).not.toEqual(second.map((r) => `${r.type}:${r.id}`));
    await expect(c.textSearch('x', { Shot: null }, { size: 26 })).rejects.toMatchObject({ status: 400 });
    await expect(c.textSearch('x', { Shot: null }, { size: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(c.textSearch('   ', { Shot: null })).rejects.toMatchObject({ status: 400 });
  });

  it('returns the shortest names first, across types', async () => {
    const rows = await c.textSearch('sh010', { Shot: null, Version: null });
    const lengths = rows.map((r) => r.name.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });
});

describe('schema', () => {
  it('adds hidden_values only when a project id is passed, and varies them per project', async () => {
    const c = client();
    const siteWide = await c.fields('Version');
    expect(siteWide['sg_status_list']?.hiddenValues).toBeUndefined();
    expect(siteWide['sg_status_list']?.validValues).toContain('pndl');

    const p70 = await c.fields('Version', 70);
    const p71 = await c.fields('Version', 71);
    expect(p70['sg_status_list']?.hiddenValues).toContain('part');
    expect(p71['sg_status_list']?.hiddenValues).toEqual(['pndl', 'pndvs']);
    // valid_values is byte-identical at every scope; only hidden_values moves (009_status_lists).
    expect(p70['sg_status_list']?.validValues).toEqual(p71['sg_status_list']?.validValues);

    const usable70 = usableStatuses(p70['sg_status_list']!).map((s) => s.code);
    const usable71 = usableStatuses(p71['sg_status_list']!).map((s) => s.code);
    expect(usable70).not.toEqual(usable71);
    expect(usable70).not.toContain('part');
    expect(usable71).toContain('part');
  });

  it('hides codes that are not in valid_values, which the site also does', async () => {
    const task = (await client().fields('Task', 71))['sg_status_list'];
    expect(task?.hiddenValues).toContain('blk');
    expect(task?.validValues).not.toContain('blk');
    // The subtraction still yields only real codes.
    expect(usableStatuses(task!).map((s) => s.code)).not.toContain('blk');
  });

  it("uses sg_status, a list, for Project's status field", async () => {
    const c = client();
    const project = await c.fields('Project');
    expect(project['sg_status']?.dataType).toBe('list');
    expect(project['sg_status_list']).toBeUndefined();
    expect(statusFieldFor('Project', project)).toBe(project['sg_status']);
    // Every other type keeps sg_status_list, a status_list.
    expect((await c.fields('Shot'))['sg_status_list']?.dataType).toBe('status_list');
  });

  it('normalises entity fields with valid_types and status fields with display_values', async () => {
    const version = await client().fields('Version');
    expect(version['entity']?.validTypes).toContain('Shot');
    expect(version['sg_status_list']?.displayValues?.['rev']).toBe('Pending Review');
    expect(version['sg_first_frame']?.dataType).toBe('number');
    expect(version['sg_uploaded_movie_frame_rate']?.dataType).toBe('float');
    expect(version['client_approved']?.dataType).toBe('checkbox');
    expect(version['client_approved_at']?.dataType).toBe('date_time');
    expect(version['image']?.dataType).toBe('image');
    expect(version['sg_uploaded_movie']?.dataType).toBe('url');
    const task = await client().fields('Task');
    expect(task['duration']?.dataType).toBe('duration');
    expect(task['time_percent_of_est']?.dataType).toBe('percent');
    expect(task['start_date']?.dataType).toBe('date');
  });

  it('lists the enabled types with display names', async () => {
    const types = await client().entityTypes();
    expect(types.map((t) => t.name)).toContain('HumanUser');
    expect(types.find((t) => t.name === 'HumanUser')?.displayName).toBe('Person');
  });
});

describe('statuses', () => {
  it('returns decimal rgb colours and icons of all three display types', async () => {
    const statuses = await client().statuses();
    expect(statuses.length).toBeGreaterThan(10);
    expect(parseBgColor(statuses[0]?.bgColor ?? null)).not.toBeNull();

    const kinds = new Set(statuses.map((s) => s.icon?.displayType));
    expect(kinds).toEqual(new Set(['image_map', 'image', 'html']));

    const stock = statuses.find((s) => s.icon?.displayType === 'image_map');
    if (stock?.icon?.displayType !== 'image_map') throw new Error('no image_map icon');
    // The stock sprite is addressed by its CSS class, and `url` is empty (010_status_icons).
    expect(stock.icon.imageMapKey).toBe(`icon_${stock.code}`);

    const custom = statuses.find((s) => s.icon?.displayType === 'image');
    if (custom?.icon?.displayType !== 'image') throw new Error('no image icon');
    expect(custom.icon.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(custom.icon.dataUrl).not.toMatch(/\s/);

    const html = statuses.find((s) => s.icon?.displayType === 'html');
    if (html?.icon?.displayType !== 'html') throw new Error('no html icon');
    expect(html.icon.html).toBe('Active');
  });
});

describe('demo hooks', () => {
  it('fails the next call only, with an SgApiError', async () => {
    const c = client();
    c.failNext({ status: 503, message: 'Service Unavailable' });
    await expect(c.entityTypes()).rejects.toMatchObject({ status: 503, message: 'Service Unavailable' });
    await expect(c.entityTypes()).resolves.toBeInstanceOf(Array);

    const armed = new MockClient({ failNext: { status: 401 } });
    await expect(armed.statuses()).rejects.toMatchObject({ status: 401 });
    await expect(armed.statuses()).resolves.toBeInstanceOf(Array);
  });

  it('simulates latency', async () => {
    const c = new MockClient({ latencyMs: 20 });
    const started = Date.now();
    await c.entityTypes();
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });
});

describe('update', () => {
  it('changes only the named fields and answers the whole record', async () => {
    const c = client();
    const before = (await c.search('Shot', { fields: ['code', 'description'], page: { size: 1 } })).data[0];
    if (!before) throw new Error('no shot');
    const row = await c.update('Shot', before.id, { description: 'written by a test' });
    expect(row.attributes['description']).toBe('written by a test');
    // A key left out of the body is unchanged, not cleared (put_entity_type_id).
    expect(row.attributes['code']).toBe(before.attributes['code']);
    // The answer is the whole record, not the change (024_read_after_write).
    expect(Object.keys(row.attributes).length).toBeGreaterThan(2);
  });

  it('is a no-op on an empty patch', async () => {
    const c = client();
    const row = await c.update('Shot', 862, {});
    expect(row.id).toBe(862);
  });

  it('stores null for an empty string on a text field', async () => {
    const c = client();
    const row = await c.update('Shot', 862, { description: '' });
    expect(row.attributes['description']).toBeNull();
  });

  it('refuses a read-only field and an unknown one', async () => {
    const c = client();
    await expect(c.update('Shot', 862, { created_at: '2026-01-01T00:00:00Z' })).rejects.toMatchObject({
      status: 400,
      message: 'API update() Shot.created_at is read only.',
    });
    await expect(c.update('Shot', 862, { sg_not_a_field: 1 })).rejects.toBeInstanceOf(SgApiError);
  });

  it('404s on an id that is not there', async () => {
    const c = client();
    await expect(c.update('Shot', 999999999, { description: 'x' })).rejects.toMatchObject({
      status: 404,
      message: 'Entity of type [Shot] with id=999999999 does not exist.',
    });
  });
});
