import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createStatusService } from '../src/status-service.js';
import { SgApiError } from '../src/client.js';
import { parseBgColor } from '../src/status.js';
import type { SgClient } from '../src/client.js';

/** Delegate everything, count the status reads. */
function counting(inner: SgClient): { client: SgClient; calls: () => number } {
  let calls = 0;
  return {
    client: {
      entityTypes: (...a) => inner.entityTypes(...a),
      fields: (...a) => inner.fields(...a),
      fieldWithProject: (...a) => inner.fieldWithProject(...a),
      search: (...a) => inner.search(...a),
      textSearch: (...a) => inner.textSearch(...a),
      update: (...a) => inner.update(...a),
      statuses: () => {
        calls += 1;
        return inner.statuses();
      },
    },
    calls: () => calls,
  };
}

describe('the status table', () => {
  it('reads the site table once, however many widgets ask', async () => {
    const { client, calls } = counting(new MockClient());
    const statuses = createStatusService(client);
    await Promise.all([statuses.all(), statuses.all(), statuses.record('apr'), statuses.byCode()]);
    expect(calls()).toBe(1);
  });

  it('indexes by code, not by entity type', async () => {
    const statuses = createStatusService(new MockClient());
    const apr = await statuses.record('apr');
    expect(apr?.code).toBe('apr');
    expect(apr?.name).toBe('Approved');
    // The same row answers for every type that offers the code.
    expect(await statuses.record('ip')).toBe((await statuses.byCode()).get('ip'));
  });

  it('carries the colour as decimal rgb and an icon', async () => {
    const statuses = createStatusService(new MockClient());
    const apr = await statuses.record('apr');
    expect(apr?.bgColor).toBe('25,118,27');
    expect(parseBgColor(apr?.bgColor)).toEqual({ r: 25, g: 118, b: 27 });
    expect(apr?.icon).toEqual({ displayType: 'image_map', imageMapKey: 'icon_apr' });
  });

  it('has no record for a plain list value', async () => {
    const statuses = createStatusService(new MockClient());
    // Project.sg_status is a `list`: no Status row stands behind its values.
    expect(await statuses.record('Bidding')).toBeUndefined();
  });

  it('does not remember a failure, and forgets on invalidate', async () => {
    const client = new MockClient();
    const statuses = createStatusService(client);
    client.failNext({ status: 503, message: 'Service Unavailable' });
    await expect(statuses.all()).rejects.toBeInstanceOf(SgApiError);
    expect((await statuses.all()).length).toBeGreaterThan(0);

    const counted = counting(client);
    const second = createStatusService(counted.client);
    await second.all();
    second.invalidate();
    await second.all();
    expect(counted.calls()).toBe(2);
  });
});
