import { useEffect, useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-center gap-2';

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

function WithThumbnails() {
  const client = useSgClient();
  const [chips, setChips] = useState<Chip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client
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
  }, [client]);

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
  return (
    <DemoClientProvider>
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
          <h4 className={label}>Type glyphs</h4>
          <div className={row}>
            {TYPES.map((type) => (
              <EntityChip key={type} entity={{ type, id: 1, name: type }} size="sm" />
            ))}
          </div>
        </section>

        <section className={group}>
          <h4 className={label}>With a thumbnail</h4>
          <WithThumbnails />
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
    </DemoClientProvider>
  );
}
