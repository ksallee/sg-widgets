import { useEffect, useMemo, useState } from 'react';
import type { EntityRef } from 'sg-widgets-core';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { createDemoContext, type DemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-center gap-2';

/** Three paths for the hover card, one of them dotted through a link with several valid types. */
const PREVIEW = ['sg_status_list', 'user', 'entity.Shot.sg_sequence'];

/** Types the glyph map covers, plus one it does not. */
const TYPES = [
  'Shot',
  'Asset',
  'Sequence',
  'Version',
  'Task',
  'HumanUser',
  'Project',
  'Note',
  'PublishedFile',
  'CustomEntity07',
];

const removable: EntityRef[] = [
  { type: 'Asset', id: 1226, name: 'charAda' },
  { type: 'Asset', id: 1227, name: 'charBabbage' },
  { type: 'Asset', id: 1228, name: 'envForest' },
];

interface Chip {
  entity: EntityRef;
  thumbnail: string | null;
}

function WithThumbnails({ context }: { context: DemoContext }) {
  const [chips, setChips] = useState<Chip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    context.client
      .search('Shot', { fields: ['code', 'image'], page: { size: 3 } })
      .then((shots) => {
        if (!live) return;
        setChips(
          shots.data.map((r) => ({
            entity: { type: r.type, id: r.id, name: String(r.attributes['code'] ?? '') },
            thumbnail: (r.attributes['image'] as string | null) ?? null,
          })),
        );
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!chips) return <p className="text-muted-foreground text-sm">Loading shots…</p>;

  return (
    <div className={row}>
      {chips.map((chip) => (
        <EntityChip key={chip.entity.id} entity={chip.entity} thumbnail={chip.thumbnail} />
      ))}
    </div>
  );
}

function WithHoverCard({ context, siteUrl }: { context: DemoContext; siteUrl: string }) {
  const [entities, setEntities] = useState<EntityRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    context.client
      .search('Version', { fields: ['code'], page: { size: 3 } })
      .then((versions) => {
        if (!live) return;
        setEntities(versions.data.map((r) => ({ type: r.type, id: r.id, name: String(r.attributes['code'] ?? '') })));
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!entities) return <p className="text-muted-foreground text-sm">Loading versions…</p>;

  return (
    <div className={row}>
      {entities.map((entity) => (
        <EntityChip key={entity.id} entity={entity} preview={PREVIEW} context={context} siteUrl={siteUrl} />
      ))}
    </div>
  );
}

function Removable() {
  const [removed, setRemoved] = useState<string[]>([]);
  const shown = removable.filter((e) => !removed.includes(`${e.type}:${e.id}`));

  return (
    <div className={row}>
      {shown.map((entity) => (
        <EntityChip
          key={entity.id}
          entity={entity}
          removable
          onRemove={(e) => setRemoved((was) => [...was, `${e.type}:${e.id}`])}
        />
      ))}
      {shown.length === 0 ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          onClick={() => setRemoved([])}
        >
          Put them back
        </button>
      ) : null}
    </div>
  );
}

export default function EntityChipDemo() {
  const context = useMemo(() => createDemoContext(), []);
  /** A site to address rows on, so the link variant has somewhere to go. */
  const site = context.siteUrl || 'https://demo.shotgunstudio.com';

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} size="sm" />
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} size="md" />
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} size="lg" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Variants</h4>
        <div className={row}>
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} variant="chip" />
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} variant="link" />
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} variant="text" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Linked to a site</h4>
        <div className={row}>
          <EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} siteUrl={site} variant="chip" />
          <EntityChip entity={{ type: 'Task', id: 5700, name: 'FX' }} siteUrl={site} variant="link" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Hover card</h4>
        <WithHoverCard context={context} siteUrl={site} />
      </section>

      <section className={group}>
        <h4 className={label}>Type glyphs</h4>
        <div className={row}>
          {TYPES.map((type) => (
            <EntityChip key={type} entity={{ type, id: 1, name: type }} size="sm" />
          ))}
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>With a thumbnail</h4>
        <WithThumbnails context={context} />
      </section>

      <section className={group}>
        <h4 className={label}>No name, link, button</h4>
        <div className={row}>
          <EntityChip entity={{ type: 'Version', id: 17055 }} />
          <EntityChip entity={{ type: 'Task', id: 5700, name: 'FX' }} href="#entity-chip" />
          <EntityChip entity={{ type: 'HumanUser', id: 20, name: 'Ada Lovelace' }} onClick={() => {}} />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Removable</h4>
        <Removable />
      </section>
    </div>
  );
}
