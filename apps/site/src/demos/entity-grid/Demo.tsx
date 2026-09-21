import { useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, EntityRef, EntityRow } from 'sg-widgets-core';
import { cellValue, condition, createEntitySource, displayNameOf, resolveColumns } from 'sg-widgets-core';
import { EntityGrid } from '@/registry/sg/components/entity-grid';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { createDemoContext } from '../_shared/client';

const ARTIST = 'user';
const FIELDS = ['code', 'image', 'sg_status_list', ARTIST];
const SIZES = ['sm', 'md', 'lg'] as const;

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-sm shadow-xs ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

/** The demo holds every third card back, to show what a disabled card does. */
const isRowDisabled = (row: EntityRow): boolean => row.id % 3 === 0;

export default function EntityGridDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const sources = useMemo(() => {
    // The mock's rows are one project's already; a real site's are not.
    const filters = context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null;
    const of = (pageSize: number) =>
      createEntitySource({ client: context.client, entityType: 'Version', fields: FIELDS, filters, pageSize });
    return { source: of(12), short: of(6) };
  }, [context]);

  const [artist, setArtist] = useState<CollectionColumn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [selected, setSelected] = useState<EntityRef[]>([]);
  const [opened, setOpened] = useState<EntityRow | null>(null);

  useEffect(() => {
    let live = true;
    resolveColumns(context.schema, 'Version', [ARTIST])
      .then(([resolved]) => {
        if (!live) return;
        void sources.source.count();
        setArtist(resolved!);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context, sources]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!artist) return <p className="text-muted-foreground text-sm">Loading the site…</p>;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <section className={group} data-testid="grid-sizes">
        <h4 className={label}>Three sizes</h4>
        <div className="flex flex-wrap items-center gap-2">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              className={toggle}
              aria-pressed={size === option}
              onClick={() => setSize(option)}
            >
              {option}
            </button>
          ))}
          <span className="text-muted-foreground text-xs" data-testid="opened">
            {opened ? `opened ${opened.type} ${opened.id}` : 'Enter opens a tile'}
          </span>
        </div>
        <EntityGrid
          source={sources.source}
          context={context}
          secondaryField={artist}
          size={size}
          maxHeight="26rem"
          onSelect={setOpened}
        />
      </section>

      <section className={group} data-testid="grid-selectable">
        <h4 className={label}>Selectable</h4>
        <span className="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
          {selected.length} selected
        </span>
        <EntityGrid
          source={sources.short}
          context={context}
          secondaryField={artist}
          size="sm"
          selectable
          maxHeight="18rem"
          onSelectionChange={setSelected}
        />
      </section>

      <section className={group} data-testid="grid-no-image">
        <h4 className={label}>No image</h4>
        <EntityGrid
          source={sources.short}
          context={context}
          thumbnail={false}
          secondaryField={artist}
          size="sm"
          maxHeight="18rem"
        />
      </section>

      <section className={group} data-testid="grid-disabled">
        <h4 className={label}>Every third card disabled</h4>
        <EntityGrid
          source={sources.short}
          context={context}
          secondaryField={artist}
          size="sm"
          selectable
          maxHeight="18rem"
          isRowDisabled={isRowDisabled}
        />
      </section>

      <section className={group} data-testid="grid-card">
        <h4 className={label}>A card of the caller&rsquo;s own</h4>
        <EntityGrid
          source={sources.short}
          context={context}
          size="sm"
          maxHeight="18rem"
          card={({ row }) => (
            <article className="border-border bg-card hover:bg-accent/50 flex h-full flex-col gap-2 rounded-md border p-3 transition-colors duration-150">
              <Thumbnail src={cellValue(row, 'image') as string | null} alt="" size="lg" className="w-full" />
              <span className="truncate text-sm font-medium" title={displayNameOf(row.attributes, String(row.id))}>
                {displayNameOf(row.attributes, String(row.id))}
              </span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {row.type} {row.id}
              </span>
            </article>
          )}
        />
      </section>
    </div>
  );
}
