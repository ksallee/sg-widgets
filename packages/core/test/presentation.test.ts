import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSchemaService } from '../src/schema-service.js';
import { createSgContext } from '../src/context.js';
import { entityDetailUrl, normalizeSiteUrl, pathLabel } from '../src/presentation.js';

describe('entityDetailUrl', () => {
  it('addresses a row on the web app', () => {
    expect(entityDetailUrl('https://example.shotgunstudio.com', { type: 'Shot', id: 862 })).toBe(
      'https://example.shotgunstudio.com/detail/Shot/862',
    );
  });

  it('drops trailing slashes on the site', () => {
    expect(entityDetailUrl('https://example.shotgunstudio.com//', { type: 'Task', id: 5700 })).toBe(
      'https://example.shotgunstudio.com/detail/Task/5700',
    );
  });

  it('answers null without a site or a row', () => {
    expect(entityDetailUrl('', { type: 'Shot', id: 862 })).toBeNull();
    expect(entityDetailUrl(null, { type: 'Shot', id: 862 })).toBeNull();
    expect(entityDetailUrl('https://example.shotgunstudio.com', null)).toBeNull();
    expect(entityDetailUrl('https://example.shotgunstudio.com', { type: '', id: 1 })).toBeNull();
  });

  it('takes the name a chip carries without putting it in the url', () => {
    expect(entityDetailUrl('https://example.shotgunstudio.com', { type: 'Shot', id: 1, name: 'sh010_0010' })).toBe(
      'https://example.shotgunstudio.com/detail/Shot/1',
    );
  });
});

describe('normalizeSiteUrl', () => {
  it('trims space and trailing slashes, and answers empty for nothing', () => {
    expect(normalizeSiteUrl('  https://example.shotgunstudio.com/ ')).toBe('https://example.shotgunstudio.com');
    expect(normalizeSiteUrl(undefined)).toBe('');
  });
});

describe('pathLabel', () => {
  const schema = createSchemaService(new MockClient());

  it('names a plain field by its display name', async () => {
    expect(pathLabel(await schema.resolvePath('Task', 'sg_status_list'))).toBe('Status');
  });

  it('leaves the type out when the hop links one type', async () => {
    expect(pathLabel(await schema.resolvePath('Version', 'sg_task.Task.sg_status_list'))).toBe('Task › Status');
  });

  it('names the type when the hop links several', async () => {
    expect(pathLabel(await schema.resolvePath('Version', 'entity.Shot.sg_sequence'))).toBe('Link › Shot › Sequence');
  });

  it('names every ambiguous hop of a longer path', async () => {
    expect(pathLabel(await schema.resolvePath('Version', 'entity.Shot.sg_sequence.Sequence.code'))).toBe(
      'Link › Shot › Sequence › Sequence Name',
    );
  });

  it('drops the type on request', async () => {
    const segments = await schema.resolvePath('Version', 'entity.Shot.sg_sequence');
    expect(pathLabel(segments, { typeWhenAmbiguous: false })).toBe('Link › Sequence');
  });

  it('shows a type by its display name when one is given', async () => {
    const segments = await schema.resolvePath('Version', 'entity.Shot.sg_sequence');
    expect(pathLabel(segments, { typeLabels: { Shot: 'Plan' } })).toBe('Link › Plan › Sequence');
  });

  it('takes a separator', async () => {
    const segments = await schema.resolvePath('Version', 'sg_task.Task.sg_status_list');
    expect(pathLabel(segments, { separator: ' / ' })).toBe('Task / Status');
  });
});

describe('the context site url', () => {
  it('carries the site every widget links into', () => {
    const sg = createSgContext({ client: new MockClient(), siteUrl: 'https://example.shotgunstudio.com/' });
    expect(sg.siteUrl).toBe('https://example.shotgunstudio.com');
    expect(entityDetailUrl(sg.siteUrl, { type: 'Asset', id: 1226 })).toBe(
      'https://example.shotgunstudio.com/detail/Asset/1226',
    );
  });

  it('is empty when the app named none', () => {
    expect(createSgContext({ client: new MockClient() }).siteUrl).toBe('');
  });
});
