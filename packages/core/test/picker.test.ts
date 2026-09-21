import { describe, expect, it, vi } from 'vitest';
import { createQueryCache } from '../src/query.js';
import { MockClient } from '../src/mock.js';
import type { WireGroup } from '../src/filter.js';
import { condition, group, toApi3Hash } from '../src/filter.js';
import type { PickerRow } from '../src/picker.js';
import {
  asFilterGroup,
  clearableForField,
  createEntitySearch,
  entityKey,
  fitChips,
  flattenRow,
  isBareRef,
  mergeFilters,
  nameSearchFilter,
  placeholderName,
  PROJECT_PICKER_FIELDS,
  projectPickerFilters,
  pruneFilterToFields,
  summariseSelection,
  USER_PICKER_FIELDS,
  userPickerFilters,
  userPickerSearchFields,
  userPickerSubLabel,
  userPickerTypes,
  userSearchFields,
  withSelectedPinned,
} from '../src/picker.js';

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait until `read` stops being null, or give up. */
async function until<T>(read: () => T | null | undefined, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== null && value !== undefined && value !== false) return value as T;
    if (Date.now() > deadline) throw new Error('timed out');
    await tick(5);
  }
}

describe('nameSearchFilter', () => {
  it('requires every word, on one field', () => {
    expect(nameSearchFilter('pub an', ['name'])).toEqual({
      kind: 'group',
      logicalOperator: 'and',
      conditions: [
        { kind: 'condition', path: 'name', operator: 'contains', value: 'pub' },
        { kind: 'condition', path: 'name', operator: 'contains', value: 'an' },
      ],
    });
  });

  it('ors the per-field groups so a word may sit in any of them', () => {
    const filter = nameSearchFilter('ada', ['name', 'login']);
    expect(filter.logicalOperator).toBe('or');
    expect(filter.conditions).toHaveLength(2);
    expect(toApi3Hash(filter)).toEqual({
      logical_operator: 'or',
      conditions: [
        { logical_operator: 'and', conditions: [['name', 'contains', 'ada']] },
        { logical_operator: 'and', conditions: [['login', 'contains', 'ada']] },
      ],
    });
  });

  it('is an empty group for an empty query or no fields, which matches every row', () => {
    expect(nameSearchFilter('   ', ['name']).conditions).toEqual([]);
    expect(nameSearchFilter('ada', []).conditions).toEqual([]);
    expect(toApi3Hash(nameSearchFilter('   ', ['name']))).toBeNull();
  });

  it('takes the operator a field is matched with', () => {
    const filter = nameSearchFilter('le', [{ path: 'email', operator: 'starts_with' }, 'login']);
    expect(toApi3Hash(filter)).toEqual({
      logical_operator: 'or',
      conditions: [
        { logical_operator: 'and', conditions: [['email', 'starts_with', 'le']] },
        { logical_operator: 'and', conditions: [['login', 'contains', 'le']] },
      ],
    });
  });

  it('keeps every word against every field, not one word per field', () => {
    const filter = nameSearchFilter('ada love', ['name', 'login']);
    expect(toApi3Hash(filter)).toEqual({
      logical_operator: 'or',
      conditions: [
        {
          logical_operator: 'and',
          conditions: [
            ['name', 'contains', 'ada'],
            ['name', 'contains', 'love'],
          ],
        },
        {
          logical_operator: 'and',
          conditions: [
            ['login', 'contains', 'ada'],
            ['login', 'contains', 'love'],
          ],
        },
      ],
    });
  });
});

describe('userSearchFields', () => {
  it('matches the email on its local part until the query holds an @', () => {
    expect(userSearchFields('le')).toEqual([{ path: 'email', operator: 'starts_with' }, 'login']);
    expect(userSearchFields('le@example.studio')).toEqual([{ path: 'email', operator: 'contains' }, 'login']);
  });

  it('drops the login once the query holds whitespace, because a login never does', () => {
    expect(userSearchFields('anna van')).toEqual([{ path: 'email', operator: 'starts_with' }]);
  });

  it('is empty for an empty query', () => {
    expect(userSearchFields('   ')).toEqual([]);
  });
});

