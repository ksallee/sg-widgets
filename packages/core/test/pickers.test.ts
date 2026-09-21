import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSchemaService } from '../src/schema-service.js';
import type { FieldSchema } from '../src/schema.js';
import {
  currentType,
  deriveFieldOptions,
  entityTypeOptions,
  fieldPathOf,
  filterEntityTypes,
  friendlyFieldPath,
  moveFieldPath,
  pathTypes,
  resolveFieldPathOptions,
  searchFieldOptions,
  searchFieldPathOptions,
  toggleFieldPath,
  traversalTargets,
  UNRESOLVED_PATH_LABEL,
  type FieldHop,
} from '../src/pickers.js';

const client = new MockClient({ seed: 1 });
const schema = createSchemaService(client);

async function fieldsOf(type: string): Promise<Record<string, FieldSchema>> {
  return schema.fields(type);
}

function pathsOf(options: { path: string }[]): string[] {
  return options.map((o) => o.path);
}

describe('filterEntityTypes', () => {
  const types = [
    { name: 'Shot', displayName: 'Shot' },
    { name: 'Asset', displayName: 'Asset' },
    { name: 'HumanUser', displayName: 'Person' },
  ];

  it('passes everything through with no restriction', () => {
    expect(filterEntityTypes(types)).toHaveLength(3);
    expect(filterEntityTypes(types, { allow: [], deny: [] })).toHaveLength(3);
  });

  it('applies allow, then deny', () => {
    expect(filterEntityTypes(types, { allow: ['Shot', 'Asset'] }).map((t) => t.name)).toEqual(['Shot', 'Asset']);
    expect(filterEntityTypes(types, { deny: ['HumanUser'] }).map((t) => t.name)).toEqual(['Shot', 'Asset']);
    expect(filterEntityTypes(types, { allow: ['Shot', 'Asset'], deny: ['Asset'] }).map((t) => t.name)).toEqual(['Shot']);
  });
});

describe('entityTypeOptions', () => {
  const types = [
    { name: 'Shot', displayName: 'Shot' },
    { name: 'Asset', displayName: 'Asset' },
    { name: 'HumanUser', displayName: 'Person' },
  ];

  it('offers nothing while the read is in flight', () => {
    const options = entityTypeOptions(null);
    expect(options.types).toEqual([]);
    expect(options.shown).toEqual([]);
    expect(options.labelOf('Shot')).toBe('Shot');
  });

  it('narrows the derived list by the query, on display name or code', () => {
    expect(entityTypeOptions(types, { query: 'person' }).shown.map((t) => t.name)).toEqual(['HumanUser']);
    expect(entityTypeOptions(types, { query: 'humanuser' }).shown.map((t) => t.name)).toEqual(['HumanUser']);
    expect(entityTypeOptions(types, { query: '' }).shown).toHaveLength(3);
  });

  it('searches what allow and deny left', () => {
    const options = entityTypeOptions(types, { deny: ['HumanUser'] });
    expect(options.types.map((t) => t.name)).toEqual(['Shot', 'Asset']);
    expect(options.shown.map((t) => t.name)).toEqual(['Shot', 'Asset']);
  });

  it('labels a code by its display name, and an absent one by itself', () => {
    const options = entityTypeOptions(types);
    expect(options.labelOf('HumanUser')).toBe('Person');
    expect(options.labelOf('CustomEntity07')).toBe('CustomEntity07');
    expect(entityTypeOptions(types, { deny: ['HumanUser'] }).labelOf('HumanUser')).toBe('HumanUser');
  });
});

