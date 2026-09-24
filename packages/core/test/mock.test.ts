import { describe, expect, it } from 'vitest';
import { MockClient, MOCK_NOW } from '../src/mock.js';
import { SgApiError } from '../src/client.js';
import type { EntityRow, SearchResult } from '../src/client.js';
import type { WireGroup } from '../src/filter.js';
import type { EntityRef, Operator } from '../src/index.js';
import { hierarchyEntity, parseBgColor, statusFieldFor, usableStatuses } from '../src/index.js';

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
    expect(c.rowsOf('Project')).toHaveLength(3);
    expect(c.rowsOf('Sequence')).toHaveLength(6);
    // 30 under a sequence, and 3 under a project that has none.
    expect(c.rowsOf('Shot')).toHaveLength(33);
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
    expect(await count(c, 'Shot', only('code', 'is_not', 'sh010_0010'))).toBe(32);
    // Matching is case-insensitive on a text field (field_types/text).
    expect(await attrs(c, 'Shot', only('code', 'is', 'SH010_0010'), 'code')).toEqual(['sh010_0010']);
  });

  it('in / not_in', async () => {
    expect(await count(c, 'Shot', only('code', 'in', ['sh010_0010', 'sh010_0020']))).toBe(2);
    expect(await count(c, 'Shot', only('code', 'not_in', ['sh010_0010', 'sh010_0020']))).toBe(31);
    expect(await count(c, 'Shot', only('code', 'in', ['ZZZNOPE']))).toBe(0);
  });

  it('contains / not_contains / starts_with / ends_with', async () => {
    const contains = codes.filter((code) => code.includes('010_00')).length;
    expect(await count(c, 'Shot', only('code', 'contains', '010_00'))).toBe(contains);
    expect(await count(c, 'Shot', only('code', 'not_contains', '010_00'))).toBe(33 - contains);
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
    expect(await count(c, 'Shot', only('sg_status_list', 'is_not', 'ip'))).toBe(33 - ip);
    const both = statuses.filter((s) => s === 'ip' || s === 'fin').length;
    expect(await count(c, 'Shot', only('sg_status_list', 'in', ['ip', 'fin']))).toBe(both);
    expect(await count(c, 'Shot', only('sg_status_list', 'not_in', ['ip', 'fin']))).toBe(33 - both);
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

describe('relative and calendar date operators', () => {
  /** The mock's own today, a Monday, at midday UTC. */
  const NOW = MOCK_NOW;

  /** Asset ids, and the date each carries around that Monday. 1234 and 1235 keep none. */
  const DATES: Record<number, string> = {
    1226: '2026-01-05', // today
    1227: '2026-01-04', // yesterday, the Sunday that ends the previous week
    1228: '2026-01-06', // tomorrow
    1229: '2025-12-31', // the last day of the previous month, and of the previous year
    1230: '2026-01-11', // the Sunday that ends this week
    1231: '2026-01-12', // the Monday that starts the next one
    1232: '2026-02-01', // next month
    1233: '2025-12-06', // 30 days back
  };

  /** Version ids, and the moment each carries. The other 52 rows keep none. */
  const MOMENTS: Record<number, string> = {
    17055: '2026-01-05T11:00:00Z', // exactly one hour back
    17056: '2026-01-05T10:59:59Z', // a second before that
    17057: '2026-01-05T00:00:00Z', // midnight today
    17058: '2026-01-04T23:59:59Z', // the last second of yesterday
    17059: '2026-01-05T13:00:00Z', // exactly one hour ahead
    17060: '2026-01-11T23:59:59Z', // the last second of this week
    17061: '2026-01-12T00:00:00Z', // the first second of the next one
    17062: '2025-12-31T23:59:59Z', // the last second of the previous year
  };

  /** A pinned-clock site carrying `values` on `field`, and null on every other row of the type. */
  async function sited(
    type: string,
    field: string,
    values: Record<number, string>,
    now: string | (() => number) = NOW,
  ): Promise<MockClient> {
    const c = new MockClient({ now });
    for (const row of c.rowsOf(type)) {
      const id = Number(row['id']);
      await c.update(type, id, { [field]: values[id] ?? null });
    }
    return c;
  }

  async function ids(c: MockClient, type: string, field: string, operator: Operator, value: unknown): Promise<number[]> {
    const res = await c.search(type, { filters: only(field, operator, value), fields: ['id'], page: { size: 500 } });
    return res.data.map((row) => row.id);
  }

  describe('a date field', () => {
    const dates = (): Promise<MockClient> => sited('Asset', 'sg_due_date', DATES);
    const matching = async (operator: Operator, value: unknown): Promise<number[]> =>
      ids(await dates(), 'Asset', 'sg_due_date', operator, value);

    it('counts in_last back from the clock, in every unit', async () => {
      // A date has no time of day, so a window shorter than a day still matches today (field_types/date).
      expect(await matching('in_last', [1, 'HOUR'])).toEqual([1226]);
      expect(await matching('in_last', [1, 'DAY'])).toEqual([1226, 1227]);
      expect(await matching('in_last', [1, 'WEEK'])).toEqual([1226, 1227, 1229]);
      expect(await matching('in_last', [30, 'DAY'])).toEqual([1226, 1227, 1229, 1233]);
      expect(await matching('in_last', [1, 'MONTH'])).toEqual([1226, 1227, 1229, 1233]);
      expect(await matching('in_last', [1, 'YEAR'])).toEqual([1226, 1227, 1229, 1233]);
    });

    it('counts in_next forward from the clock, in every unit', async () => {
      expect(await matching('in_next', [1, 'HOUR'])).toEqual([1226]);
      expect(await matching('in_next', [1, 'DAY'])).toEqual([1226, 1228]);
      expect(await matching('in_next', [1, 'WEEK'])).toEqual([1226, 1228, 1230, 1231]);
      expect(await matching('in_next', [1, 'MONTH'])).toEqual([1226, 1228, 1230, 1231, 1232]);
      expect(await matching('in_next', [1, 'YEAR'])).toEqual([1226, 1228, 1230, 1231, 1232]);
    });

    it('adds the rows with no date to the negating forms', async () => {
      expect(await matching('not_in_last', [1, 'DAY'])).toEqual([1228, 1229, 1230, 1231, 1232, 1233, 1234, 1235]);
      expect(await matching('not_in_next', [1, 'DAY'])).toEqual([1227, 1229, 1230, 1231, 1232, 1233, 1234, 1235]);
      // The positive forms never do.
      expect(await matching('in_last', [100, 'YEAR'])).not.toContain(1234);
      expect(await matching('in_next', [100, 'YEAR'])).not.toContain(1234);
    });

    it('buckets a calendar day, week, month and year at the UTC boundary', async () => {
      expect(await matching('in_calendar_day', 0)).toEqual([1226]);
      expect(await matching('in_calendar_day', -1)).toEqual([1227]);
      expect(await matching('in_calendar_day', 1)).toEqual([1228]);
      // A week runs Monday to Sunday, so yesterday is the previous one and this Sunday is this one.
      expect(await matching('in_calendar_week', 0)).toEqual([1226, 1228, 1230]);
      expect(await matching('in_calendar_week', -1)).toEqual([1227, 1229]);
      expect(await matching('in_calendar_week', 1)).toEqual([1231]);
      expect(await matching('in_calendar_month', 0)).toEqual([1226, 1227, 1228, 1230, 1231]);
      expect(await matching('in_calendar_month', -1)).toEqual([1229, 1233]);
      expect(await matching('in_calendar_month', 1)).toEqual([1232]);
      expect(await matching('in_calendar_year', 0)).toEqual([1226, 1227, 1228, 1230, 1231, 1232]);
      expect(await matching('in_calendar_year', -1)).toEqual([1229, 1233]);
      expect(await matching('in_calendar_year', 1)).toEqual([]);
      // A bare offset and a one-element array are the same value (field_types/date).
      expect(await matching('in_calendar_day', [0])).toEqual([1226]);
    });
  });

  describe('a date_time field', () => {
    const moments = (): Promise<MockClient> => sited('Version', 'client_approved_at', MOMENTS);
    const matching = async (operator: Operator, value: unknown): Promise<number[]> =>
      ids(await moments(), 'Version', 'client_approved_at', operator, value);

    it('counts in_last and in_next to the second', async () => {
      // Where a date stands for its whole day, a moment is a point: midnight today is an hour out.
      expect(await matching('in_last', [1, 'HOUR'])).toEqual([17055]);
      expect(await matching('in_next', [1, 'HOUR'])).toEqual([17059]);
      expect(await matching('in_last', [1, 'DAY'])).toEqual([17055, 17056, 17057, 17058]);
      expect(await matching('in_next', [1, 'WEEK'])).toEqual([17059, 17060, 17061]);
      expect(await matching('in_last', [1, 'MONTH'])).toEqual([17055, 17056, 17057, 17058, 17062]);
      expect(await matching('in_last', [1, 'YEAR'])).toEqual([17055, 17056, 17057, 17058, 17062]);
    });

    it('adds the rows with no moment to the negating forms', async () => {
      const negated = await matching('not_in_last', [1, 'HOUR']);
      expect(negated).toHaveLength(59);
      expect(negated).not.toContain(17055);
      // 52 of the 60 Versions carry nothing at all, and every one of them is in the answer.
      expect(negated).toContain(17063);
      expect(await matching('in_last', [1, 'HOUR'])).not.toContain(17063);
    });

    it('buckets a calendar day, week, month and year at the UTC boundary', async () => {
      expect(await matching('in_calendar_day', 0)).toEqual([17055, 17056, 17057, 17059]);
      expect(await matching('in_calendar_day', -1)).toEqual([17058]);
      expect(await matching('in_calendar_week', 0)).toEqual([17055, 17056, 17057, 17059, 17060]);
      expect(await matching('in_calendar_week', 1)).toEqual([17061]);
      expect(await matching('in_calendar_month', 0)).toEqual([17055, 17056, 17057, 17058, 17059, 17060, 17061]);
      expect(await matching('in_calendar_month', -1)).toEqual([17062]);
      expect(await matching('in_calendar_year', 0)).toEqual([17055, 17056, 17057, 17058, 17059, 17060, 17061]);
      expect(await matching('in_calendar_year', -1)).toEqual([17062]);
    });
  });

  it('clamps a month and a year onto a day the target does not have', async () => {
    const march = await sited('Asset', 'sg_due_date', { 1226: '2026-02-28', 1227: '2026-02-27' }, '2026-03-31T12:00:00Z');
    expect(await ids(march, 'Asset', 'sg_due_date', 'in_last', [1, 'MONTH'])).toEqual([1226]);
    const leap = await sited('Asset', 'sg_due_date', { 1226: '2027-02-28', 1227: '2027-02-27' }, '2028-02-29T12:00:00Z');
    expect(await ids(leap, 'Asset', 'sg_due_date', 'in_last', [1, 'YEAR'])).toEqual([1226]);
  });

  it('400s on a value that is not [count, UNIT]', async () => {
    const c = await sited('Asset', 'sg_due_date', DATES);
    const refused = (operator: Operator, value: unknown): Promise<unknown> =>
      c.search('Asset', { filters: only('sg_due_date', operator, value) });
    await expect(refused('in_last', 1)).rejects.toMatchObject({
      status: 400,
      message: "API read() 'in_last' 'relation' expects a 2-element array: [1]",
    });
    await expect(refused('in_last', [1])).rejects.toMatchObject({ status: 400 });
    await expect(refused('in_next', [100, 'day'])).rejects.toMatchObject({
      status: 400,
      message:
        `API read() 'in_next' 'relation' doesn't support the 'day' time unit: [100, "day"]` +
        `  Valid time units: ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]`,
    });
    await expect(refused('in_last', [-10, 'DAY'])).rejects.toMatchObject({
      status: 400,
      message: "API read() 'in_last' 'relation' expects at a positive Integer time unit",
    });
    // The value is refused before the rows are read, so a negating form on a row with no date still 400s.
    await expect(refused('not_in_last', [0, 'DAY'])).rejects.toBeInstanceOf(SgApiError);
  });

  it('reads the clock on every call, and defaults it to now', async () => {
    let now = Date.parse(NOW);
    const c = await sited('Asset', 'sg_due_date', { 1226: '2026-01-05' }, () => now);
    expect(await ids(c, 'Asset', 'sg_due_date', 'in_calendar_day', 0)).toEqual([1226]);
    now += 86_400_000;
    expect(await ids(c, 'Asset', 'sg_due_date', 'in_calendar_day', 0)).toEqual([]);
    expect(await ids(c, 'Asset', 'sg_due_date', 'in_calendar_day', -1)).toEqual([1226]);

    const live = new MockClient();
    await live.update('Asset', 1226, { sg_due_date: new Date().toISOString().slice(0, 10) });
    expect(await ids(live, 'Asset', 'sg_due_date', 'in_calendar_day', 0)).toContain(1226);
  });

  it('reaches the fixtures from MOCK_NOW', async () => {
    const c = new MockClient({ now: MOCK_NOW });
    // Every Version is created inside the 120 days before the mock's today, and none after it.
    expect(await count(c, 'Version', only('created_at', 'in_last', [120, 'DAY']))).toBe(60);
    expect(await count(c, 'Version', only('created_at', 'in_next', [1, 'YEAR']))).toBe(0);
    expect(await count(c, 'Version', only('created_at', 'not_in_next', [1, 'YEAR']))).toBe(60);
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
    expect(await count(c, 'Shot', { logical_operator: 'and', conditions: [] })).toBe(33);
    expect(await count(c, 'Shot', null)).toBe(33);
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
    expect(seen).toHaveLength(33);
    expect(new Set(seen).size).toBe(33);
    // 33 rows in pages of 7: the fifth page holds 5, so hasMore is false there (006_pagination).
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
    // The map's value is a filter array, which is the only shape `entity_types` takes.
    const scoped = await c.textSearch('0010', { Shot: [['project', 'is', { type: 'Project', id: 71 }]] });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((row) => row.name.startsWith('hb'))).toBe(true);
    const row = scoped[0];
    // There is no `fields` parameter: name, links and status, whatever the type.
    expect(Object.keys(row ?? {}).sort()).toEqual(['id', 'links', 'name', 'status', 'type']);
    expect(row?.links).toEqual(['Sequence', 'hb010']);
  });

  it('takes an and-group as well, and refuses a shape the array form cannot carry', async () => {
    const group = await c.textSearch('0010', {
      Shot: { logical_operator: 'and', conditions: [['project', 'is', { type: 'Project', id: 71 }]] },
    });
    expect(group.map((r) => r.name)).toEqual(
      (await c.textSearch('0010', { Shot: [['project', 'is', { type: 'Project', id: 71 }]] })).map((r) => r.name),
    );
    await expect(c.textSearch('0010', { Shot: { logical_operator: 'or', conditions: [] } })).rejects.toThrow(/'and' only/);
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

  it('refuses a read-only field, a create-only one and an unknown one', async () => {
    const c = client();
    await expect(c.update('Shot', 862, { id: 1 })).rejects.toMatchObject({
      status: 400,
      message: 'API update() Shot.id is read only.',
    });
    // A timestamp is stored on create and refused on update (070_authored_timestamps).
    await expect(c.update('Shot', 862, { created_at: '2026-01-01T00:00:00Z' })).rejects.toMatchObject({
      status: 400,
      message: 'API update() Shot.created_at is editable on create only.',
    });
    await expect(c.update('Shot', 862, { sg_not_a_field: 1 })).rejects.toBeInstanceOf(SgApiError);
  });

  it('refuses a bare id where an entity link hash is required', async () => {
    const c = client();
    await expect(c.update('Version', 17055, { entity: 862 })).rejects.toMatchObject({
      status: 400,
      message: /^API update\(\) Version\.entity expected \[Hash, .* but got Integer: 862$/,
    });
    await expect(c.update('Version', 17055, { entity: { id: 862 } })).rejects.toMatchObject({
      status: 400,
      message: `API update() invalid/missing entity hash string 'type': {"id":862}`,
    });
  });

  it('404s on an id that is not there', async () => {
    const c = client();
    await expect(c.update('Shot', 999999999, { description: 'x' })).rejects.toMatchObject({
      status: 404,
      message: 'Entity of type [Shot] with id=999999999 does not exist.',
    });
  });
});

describe('the navigation tree', () => {
  it('answers one level, and names the next paths', async () => {
    const c = client();
    const root = await c.hierarchyExpand('/Project/70');
    expect(root.ref).toEqual({ kind: 'entity', value: { type: 'Project', id: 70 } });
    expect(root.children.map((n) => n.label)).toEqual(['Assets', 'Shots']);
    // A child names the path that opens it, and `hasChildren` says whether that is worth doing.
    expect(root.children.map((n) => n.path)).toEqual(['/Project/70/Asset', '/Project/70/Shot']);
    expect(root.children.every((n) => n.children.length === 0)).toBe(true);
    expect(root.children.every((n) => n.hasChildren)).toBe(true);
  });

  it('walks Project > Sequence > Shot > Task', async () => {
    const c = client();
    const shots = await c.hierarchyExpand('/Project/70/Shot');
    const sequence = shots.children[0];
    if (!sequence) throw new Error('no sequence');
    // The path runs through the field name the site navigates by (post_hierarchy_search).
    expect(sequence.path).toMatch(/\/Project\/70\/Shot\/sg_sequence\/Sequence\/\d+$/);
    const level = await c.hierarchyExpand(sequence.path);
    expect(level.children.length).toBeGreaterThan(0);
    const shot = level.children[0];
    if (!shot) throw new Error('no shot');
    expect(hierarchyEntity(shot.ref)?.type).toBe('Shot');
    // A Shot carries its Tasks, so the tree goes one level further.
    expect(shot.hasChildren).toBe(true);
    const shotNode = await c.hierarchyExpand(shot.path);
    expect(shotNode.children.map((n) => n.label)).toEqual(['Tasks']);
    const tasks = await c.hierarchyExpand(shotNode.children[0]?.path ?? '');
    expect(tasks.children.length).toBeGreaterThan(0);
    expect(hierarchyEntity(tasks.children[0]?.ref)?.type).toBe('Task');
  });

  it('walks Project > Asset > Task', async () => {
    const c = client();
    const assets = await c.hierarchyExpand('/Project/70/Asset');
    const asset = assets.children[0];
    if (!asset) throw new Error('no asset');
    expect(hierarchyEntity(asset.ref)?.type).toBe('Asset');
    const assetNode = await c.hierarchyExpand(asset.path);
    const tasks = await c.hierarchyExpand(assetNode.children[0]?.path ?? '');
    expect(hierarchyEntity(tasks.children[0]?.ref)?.type).toBe('Task');
  });

  it('400s on a project that is not there', async () => {
    const c = client();
    await expect(c.hierarchyExpand('/Project/999999999')).rejects.toMatchObject({ status: 400 });
  });

  it('hides every row of a level whose grouping field has no rows', async () => {
    const c = client();
    const shots = await c.hierarchyExpand('/Project/72/Shot');
    // One `empty` child, no bucket among the children, and no path of its own
    // (064_hierarchy_expand_buckets).
    expect(shots.children.map((n) => n.ref.kind)).toEqual(['empty']);
    expect(shots.children[0]?.path).toBe('/Project/72/Shot');
  });

  it('answers the bucket path at both its spellings', async () => {
    const c = client();
    const long = await c.hierarchyExpand('/Project/72/Shot/sg_sequence/Sequence/__none__');
    const short = await c.hierarchyExpand('/Project/72/Shot/sg_sequence/__none__');
    expect(long.children.map((n) => n.label)).toEqual(['nf_0010', 'nf_0020', 'nf_0030']);
    expect(short.children.map((n) => n.label)).toEqual(long.children.map((n) => n.label));
  });

  it('names the grouping field a level takes in the 400 it answers a bogus one', async () => {
    const c = client();
    await expect(c.hierarchyExpand('/Project/72/Shot/nope')).rejects.toMatchObject({
      status: 400,
      message: 'Unexpected field name in path: nope (expecting sg_sequence)',
    });
  });

  it('places an ungrouped row under the bucket the search endpoint spells', async () => {
    const c = client();
    const [found] = await c.hierarchySearch('/Project/72', { type: 'Shot', id: 892 });
    expect(found?.incrementalPath).toEqual([
      '/Project/72',
      '/Project/72/Shot',
      '/Project/72/Shot/sg_sequence/__none__',
      '/Project/72/Shot/sg_sequence/__none__/id/892',
    ]);
  });
});

describe('summarize', () => {
  it('counts without paging rows', async () => {
    const c = client();
    const all = await c.search('Version', { fields: ['id'], page: { size: 500 } });
    const summary = await c.summarize('Version');
    expect(summary.summaries['id']).toBe(all.data.length);
    expect(summary.groups).toEqual([]);
  });

  it('counts the rows a filter matches', async () => {
    const c = client();
    const filters: WireGroup = { logical_operator: 'and', conditions: [['sg_status_list', 'is', 'ip']] };
    const rows = await c.search('Version', { filters, fields: ['id'], page: { size: 500 } });
    const summary = await c.summarize('Version', { filters });
    expect(summary.summaries['id']).toBe(rows.data.length);
  });

  it('returns one group per distinct value, keyed on group_value', async () => {
    const c = client();
    const summary = await c.summarize('Version', { grouping: [{ field: 'sg_status_list' }] });
    expect(summary.groups.length).toBeGreaterThan(1);
    const total = summary.groups.reduce((n, g) => n + (g.summaries['id'] ?? 0), 0);
    expect(total).toBe(summary.summaries['id']);
    for (const group of summary.groups) expect(typeof group.groupValue).toBe('string');
  });

  it('groups an entity field on the reference, with the name as the label', async () => {
    const c = client();
    const summary = await c.summarize('Note', { grouping: [{ field: 'user' }] });
    expect(summary.groups.length).toBeGreaterThan(0);
    for (const group of summary.groups) {
      expect(group.groupValue).toMatchObject({ type: 'HumanUser', id: expect.any(Number), name: group.groupName, valid: 'valid' });
      expect(group.groupName).not.toBe('');
    }
    const links = await c.summarize('Note', { grouping: [{ field: 'addressings_to' }] });
    expect(links.groups.length).toBeGreaterThan(0);
    for (const group of links.groups) expect(group.groupValue).toEqual([{ type: 'HumanUser', id: expect.any(Number), name: group.groupName, valid: 'valid' }]);
  });

  it('refuses to group the read state and an image', async () => {
    const c = client();
    await expect(c.summarize('Note', { grouping: [{ field: 'read_by_current_user' }] })).rejects.toMatchObject({
      status: 400,
      message: 'Grouping is not allowed for field Note.read_by_current_user.',
    });
    await expect(c.summarize('Version', { grouping: [{ field: 'image' }] })).rejects.toMatchObject({ status: 400 });
  });
});

describe('a note thread', () => {
  it('returns the Note, its Attachments and its Replies in time order', async () => {
    const c = client();
    const thread = await c.threadContents(11030);
    expect(thread.map((row) => [row.type, row.id])).toEqual([
      ['Note', 11030],
      ['Attachment', 2626],
      ['Reply', 610],
      ['Attachment', 2627],
      ['Reply', 611],
    ]);
    const times = thread.map((row) => String(row.createdAt));
    expect([...times].sort()).toEqual(times);
  });

  it('names the author under created_by on a Note and an Attachment and under user on a Reply', async () => {
    const thread = await client().threadContents(11030);
    const note = thread[0];
    const attachment = thread[1];
    const reply = thread[2];
    expect(note?.fields['created_by']).toEqual(note?.author);
    expect(note?.fields['user']).toBeUndefined();
    expect(attachment?.fields['created_by']).toEqual(attachment?.author);
    expect(reply?.fields['user']).toEqual(reply?.author);
    expect(reply?.fields['created_by']).toBeUndefined();
    // Only a Reply's author hash carries the presigned avatar.
    expect(reply?.author?.image).toMatch(/^https:\/\//);
    expect(note?.author?.image).toBeUndefined();
  });

  it('carries no content on an Attachment row', async () => {
    const thread = await client().threadContents(11030);
    const attachment = thread.find((row) => row.type === 'Attachment');
    expect(attachment?.content).toBeNull();
    expect(attachment?.fields).not.toHaveProperty('content');
  });

  it('widens a Note and an Attachment, and ignores the Reply entry', async () => {
    const thread = await client().threadContents(11030, {
      Note: ['subject', 'sg_status_list'],
      Attachment: ['filename'],
      Reply: ['updated_at'],
    });
    expect(thread[0]?.fields['subject']).toBe('Key light reads flat');
    expect(thread[0]?.fields['sg_status_list']).toBe('opn');
    expect(thread[1]?.fields['filename']).toBe('key_light_ref.png');
    expect(thread[2]?.fields).not.toHaveProperty('updated_at');
  });

  it('answers one row for a note with no replies, and 404s on an unknown note', async () => {
    const c = client();
    const alone = await c.threadContents(11032);
    expect(alone.map((row) => row.type)).toEqual(['Note']);
    await expect(c.threadContents(999999999)).rejects.toMatchObject({ status: 404 });
  });

  it('reads read_by_current_user as a code and types it as a list', async () => {
    const c = client();
    const fields = await c.fields('Note');
    expect(fields['read_by_current_user']?.dataType).toBe('list');
    expect(fields['read_by_current_user']?.validValues).toEqual(['unread', 'read']);
    const note = (await c.search('Note', { filters: only('id', 'is', 11030), fields: ['read_by_current_user'] })).data[0];
    expect(note?.attributes['read_by_current_user']).toBe('unread');
  });

  it('has no project field on Reply', async () => {
    const c = client();
    await expect(c.search('Reply', { filters: only('project', 'is', { type: 'Project', id: 70 }) })).rejects.toMatchObject({
      status: 400,
      message: "API read() Reply.project doesn't exist.",
    });
  });
});

describe('the event log', () => {
  it('answers newest first, by id', async () => {
    const log = await client().eventLog({ page: { size: 10 } });
    const ids = log.data.map((entry) => entry.id);
    expect(ids.length).toBe(10);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  });

  it('narrows on entity, event type and attribute name, and reads the values out of meta', async () => {
    const c = client();
    const shot = (await c.search('Shot', { fields: ['sg_status_list'], page: { size: 1 } })).data[0];
    if (!shot) throw new Error('no shot');
    const log = await c.eventLog({
      entity: { type: 'Shot', id: shot.id },
      eventType: 'Shotgun_Shot_Change',
      attributeName: 'sg_status_list',
    });
    expect(log.data.length).toBe(1);
    const entry = log.data[0];
    expect(entry?.entity).toMatchObject({ type: 'Shot', id: shot.id });
    expect(entry?.meta?.['type']).toBe('attribute_change');
    expect(entry?.oldValue).toBe('wtg');
    // The newest entry's new_value is what the row holds now, which is what makes a restore safe.
    expect(entry?.newValue).toBe(shot.attributes['sg_status_list']);
  });

  it('keeps an event whose target is deleted, with entity null and meta naming it', async () => {
    const log = await client().eventLog({ eventType: 'Shotgun_Shot_Change', page: { size: 50 } });
    const orphan = log.data.find((entry) => entry.entity === null);
    expect(orphan?.meta?.['entity_id']).toBe(9001);
    expect(orphan?.newValue).toBe('omt');
  });

  it('cuts on project and on a date window', async () => {
    const c = client();
    const all = await c.eventLog({ page: { size: 100 } });
    const mine = await c.eventLog({ projectId: 71, page: { size: 100 } });
    expect(mine.data.length).toBeGreaterThan(0);
    expect(mine.data.length).toBeLessThan(all.data.length);
    for (const entry of mine.data) expect(entry.project?.id).toBe(71);

    const recent = await c.eventLog({ since: '2026-01-02T00:00:00Z', page: { size: 100 } });
    expect(recent.data.length).toBeGreaterThan(0);
    for (const entry of recent.data) expect(String(entry.createdAt) > '2026-01-02T00:00:00Z').toBe(true);
  });

  it('refuses a filter on meta, the field that holds the answer', async () => {
    const c = client();
    await expect(c.search('EventLogEntry', { filters: only('meta', 'is', null) })).rejects.toMatchObject({
      status: 400,
      message: "API read() EventLogEntry.meta's 'serializable' data type cannot be used in a filter.",
    });
  });
});

describe('what a person follows', () => {
  it('answers a type and an id per row, unpaged', async () => {
    const rows = await client().following(20);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['id', 'type']);
    expect(new Set(rows.map((row) => row.type))).toEqual(new Set(['Note', 'Task']));
  });

  it('takes the schema name and the plural alike, and cuts on the project', async () => {
    const c = client();
    const notes = await c.following(20, { entity: 'Note' });
    expect(await c.following(20, { entity: 'notes' })).toEqual(notes);
    expect(notes.every((row) => row.type === 'Note')).toBe(true);
    // A type nobody follows is an empty list, not an error.
    expect(await c.following(20, { entity: 'shots' })).toEqual([]);
    const inProject = await c.following(20, { projectId: 70 });
    expect(inProject.length).toBeGreaterThan(0);
    expect(inProject.length).toBeLessThanOrEqual((await c.following(20)).length);
  });

  it('404s on a user who is not a HumanUser and on an unknown project', async () => {
    const c = client();
    await expect(c.following(90)).rejects.toMatchObject({ status: 404 });
    await expect(c.following(20, { projectId: 999999999 })).rejects.toMatchObject({ status: 404 });
    await expect(c.following(20, { entity: 'nonsense' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('create', () => {
  it('refuses a project-scoped create with no project, and echoes the body', async () => {
    const c = client();
    await expect(c.create('Note', { subject: 'No project' })).rejects.toMatchObject({
      status: 400,
      message: 'API create() missing \'project\' attribute: {"subject":"No project"}',
    });
  });

  it('fills the identity field the server generates, and leaves a Note titleless', async () => {
    const c = client();
    const shot = await c.create('Shot', { project: { type: 'Project', id: 70 } });
    expect(shot.attributes['code']).toBe(`New Shot ${shot.id}`);
    // A Note's subject is optional and is not auto-filled (entity_types/Note).
    const note = await c.create('Note', { project: { type: 'Project', id: 70 } });
    expect(note.attributes['subject']).toBeNull();
    expect(note.attributes['cached_display_name']).toBe('');
    // The defaults come back on the answer, so they are read off it (entity_types/Note).
    expect(note.attributes['sg_status_list']).toBe('opn');
    expect(note.attributes['read_by_current_user']).toBe('unread');
    expect(note.attributes['publish_status']).toBe('published');
  });

  it('stores an authored created_at and updated_at, and has no updated_at on a Reply', async () => {
    const c = client();
    const project = { type: 'Project', id: 70 };
    // Both are flagged `editable: false` and both are taken by a create (070_authored_timestamps).
    const dated = await c.create('Note', { project, subject: 'Imported', created_at: '2019-03-04T05:06:07Z', updated_at: '2020-01-02T03:04:05Z' });
    expect(dated.attributes['created_at']).toBe('2019-03-04T05:06:07Z');
    expect(dated.attributes['updated_at']).toBe('2020-01-02T03:04:05Z');
    await expect(c.create('Reply', { entity: { type: 'Note', id: 11030 }, updated_at: '2020-01-02T03:04:05Z' })).rejects.toMatchObject({
      status: 400,
      message: "API create() Reply.updated_at doesn't exist.",
    });
  });

  it('takes this_file on an Attachment create and never after', async () => {
    const c = client();
    const project = { type: 'Project', id: 70 };
    const link = { url: 'https://example.com/probe.png', name: 'probe.png' };
    const made = await c.create('Attachment', { project, this_file: link });
    expect(made.attributes['this_file']).toEqual(link);
    await expect(c.update('Attachment', made.id, { this_file: link })).rejects.toMatchObject({
      status: 400,
      message: 'API update() Attachment.this_file is editable on create only.',
    });
  });

  it('refuses a bare id where an entity link hash is required', async () => {
    const c = client();
    await expect(c.create('Reply', { entity: 11030, content: 'On it.' })).rejects.toMatchObject({
      status: 400,
      message: /^API create\(\) Reply\.entity expected \[Hash, .* but got Integer: 11030$/,
    });
  });

  it('puts a Reply in the thread it names, and keeps one that names nothing', async () => {
    const c = client();
    const reply = await c.create('Reply', { entity: { type: 'Note', id: 11030 }, content: 'On it.' });
    expect(reply.relationships['entity']?.data).toMatchObject({ type: 'Note', id: 11030 });
    const thread = await c.threadContents(11030);
    expect(thread[thread.length - 1]?.id).toBe(reply.id);
    // A Reply created without `entity` is legal and is permanent litter (entity_types/Reply).
    const orphan = await c.create('Reply', { content: 'Nowhere.' });
    expect(orphan.relationships['entity']?.data).toBeNull();
  });

  it('refuses an unknown field, a read-only one and an empty identity', async () => {
    const c = client();
    const project = { type: 'Project', id: 70 };
    await expect(c.create('Note', { project, nope: 1 })).rejects.toMatchObject({ message: "API create() Note.nope doesn't exist." });
    await expect(c.create('Attachment', { project, filename: 'probe.png' })).rejects.toMatchObject({
      message: 'API create() Attachment.filename is read only.',
    });
    await expect(c.create('Shot', { project, code: '' })).rejects.toMatchObject({
      message: 'Create failed for [Shot]: Cannot set identifier field to empty. (Shot)',
    });
  });
});

describe('upload', () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);

  it('puts an Attachment on the row and names the kind after the field', async () => {
    const c = client();
    const before = c.rowsOf('Attachment').length;
    const result = await c.upload('Note', 11030, { filename: 'screenshot.png', data: bytes, field: 'attachments' });
    expect(result.uploadType).toBe('Attachment');
    expect(result.uploadInfo['original_filename']).toBe('screenshot.png');
    expect(c.rowsOf('Attachment')).toHaveLength(before + 1);
    const thread = await c.threadContents(11030);
    expect(thread.filter((row) => row.type === 'Attachment').map((row) => row.fields['id'])).toContain(
      c.rowsOf('Attachment')[before]?.['id'],
    );
  });

  it('is a Thumbnail on image, and the field reads a placeholder until the transcode lands', async () => {
    const c = client();
    const result = await c.upload('Shot', 862, { filename: 'frame.png', data: bytes, field: 'image' });
    expect(result.uploadType).toBe('Thumbnail');
    const shot = (await c.search('Shot', { filters: only('id', 'is', 862), fields: ['image'] })).data[0];
    // Absolute, on the site root (013_upload_media).
    expect(String(shot?.attributes['image'])).toMatch(/^https:\/\/[^/]+\/images\/status\/transient\//);
  });

  it('leaves the size and the extension unset, as an uploaded row reads them', async () => {
    const c = client();
    await c.upload('Version', 17055, { filename: 'workflow.json', data: bytes });
    const attachment = c.rowsOf('Attachment').at(-1);
    expect(attachment?.['file_size']).toBeNull();
    expect(attachment?.['file_extension']).toBeNull();
    // Not one of the four values its own `valid_values` declares (entity_types/Attachment).
    expect(attachment?.['processing_status']).toBe('thumbnail_pending_us');
  });

  it('404s on a field the type does not have and on a row that is not there', async () => {
    const c = client();
    await expect(c.upload('Shot', 862, { filename: 'x.png', data: bytes, field: 'attachments' })).rejects.toMatchObject({
      status: 404,
      message: "Field 'Shot.attachments' does not exist.",
    });
    await expect(c.upload('Shot', 999999, { filename: 'x.png', data: bytes })).rejects.toMatchObject({ status: 404 });
  });
});

describe('delete and revive', () => {
  it('retires a row, refuses a second delete, and revives it with its values', async () => {
    const c = client();
    const before = await c.search('Shot', { filters: only('id', 'is', 862), fields: ['code', 'description'] });
    await expect(c.delete('Shot', 862)).resolves.toBeUndefined();
    expect(await count(c, 'Shot', only('id', 'is', 862))).toBe(0);
    await expect(c.update('Shot', 862, { description: 'x' })).rejects.toMatchObject({ status: 404 });
    // A second delete is 404: the effect is idempotent, the status is not (delete_entity_type_id).
    await expect(c.delete('Shot', 862)).rejects.toMatchObject({
      status: 404,
      message: 'Entity of type [Shot] with id=862 does not exist.',
    });
    await expect(c.revive('Shot', 862)).resolves.toBe(true);
    // Field values survive the retire and come back with the revive (post_entity_type_id).
    expect(await c.search('Shot', { filters: only('id', 'is', 862), fields: ['code', 'description'] })).toEqual(before);
  });

  it('answers false for a live row and 404 for an id that never existed', async () => {
    const c = client();
    await expect(c.revive('Shot', 862)).resolves.toBe(false);
    await expect(c.revive('Version', 999999999)).rejects.toMatchObject({
      status: 404,
      message: 'Entity of type [Version] with id=999999999 does not exist.',
    });
  });

  it('never hands a retired id to a create', async () => {
    const c = client();
    const made = await c.create('Shot', { project: { type: 'Project', id: 70 } });
    await c.delete('Shot', made.id);
    const next = await c.create('Shot', { project: { type: 'Project', id: 70 } });
    expect(next.id).toBeGreaterThan(made.id);
  });
});

describe('batch', () => {
  const project = { type: 'Project', id: 70 };

  it('answers one row per request in request order', async () => {
    const c = client();
    const results = await c.batch([
      { request_type: 'create', entity: 'Version', data: { project, code: 'v001', entity: { type: 'Shot', id: 862 } } },
      { request_type: 'update', entity: 'Shot', record_id: 862, data: { description: 'batched' } },
      { request_type: 'create', entity: 'Version', data: { project, code: 'v001', entity: { type: 'Shot', id: 862 } } },
    ]);
    expect(results.map((r) => r.request_type)).toEqual(['create', 'update', 'create']);
    const [first, updated, second] = results;
    if (first?.request_type !== 'create' || updated?.request_type !== 'update' || second?.request_type !== 'create') throw new Error('shape');
    // Two creates of one code are two rows, told apart by position and id (recipes/002).
    expect(first.data.attributes['code']).toBe('v001');
    expect(second.data.id).not.toBe(first.data.id);
    expect(updated.data.attributes['description']).toBe('batched');

    const deleted = await c.batch([{ request_type: 'delete', entity: 'Version', record_id: first.data.id }]);
    expect(deleted).toEqual([
      { request_type: 'delete', type: 'Version', id: first.data.id, uuid: expect.any(String), did_delete: true },
    ]);
    expect(await count(c, 'Version', only('id', 'is', first.data.id))).toBe(0);
  });

  it('answers an empty list for no requests', async () => {
    expect(await client().batch([])).toEqual([]);
  });

  it('rolls every request back when one fails', async () => {
    const c = client();
    const before = await count(c, 'Version', null);
    const rejected = c.batch([
      { request_type: 'create', entity: 'Version', data: { project, code: 'v001' } },
      { request_type: 'update', entity: 'Shot', record_id: 862, data: { description: 'after' } },
      { request_type: 'delete', entity: 'Version', record_id: 999999999 },
    ]);
    await expect(rejected).rejects.toMatchObject({ status: 404, message: 'Entity of type [Version] with id=999999999 does not exist.' });
    expect(await count(c, 'Version', null)).toBe(before);
    expect(await attrs(c, 'Shot', only('id', 'is', 862), 'description')).not.toEqual(['after']);
  });

  it('refuses an unknown field in a create in the batch spelling', async () => {
    const rejected = client().batch([{ request_type: 'create', entity: 'Version', data: { project, sg_not_a_field: 1 } }]);
    await expect(rejected).rejects.toMatchObject({
      status: 400,
      message:
        'Invalid field value, update failed [2 - Invalid field name: field [Version.sg_not_a_field] does not exist or user does not have access permission.]',
    });
  });

  it('lets a create with no project through, to a row only a delete reaches', async () => {
    // report 001: the batch skips the check a single create makes, and the row is unreadable.
    const c = client();
    const [made] = await c.batch([{ request_type: 'create', entity: 'Version', data: { code: 'v001' } }]);
    if (made?.request_type !== 'create') throw new Error('shape');
    expect(await count(c, 'Version', only('id', 'is', made.data.id))).toBe(0);
    await expect(c.update('Version', made.data.id, { code: 'v002' })).rejects.toMatchObject({ status: 404 });
    await expect(c.delete('Version', made.data.id)).resolves.toBeUndefined();
  });

  it('refuses a delete of a deleted row and takes the batch down with it', async () => {
    const c = client();
    await c.delete('Shot', 862);
    const before = await count(c, 'Version', null);
    const rejected = c.batch([
      { request_type: 'create', entity: 'Version', data: { project, code: 'v001' } },
      { request_type: 'delete', entity: 'Shot', record_id: 862 },
    ]);
    await expect(rejected).rejects.toMatchObject({ status: 404, message: 'Entity of type [Shot] with id=862 does not exist.' });
    expect(await count(c, 'Version', null)).toBe(before);
  });
});