describe('the person configuration both user pickers take', () => {
  it('offers script accounts after people, and people alone when they are not wanted', () => {
    expect(userPickerTypes(true)).toEqual(['HumanUser', 'ApiUser']);
    expect(userPickerTypes(false)).toEqual(['HumanUser']);
  });

  it('sends the active condition unless inactive people are asked for', () => {
    expect(toApi3Hash(userPickerFilters(false, null))).toEqual({
      logical_operator: 'and',
      conditions: [['sg_status_list', 'is', 'act']],
    });
    expect(userPickerFilters(true, null).conditions).toHaveLength(0);
  });

  it("keeps the caller's own filter beside it", () => {
    const merged = userPickerFilters(false, group('and', [condition('id', 'is', 7)]));
    expect(toApi3Hash(merged)).toEqual({
      logical_operator: 'and',
      conditions: [
        { logical_operator: 'and', conditions: [['id', 'is', 7]] },
        ['sg_status_list', 'is', 'act'],
      ],
    });
  });

  it('names a script account, and a person by their address', () => {
    const script: PickerRow = { type: 'ApiUser', id: 3, name: 'sync', values: {} };
    const person: PickerRow = { type: 'HumanUser', id: 20, name: 'Ada Lovelace', values: { email: 'ada@example.studio' } };
    const nameless: PickerRow = { type: 'HumanUser', id: 21, name: 'Bruno Kessel', values: {} };
    expect(userPickerSubLabel(script)).toBe('API user');
    expect(userPickerSubLabel(person)).toBe('ada@example.studio');
    expect(userPickerSubLabel(nameless)).toBe('');
  });

  it("puts the caller's search fields after the ones a person is searched by", () => {
    expect(userPickerSearchFields(['sg_department'])('ada')).toEqual([
      { path: 'email', operator: 'starts_with' },
      'login',
      'sg_department',
    ]);
    expect(userPickerSearchFields((query) => (query.length > 2 ? ['sg_department'] : []))('ad')).toEqual([
      { path: 'email', operator: 'starts_with' },
      'login',
    ]);
  });
});

describe('the project configuration both project pickers take', () => {
  it('hides archived projects unless they are asked for', () => {
    expect(toApi3Hash(projectPickerFilters(false, null))).toEqual({
      logical_operator: 'and',
      conditions: [['archived', 'is', false]],
    });
    expect(projectPickerFilters(true, null).conditions).toHaveLength(0);
  });

  it('reads the status field Project alone uses', () => {
    expect(PROJECT_PICKER_FIELDS).toContain('sg_status');
    expect(USER_PICKER_FIELDS).toContain('sg_status_list');
  });
});

describe('mergeFilters and asFilterGroup', () => {
  it('drops the parts that would serialise to nothing', () => {
    const merged = mergeFilters(nameSearchFilter('', ['name']), nameSearchFilter('ada', ['name']), null);
    expect(merged.conditions).toHaveLength(1);
  });

  it('takes the wire shape as well as the tree', () => {
    const wire: WireGroup = { logical_operator: 'and', conditions: [['id', 'is', 7]] };
    expect(asFilterGroup(wire)).toEqual({
      kind: 'group',
      logicalOperator: 'and',
      conditions: [{ kind: 'condition', path: 'id', operator: 'is', value: 7 }],
    });
    expect(asFilterGroup(null)).toBeNull();
  });
});

