import { useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { condition, group, toApi3Hash } from '@sg-widgets/core';
import { FilterEditor } from '@/registry/sg/components/filter-editor';
import { DemoClientProvider, useSgClient } from '../_shared/react';

/** A tree a person would build: one condition, then a nested any-of. */
function initial(): FilterGroup {
  return group('and', [
    condition('sg_status_list', 'in', ['rev', 'vwd']),
    condition('client_approved', 'is', true),
    group('or', [condition('code', 'contains', 'comp'), condition('created_at', 'in_last', [30, 'DAY'])]),
  ]);
}

function Editor() {
  const client = useSgClient();
  const [value, setValue] = useState<FilterGroup>(initial);
  const hash = toApi3Hash(value);

  return (
    <div className="flex flex-col gap-4">
      <FilterEditor
        entityType="Version"
        client={client}
        value={value}
        hidePaths={['sg_task']}
        onChange={setValue}
      />

      <section className="flex flex-col gap-2">
        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">api3_hash</h4>
        <pre
          data-testid="filter-json"
          className="border-border bg-muted text-foreground max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs"
        >
          {JSON.stringify(hash, null, 2)}
        </pre>
      </section>
    </div>
  );
}

export default function FilterEditorDemo() {
  return (
    <DemoClientProvider>
      <Editor />
    </DemoClientProvider>
  );
}
