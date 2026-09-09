import { Fragment, useMemo, useState } from 'react';
import { createSchemaService } from '@sg-widgets/core';
import { EntityTypePicker } from '@/registry/sg/components/entity-type-picker';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];
const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;

const group = 'flex flex-col gap-3';
/** One control per row, at the pane's full width, with its caption above it. */
const stack = 'flex flex-col gap-4';
const field = 'flex w-full flex-col gap-2';
const label = 'text-muted-foreground text-xs';
const readout = 'text-muted-foreground font-mono text-xs';
/** At most 20rem, so the fit has something to cut against. */
const narrow = 'max-w-80';

function Pickers() {
  const client = useSgClient();
  const schema = useMemo(() => createSchemaService(client), [client]);
  const [one, setOne] = useState<string | null>('Shot');
  const [many, setMany] = useState<string[]>(['Version']);

  return (
    <div className="flex flex-col gap-4">
      <div className={field} data-demo="single">
        <span className={label}>Single, allow list: the six production types</span>
        <EntityTypePicker
          schema={schema}
          value={one}
          onValueChange={(next) => setOne(next as string | null)}
          allow={PRODUCTION}
        />
        <span className={readout}>{one ?? 'null'}</span>
      </div>

      <div className={field} data-demo="multi">
        <span className={label}>Multi, deny list: everything but the two user types</span>
        <EntityTypePicker
          schema={schema}
          multiple
          value={many}
          onValueChange={(next) => setMany((next as string[] | null) ?? [])}
          deny={['HumanUser', 'ApiUser']}
          placeholder="Select entity types"
        />
        <span className={readout}>[{many.join(', ')}]</span>
      </div>

      <div className={group} data-demo="summary">
        <span className={label}>What the control shows for six selected, wide and narrow</span>
        <div className={stack}>
          {SUMMARIES.map((summary) => (
            <Fragment key={summary}>
              <div className={field} data-demo-summary={summary}>
                <span className={label}>{summary}, full width</span>
                <EntityTypePicker
                  schema={schema}
                  multiple
                  value={PRODUCTION}
                  summary={summary}
                  allow={PRODUCTION}
                  clearable={false}
                />
              </div>
              <div className={field} data-demo-summary={`${summary}-narrow`}>
                <span className={label}>{summary}, at most 20rem</span>
                <div className={narrow}>
                  <EntityTypePicker
                    schema={schema}
                    multiple
                    value={PRODUCTION}
                    summary={summary}
                    allow={PRODUCTION}
                    clearable={false}
                  />
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      <div className={group} data-demo="codes">
        <span className={label}>The code under the display name, and without it</span>
        <div className={stack}>
          <div className={field}>
            <span className={label}>With the code</span>
            <EntityTypePicker schema={schema} value="Version" allow={PRODUCTION} />
          </div>
          <div className={field}>
            <span className={label}>Without it</span>
            <EntityTypePicker schema={schema} value="Version" allow={PRODUCTION} showCode={false} />
          </div>
        </div>
      </div>

      <div className={group}>
        <span className={label}>Sizes, read-only and invalid</span>
        <div className={stack}>
          <div className={field}>
            <span className={label}>sm</span>
            <EntityTypePicker schema={schema} value="Shot" size="sm" allow={PRODUCTION} />
          </div>
          <div className={field}>
            <span className={label}>lg</span>
            <EntityTypePicker schema={schema} value="Asset" size="lg" allow={PRODUCTION} />
          </div>
          <div className={field}>
            <span className={label}>Read-only</span>
            <EntityTypePicker schema={schema} value="Task" readOnly />
          </div>
          <div className={field}>
            <span className={label}>Invalid</span>
            <EntityTypePicker schema={schema} value={null} invalid />
          </div>
          <div className={field}>
            <span className={label}>Disabled</span>
            <EntityTypePicker schema={schema} value="Version" disabled />
          </div>
        </div>
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
