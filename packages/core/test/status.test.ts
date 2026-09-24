import { describe, expect, it } from 'vitest';
import {
  foregroundFor,
  intersectStatuses,
  parseBgColor,
  statusGlyph,
  statusPaint,
  usableStatuses,
} from '../src/status.js';
import { STOCK_ICON_CELLS } from '../src/status-icons.js';
import {
  displayNameOf,
  fieldSchemaOverride,
  normalizeField,
  normalizeFields,
  statusFieldFor,
  statusFieldNameFor,
} from '../src/schema.js';

describe('usableStatuses', () => {
  const field = {
    validValues: ['na', 'rev', 'vwd', 'apr', 'fin', 'part'],
    hiddenValues: ['part', 'blk'],
    displayValues: { rev: 'Pending Review', fin: 'Final' },
  };
  it('subtracts hidden from valid and tolerates hidden codes outside valid', () => {
    expect(usableStatuses(field).map((s) => s.code)).toEqual(['na', 'rev', 'vwd', 'apr', 'fin']);
    expect(usableStatuses(field)[1]).toEqual({ code: 'rev', label: 'Pending Review' });
  });
  it('intersects across projects keeping the first order', () => {
    const other = { ...field, hiddenValues: ['na', 'vwd'] };
    expect(intersectStatuses([field, other]).map((s) => s.code)).toEqual(['rev', 'apr', 'fin']);
  });
});

describe('colours', () => {
  it('parses decimal rgb triples and rejects hex', () => {
    expect(parseBgColor('25,118,27')).toEqual({ r: 25, g: 118, b: 27 });
    expect(parseBgColor('#19761b')).toBeNull();
    expect(foregroundFor({ r: 25, g: 118, b: 27 })).toBe('white');
    expect(foregroundFor({ r: 240, g: 240, b: 240 })).toBe('black');
  });
  it('paints a status in its own colour with a readable ink on it', () => {
    expect(statusPaint({ bgColor: '25,118,27' })).toEqual({ background: 'rgb(25 118 27)', foreground: '#fff' });
    expect(statusPaint({ bgColor: '240,240,240' })?.foreground).toBe('#000');
    expect(statusPaint({ bgColor: null })).toBeNull();
    expect(statusPaint(null)).toBeNull();
  });
});

describe('statusGlyph', () => {
  it('answers one drawing per display type, and a dot for a key it cannot serve', () => {
    expect(statusGlyph(null)).toEqual({ kind: 'none' });
    expect(statusGlyph({ icon: null })).toEqual({ kind: 'none' });
    expect(statusGlyph({ icon: { displayType: 'html', html: '<b>Active</b>' } })).toEqual({
      kind: 'html',
      html: '<b>Active</b>',
    });
    expect(statusGlyph({ icon: { displayType: 'image', dataUrl: 'data:image/png;base64,AA' } })).toEqual({
      kind: 'image',
      src: 'data:image/png;base64,AA',
    });

    const bundled = statusGlyph({ icon: { displayType: 'image_map', imageMapKey: 'icon_apr' } });
    expect(bundled.kind).toBe('cell');
    if (bundled.kind === 'cell') {
      expect(bundled.cell).toEqual(STOCK_ICON_CELLS['icon_apr']);
      expect(bundled.src).toMatch(/^data:image\/png;base64,/);
    }

    const key = 'icon_x_thin_white';
    const served = statusGlyph({ icon: { displayType: 'image_map', imageMapKey: key } }, 'https://studio.example.com/');
    expect(served.kind).toBe('sprite');
    if (served.kind === 'sprite') {
      expect(served.style.backgroundPosition).toBe(`-${STOCK_ICON_CELLS[key]!.x}px -${STOCK_ICON_CELLS[key]!.y}px`);
    }
    expect(statusGlyph({ icon: { displayType: 'image_map', imageMapKey: key } })).toEqual({
      kind: 'dot',
      imageMapKey: key,
    });
  });
});

