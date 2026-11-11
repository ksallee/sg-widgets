import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';
import * as mock from '../src/mock.js';
import { MockClient } from '../src/mock.js';
import { MockSchemaClient } from '../src/schema-write-mock.js';
import { SchemaApiError } from '../src/schema-write.js';

function site(): MockSchemaClient {
  return new MockSchemaClient({ client: new MockClient() });
}

describe('the entries', () => {
  it('hand the client out of the root and the mock out of the mock entry', () => {
    for (const name of ['RestSchemaClient', 'ProxySchemaClient', 'createSchemaProxyHandler', 'SchemaApiError']) expect(Object.keys(core)).toContain(name);
    expect(Object.keys(core)).not.toContain('MockSchemaClient');
    expect(Object.keys(mock)).toContain('MockSchemaClient');
  });
});

describe('a create on the mock', () => {
  it('derives the name the way the server does', async () => {
    // 019_create_fields.
    const client = site();
    expect((await client.createField('Version', { dataType: 'text', displayName: 'zzprobe 019 With (Parens)' })).name).toBe('sg_zzprobe_019_with__parens_');
    expect((await client.createField('Version', { dataType: 'text', displayName: 'sg_already_prefixed' })).name).toBe('sg_sg_already_prefixed');
  });

  it('names a field with a non-ASCII display name after its data type', async () => {
    // 117_field_types_and_names.
    const client = site();
    const created = await client.createField('Version', { dataType: 'currency', displayName: 'zzprobe 117 Durée Écran ñ' });
    expect(created.name).toBe('sg_currency');
    const read = await client.readField('Version', 'sg_currency');
    expect(read.status === 'found' && read.field.displayName).toBe('zzprobe 117 Durée Écran ñ');
    await client.retireField('Version', 'sg_currency');
    const refused = await client.createField('Version', { dataType: 'currency', displayName: 'zzprobe 117 日本語 поле' }).catch((e: unknown) => e);
    expect(refused).toMatchObject({ status: 400 });
    expect((refused as Error).message).toContain('retired field with the same field_name: sg_currency');
  });

  it('suffixes a display name already in use, without a warning', async () => {
    const client = site();
    const names: string[] = [];
    for (let i = 0; i < 3; i += 1) names.push((await client.createField('Version', { dataType: 'text', displayName: 'zzprobe 041 dup' })).name);
    expect(names).toEqual(['sg_zzprobe_041_dup', 'sg_zzprobe_041_dup_1', 'sg_zzprobe_041_dup_2']);
    const read = await client.readField('Version', 'sg_zzprobe_041_dup_2');
    expect(read.status === 'found' && read.field.displayName).toBe('zzprobe 041 dup');
  });

  it('answers the body the server does, with no programmatic name in it', async () => {
    const created = await site().createField('Version', { dataType: 'text', displayName: 'Plate Note' });
    expect(created.self).toBe('/api/v1/schema/Version/fields/sg_plate_note');
    expect(JSON.stringify(created.raw)).not.toContain('sg_plate_note');
  });

  it('refuses what the server refuses', async () => {
    const client = site();
    const refused = (input: Parameters<MockSchemaClient['createField']>[1]) => client.createField('Version', input).catch((e: unknown) => e);
    expect(await refused({ dataType: 'color', displayName: 'a' })).toMatchObject({ status: 400, source: { data_type: ['data_type is not valid'] } });
    expect(await refused({ dataType: 'image', displayName: 'a' })).toMatchObject({ status: 400 });
    expect(await refused({ dataType: 'calculated', displayName: 'a' })).toMatchObject({ status: 500 });
    expect(await refused({ dataType: 'checkbox', displayName: 'a' })).toMatchObject({ status: 500, message: 'Only true or false allowed in checkbox' });
    expect(await refused({ dataType: 'entity', displayName: 'a' })).toMatchObject({ status: 400 });
    expect(await refused({ dataType: 'multi_entity', displayName: 'a', properties: { valid_types: ['Shot', 'Asset'] } })).toMatchObject({
      status: 400,
      message: "'valid_types' value expected Array with one element",
    });
    expect(await refused({ dataType: 'multi_entity', displayName: 'a', properties: { valid_types: [] } })).toMatchObject({ status: 400 });
    expect(await refused({ dataType: 'text', displayName: 'a' })).toMatchObject({ name: 'sg_a' });
    expect(await refused({ dataType: 'entity', displayName: 'b', properties: { valid_types: ['Shot'] } })).toMatchObject({ name: 'sg_b' });
    expect(await refused({ dataType: 'checkbox', displayName: 'c', properties: { default_value: false } })).toMatchObject({ name: 'sg_c' });
  });

  it('takes several valid types on an entity link, and exactly one on a multi_entity', async () => {
    // 116_field_settings_create_update.
    const client = site();
    const link = await client.createField('Version', { dataType: 'entity', displayName: 'Source', properties: { valid_types: ['Shot', 'Asset'] } });
    expect(link.name).toBe('sg_source');
    const read = await client.readField('Version', link.name);
    expect(read.status === 'found' && read.raw.properties['valid_types']).toEqual({ value: ['Shot', 'Asset'], editable: true });
    const many = await client.createField('Version', { dataType: 'multi_entity', displayName: 'Sources', properties: { valid_types: ['Shot'] } });
    const readMany = await client.readField('Version', many.name);
    expect(readMany.status === 'found' && readMany.raw.properties['valid_types']).toEqual({ value: ['Shot'], editable: false });
  });

  it('keeps custom_metadata at the top level of the record, as the server does', async () => {
    // 002_schema, 009_status_lists.
    const client = site();
    const bare = await client.createField('Shot', { dataType: 'text', displayName: 'Plate Note' });
    expect(bare.raw).toMatchObject({ custom_metadata: { value: '', editable: true } });
    const { name, raw } = await client.createField('Shot', { dataType: 'text', displayName: 'Plate Source', properties: { custom_metadata: 'set:plates' } });
    expect(raw).toMatchObject({ custom_metadata: { value: 'set:plates', editable: true } });
    expect(raw?.['properties']).not.toHaveProperty('custom_metadata');
    const updated = await client.updateField('Shot', name, { custom_metadata: 'set:shoot' });
    expect(updated?.custom_metadata).toEqual({ value: 'set:shoot', editable: true });
    expect(updated?.properties).not.toHaveProperty('custom_metadata');
    expect((await client.readRawFields('Shot'))[name]?.custom_metadata?.value).toBe('set:shoot');
    // A field of the site carries the key too, empty (056_stock_vs_custom_field).
    expect((await client.readRawFields('Shot'))['code']?.custom_metadata).toEqual({ value: '', editable: true });
  });

  it('reads unique back at the top level, never editable', async () => {
    // 116_field_settings_create_update.
    const client = site();
    const { name, raw } = await client.createField('Version', { dataType: 'text', displayName: 'Slate', properties: { unique: true } });
    expect(raw).toMatchObject({ unique: { value: true, editable: false } });
    expect(raw?.['properties']).not.toHaveProperty('unique');
    const read = await client.readField('Version', name);
    expect(read.status === 'found' && read.field.unique).toBe(true);
  });

  it('refuses a status_list without its valid values', async () => {
    // 116_field_settings_create_update.
    const client = site();
    await expect(client.createField('Version', { dataType: 'status_list', displayName: 'Review' })).rejects.toMatchObject({
      status: 400,
      message: `API schema_field_create() missing required 'properties' ["valid_values"]`,
    });
    const made = await client.createField('Version', { dataType: 'status_list', displayName: 'Review', properties: { valid_values: ['na', 'rev', 'vwd'], default_value: 'rev' } });
    expect(made.name).toBe('sg_review');
  });

  it('refuses a type the site does not have', async () => {
    await expect(site().createField('NotTypeAtAll', { dataType: 'text', displayName: 'a' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('retire and revive on the mock', () => {
  it('burns the name: gone from every read, refused on create, back at its old type on revive', async () => {
    // 040_field_revive.
    const client = site();
    const { name } = await client.createField('Version', { dataType: 'text', displayName: 'zzprobe 040 revive' });
    await client.retireField('Version', name);

    expect(await client.readField('Version', name)).toEqual({ status: 'missing', message: `Field 'Version.${name}' does not exist.` });
    expect(Object.keys(await client.readRawFields('Version'))).not.toContain(name);
    await expect(client.retireField('Version', name)).rejects.toMatchObject({ status: 404 });

    const error = await client.createField('Version', { dataType: 'number', displayName: 'zzprobe 040 revive' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchemaApiError);
    expect(error).toMatchObject({
      status: 400,
      message: `API schema_field_create() failed, there is a retired field with the same field_name: ${name}. Delete the retired field forever from the Trash Page in Shotgun and try again.`,
    });

    expect(await client.reviveField('Version', name)).toEqual({ revived: true });
    const back = await client.readField('Version', name);
    expect(back.status === 'found' && back.field).toMatchObject({ dataType: 'text', displayName: 'zzprobe 040 revive' });
  });

  it('answers not revived for a name with nothing in the trash', async () => {
    const client = site();
    expect(await client.reviveField('Version', 'sg_never')).toMatchObject({ revived: false });
    expect(await client.reviveField('Version', 'code')).toMatchObject({ revived: false });
  });
});

describe('an update on the mock', () => {
  it('renames, leaves the programmatic name, and answers the record', async () => {
    const client = site();
    const { name } = await client.createField('Shot', { dataType: 'text', displayName: 'Plate Note' });
    const raw = await client.updateField('Shot', name, { name: 'Plate Notes', description: 'From the shoot' });
    expect(raw?.name.value).toBe('Plate Notes');
    const read = await client.readField('Shot', name);
    expect(read.status === 'found' && read.field).toMatchObject({ name, displayName: 'Plate Notes', description: 'From the shoot' });
  });

  it('keeps the description at the top level of the record, as the server does', async () => {
    // 116_field_settings_create_update.
    const client = site();
    const { name, raw } = await client.createField('Shot', { dataType: 'text', displayName: 'Plate Note', properties: { description: 'From the shoot' } });
    expect(raw).toMatchObject({ description: { value: 'From the shoot', editable: true } });
    expect(raw?.['properties']).not.toHaveProperty('description');
    const updated = await client.updateField('Shot', name, { description: 'From the set' });
    expect(updated?.description?.value).toBe('From the set');
    expect(updated?.properties).not.toHaveProperty('description');
    expect((await client.readRawFields('Shot'))[name]?.description?.value).toBe('From the set');
  });

  it('refuses data_type and hidden_values by name', async () => {
    // 040_field_revive, 114_schema_admin_recheck.
    const client = site();
    const { name } = await client.createField('Shot', { dataType: 'text', displayName: 'Plate Note' });
    await expect(client.updateField('Shot', name, { data_type: 'number' })).rejects.toMatchObject({
      status: 400,
      message: "API schema_field_update() invalid property 'data_type'",
    });
    await expect(client.updateField('Shot', 'sg_status_list', { hidden_values: ['ip'] }, 70)).rejects.toMatchObject({ status: 400 });
  });

  // 116_field_settings_create_update, the table of what an update takes.
  describe('what the server refuses after creation', () => {
    const VALID_NAMES = '["name", "visible", "description", "summary_default", "valid_values", "default_value", "custom_metadata"]';

    it('refuses unique: 400 on a field that is not unique, 500 on a text field created unique', async () => {
      const client = site();
      const list = await client.createField('Version', { dataType: 'list', displayName: 'Grade', properties: { valid_values: ['alpha', 'beta'] } });
      await expect(client.updateField('Version', list.name, { unique: true })).rejects.toMatchObject({
        status: 400,
        message: `API schema_field_update() invalid property 'unique': Valid property names: ${VALID_NAMES}`,
      });
      const text = await client.createField('Version', { dataType: 'text', displayName: 'Slate', properties: { unique: true } });
      await expect(client.updateField('Version', text.name, { unique: false })).rejects.toMatchObject({
        status: 500,
        code: 105,
        message: "API schema_field_update() does not support updating 'unique'.",
      });
      const read = await client.readField('Version', text.name);
      expect(read.status === 'found' && read.field.unique).toBe(true);
    });

    it('refuses valid_types on a multi_entity, the value it holds included, and takes them on an entity', async () => {
      const client = site();
      const many = await client.createField('Version', { dataType: 'multi_entity', displayName: 'Sources', properties: { valid_types: ['Shot'] } });
      for (const value of [['Shot'], ['Asset'], ['Shot', 'Asset']]) {
        const refused = await client.updateField('Version', many.name, { valid_types: value }).catch((e: unknown) => e);
        expect(refused).toMatchObject({ status: 400 });
        expect((refused as Error).message).toContain("API schema_field_update() can't update 'valid_types' on this field");
      }
      const link = await client.createField('Version', { dataType: 'entity', displayName: 'Source', properties: { valid_types: ['Shot', 'Asset'] } });
      const updated = await client.updateField('Version', link.name, { valid_types: ['Asset', 'Sequence'] });
      expect(updated?.properties['valid_types']).toEqual({ value: ['Asset', 'Sequence'], editable: true });
    });

    it('refuses to clear a default, with null or an empty string', async () => {
      const client = site();
      const list = await client.createField('Version', { dataType: 'list', displayName: 'Grade', properties: { valid_values: ['alpha', 'beta'], default_value: 'beta' } });
      const box = await client.createField('Version', { dataType: 'checkbox', displayName: 'Hero', properties: { default_value: true } });
      for (const [field, value] of [[list.name, null], [list.name, ''], [box.name, null], [box.name, '']] as const) {
        await expect(client.updateField('Version', field, { default_value: value })).rejects.toMatchObject({
          status: 400,
          title: 'Request Parameters invalid.',
          source: { properties: { '0': { value: ['value must be filled'] } } },
        });
      }
      const read = await client.readField('Version', list.name);
      expect(read.status === 'found' && read.field.defaultValue).toBe('beta');
    });

    it('refuses a default that is not a valid value, on a list and a status_list', async () => {
      const client = site();
      const list = await client.createField('Version', { dataType: 'list', displayName: 'Grade', properties: { valid_values: ['alpha', 'beta'], default_value: 'beta' } });
      const refused = await client.updateField('Version', list.name, { default_value: 'zzz' }).catch((e: unknown) => e);
      expect(refused).toMatchObject({ status: 400 });
      expect((refused as Error).message).toContain("API schema_field_update() 'default_value' not in valid_values");
      const status = await client.createField('Version', { dataType: 'status_list', displayName: 'Review', properties: { valid_values: ['na', 'rev'], default_value: 'rev' } });
      await expect(client.updateField('Version', status.name, { default_value: 'zzz' })).rejects.toMatchObject({ status: 400 });
      expect((await client.updateField('Version', list.name, { default_value: 'alpha' }))?.properties['default_value']?.value).toBe('alpha');
      expect((await client.updateField('Version', status.name, { default_value: 'na' }))?.properties['default_value']?.value).toBe('na');
    });

    it('keeps a list default its values no longer hold, and refuses the same on a status_list', async () => {
      const client = site();
      const list = await client.createField('Version', { dataType: 'list', displayName: 'Grade', properties: { valid_values: ['alpha', 'beta'], default_value: 'alpha' } });
      const updated = await client.updateField('Version', list.name, { valid_values: ['beta'] });
      expect(updated?.properties['valid_values']?.value).toEqual(['beta']);
      expect(updated?.properties['default_value']?.value).toBe('alpha');

      const status = await client.createField('Version', { dataType: 'status_list', displayName: 'Review', properties: { valid_values: ['na', 'rev', 'vwd'], default_value: 'na' } });
      await expect(client.updateField('Version', status.name, { valid_values: ['rev'] })).rejects.toMatchObject({
        status: 400,
        message: `API schema_field_update() 'valid_values' ["rev"] must include the 'default_value' 'na'`,
      });
      expect((await client.updateField('Version', status.name, { valid_values: ['na', 'rev'] }))?.properties['valid_values']?.value).toEqual(['na', 'rev']);
    });

    it('refuses an empty list of valid values, and an update with no properties', async () => {
      const client = site();
      const list = await client.createField('Version', { dataType: 'list', displayName: 'Grade', properties: { valid_values: ['alpha', 'beta'] } });
      await expect(client.updateField('Version', list.name, { valid_values: [] })).rejects.toMatchObject({
        status: 400,
        source: { properties: { '0': { value: ['value must be filled'] } } },
      });
      const none = await client.updateField('Version', list.name, []).catch((e: unknown) => e);
      expect(none).toMatchObject({ status: 400 });
      expect((none as Error).message).toContain("can't create/update with no 'properties'");
    });

    it('refuses a default on a type that takes none after creation', async () => {
      const client = site();
      const { name } = await client.createField('Version', { dataType: 'currency', displayName: 'Budget' });
      const refused = await client.updateField('Version', name, { default_value: 12 }).catch((e: unknown) => e);
      expect(refused).toMatchObject({ status: 400 });
      expect((refused as Error).message).toContain('default value is read-only for all data types except status_list, list, checkbox');
    });

    it('stores a checkbox default sent as a string as that string', async () => {
      const client = site();
      const { name } = await client.createField('Version', { dataType: 'checkbox', displayName: 'Hero', properties: { default_value: true } });
      const updated = await client.updateField('Version', name, { default_value: 'false' });
      expect(updated?.properties['default_value']?.value).toBe('false');
    });
  });

  it('writes a field of the site it was given, and keeps a project write to that project', async () => {
    const client = site();
    await client.updateField('Shot', 'sg_status_list', { name: 'State' });
    await client.updateField('Shot', 'sg_status_list', { visible: false }, 70);
    const siteWide = await client.readField('Shot', 'sg_status_list');
    const scoped = await client.readField('Shot', 'sg_status_list', 70);
    expect(siteWide.status === 'found' && [siteWide.field.displayName, siteWide.raw.visible?.value]).toEqual(['State', true]);
    expect(scoped.status === 'found' && [scoped.field.displayName, scoped.raw.visible?.value]).toEqual(['State', false]);
  });

  it('rejects for a field that is not there', async () => {
    await expect(site().updateField('Shot', 'sg_never', { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('reads on the mock', () => {
  it('wraps a field of the site it was given, hidden values at project scope only', async () => {
    const client = site();
    const siteWide = await client.readField('Shot', 'sg_status_list');
    const scoped = await client.readField('Shot', 'sg_status_list', 70);
    expect(siteWide.status === 'found' && siteWide.raw.data_type).toEqual({ value: 'status_list', editable: false });
    expect(siteWide.status === 'found' && siteWide.raw.properties['hidden_values']).toBeUndefined();
    expect(scoped.status === 'found' && Array.isArray(scoped.raw.properties['hidden_values']?.value)).toBe(true);
    expect(siteWide.status === 'found' && siteWide.field).toEqual((await new MockClient().fields('Shot'))['sg_status_list']);
  });

  it('answers undeclared for the field the census leaves out', async () => {
    const bare = new MockSchemaClient();
    expect(await bare.readField('Note', 'read_by_current_user')).toEqual({ status: 'undeclared' });
    expect(await bare.readField('Note', 'sg_never')).toMatchObject({ status: 'missing' });
  });

  it('fails the next call when armed', async () => {
    const client = site();
    client.failNext({ status: 403, message: 'No' });
    await expect(client.readField('Shot', 'code')).rejects.toMatchObject({ name: 'SchemaApiError', status: 403, message: 'No' });
    expect((await client.readField('Shot', 'code')).status).toBe('found');
  });
});
