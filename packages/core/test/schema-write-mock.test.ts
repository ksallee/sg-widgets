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
    expect(await refused({ dataType: 'text', displayName: 'a' })).toMatchObject({ name: 'sg_a' });
    expect(await refused({ dataType: 'entity', displayName: 'b', properties: { valid_types: ['Shot'] } })).toMatchObject({ name: 'sg_b' });
    expect(await refused({ dataType: 'checkbox', displayName: 'c', properties: { default_value: false } })).toMatchObject({ name: 'sg_c' });
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