describe('pruneFilterToFields', () => {
  it('drops a condition on a field the type does not have', () => {
    const filter = group('and', [condition('sg_status_list', 'is', 'act'), condition('login', 'contains', 'a')]);
    const pruned = pruneFilterToFields(filter, new Set(['login']));
    expect(pruned).toEqual(group('and', [condition('login', 'contains', 'a')]));
  });

  it('checks only the root of a dotted path', () => {
    const filter = group('and', [condition('project.Project.name', 'is', 'x')]);
    expect(pruneFilterToFields(filter, new Set(['project']))).not.toBeNull();
    expect(pruneFilterToFields(filter, new Set(['projects']))).toBeNull();
  });

  it('drops a group left with nothing in it', () => {
    const filter = group('and', [group('or', [condition('archived', 'is', false)])]);
    expect(pruneFilterToFields(filter, new Set(['code']))).toBeNull();
  });
});

describe('keys and references', () => {
  it('keys on type and id together', () => {
    expect(entityKey({ type: 'Shot', id: 1 })).toBe('Shot:1');
    expect(entityKey({ type: 'Asset', id: 1 })).not.toBe(entityKey({ type: 'Shot', id: 1 }));
  });

  it('treats a missing name and the Type id placeholder alike', () => {
    expect(isBareRef({ type: 'Shot', id: 862 })).toBe(true);
    expect(isBareRef({ type: 'Shot', id: 862, name: '' })).toBe(true);
    expect(isBareRef({ type: 'Shot', id: 862, name: placeholderName({ type: 'Shot', id: 862 }) })).toBe(true);
    expect(isBareRef({ type: 'Shot', id: 862, name: 'sh010_0010' })).toBe(false);
  });
});

describe('flattenRow', () => {
  it('lifts type and id, unwraps relationships and keeps a dotted key literal', () => {
    const row = flattenRow({
      type: 'Shot',
      id: 862,
      attributes: { code: 'sh010_0010', 'project.Project.name': 'Blue Moon Rising' },
      relationships: { project: { data: { type: 'Project', id: 70, name: 'Blue Moon Rising' } } },
    });
    expect(row).toEqual({
      type: 'Shot',
      id: 862,
      name: 'sh010_0010',
      values: {
        code: 'sh010_0010',
        'project.Project.name': 'Blue Moon Rising',
        project: { type: 'Project', id: 70, name: 'Blue Moon Rising' },
      },
    });
  });

  it('falls through the display-name chain and then to Type id', () => {
    expect(flattenRow({ type: 'Task', id: 5700, attributes: { content: 'FX' }, relationships: {} }).name).toBe('FX');
    expect(flattenRow({ type: 'Version', id: 17055, attributes: {}, relationships: {} }).name).toBe('Version 17055');
  });

  it('prefers an explicit label field', () => {
    const row = flattenRow({ type: 'Shot', id: 862, attributes: { code: 'sh010_0010', description: 'A shot' }, relationships: {} }, 'description');
    expect(row.name).toBe('A shot');
  });
});

describe('withSelectedPinned', () => {
  const row = (type: string, id: number, name: string): PickerRow => ({ type, id, name, values: {} });

  it('appends selected rows the results do not hold, in selection order', () => {
    const rows = [row('Shot', 1, 'a'), row('Shot', 2, 'b')];
    const known = new Map([['Asset:1', row('Asset', 1, 'charAda')]]);
    const out = withSelectedPinned(rows, [{ type: 'Shot', id: 2 }, { type: 'Asset', id: 1 }], known);
    expect(out.map(entityKey)).toEqual(['Shot:1', 'Shot:2', 'Asset:1']);
    expect(out[2]?.name).toBe('charAda');
  });

  it('falls back to Type id for a selection nothing has resolved', () => {
    const out = withSelectedPinned([], [{ type: 'Shot', id: 9 }], new Map());
    expect(out[0]?.name).toBe('Shot 9');
  });
});