describe('dotted paths', () => {
  const hops: FieldHop[] = [
    { name: 'entity', displayName: 'Link', through: 'Shot' },
    { name: 'project', displayName: 'Project', through: 'Project' },
  ];

  it('names the type it travels through at every hop', () => {
    expect(fieldPathOf([], 'code')).toBe('code');
    expect(fieldPathOf(hops, 'name')).toBe('entity.Shot.project.Project.name');
  });

  it('a path built here resolves against the schema', async () => {
    const segments = await schema.resolvePath('Version', fieldPathOf([{ name: 'entity', displayName: 'Link', through: 'Shot' }], 'code'));
    expect(segments.map((s) => s.name)).toEqual(['entity', 'code']);
    expect(friendlyFieldPath(segments)).toBe('Link › Shot Code');
  });

  it('tracks the types already visited', () => {
    expect(pathTypes('Version', hops)).toEqual(['Version', 'Shot', 'Project']);
    expect(currentType('Version', [])).toBe('Version');
    expect(currentType('Version', hops)).toBe('Project');
  });
});

describe('traversalTargets', () => {
  const link = { dataType: 'entity', validTypes: ['Shot', 'Asset', 'Sequence'] };

  it('is empty until deep links are on', () => {
    expect(traversalTargets(link, { rootType: 'Version' })).toEqual([]);
    expect(traversalTargets(link, { rootType: 'Version', deepLinks: true })).toEqual(['Shot', 'Asset', 'Sequence']);
  });

  it('refuses a multi_entity field, whose dotted path reads back nothing (probe 016)', () => {
    expect(traversalTargets({ dataType: 'multi_entity', validTypes: ['Task'] }, { rootType: 'Shot', deepLinks: true })).toEqual([]);
  });

  it('refuses a link declaring no target type', () => {
    expect(traversalTargets({ dataType: 'entity' }, { rootType: 'Version', deepLinks: true })).toEqual([]);
    expect(traversalTargets({ dataType: 'entity', validTypes: [] }, { rootType: 'Version', deepLinks: true })).toEqual([]);
  });

  it('drops a type already on the path', () => {
    const hops: FieldHop[] = [{ name: 'entity', displayName: 'Link', through: 'Shot' }];
    expect(traversalTargets(link, { rootType: 'Version', hops, deepLinks: true })).toEqual(['Asset', 'Sequence']);
    expect(traversalTargets({ dataType: 'entity', validTypes: ['Version'] }, { rootType: 'Version', hops, deepLinks: true })).toEqual([]);
  });

  it('stops at the depth limit', () => {
    const two: FieldHop[] = [
      { name: 'entity', displayName: 'Link', through: 'Shot' },
      { name: 'sg_sequence', displayName: 'Sequence', through: 'Sequence' },
    ];
    expect(traversalTargets(link, { rootType: 'Version', hops: two, deepLinks: true })).toEqual([]);
    expect(traversalTargets(link, { rootType: 'Version', hops: two, deepLinks: true, maxDepth: 3 })).toEqual(['Asset']);
    expect(traversalTargets(link, { rootType: 'Version', hops: two.slice(0, 1), deepLinks: true, maxDepth: 1 })).toEqual([]);
  });
});