describe('schema', () => {
  it('normalises the {value, editable} wrapper', () => {
    const f = normalizeField('sg_status_list', {
      name: { value: 'Status', editable: true },
      entity_type: { value: 'Version', editable: false },
      data_type: { value: 'status_list', editable: false },
      editable: { value: true, editable: false },
      mandatory: { value: false, editable: false },
      unique: { value: false, editable: false },
      properties: {
        valid_values: { value: ['rev', 'fin'], editable: true },
        hidden_values: { value: ['fin'], editable: true },
        display_values: { value: { rev: 'Pending Review', fin: 'Final' }, editable: true },
        default_value: { value: 'rev', editable: true },
      },
    });
    expect(f.displayName).toBe('Status');
    expect(f.dataType).toBe('status_list');
    expect(f.hiddenValues).toEqual(['fin']);
    expect(statusFieldFor('Version', { sg_status_list: f })).toBe(f);
    expect(statusFieldFor('Project')).toBe('sg_status');
  });
  it('keeps visible.editable as hideable, and leaves it out when the schema does', () => {
    const raw = (visible?: { value: boolean; editable: boolean }) => ({
      name: { value: 'Code', editable: true },
      entity_type: { value: 'Project', editable: false },
      data_type: { value: 'text', editable: false },
      editable: { value: true, editable: false },
      mandatory: { value: false, editable: false },
      unique: { value: false, editable: false },
      properties: {},
      ...(visible ? { visible } : {}),
    });
    // 056_stock_vs_custom_field: false is stock; true is every custom field and a few stock ones.
    expect(normalizeField('code', raw({ value: true, editable: true })).hideable).toBe(true);
    expect(normalizeField('code', raw({ value: true, editable: false })).hideable).toBe(false);
    expect('hideable' in normalizeField('code', raw())).toBe(false);
  });
  it('the conventional status field wins over another status_list the site added', () => {
    const shape = (name: string, displayName: string) => ({
      name,
      displayName,
      entityType: 'Shot',
      dataType: 'status_list' as const,
      editable: true,
      mandatory: false,
      unique: false,
    });
    // A schema read answers in no order the caller controls, so the first status_list
    // found is not the type's status.
    const fields = {
      sg_client_status: shape('sg_client_status', 'Client Status'),
      sg_status_list: shape('sg_status_list', 'Status'),
    };
    expect(statusFieldFor('Shot', fields)).toBe(fields.sg_status_list);
    // With no conventional field the first status_list is still better than a guess.
    expect(statusFieldFor('Shot', { sg_client_status: fields.sg_client_status })).toBe(fields.sg_client_status);
    expect(statusFieldFor('Shot', {})).toBe('sg_status_list');
    expect(statusFieldNameFor('Project')).toBe('sg_status');
  });
  it('display name falls back through the conventional fields', () => {
    expect(displayNameOf({ code: 'sh010', name: 'x' })).toBe('sh010');
    expect(displayNameOf({ content: 'Comp' })).toBe('Comp');
    expect(displayNameOf({}, '#12')).toBe('#12');
  });
});

describe('the fields the schema types wrongly', () => {
  it('reads Note.read_by_current_user as a list of unread and read', () => {
    const field = normalizeField('read_by_current_user', {
      name: { value: 'Read by Current User', editable: true },
      entity_type: { value: 'Note', editable: false },
      data_type: { value: 'checkbox', editable: false },
      editable: { value: true, editable: false },
      mandatory: { value: false, editable: false },
      unique: { value: false, editable: false },
      properties: {},
    });
    expect(field.dataType).toBe('list');
    expect(field.validValues).toEqual(['unread', 'read']);
    expect(fieldSchemaOverride('Shot', 'sg_status_list')).toBeUndefined();
  });

  it('answers Note.read_by_current_user from a schema that does not declare it', () => {
    const fields = normalizeFields({
      data: {
        subject: {
          name: { value: 'Subject', editable: true },
          entity_type: { value: 'Note', editable: false },
          data_type: { value: 'text', editable: false },
          editable: { value: true, editable: false },
          mandatory: { value: true, editable: false },
          unique: { value: false, editable: false },
          properties: {},
        },
      },
    });
    const read = fields['read_by_current_user'];
    expect(read).toEqual({
      name: 'read_by_current_user',
      displayName: 'Read by Current User',
      entityType: 'Note',
      dataType: 'list',
      validValues: ['unread', 'read'],
      operators: ['is', 'is_not'],
      // A person's write is stored (068_note_read_state).
      editable: true,
      mandatory: false,
      unique: false,
    });
  });

  it('patches only the type, the values and the operators on a site that declares the field', () => {
    const declared = normalizeField('read_by_current_user', {
      name: { value: 'Read State', editable: true },
      entity_type: { value: 'Note', editable: false },
      data_type: { value: 'checkbox', editable: false },
      editable: { value: false, editable: false },
      mandatory: { value: false, editable: false },
      unique: { value: false, editable: false },
      properties: { description: { value: 'Per person.', editable: true } },
    });
    expect(declared).toEqual({
      name: 'read_by_current_user',
      displayName: 'Read State',
      entityType: 'Note',
      dataType: 'list',
      validValues: ['unread', 'read'],
      operators: ['is', 'is_not'],
      editable: false,
      mandatory: false,
      unique: false,
      description: 'Per person.',
    });
    expect(fieldSchemaOverride('Note', 'read_by_current_user')).toEqual({
      dataType: 'list',
      validValues: ['unread', 'read'],
      operators: ['is', 'is_not'],
    });
  });

  it('leaves the field the schema did declare alone, and adds nothing to another type', () => {
    const raw = (entityType: string, dataType: string) => ({
      name: { value: 'Read by Current User', editable: true },
      entity_type: { value: entityType, editable: false },
      data_type: { value: dataType, editable: false },
      editable: { value: true, editable: false },
      mandatory: { value: false, editable: false },
      unique: { value: false, editable: false },
      properties: {},
    });
    const notes = normalizeFields({ data: { read_by_current_user: raw('Note', 'checkbox') } });
    expect(Object.keys(notes)).toEqual(['read_by_current_user']);
    expect(notes['read_by_current_user']?.dataType).toBe('list');
    const shots = normalizeFields({ data: { read_by_current_user: raw('Shot', 'checkbox') } });
    expect(shots['read_by_current_user']?.dataType).toBe('checkbox');
    expect(Object.keys(normalizeFields({ data: {} }, 'Note'))).toEqual(['read_by_current_user']);
    expect(Object.keys(normalizeFields({ data: {} }))).toEqual([]);
  });
});
