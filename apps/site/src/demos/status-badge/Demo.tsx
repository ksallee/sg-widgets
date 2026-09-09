import { useEffect, useState } from 'react';
import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-center gap-2';

interface Loaded {
  statuses: Record<string, StatusRecord>;
  field: FieldSchema;
}

function StatusBadges() {
  const client = useSgClient();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([client.statuses(), client.fields('Version')])
      .then(([rows, fields]) => {
        if (!live) return;
        const statuses: Record<string, StatusRecord> = {};
        for (const status of rows) statuses[status.code] = status;
        setData({ statuses, field: fields['sg_status_list'] as FieldSchema });
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [client]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Loading statuses…</p>;
  const { statuses, field } = data;

  return (
    <>
      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <StatusBadge code="apr" status={statuses['apr']} field={field} size="sm" />
          <StatusBadge code="apr" status={statuses['apr']} field={field} size="md" />
          <StatusBadge code="apr" status={statuses['apr']} field={field} size="lg" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Variants</h4>
        <div className={row}>
          <StatusBadge code="ip" status={statuses['ip']} field={field} variant="both" />
          <StatusBadge code="ip" status={statuses['ip']} field={field} variant="icon" />
          <StatusBadge code="ip" status={statuses['ip']} field={field} variant="text" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Icon display types</h4>
        <div className={row}>
          <StatusBadge code="na" status={statuses['na']} field={field} />
          <StatusBadge code="custom" status={statuses['custom']} field={field} />
          <StatusBadge code="act" status={statuses['act']} field={field} />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Every status on the site</h4>
        <div className={row}>
          {Object.values(statuses).map((status) => (
            <StatusBadge key={status.code} code={status.code} status={status} field={field} size="sm" />
          ))}
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Label from the schema, and an unknown code</h4>
        <div className={row}>
          <StatusBadge code="fin" field={field} />
          <StatusBadge code="zz_retired" />
        </div>
      </section>
    </>
  );
}

export default function StatusBadgeDemo() {
  return (
    <DemoClientProvider>
      <div className="flex flex-col gap-4">
        <StatusBadges />
      </div>
    </DemoClientProvider>
  );
}
