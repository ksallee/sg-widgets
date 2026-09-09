import { useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { condition, group, toApi3Hash } from '@sg-widgets/core';
import { FilterEditor } from '@/registry/sg/components/filter-editor';
import { DemoClientProvider, useSgClient } from '../_shared/react';

/**
 * A tree a person would build: a status list on the multi picker, two conditions
 * reached through links, a duration and a nested any-of. The duration is typed
 * `1h 30m` or `1:30` and goes out as the 90 minutes it stores.
 */
function initial(): FilterGroup {
  return group('and', [
    condition('sg_status_list', 'in', ['rev', 'vwd']),
    condition('entity.Shot.sg_sequence', 'is', { type: 'Sequence', id: 100, name: 'sh010' }),
    condition('project.Project.sg_status', 'is', 'Active'),
    condition('entity.Shot.sg_working_duration', 'greater_than', 90),
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
