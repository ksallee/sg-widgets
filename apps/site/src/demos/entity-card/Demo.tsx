import { useEffect, useMemo, useState } from 'react';
import type { EntityRef, EntityRow, WireGroup } from '@sg-widgets/core';
import { entityCardFields } from '@sg-widgets/core';
import { EntityCard } from '@/registry/sg/components/entity-card';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { createDemoContext, type DemoContext } from '../_shared/client';

/**
 * Four paths. The first dotted through a link that accepts several types, so its
 * label names the type it travels through, and the last the row's own status, which
 * the header draws and the grid therefore does not.
 */
const FIELDS = ['entity.Shot.sg_sequence', 'user', 'description', 'sg_status_list'];
const SIZES = ['sm', 'md', 'lg'] as const;

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const caption = 'text-muted-foreground text-xs';
// The card variant paints no surface: the caller frames it, here as a card.
const box = 'bg-card text-card-foreground rounded-lg border p-3';
const action =
  'inline-flex size-6 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground shadow-sm outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

async function loadRows(context: DemoContext): Promise<EntityRow[]> {
  // The mock's rows are one project's already; a real site's are not.
  const filters: WireGroup | null = context.live
    ? { logical_operator: 'and', conditions: [['project', 'is', { type: 'Project', id: context.projectId }]] }
    : null;
  const found = await context.client.search('Version', {
    filters,
    fields: await entityCardFields(context, 'Version', { fields: FIELDS }),
    page: { size: 3 },
  });
  if (found.data.length === 0) throw new Error('The site has no Version to show.');
  return found.data;
}

export default function EntityCardDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [rows, setRows] = useState<EntityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<EntityRef | null>(null);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    let live = true;
    loadRows(context)
      .then((found) => live && setRows(found))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!rows) return <p className="text-muted-foreground text-sm">Loading a version…</p>;

  const row = rows[0]!;
  // A pick hands the card type and id only, so the card has to read the row.
  const reference = picked ? { type: picked.type, id: picked.id } : null;

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>From a row</h4>
        <p className={caption}>The caller already holds the row. The card reads nothing.</p>
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
        <p className={caption}>Each pick hands the card a type and an id. The card reads the row itself.</p>
        <div className="flex max-w-sm flex-col gap-2">
          <EntityPicker
            context={context}
            entityTypes={['Version']}
            projectId={context.live ? context.projectId : undefined}
            placeholder="Search versions…"
            value={picked}
            onValueChange={setPicked}
            clearable
          />
        </div>
        <div className={box}>
          {reference ? (
            <EntityCard context={context} entity={reference} fields={FIELDS} />
          ) : (
            <p className="text-muted-foreground text-sm">Pick a version to read one.</p>
          )}
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>As a tile</h4>
        <p className={caption}>
          The same row picture first: the status on the thumbnail, the name, then one metadata line.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(224px,1fr))' }}>
          {SIZES.map((size, index) => (
            <EntityCard
              key={size}
              context={context}
              row={rows[index % rows.length]!}
              variant="tile"
              subLabelField="sg_status_list"
              secondaryField="user"
              size={size}
            />
          ))}
          <EntityCard
            context={context}
            row={row}
            variant="tile"
            subLabelField="sg_status_list"
            secondaryField="user"
            actions={
              <button type="button" className={action} aria-label="More">
                …
              </button>
            }
            selectable
            selected={selected}
            onSelectedChange={setSelected}
          />
        </div>
      </section>
    </div>
  );
}
