import { describe, expect, it } from 'vitest';
import {
  createSchemaService,
  createStatusService,
  pathOf,
  resolveRowFields,
  rowCode,
  rowFields,
  rowSecondary,
  rowSubLabel,
  rowThumbnail,
  secondaryType,
  subLabelType,
  thumbnailField,
  type CollectionColumn,
} from '../src/index.js';
import { MockClient } from '../src/mock.js';

const column: CollectionColumn = {
  path: 'sg_status_list',
  header: 'Status',
  dataType: 'status_list',
  editable: true,
  align: 'left',
  sortable: true,
  field: null,
};

describe('pathOf', () => {
  it('takes a bare path or a resolved column', () => {
    expect(pathOf('code')).toBe('code');
    expect(pathOf(column)).toBe('sg_status_list');
  });

  it('answers an empty path for nothing', () => {
    expect(pathOf(null)).toBe('');
    expect(pathOf(undefined)).toBe('');
  });
});

describe('thumbnailField', () => {
  it('defaults to image and is off on false', () => {
    expect(thumbnailField({})).toBe('image');
    expect(thumbnailField({ thumbnail: 'sg_uploaded_movie_image' })).toBe('sg_uploaded_movie_image');
    expect(thumbnailField({ thumbnail: false })).toBeNull();
  });
});

describe('rowFields', () => {
  it('asks for every part of the anatomy once, base first', () => {
    expect(
      rowFields(
        {
          labelField: 'code',
          subLabelField: 'description',
          secondaryField: column,
          showCode: true,
          fields: ['code', 'sg_cut_in'],
        },
        ['id', 'type', 'code'],
      ),
    ).toEqual(['id', 'type', 'code', 'description', 'sg_status_list', 'image', 'sg_cut_in']);
  });

  it('leaves the image out when the thumbnail is off', () => {
    expect(rowFields({ thumbnail: false }, ['id'])).toEqual(['id']);
  });

  it('asks for code only when the code is shown', () => {
    expect(rowFields({ thumbnail: false })).toEqual([]);
    expect(rowFields({ thumbnail: false, showCode: true })).toEqual(['code']);
  });
});

describe('rowThumbnail', () => {
  it('reads the named field and ignores anything that is not a URL', () => {
    expect(rowThumbnail({ image: 'https://x/y.jpg' }, {})).toBe('https://x/y.jpg');
    expect(rowThumbnail({ image: null }, {})).toBeNull();
    expect(rowThumbnail({ image: '' }, {})).toBeNull();
    expect(rowThumbnail({ image: 'https://x/y.jpg' }, { thumbnail: false })).toBeNull();
  });
});

describe('rowSubLabel', () => {
  it('is empty without a field', () => {
    expect(rowSubLabel({ description: 'a shot' }, {})).toBe('');
  });

  it('reads a scalar and a relationship alike', () => {
    expect(rowSubLabel({ description: 'a shot' }, { subLabelField: 'description' })).toBe('a shot');
    expect(rowSubLabel({ sg_cut_in: 1001 }, { subLabelField: 'sg_cut_in' })).toBe('1001');
    expect(
      rowSubLabel({ project: { type: 'Project', id: 70, name: 'Blue Moon' } }, { subLabelField: 'project' }),
    ).toBe('Blue Moon');
  });

  it('is empty on a blank value', () => {
    expect(rowSubLabel({ description: null }, { subLabelField: 'description' })).toBe('');
    expect(rowSubLabel({ project: null }, { subLabelField: 'project' })).toBe('');
  });

  it('takes a resolved column as well as a path', () => {
    expect(rowSubLabel({ sg_status_list: 'ip' }, { subLabelField: column })).toBe('ip');
  });
});

describe('rowCode', () => {
  it('shows the code only when it says something the label does not', () => {
    expect(rowCode({ code: 'sh010' }, 'Shot sh010', true)).toBe('sh010');
    expect(rowCode({ code: 'sh010' }, 'sh010', true)).toBe('');
    expect(rowCode({ code: 'sh010' }, 'Shot sh010', false)).toBe('');
    expect(rowCode({}, 'Shot sh010', true)).toBe('');
  });
});

describe('rowSecondary', () => {
  it('answers the id off the reference, not the attributes', () => {
    expect(rowSecondary({ id: 862, values: {} }, { secondaryField: 'id' })).toBe(862);
  });

  it('reads any other field off the values', () => {
    expect(rowSecondary({ id: 862, values: { sg_status_list: 'ip' } }, { secondaryField: column })).toBe('ip');
    expect(rowSecondary({ id: 862, values: {} }, {})).toBeNull();
  });
});

describe('secondaryType', () => {
  it('prefers the resolved column, then the schema, then text', () => {
    expect(secondaryType({ secondaryField: column })).toBe('status_list');
    expect(secondaryType({ secondaryField: 'sg_status_list' }, 'status_list')).toBe('status_list');
    expect(secondaryType({ secondaryField: 'description' })).toBe('text');
  });

  it('renders an id as a number, which is the mono treatment', () => {
    expect(secondaryType({ secondaryField: 'id' })).toBe('number');
  });
});