describe('fitChips', () => {
  it('keeps every chip when they all fit, and holds nothing back', () => {
    expect(fitChips([100, 80, 60], 240, 40)).toEqual({ visible: 3, hidden: 0 });
    expect(fitChips([100, 80, 60], 1000, 40)).toEqual({ visible: 3, hidden: 0 });
  });

  it('has nothing to fit for an empty row', () => {
    expect(fitChips([], 0, 40)).toEqual({ visible: 0, hidden: 0 });
  });

  it('hides every chip when the first one does not fit', () => {
    expect(fitChips([100, 80], 90, 40)).toEqual({ visible: 0, hidden: 2 });
  });

  it('cuts at a whole chip, never inside one', () => {
    expect(fitChips([100, 80, 60], 200, 40)).toEqual({ visible: 1, hidden: 2 });
  });

  it('spends the reserve only once the row overflows', () => {
    // 200 of chips in 205 is every chip; the same chips in 199 lose two, because the
    // "+n" pill takes its 40 out of what is left.
    expect(fitChips([100, 100], 205, 40)).toEqual({ visible: 2, hidden: 0 });
    expect(fitChips([100, 100], 199, 40)).toEqual({ visible: 1, hidden: 1 });
  });

  it('fits nothing into a row narrower than its reserve', () => {
    expect(fitChips([100], 30, 40)).toEqual({ visible: 0, hidden: 1 });
  });
});

describe('summariseSelection', () => {
  const codes = ['ip', 'apr', 'fin', 'hld', 'omt'];

  it('keeps one line by default, which is ellipsis', () => {
    const plan = summariseSelection(codes, (c) => c);
    expect(plan.shown).toEqual(['ip', 'apr', 'fin']);
    expect(plan.overflow).toBe(2);
    expect(plan.oneLine).toBe(true);
  });

  it('draws every chip and wraps under chips', () => {
    const plan = summariseSelection(codes, (c) => c, { summary: 'chips' });
    expect(plan.shown).toEqual(codes);
    expect(plan.overflow).toBe(0);
    expect(plan.oneLine).toBe(false);
  });

  it('caps the chips at max and counts the rest', () => {
    const plan = summariseSelection(codes, (c) => c, { summary: 'chips', max: 2 });
    expect(plan.shown).toEqual(['ip', 'apr']);
    expect(plan.overflow).toBe(3);
  });

  it('keeps ellipsis on one line, three chips wide unless max says otherwise', () => {
    const plan = summariseSelection(codes, (c) => c, { summary: 'ellipsis' });
    expect(plan.shown).toEqual(['ip', 'apr', 'fin']);
    expect(plan.overflow).toBe(2);
    expect(plan.oneLine).toBe(true);
    expect(summariseSelection(codes, (c) => c, { summary: 'ellipsis', max: 1 }).overflow).toBe(4);
  });

  it('draws no chip under count and reads the number selected', () => {
    const plan = summariseSelection(codes, (c) => c, { summary: 'count' });
    expect(plan.shown).toEqual([]);
    expect(plan.countLabel).toBe('5 selected');
  });

  it('puts every label in the title, whatever the mode', () => {
    for (const summary of ['chips', 'ellipsis', 'count'] as const) {
      expect(summariseSelection(codes, (c) => c.toUpperCase(), { summary, max: 1 }).title).toBe(
        'IP, APR, FIN, HLD, OMT',
      );
    }
  });

  it('fits the ellipsis chips to a measured row', () => {
    const fit = { widths: [60, 60, 60, 60, 60], available: 150, reserve: 30 };
    const plan = summariseSelection(codes, (c) => c, { summary: 'ellipsis', fit });
    expect(plan.shown).toEqual(['ip', 'apr']);
    expect(plan.overflow).toBe(3);
  });

  it('lets a measured row draw more than three chips, and max still caps it', () => {
    const fit = { widths: [40, 40, 40, 40, 40], available: 400, reserve: 30 };
    expect(summariseSelection(codes, (c) => c, { summary: 'ellipsis', fit }).shown).toEqual(codes);
    expect(summariseSelection(codes, (c) => c, { summary: 'ellipsis', max: 2, fit }).shown).toEqual([
      'ip',
      'apr',
    ]);
  });

  it('draws no chip when the row fits none, and counts them all', () => {
    const fit = { widths: [60, 60, 60, 60, 60], available: 40, reserve: 30 };
    const plan = summariseSelection(codes, (c) => c, { summary: 'ellipsis', fit });
    expect(plan.shown).toEqual([]);
    expect(plan.overflow).toBe(5);
  });

  it('ignores a measured row outside ellipsis', () => {
    const fit = { widths: [60, 60, 60, 60, 60], available: 40, reserve: 30 };
    expect(summariseSelection(codes, (c) => c, { summary: 'chips', fit }).shown).toEqual(codes);
  });

  it('is empty for an empty selection', () => {
    const plan = summariseSelection([], (c: string) => c, { summary: 'ellipsis' });
    expect(plan.shown).toEqual([]);
    expect(plan.overflow).toBe(0);
    expect(plan.title).toBe('');
    expect(plan.countLabel).toBe('0 selected');
  });
});

