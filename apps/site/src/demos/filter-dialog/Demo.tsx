import { useMemo, useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { condition, emptyFilter, group, toApi3Hash } from '@sg-widgets/core';
import { FilterDialog } from '@/registry/sg/components/filter-dialog';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';
import { VersionResults } from '../_shared/version-results';

const section = 'flex min-w-0 flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

export default function FilterDialogDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [empty, setEmpty] = useState<FilterGroup>(emptyFilter);
  const [applied, setApplied] = useState<FilterGroup>(() =>
    group('and', [
      condition('sg_status_list', 'in', ['rev', 'vwd', 'fin']),
      condition('created_at', 'in_last', [1, 'YEAR']),
    ]),
  );

  return (
    <DemoClientProvider client={context.client}>
      <div className="flex min-w-0 flex-col gap-4">
        <section className={section}>
          <h4 className={label}>No filters yet, not wired to the table</h4>
          <FilterDialog entityType="Version" client={context.client} value={empty} onChange={setEmpty} />
        </section>

        <section className={section}>
          <h4 className={label}>Two applied, drives the table below</h4>
          <FilterDialog entityType="Version" client={context.client} value={applied} onChange={setApplied} />
          <pre
            data-testid="dialog-json"
            className="border-border bg-muted text-foreground max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs"
          >
            {JSON.stringify(toApi3Hash(applied), null, 2)}
          </pre>
        </section>

        <VersionResults context={context} value={applied} heading="Versions matching the second launcher" />
      </div>
    </DemoClientProvider>
  );
}