/** Two Status rows, the shape a site's Status table has, keyed by code (probe 010). */
const statuses = {
  pndng: { id: 3, code: 'pndng', name: 'Pending Review', bgColor: '236,151,31', icon: null },
  ip: { id: 4, code: 'ip', name: 'In Progress', bgColor: '25,118,27', icon: null },
};

describe('rowSubLabel by data type', () => {
  it('reads a status code as the name the site knows it by', () => {
    expect(
      rowSubLabel({ sg_status_list: 'pndng' }, { subLabelField: 'sg_status_list' }, { dataType: 'status_list', statuses }),
    ).toBe('Pending Review');
  });

  it('keeps a code the table has no row for', () => {
    expect(
      rowSubLabel({ sg_status_list: 'zzz' }, { subLabelField: 'sg_status_list' }, { dataType: 'status_list', statuses }),
    ).toBe('zzz');
    expect(
      rowSubLabel({ sg_status_list: 'pndng' }, { subLabelField: 'sg_status_list' }, { dataType: 'status_list' }),
    ).toBe('pndng');
  });

  it('keeps an entity name and joins the names of a list of them', () => {
    expect(
      rowSubLabel(
        { project: { type: 'Project', id: 70, name: 'Blue Moon' } },
        { subLabelField: 'project' },
        { dataType: 'entity' },
      ),
    ).toBe('Blue Moon');
    expect(
      rowSubLabel(
        {
          assets: [
            { type: 'Asset', id: 1, name: 'Anna' },
            { type: 'Asset', id: 2, name: 'Rooftop' },
          ],
        },
        { subLabelField: 'assets' },
        { dataType: 'multi_entity' },
      ),
    ).toBe('Anna, Rooftop');
    expect(rowSubLabel({ assets: [] }, { subLabelField: 'assets' }, { dataType: 'multi_entity' })).toBe('');
  });

  it('leaves a date and a date-time as they were written', () => {
    expect(rowSubLabel({ due: '2026-04-07' }, { subLabelField: 'due' }, { dataType: 'date' })).toBe('2026-04-07');
    expect(
      rowSubLabel({ created_at: '2026-04-07T10:15:00Z' }, { subLabelField: 'created_at' }, { dataType: 'date_time' }),
    ).toBe('2026-04-07T10:15:00Z');
  });

  it('is the value as written for every other type, table or no table', () => {
    expect(rowSubLabel({ sg_cut_in: 1001 }, { subLabelField: 'sg_cut_in' }, { dataType: 'number', statuses })).toBe(
      '1001',
    );
    expect(rowSubLabel({ description: 'a shot' }, { subLabelField: 'description' }, { dataType: 'text' })).toBe(
      'a shot',
    );
    expect(rowSubLabel({ sg_status_list: 'pndng' }, { subLabelField: 'sg_status_list' })).toBe('pndng');
  });

  it('takes the type off a resolved column', () => {
    expect(
      rowSubLabel(
        { sg_status_list: 'ip' },
        { subLabelField: column },
        { dataType: subLabelType({ subLabelField: column }), statuses },
      ),
    ).toBe('In Progress');
  });
});

describe('subLabelType', () => {
  it('prefers the resolved column, then the schema, and names nothing otherwise', () => {
    expect(subLabelType({ subLabelField: column })).toBe('status_list');
    expect(subLabelType({ subLabelField: 'sg_status_list' }, 'status_list')).toBe('status_list');
    expect(subLabelType({ subLabelField: 'description' })).toBe('');
    expect(subLabelType({})).toBe('');
  });
});

describe('resolveRowFields', () => {
  it('resolves both fields and reads the Status table once when either is a status', async () => {
    const client = new MockClient();
    const plan = await resolveRowFields(createSchemaService(client), createStatusService(client), 'Version', {
      subLabelField: 'sg_status_list',
      secondaryField: 'id',
    });
    expect(plan.subLabel?.dataType).toBe('status_list');
    // `id` is on the row itself, so it costs no read.
    expect(plan.secondary).toBeNull();
    expect(plan.statuses?.['pndng']?.name).toBe('Pending');
  });

  it('reads no Status table when neither field is a status', async () => {
    const client = new MockClient();
    const plan = await resolveRowFields(createSchemaService(client), createStatusService(client), 'Shot', {
      subLabelField: 'description',
      secondaryField: 'code',
    });
    expect(plan.subLabel?.dataType).toBe('text');
    expect(plan.secondary?.name).toBe('code');
    expect(plan.statuses).toBeNull();
  });

  it('takes a column at its word and answers null for a field the schema has not', async () => {
    const client = new MockClient();
    const plan = await resolveRowFields(createSchemaService(client), createStatusService(client), 'Shot', {
      subLabelField: column,
      secondaryField: 'sg_not_a_field',
    });
    expect(plan.secondary).toBeNull();
    // The column declares a status, so the table loads without a schema read.
    expect(plan.statuses?.['ip']?.code).toBe('ip');
  });
});
