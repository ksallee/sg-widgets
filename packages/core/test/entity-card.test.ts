import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSgContext } from '../src/context.js';
import { toColumn } from '../src/collection.js';
import type { EntityCardModel } from '../src/entity-card.js';
import { describeEntityCard, entityCardFields, entityCardSlot, loadEntityCard } from '../src/entity-card.js';

function context(): ReturnType<typeof createSgContext> {
  return createSgContext({ client: new MockClient(), siteUrl: 'https://example.shotgunstudio.com' });
}

describe('entityCardFields', () => {
  it('asks for the identity chain, the thumbnail, the status field and the caller paths', async () => {
    const fields = await entityCardFields(context(), 'Shot', { fields: ['sg_sequence', 'description'] });
    expect(fields).toContain('cached_display_name');
    expect(fields).toContain('code');
    expect(fields).toContain('image');
    expect(fields).toContain('sg_status_list');
    expect(fields).toContain('sg_sequence');
    expect(fields).toContain('description');
  });

  it('leaves out an identity field the type does not have', async () => {
    const fields = await entityCardFields(context(), 'Task');
    expect(fields).not.toContain('code');
    expect(fields).not.toContain('name');
    expect(fields).toContain('content');
  });

  it('names each field once', async () => {
    const fields = await entityCardFields(context(), 'Shot', { fields: ['code', 'code'] });
    expect(fields.filter((f) => f === 'code')).toHaveLength(1);
  });
});

describe('loadEntityCard', () => {
  it('reads one row and describes it', async () => {
    const sg = context();
    const first = (await sg.client.search('Shot', { fields: ['code'], page: { size: 1 } })).data[0];
    const card = await loadEntityCard(sg, { type: 'Shot', id: first?.id ?? 0 }, { fields: ['sg_status_list'] });
    expect(card.entity.id).toBe(first?.id);
    expect(card.name.length).toBeGreaterThan(0);
    expect(card.typeLabel).toBe('Shot');
    expect(card.status?.code).toBeTruthy();
    // The header already carries this status, so the column naming the same field is gone.
    expect(card.columns).toEqual([]);
  });

  it('keeps a linked row status, which is a different row from the one the card is of', async () => {
    const sg = context();
    const first = (await sg.client.search('Version', { fields: ['code'], page: { size: 1 } })).data[0];
    const card = await loadEntityCard(
      sg,
      { type: 'Version', id: first?.id ?? 0 },
      { fields: ['sg_status_list', 'sg_task.Task.sg_status_list'] },
    );
    expect(card.columns.map((c) => c.path)).toEqual(['sg_task.Task.sg_status_list']);
    expect(card.status?.field.name).toBe('sg_status_list');
  });

  it('labels a dotted path through a field with several valid types', async () => {
    const sg = context();
    const first = (await sg.client.search('Version', { fields: ['code'], page: { size: 1 } })).data[0];
    const card = await loadEntityCard(
      sg,
      { type: 'Version', id: first?.id ?? 0 },
      { fields: ['entity.Shot.sg_sequence', 'sg_task.Task.sg_status_list'] },
    );
    expect(card.columns.map((c) => c.label)).toEqual(['Link › Shot › Sequence', 'Task › Status']);
    expect(card.columns[0]?.dataType).toBe('entity');
    expect(card.columns[1]?.dataType).toBe('status_list');
  });

  it('carries the row it described, for a label the caller derives', async () => {
    const sg = context();
    const first = (await sg.client.search('Shot', { fields: ['code'], page: { size: 1 } })).data[0];
    const card = await loadEntityCard(sg, { type: 'Shot', id: first?.id ?? 0 });
    expect(card.row.id).toBe(first?.id);
    expect(card.row.type).toBe('Shot');
  });

  it('names the type by its display name', async () => {
    const sg = context();
    const first = (await sg.client.search('HumanUser', { fields: ['name'], page: { size: 1 } })).data[0];
    const card = await loadEntityCard(sg, { type: 'HumanUser', id: first?.id ?? 0 });
    expect(card.typeLabel).toBe('Person');
  });

  it('throws for a row that is not readable', async () => {
    await expect(loadEntityCard(context(), { type: 'Shot', id: 99_999_999 })).rejects.toThrow(/not readable/);
  });
});

