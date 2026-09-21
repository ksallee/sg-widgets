import { useMemo, useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { condition, emptyFilter, group, toApi3Hash } from '@sg-widgets/core';
import { Button } from '@/components/ui/button';
import { FilterDialog, type FilterDialogSize } from '@/registry/sg/components/filter-dialog';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';
import { VersionResults } from '../_shared/version-results';

const section = 'flex min-w-0 flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const SIZES: FilterDialogSize[] = ['sm', 'md', 'lg'];

export default function FilterDialogDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [empty, setEmpty] = useState<FilterGroup>(emptyFilter);
  const [applied, setApplied] = useState<FilterGroup>(() =>
    group('and', [
      condition('sg_status_list', 'in', ['rev', 'vwd', 'fin']),
      condition('created_at', 'in_last', [1, 'YEAR']),
    ]),
  );
  /** A Note, whose read-state field evaluates `is` and `is_not` and nothing else. */
  const [note, setNote] = useState<FilterGroup>(() => group('and', [condition('read_by_current_user', 'is', 'unread')]));
  const [sized, setSized] = useState<Record<FilterDialogSize, FilterGroup>>({ sm: emptyFilter(), md: emptyFilter(), lg: emptyFilter() });

  return (
    <DemoContextProvider context={context}>
      <div className="flex min-w-0 flex-col gap-4">
        <section className={section}>
          <h4 className={label}>No filters yet, not wired to the table</h4>
          <FilterDialog entityType="Version" context={context} value={empty} onValueChange={setEmpty} />
        </section>

        <section className={section}>
          <h4 className={label}>Two applied, drives the table below</h4>
          <FilterDialog entityType="Version" context={context} value={applied} onValueChange={setApplied} />
          <pre
            data-testid="dialog-json"
            className="border-border bg-muted text-foreground max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs"
          >
            {JSON.stringify(toApi3Hash(applied), null, 2)}
          </pre>
        </section>

        <VersionResults context={context} value={applied} heading="Versions matching the second launcher" />

        <section className={section} data-demo="note">
          <h4 className={label}>Note, whose read-state field takes is and is not alone</h4>
          <FilterDialog entityType="Note" context={context} value={note} onValueChange={setNote} />
        </section>

        <section className={section} data-demo="sizes">
          <h4 className={label}>Sizes, beside a button of the same size</h4>
          <div className="flex min-w-0 flex-col gap-3">
            {SIZES.map((size) => (
              <div key={size} className="flex min-w-0 items-center gap-3" data-qa-widget="filter-dialog" data-qa-size={size}>
                <FilterDialog
                  entityType="Version"
                  context={context}
                  size={size}
                  value={sized[size]}
                  onValueChange={(next) => setSized({ ...sized, [size]: next })}
                />
                <Button variant="outline" size={size === 'md' ? 'default' : size}>
                  {size}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DemoContextProvider>
  );
}
