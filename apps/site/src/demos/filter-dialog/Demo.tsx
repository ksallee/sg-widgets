import { useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { condition, emptyFilter, group, toApi3Hash } from '@sg-widgets/core';
import { FilterDialog } from '@/registry/sg/components/filter-dialog';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const section = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

function Launchers() {
  const client = useSgClient();
  const [empty, setEmpty] = useState<FilterGroup>(emptyFilter);
  const [applied, setApplied] = useState<FilterGroup>(() =>
    group('and', [
      condition('sg_status_list', 'in', ['ip', 'fin']),
      condition('sg_turnover_date', 'in_next', [2, 'WEEK']),
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <section className={section}>
        <h4 className={label}>No filters yet</h4>
        <FilterDialog entityType="Shot" client={client} value={empty} onChange={setEmpty} />
      </section>

      <section className={section}>
        <h4 className={label}>Two applied</h4>
        <FilterDialog entityType="Shot" client={client} value={applied} onChange={setApplied} />
        <pre
          data-testid="dialog-json"
          className="border-border bg-muted text-foreground max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs"
        >
          {JSON.stringify(toApi3Hash(applied), null, 2)}
        </pre>
      </section>
    </div>
  );
}

export default function FilterDialogDemo() {
  return (
    <DemoClientProvider>
      <Launchers />
    </DemoClientProvider>
  );
}
