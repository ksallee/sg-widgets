import { useEffect, useState } from 'react';
import type { EntityRow, SortKey } from '@sg-widgets/core';
import { toSortString } from '@sg-widgets/core';
import { SortPicker } from '@/registry/sg/components/sort-picker';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

function Picker() {
  const client = useSgClient();
  const [value, setValue] = useState<SortKey[]>([
    { field: 'sg_status_list', direction: 'asc' },
    { field: 'code', direction: 'desc' },
  ]);
  const [rows, setRows] = useState<EntityRow[] | null>(null);
  const sort = toSortString(value);

  useEffect(() => {
    let live = true;
    setRows(null);
    void client
      .search('Shot', { fields: ['code', 'sg_status_list'], sort, page: { size: 6 } })
      .then((result) => {
        if (live) setRows(result.data);
      });
    return () => {
      live = false;
    };
  }, [client, sort]);

  return (
    <div className="flex flex-col gap-4">
      <SortPicker entityType="Shot" client={client} value={value} onChange={setValue} />

      <section className="flex flex-col gap-2">
        <h4 className={label}>sort</h4>
        <pre
          data-testid="sort-string"
          className="border-border bg-muted text-foreground overflow-auto rounded-lg border p-3 font-mono text-xs"
        >
          {sort || '(none)'}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className={label}>First six shots</h4>
        {rows === null ? (
          <p className="text-muted-foreground text-sm">Loading shots…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{String(row.attributes['code'])}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {String(row.attributes['sg_status_list'])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function SortPickerDemo() {
  return (
    <DemoClientProvider>
      <Picker />
    </DemoClientProvider>
  );
}
