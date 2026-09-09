import { useMemo, useState } from 'react';
import { createSchemaService } from '@sg-widgets/core';
import { EntityTypePicker } from '@/registry/sg/components/entity-type-picker';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];
const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;
const label = 'text-muted-foreground text-xs';

function Pickers() {
  const client = useSgClient();
  const schema = useMemo(() => createSchemaService(client), [client]);
  const [one, setOne] = useState<string | null>('Shot');
  const [many, setMany] = useState<string[]>(['Version']);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-demo="single">
        <span className={label}>Single, allow list: the six production types</span>
        <EntityTypePicker
          schema={schema}
          value={one}
          onValueChange={(next) => setOne(next as string | null)}
          allow={PRODUCTION}
        />
        <span className="text-muted-foreground font-mono text-xs">{one ?? 'null'}</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="multi">
        <span className={label}>Multi, deny list: everything but the two user types</span>
        <EntityTypePicker
          schema={schema}
          multiple
          value={many}
          onValueChange={(next) => setMany((next as string[] | null) ?? [])}
          deny={['HumanUser', 'ApiUser']}
          placeholder="Select entity types"
        />
        <span className="text-muted-foreground font-mono text-xs">[{many.join(', ')}]</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="summary">
        <span className={label}>What the control shows for six selected</span>
        {SUMMARIES.map((summary) => (
          <div data-demo-summary={summary} key={summary}>
            <EntityTypePicker
              schema={schema}
              multiple
              value={PRODUCTION}
              summary={summary}
              allow={PRODUCTION}
              clearable={false}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2" data-demo="codes">
        <span className={label}>The code under the display name, and without it</span>
        <EntityTypePicker schema={schema} value="Version" allow={PRODUCTION} />
        <EntityTypePicker schema={schema} value="Version" allow={PRODUCTION} showCode={false} />
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Sizes, read-only and invalid</span>
        <EntityTypePicker schema={schema} value="Shot" size="sm" allow={PRODUCTION} />
        <EntityTypePicker schema={schema} value="Asset" size="lg" allow={PRODUCTION} />
        <EntityTypePicker schema={schema} value="Task" readOnly />
        <EntityTypePicker schema={schema} value={null} invalid />
        <EntityTypePicker schema={schema} value="Version" disabled />
      </div>
    </div>
  );
}

export default function EntityTypePickerDemo() {
  return (
    <DemoClientProvider>
      <Pickers />
    </DemoClientProvider>
  );
}
