import { describe, expect, it } from 'vitest';
import {
  pathOf,
  rowCode,
  rowFields,
  rowSecondary,
  rowSubLabel,
  rowThumbnail,
  secondaryType,
  thumbnailField,
  type CollectionColumn,
} from '../src/index.js';

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
