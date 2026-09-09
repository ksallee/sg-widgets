import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSchemaService } from '../src/schema-service.js';
import type { FieldSchema } from '../src/schema.js';
import {
  currentType,
  deriveFieldOptions,
  fieldPathOf,
  filterEntityTypes,
  friendlyFieldPath,
  matchesTokens,
  pathTypes,
  searchFieldOptions,
  traversalTargets,
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

describe('matchesTokens', () => {
  it('needs every token, in any order and any field', () => {
    expect(matchesTokens('due date', 'Due Date', 'due_date')).toBe(true);
    expect(matchesTokens('date due', 'Due Date', 'due_date')).toBe(true);
    expect(matchesTokens('due code', 'Due Date', 'due_date')).toBe(false);
    expect(matchesTokens('', 'anything')).toBe(true);
    expect(matchesTokens('STATUS', 'Status', 'sg_status_list')).toBe(true);
  });
});

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