describe('describeEntityCard', () => {
  it('shows an unresolvable path under its own text and an empty value', async () => {
    const sg = context();
    const row = (await sg.client.search('Shot', { fields: ['code'], page: { size: 1 } })).data[0];
    const card = await describeEntityCard(sg, row!, { fields: ['sg_nonesuch'] });
    expect(card.columns[0]).toMatchObject({ path: 'sg_nonesuch', label: 'sg_nonesuch', dataType: 'text' });
    expect(card.columns[0]?.value).toBeNull();
  });

  it('has no status for a type without a status field', async () => {
    const sg = context();
    const row = (await sg.client.search('HumanUser', { fields: ['name'], page: { size: 1 } })).data[0];
    expect((await describeEntityCard(sg, row!)).status).toBeNull();
  });

  it('drops a Project column naming sg_status, the status field of that type', async () => {
    const sg = context();
    const first = (await sg.client.search('Project', { fields: ['name'], page: { size: 1 } })).data[0];
    const card = await loadEntityCard(sg, { type: 'Project', id: first?.id ?? 0 }, { fields: ['sg_status', 'sg_type'] });
    expect(card.status?.field.name).toBe('sg_status');
    expect(card.columns.map((c) => c.path)).toEqual(['sg_type']);
  });

  it('keeps the status column when the row has no status to draw', async () => {
    const sg = context();
    const row = { type: 'Shot', id: 4243, attributes: { code: 'sh_4243', sg_status_list: null }, relationships: {} };
    const card = await describeEntityCard(sg, row, { fields: ['sg_status_list', 'description'] });
    expect(card.status).toBeNull();
    expect(card.columns.map((c) => c.path)).toEqual(['sg_status_list', 'description']);
  });

  it('falls back to type and id when the row has no name', async () => {
    const sg = context();
    const card = await describeEntityCard(sg, { type: 'Shot', id: 4242, attributes: {}, relationships: {} });
    expect(card.name).toBe('Shot #4242');
  });
});

describe('entityCardSlot', () => {
  async function versionCard(fields: string[]): Promise<EntityCardModel> {
    const sg = context();
    const first = (await sg.client.search('Version', { fields: ['code'], page: { size: 1 } })).data[0];
    return loadEntityCard(sg, { type: 'Version', id: first?.id ?? 0 }, { fields });
  }

  it("draws the row's own status, which the grid leaves to the header", async () => {
    const card = await versionCard(['sg_status_list']);
    expect(card.columns).toEqual([]);
    const slot = entityCardSlot(card, 'sg_status_list');
    expect(slot?.dataType).toBe('status_list');
    expect(slot?.value).toBe(card.status?.code);
    expect(slot?.field?.displayValues?.[card.status?.code ?? '']).toBeTruthy();
  });

  it("reads a bare path off the card's own columns, resolved by its data type", async () => {
    const card = await versionCard(['user']);
    expect(entityCardSlot(card, 'user')?.dataType).toBe('entity');
  });

  it('takes a resolved column at its own word', async () => {
    const card = await versionCard([]);
    const slot = entityCardSlot(card, { ...toColumn('sg_status_list'), dataType: 'status_list', header: 'Status' });
    expect(slot?.dataType).toBe('status_list');
    expect(slot?.label).toBe('Status');
  });

  it('answers nothing for no field, an unread path or an empty value', async () => {
    const sg = context();
    const row = { type: 'Shot', id: 4243, attributes: { code: 'sh_4243', description: null }, relationships: {} };
    const card = await describeEntityCard(sg, row, { fields: ['description'] });
    expect(entityCardSlot(card, null)).toBeNull();
    expect(entityCardSlot(card, '')).toBeNull();
    expect(entityCardSlot(card, 'sg_nonesuch')).toBeNull();
    expect(entityCardSlot(card, 'description')).toBeNull();
  });
});
