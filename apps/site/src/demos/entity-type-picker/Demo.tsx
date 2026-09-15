import { useState } from 'react';
import { EntityTypePicker } from '@/registry/sg/components/entity-type-picker';
import { DemoContextProvider, useSgContext } from '../_shared/react';

const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];

const group = 'flex flex-col gap-3';
/** One control per row, at the pane's full width, with its caption above it. */
const stack = 'flex flex-col gap-4';
const field = 'flex w-full flex-col gap-2';
const label = 'text-muted-foreground text-xs';
const readout = 'text-muted-foreground font-mono text-xs';

function Pickers() {
  const context = useSgContext();
  const [one, setOne] = useState<string | null>('Shot');
  const [any, setAny] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className={field} data-demo="single">
        <span className={label}>Allow list: the six production types</span>
        <EntityTypePicker context={context} value={one} onValueChange={setOne} allow={PRODUCTION} />
        <span className={readout}>{one ?? 'null'}</span>
      </div>

      <div className={field} data-demo="deny">
        <span className={label}>Deny list: everything but the two user types</span>
        <EntityTypePicker
          context={context}
          value={any}
          onValueChange={setAny}
          deny={['HumanUser', 'ApiUser']}
        />
        <span className={readout}>{any ?? 'null'}</span>
      </div>

      <div className={group} data-demo="codes">
        <span className={label}>The code under the display name, and without it</span>
        <div className={stack}>
          <div className={field}>
            <span className={label}>With the code</span>
            <EntityTypePicker context={context} value="Version" allow={PRODUCTION} />
          </div>
          <div className={field}>
            <span className={label}>Without it</span>
            <EntityTypePicker context={context} value="Version" allow={PRODUCTION} showCode={false} />
          </div>
        </div>
      </div>

      <div className={group}>
        <span className={label}>Sizes, read-only and invalid</span>
        <div className={stack}>
          <div className={field}>
            <span className={label}>sm</span>
            <EntityTypePicker context={context} value="Shot" size="sm" allow={PRODUCTION} />
          </div>
          <div className={field}>
            <span className={label}>lg</span>
            <EntityTypePicker context={context} value="Asset" size="lg" allow={PRODUCTION} />
          </div>
          <div className={field}>
            <span className={label}>Read-only</span>
            <EntityTypePicker context={context} value="Task" readonly />
          </div>
          <div className={field}>
            <span className={label}>Invalid</span>
            <EntityTypePicker context={context} value={null} invalid />
          </div>
          <div className={field}>
            <span className={label}>Disabled</span>
            <EntityTypePicker context={context} value="Version" disabled />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EntityTypePickerDemo() {
  return (
    <DemoContextProvider>
      <Pickers />
    </DemoContextProvider>
  );
}
