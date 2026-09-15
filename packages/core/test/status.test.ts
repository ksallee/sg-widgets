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
import { displayNameOf, fieldSchemaOverride, normalizeField, statusFieldFor } from '../src/schema.js';

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
});