describe('createEntitySearch', () => {
  function harness(overrides: Record<string, unknown> = {}) {
    const mock = new MockClient({ seed: 1 });
    const client = createQueryCache(mock);
    const search = createEntitySearch({
      client,
      entityTypes: ['Shot'],
      debounceMs: 5,
      pageSize: 5,
      ...overrides,
    });
    return { mock, client, search };
  }

  it('lists the first page, last updated first, with nothing typed', async () => {
    const { search } = harness({ fields: ['updated_at'] });
    search.setQuery('');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows).toHaveLength(5);
    expect(search.state.hasMore).toBe(true);
    const dates = search.state.rows.map((row) => String(row.values['updated_at']));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('drops the name condition under the minimum query length instead of the rows', async () => {
    const { search } = harness({ minQueryLength: 2, fields: ['updated_at'] });
    search.setQuery('sh010');
    await until(() => search.state.rows.length > 0 && search.state.rows.every((r) => r.name.startsWith('sh010')));
    search.setQuery('s');
    await until(() => !search.state.loading && search.state.rows.some((r) => !r.name.startsWith('sh010')));
    expect(search.state.tooShort).toBe(true);
    expect(search.state.rows).toHaveLength(5);
    // Nothing is highlighted, because the rows answer no query.
    expect(search.state.query).toBe('');
  });

  it('keeps the project scope and the exclusions on the unfiltered list', async () => {
    const { search } = harness({ projectId: 71, fields: ['project'] });
    search.setQuery('');
    const rows = await until(() => (search.state.rows.length > 0 ? search.state.rows : null));
    expect(rows.every((row) => (row.values['project'] as { id: number }).id === 71)).toBe(true);
    const dropped = rows[0] as PickerRow;
    search.update({ exclude: [{ type: 'Shot', id: dropped.id }] });
    await until(() => search.state.rows.length > 0 && !search.state.rows.some((r) => r.id === dropped.id));
    expect(search.state.rows.some((r) => r.id === dropped.id)).toBe(false);
  });

  it('pages the unfiltered list with the load more row', async () => {
    const { search } = harness({ pageSize: 3 });
    search.setQuery('');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows).toHaveLength(3);
    search.loadMore();
    await until(() => search.state.rows.length > 3);
    expect(new Set(search.state.rows.map(entityKey)).size).toBe(6);
  });

  it('does not match every person through the domain they share', async () => {
    const { search } = harness({ entityTypes: ['HumanUser'], searchFields: userSearchFields });
    search.setQuery('le');
    await until(() => search.state.rows.length > 0);
    await tick(20);
    // `contains` on the whole address matches all eight through `example.studio`.
    expect(search.state.rows.map((r) => r.name)).toEqual(['Cleo Dias']);
  });

  it('matches the whole address once the query holds an @', async () => {
    const { search } = harness({ entityTypes: ['HumanUser'], searchFields: userSearchFields });
    search.setQuery('bo.chen@example.studio');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows.map((r) => r.name)).toEqual(['Bo Chen']);
  });

  it('finds rows whose label holds every word', async () => {
    const { search } = harness();
    search.setQuery('sh010 0010');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows.map((r) => r.name)).toEqual(['sh010_0010']);
  });

  it('keys the rows it remembers on type and id', async () => {
    const { search } = harness({ entityTypes: ['Shot', 'Asset'] });
    search.setQuery('char');
    await until(() => search.state.rows.length > 0);
    for (const key of search.known.keys()) expect(key).toMatch(/^[A-Za-z]+:\d+$/);
  });

  it('never lets a slow earlier response overwrite a later one', async () => {
    const mock = new MockClient({ seed: 1 });
    const delays = [80, 0];
    const slow = {
      ...mock,
      search: async (type: string, options: Parameters<MockClient['search']>[1]) => {
        await tick(delays.shift() ?? 0);
        return mock.search(type, options);
      },
      entityTypes: () => mock.entityTypes(),
      fields: (t: string, p?: number) => mock.fields(t, p),
      fieldWithProject: (t: string, f: string, p: number) => mock.fieldWithProject(t, f, p),
      textSearch: (t: string, e: Record<string, never>) => mock.textSearch(t, e),
      statuses: () => mock.statuses(),
    } as unknown as MockClient;
    const search = createEntitySearch({ client: createQueryCache(slow), entityTypes: ['Shot'], debounceMs: 0, pageSize: 5 });

    search.setQuery('sh010');
    await tick(1);
    search.setQuery('sh020');
    await until(() => !search.state.loading && search.state.rows.length > 0);
    await tick(150);
    expect(search.state.query).toBe('sh020');
    expect(search.state.rows.every((r) => r.name.startsWith('sh020'))).toBe(true);
  });

  it('pages, appending the next page to the rows already shown', async () => {
    const { search } = harness({ pageSize: 3 });
    search.setQuery('sh0');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows).toHaveLength(3);
    expect(search.state.hasMore).toBe(true);
    search.loadMore();
    await until(() => search.state.rows.length > 3);
    expect(search.state.rows).toHaveLength(6);
    expect(new Set(search.state.rows.map(entityKey)).size).toBe(6);
  });

  it('pushes an exclusion into the server filter', async () => {
    const { search } = harness();
    search.setQuery('sh010');
    const first = await until(() => (search.state.rows.length > 0 ? search.state.rows : null));
    const dropped = first[0] as PickerRow;
    search.update({ exclude: [{ type: 'Shot', id: dropped.id }] });
    await until(() => search.state.rows.length > 0 && !search.state.rows.some((r) => r.id === dropped.id));
    expect(search.state.rows.some((r) => r.id === dropped.id)).toBe(false);
  });

  it('scopes by project through the field the type actually has', async () => {
    const { search } = harness({ entityTypes: ['Shot'], projectId: 71 });
    search.setQuery('hb0');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows.length).toBeGreaterThan(0);
    search.update({ projectId: 70 });
    await until(() => !search.state.loading);
    expect(search.state.rows).toEqual([]);
  });

  it('scopes a site-wide type through its projects field rather than 400ing', async () => {
    const { search } = harness({ entityTypes: ['HumanUser'], projectId: 70 });
    search.setQuery('ada');
    await until(() => search.state.rows.length > 0 || search.state.error !== null);
    expect(search.state.error).toBeNull();
    expect(search.state.rows.map((r) => r.name)).toEqual(['Ada Lovelace']);
  });

  it('searches the fields a caller adds on top of the display-name chain', async () => {
    const { search } = harness({ entityTypes: ['HumanUser'], searchFields: ['login', 'email'] });
    search.setQuery('bo.chen');
    await until(() => search.state.rows.length > 0);
    expect(search.state.rows.map((r) => r.name)).toEqual(['Bo Chen']);
  });

  it('drops a search field the type does not have instead of failing the request', async () => {
    const { search } = harness({ entityTypes: ['HumanUser', 'ApiUser'], searchFields: ['login'] });
    search.setQuery('pipeline');
    await until(() => search.state.rows.length > 0 || search.state.error !== null);
    expect(search.state.error).toBeNull();
    expect(search.state.rows.map((r) => r.name)).toEqual(['pipeline_bot']);
  });

  it('applies a pre-filter only to the types that have the field', async () => {
    const { search } = harness({
      entityTypes: ['HumanUser', 'ApiUser'],
      // ApiUser has no status field, so the condition is dropped there rather than 400ing.
      filters: group('and', [condition('sg_status_list', 'is', 'act')]),
    });
    search.setQuery('o');
    search.update({ minQueryLength: 1 });
    await until(() => search.state.rows.length > 0 || search.state.error !== null);
    expect(search.state.error).toBeNull();
    const names = search.state.rows.map((r) => r.name);
    expect(names).toContain('pipeline_bot');
    expect(names).not.toContain('Bo Chen');
  });

  it('surfaces a failure instead of swallowing it', async () => {
    const { mock, search } = harness();
    const onError = vi.fn();
    search.update({ onError });
    mock.failNext({ status: 500, message: 'Flow PT API error 500' });
    search.setQuery('sh010');
    await until(() => search.state.error !== null);
    expect(search.state.error?.message).toBe('Flow PT API error 500');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(search.state.loading).toBe(false);
  });

  it('hydrates bare references with one request per type', async () => {
    const { search } = harness({ entityTypes: ['Shot', 'Asset'] });
    search.hydrate([
      { type: 'Shot', id: 862 },
      { type: 'Shot', id: 863 },
      { type: 'Asset', id: 1226 },
    ]);
    await until(() => search.known.size >= 3);
    expect(search.known.get('Shot:862')?.name).toBe('sh010_0010');
    expect(search.known.get('Asset:1226')?.name).toBe('charAda');
  });

  it('does not overwrite a hydrated row with a bare reference handed in later', async () => {
    const { search } = harness();
    search.hydrate([{ type: 'Shot', id: 862 }]);
    await until(() => search.known.get('Shot:862')?.name === 'sh010_0010');
    search.hydrate([{ type: 'Shot', id: 862 }]);
    await tick(20);
    expect(search.known.get('Shot:862')?.name).toBe('sh010_0010');
  });

  it('leaves a reference that cannot be resolved as Type id', async () => {
    const { search } = harness();
    search.hydrate([{ type: 'Shot', id: 999999 }]);
    await until(() => search.known.has('Shot:999999'));
    expect(search.known.get('Shot:999999')?.name).toBe('Shot 999999');
  });

  it('keeps a hydration failure visible and still names the row', async () => {
    const { mock, search } = harness();
    mock.failNext({ status: 503, message: 'Flow PT API error 503' });
    search.hydrate([{ type: 'Shot', id: 862 }]);
    await until(() => search.state.error !== null);
    expect(search.known.get('Shot:862')?.name).toBe('Shot 862');
  });
});

describe('clearableForField', () => {
  it('drops the clear on a mandatory field and keeps the caller answer otherwise', () => {
    expect(clearableForField(true, { mandatory: true })).toBe(false);
    expect(clearableForField(undefined, { mandatory: true })).toBe(false);
    expect(clearableForField(true, { mandatory: false })).toBe(true);
    expect(clearableForField(false, { mandatory: false })).toBe(false);
    // A field the widget has not read is not mandatory as far as it knows.
    expect(clearableForField(undefined, null)).toBe(true);
    expect(clearableForField(false, null)).toBe(false);
  });
});
