import { useEffect, useState } from 'react';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { DemoClientProvider, useSgClient } from '../_shared/react';
import { createDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-center gap-2';

/** The URL Flow PT serves while a thumbnail is still transcoding. */
const PENDING = 'https://sg.example.com/images/status/transient/thumbnail_pending.png';
/** A truncated PNG: it fails to decode, which is the load-failure fallback. */
const BROKEN = 'data:image/png;base64,iVBORw0KGgo=';

interface Shot {
  code: string;
  src: string | null;
}

function FromTheSite() {
  const client = useSgClient();
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const context = createDemoContext();
    const project = { type: 'Project', id: context.projectId };
    // The chosen project's own picture first, then that project's Versions that carry one.
    Promise.all([
      client.search('Project', {
        filters: { logical_operator: 'and', conditions: [['id', 'is', context.projectId]] },
        fields: ['name', 'image'],
        page: { size: 1 },
      }),
      client.search('Version', {
        filters: { logical_operator: 'and', conditions: [['project', 'is', project], ['image', 'is_not', null]] },
        fields: ['code', 'image'],
        page: { size: 3 },
      }),
    ])
      .then(([projects, versions]) => {
        const rows = [...projects.data, ...versions.data].filter((r) => r.attributes['image']);
        return { data: rows.length >= 3 ? rows : [...rows, ...rows, ...rows].slice(0, 3) };
      })
      .then((result) => {
        if (!live) return;
        setShots(
          result.data.map((r) => ({
            code: String(r.attributes['code'] ?? r.attributes['name'] ?? ''),
            src: (r.attributes['image'] as string | null) ?? null,
          })),
        );
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [client]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!shots) return <p className="text-muted-foreground text-sm">Loading shots…</p>;

  return (
    <>
      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="sm" />
          <Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="md" />
          <Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="lg" />
          <Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="xl" />
          <Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="2xl" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Aspect</h4>
        <div className={row}>
          <Thumbnail src={shots[1]?.src} alt={shots[1]?.code ?? ''} size="lg" aspect="16:9" />
          <Thumbnail src={shots[1]?.src} alt={shots[1]?.code ?? ''} size="lg" aspect="square" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Playable</h4>
        <div className={row}>
          <Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="sm" playable />
          <Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="md" playable />
          <Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="lg" playable />
          <Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="xl" playable />
          <Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="2xl" playable />
        </div>
      </section>
    </>
  );
}

export default function ThumbnailDemo() {
  return (
    <DemoClientProvider>
      <div className="flex flex-col gap-4">
        <FromTheSite />

        <section className={group}>
          <h4 className={label}>No image, still transcoding, failed to load</h4>
          <div className={row}>
            <Thumbnail src={null} size="lg" />
            <Thumbnail src={PENDING} size="lg" />
            <Thumbnail src={BROKEN} size="lg" />
            <Thumbnail src={null} size="lg" aspect="square" playable />
          </div>
        </section>
      </div>
    </DemoClientProvider>
  );
}