describe('deriveFieldOptions', () => {
  it('sorts by display name and marks every row selectable with no restriction', async () => {
    const options = deriveFieldOptions(await fieldsOf('Version'), { rootType: 'Version' });
    expect(options.every((o) => o.selectable)).toBe(true);
    expect(options.every((o) => !o.traversable)).toBe(true);
    const names = options.map((o) => o.displayName);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('keeps a link on the list when the selection is restricted to another type', async () => {
    const options = deriveFieldOptions(await fieldsOf('Version'), {
      rootType: 'Version',
      deepLinks: true,
      dataTypes: ['date', 'date_time'],
    });
    const link = options.find((o) => o.path === 'entity');
    expect(link).toMatchObject({ selectable: false, traversable: true, targets: ['Shot', 'Asset', 'Sequence'] });
    const date = options.find((o) => o.path === 'client_approved_at');
    expect(date).toMatchObject({ selectable: true, traversable: false });
    expect(pathsOf(options)).not.toContain('code');
  });

  it('drops a link too when deep links are off and the type is not wanted', async () => {
    const options = deriveFieldOptions(await fieldsOf('Version'), { rootType: 'Version', dataTypes: 'date' });
    expect(pathsOf(options)).not.toContain('entity');
    expect(options.every((o) => o.dataType === 'date')).toBe(true);
  });

  it('takes a single data type as a string', async () => {
    const one = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Shot', dataTypes: 'checkbox' });
    const many = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Shot', dataTypes: ['checkbox'] });
    expect(pathsOf(one)).toEqual(pathsOf(many));
  });

  it('restricts selection to fields linking one of the wanted types', async () => {
    const options = deriveFieldOptions(await fieldsOf('Task'), { rootType: 'Task', validTypes: ['HumanUser'] });
    expect(pathsOf(options)).toContain('task_assignees');
    expect(pathsOf(options)).not.toContain('content');
    expect(pathsOf(options)).not.toContain('step');
  });

  it('excludes by full path, so a hop keeps its own name', async () => {
    const hops: FieldHop[] = [{ name: 'entity', displayName: 'Link', through: 'Shot' }];
    const root = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Shot', exclude: ['code'] });
    expect(pathsOf(root)).not.toContain('code');
    const nested = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Version', hops, exclude: ['code'] });
    expect(pathsOf(nested)).toContain('entity.Shot.code');
  });

  it('hides a prefix and everything beneath it', async () => {
    const hops: FieldHop[] = [{ name: 'entity', displayName: 'Link', through: 'Shot' }];
    const root = deriveFieldOptions(await fieldsOf('Version'), { rootType: 'Version', deepLinks: true, hidePaths: ['entity'] });
    expect(pathsOf(root)).not.toContain('entity');
    const nested = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Version', hops, hidePaths: ['entity'] });
    expect(nested).toHaveLength(0);
  });

  it('drops the types the API refuses in a filter (017_filter_operators)', async () => {
    const options = deriveFieldOptions(await fieldsOf('Version'), { rootType: 'Version', filterableOnly: true });
    expect(pathsOf(options)).not.toContain('sg_uploaded_movie');
    expect(pathsOf(options)).toContain('code');
  });

  it('takes a caller predicate over the schema and the full path', async () => {
    const seen: string[] = [];
    const options = deriveFieldOptions(await fieldsOf('Shot'), {
      rootType: 'Shot',
      filter: (field, path) => {
        seen.push(path);
        return field.editable;
      },
    });
    expect(seen).toContain('id');
    expect(pathsOf(options)).not.toContain('id');
    expect(pathsOf(options)).toContain('code');
  });

  it('puts computed entries first, at the root only, past every restriction', async () => {
    const extraFields = [{ name: 'row_number', displayName: 'Row Number' }];
    const root = deriveFieldOptions(await fieldsOf('Version'), { rootType: 'Version', dataTypes: 'date', extraFields });
    expect(root[0]).toMatchObject({ path: 'row_number', computed: true, selectable: true, traversable: false });
    const nested = deriveFieldOptions(await fieldsOf('Shot'), {
      rootType: 'Version',
      hops: [{ name: 'entity', displayName: 'Link', through: 'Shot' }],
      extraFields,
    });
    expect(pathsOf(nested)).not.toContain('row_number');
  });

  it('builds nested paths that resolve back through the schema', async () => {
    const hops: FieldHop[] = [{ name: 'entity', displayName: 'Link', through: 'Shot' }];
    const options = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Version', hops, dataTypes: 'date' });
    const turnover = options.find((o) => o.path === 'entity.Shot.sg_turnover_date');
    expect(turnover?.selectable).toBe(true);
    const segments = await schema.resolvePath('Version', turnover?.path ?? '');
    expect(friendlyFieldPath(segments)).toBe('Link › Turnover Date');
  });
});

describe('searchFieldOptions', () => {
  it('matches display name, code and data type', async () => {
    const options = deriveFieldOptions(await fieldsOf('Shot'), { rootType: 'Shot' });
    expect(pathsOf(searchFieldOptions(options, 'turnover'))).toEqual(['sg_turnover_date']);
    expect(pathsOf(searchFieldOptions(options, 'sg_cut_in'))).toEqual(['sg_cut_in']);
    expect(searchFieldOptions(options, '   ')).toHaveLength(options.length);
    expect(searchFieldOptions(options, 'zzznope')).toHaveLength(0);
  });
});

describe('toggleFieldPath', () => {
  it('appends a path that is absent and drops one that is there', () => {
    expect(toggleFieldPath(['code'], 'sg_status_list')).toEqual(['code', 'sg_status_list']);
    expect(toggleFieldPath(['code', 'sg_status_list'], 'code')).toEqual(['sg_status_list']);
    expect(toggleFieldPath([], 'code')).toEqual(['code']);
  });

  it('leaves the source alone', () => {
    const paths = ['code'];
    expect(toggleFieldPath(paths, 'description')).not.toBe(paths);
    expect(paths).toEqual(['code']);
  });
});

describe('moveFieldPath', () => {
  const paths = ['code', 'sg_status_list', 'entity.Shot.sg_turnover_date'];

  it('moves an entry and keeps the rest in order', () => {
    expect(moveFieldPath(paths, 2, 1)).toEqual(['code', 'entity.Shot.sg_turnover_date', 'sg_status_list']);
    expect(moveFieldPath(paths, 0, 2)).toEqual(['sg_status_list', 'entity.Shot.sg_turnover_date', 'code']);
  });

  it('leaves the order alone off either end', () => {
    expect(moveFieldPath(paths, 0, -1)).toEqual(paths);
    expect(moveFieldPath(paths, 2, 3)).toEqual(paths);
    expect(moveFieldPath(paths, 1, 1)).toEqual(paths);
    expect(moveFieldPath([], 0, 0)).toEqual([]);
  });
});

describe('resolveFieldPathOptions', () => {
  const paths = ['code', 'entity.Shot.sg_turnover_date', 'sg_nope.Thing.code'];

  it('keeps the order it was given and labels a plain path by its field', async () => {
    const options = await resolveFieldPathOptions(schema, 'Version', paths);
    expect(pathsOf(options)).toEqual(paths);
    expect(options[0]).toMatchObject({ label: 'Version Name', name: 'code', dataType: 'text', resolved: true });
  });

  it('labels a dotted path by every display name it travels', async () => {
    const [dotted] = await resolveFieldPathOptions(schema, 'Version', ['entity.Shot.sg_turnover_date']);
    expect(dotted).toMatchObject({
      label: 'Link › Shot › Turnover Date',
      name: 'sg_turnover_date',
      dataType: 'date',
      subLabel: 'date',
      resolved: true,
    });
  });

  it('keeps a path the schema does not hold, marked in its sub-label', async () => {
    const options = await resolveFieldPathOptions(schema, 'Version', paths);
    expect(options[2]).toEqual({
      path: 'sg_nope.Thing.code',
      label: 'sg_nope.Thing.code',
      name: '',
      dataType: '',
      subLabel: UNRESOLVED_PATH_LABEL,
      resolved: false,
    });
  });

  it('carries the leaf code a row shows under showCode', async () => {
    const options = await resolveFieldPathOptions(schema, 'Version', ['sg_status_list', 'entity.Shot.sg_turnover_date']);
    expect(options.map((o) => o.name)).toEqual(['sg_status_list', 'sg_turnover_date']);
  });
});

describe('searchFieldPathOptions', () => {
  it('matches the label and the path, and leaves an empty query alone', async () => {
    const options = await resolveFieldPathOptions(schema, 'Version', ['code', 'entity.Shot.sg_turnover_date', 'sg_nope']);
    expect(pathsOf(searchFieldPathOptions(options, 'turnover'))).toEqual(['entity.Shot.sg_turnover_date']);
    expect(pathsOf(searchFieldPathOptions(options, 'entity.Shot'))).toEqual(['entity.Shot.sg_turnover_date']);
    expect(pathsOf(searchFieldPathOptions(options, 'sg_nope'))).toEqual(['sg_nope']);
    expect(searchFieldPathOptions(options, '   ')).toHaveLength(3);
    expect(searchFieldPathOptions(options, 'zzznope')).toHaveLength(0);
  });
});
