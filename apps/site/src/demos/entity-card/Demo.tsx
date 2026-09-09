import { useEffect, useMemo, useState } from 'react';
import type { EntityRow, WireGroup } from '@sg-widgets/core';
import { entityCardFields } from '@sg-widgets/core';
import { EntityCard } from '@/registry/sg/components/entity-card';
import { createDemoContext, type DemoContext } from '../_shared/client';

/**
 * Three paths, the first dotted through a link that accepts several types, so its
 * label names the type it travels through.
 */
const FIELDS = ['entity.Shot.sg_sequence', 'user', 'description'];
const SIZES = ['sm', 'md', 'lg'] as const;

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const box = 'rounded-lg border p-3';

async function loadRow(context: DemoContext): Promise<EntityRow> {
  // The mock's rows are one project's already; a real site's are not.
  const filters: WireGroup | null = context.live
    ? { logical_operator: 'and', conditions: [['project', 'is', { type: 'Project', id: context.projectId }]] }
    : null;
  const found = await context.client.search('Version', {
    filters,
    fields: await entityCardFields(context, 'Version', { fields: FIELDS }),
    page: { size: 1 },
  });
  const row = found.data[0];
  if (!row) throw new Error('The site has no Version to show.');
  return row;
}

export default function EntityCardDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [row, setRow] = useState<EntityRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadRow(context)
      .then((found) => live && setRow(found))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!row) return <p className="text-muted-foreground text-sm">Loading a version…</p>;

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>From a row</h4>
        <div className="flex flex-col gap-3">
          {SIZES.map((size) => (
            <div key={size} className={box}>
              <EntityCard context={context} row={row} fields={FIELDS} size={size} />
            </div>
          ))}
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>From a reference</h4>
        <div className="flex flex-col gap-3">
          {SIZES.map((size) => (
            <div key={size} className={box}>
              <EntityCard context={context} entity={{ type: row.type, id: row.id }} fields={FIELDS} size={size} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
