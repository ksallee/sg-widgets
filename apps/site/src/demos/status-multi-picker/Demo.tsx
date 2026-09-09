import { useState } from 'react';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-start gap-3';
const box = 'w-64';
const readout = 'text-muted-foreground font-mono text-xs tabular-nums';

function Pickers() {
  const client = useSgClient();
  const [inProject70, setInProject70] = useState<string[]>(['ip', 'apr']);
  const [inProject71, setInProject71] = useState<string[]>(['pndad']);
  const [shared, setShared] = useState<string[]>([]);
  const [project, setProject] = useState<string[]>(['Active', 'Bidding']);
  const [unknown, setUnknown] = useState<string[]>(['zz_retired', 'rev']);

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>Version, in project 70 and in project 71</h4>
        <div className={row}>
          <div className={box} data-demo="p70">
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={inProject70}
              onValueChange={setInProject70}
            />
          </div>
          <div className={box} data-demo="p71">
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={71}
              value={inProject71}
              onValueChange={setInProject71}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>The statuses both projects offer</h4>
        <div className={row}>
          <div className={box} data-demo="both">
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectIds={[70, 71]}
              value={shared}
              onValueChange={setShared}
            />
          </div>
          <span className={readout}>{shared.join(', ') || '—'}</span>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Project, whose status field is a plain list with no icons</h4>
        <div className={row}>
          <div className={box} data-demo="project">
            <StatusMultiPicker
              client={client}
              entityType="Project"
              value={project}
              onValueChange={setProject}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>A code the field does not carry, and the code instead of the label</h4>
        <div className={row}>
          <div className={box} data-demo="unknown">
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={unknown}
              onValueChange={setUnknown}
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['ip', 'fin']}
              showCode
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className={row}>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['apr', 'fin']}
              disabled
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['apr']}
              readOnly
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['apr', 'fin']}
              invalid
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['rev']}
              size="sm"
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['rev']}
              size="md"
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={70}
              value={['rev']}
              size="lg"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function StatusMultiPickerDemo() {
  return (
    <DemoClientProvider>
      <Pickers />
    </DemoClientProvider>
  );
}
