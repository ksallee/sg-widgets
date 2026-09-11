import { useEffect, useState } from 'react';
import type { FieldSchema, NativeStatus, StatusRecord } from '@sg-widgets/core';
import { NATIVE_STATUSES, STOCK_ICON_KEYS } from '@sg-widgets/core';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { DemoContextProvider, useSgContext } from '../_shared/react';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-center gap-2';

/* No site is reachable from a demo: this one serves a stand-in sprite at the stock path. */
const DEMO_SITE = '/demo-site';

/** A shipped status as `GET /entity/statuses` returns it. `act` is the one with an html icon. */
function nativeRecord(status: NativeStatus, index: number): StatusRecord {
  return {
    id: index,
    code: status.code,
    name: status.name,
    bgColor: null,
    icon: status.imageMapKey
      ? { displayType: 'image_map', imageMapKey: status.imageMapKey }
      : { displayType: 'html', html: status.name },
  };
}

const natives = NATIVE_STATUSES.map(nativeRecord);

/** A stock icon the package does not bundle: it draws only from a site's own sprite. */
const cancelled: StatusRecord = {
  id: 900,
  code: 'cncl',
  name: 'Cancelled',
  bgColor: null,
  icon: { displayType: 'image_map', imageMapKey: 'icon_x_thin_white' },
};

/** A selection the cross can take from. */
const REMOVABLE = ['ip', 'apr', 'hld'];

function Removable({ statuses, field }: Loaded) {
  const [removed, setRemoved] = useState<string[]>([]);
  const shown = REMOVABLE.filter((code) => !removed.includes(code));

  return (
    <div className={row}>
      {shown.map((code) => (
        <StatusBadge
          key={code}
          code={code}
          status={statuses[code]}
          field={field}
          color
          removable
          onRemove={(c) => setRemoved((was) => [...was, c])}
        />
      ))}
      <StatusBadge code="rev" status={statuses['rev']} field={field} color variant="icon" removable />
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

interface Loaded {
  statuses: Record<string, StatusRecord>;
  field: FieldSchema;
}

function StatusBadges() {
  const context = useSgContext();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([context.client.statuses(), context.client.fields('Version')])
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
  }, [context]);

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

      <section className={group} data-demo="color">
        <h4 className={label}>Neutral, then coloured</h4>
        <div className={row} data-demo="neutral">
          <StatusBadge code="apr" status={statuses['apr']} field={field} />
          <StatusBadge code="ip" status={statuses['ip']} field={field} />
          <StatusBadge code="hld" status={statuses['hld']} field={field} />
          <StatusBadge code="omt" status={statuses['omt']} field={field} />
        </div>
        <div className={row} data-demo="coloured">
          <StatusBadge code="apr" status={statuses['apr']} field={field} color />
          <StatusBadge code="ip" status={statuses['ip']} field={field} color />
          <StatusBadge code="hld" status={statuses['hld']} field={field} color />
          <StatusBadge code="omt" status={statuses['omt']} field={field} color />
        </div>
      </section>

      <section className={group} data-demo="removable">
        <h4 className={label}>Removable, with the cross inside the pill</h4>
        <Removable statuses={statuses} field={field} />
      </section>

      <section className={group} data-demo="label">
        <h4 className={label}>Name, and the code instead</h4>
        <div className={row}>
          <StatusBadge code="rev" status={statuses['rev']} field={field} />
          <StatusBadge code="rev" status={statuses['rev']} field={field} label="code" />
        </div>
      </section>

      <section className={group} data-demo="icons">
        <h4 className={label}>Uploaded icon, and an html icon</h4>
        <div className={row}>
          <StatusBadge code="custom" status={statuses['custom']} field={field} />
          <StatusBadge code="act" status={statuses['act']} field={field} />
        </div>
      </section>

      <section className={group} data-demo="unknown">
        <h4 className={label}>Label from the schema, and an unknown code</h4>
        <div className={row}>
          <StatusBadge code="fin" field={field} />
          <StatusBadge code="zz_retired" />
        </div>
      </section>
      <section className={group} data-demo="site">
        <h4 className={label}>This site's statuses, custom ones included</h4>
        <div className={row}>
          {Object.values(data.statuses)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((status) => (
              <StatusBadge key={status.code} code={status.code} status={status} size="sm" />
            ))}
        </div>
      </section>
    </>
  );
}

export default function StatusBadgeDemo() {
  return (
    <DemoContextProvider>
      <div className="flex flex-col gap-4">
        <StatusBadges />

        <section className={group} data-demo="native">
          <h4 className={label}>The shipped statuses</h4>
          <div className={row}>
            {natives.map((status) => (
              <StatusBadge key={status.code} code={status.code} status={status} size="sm" />
            ))}
          </div>
        </section>

        <section className={group} data-demo="stock">
          <h4 className={label}>The shipped icons</h4>
          <div className={row}>
            {STOCK_ICON_KEYS.map((key) => (
              <StatusBadge
                key={key}
                code={key}
                status={{ id: 0, code: key, name: key, bgColor: null, icon: { displayType: 'image_map', imageMapKey: key } }}
                variant="icon"
                size="sm"
              />
            ))}
          </div>
        </section>

        <section className={group} data-demo="sprite">
          <h4 className={label}>A sprite cell outside the status set, without and with a site</h4>
          <div className={row}>
            <StatusBadge code={cancelled.code} status={cancelled} />
            <StatusBadge code={cancelled.code} status={cancelled} siteUrl={DEMO_SITE} />
          </div>
        </section>
      </div>
    </DemoContextProvider>
  );
}
