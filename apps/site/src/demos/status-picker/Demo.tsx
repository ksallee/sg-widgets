import { useMemo, useState } from 'react';
import { StatusPicker } from '@/registry/sg/components/status-picker';
import { createDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-start gap-3';
const box = 'w-64';
const readout = 'text-muted-foreground font-mono text-xs tabular-nums';

export default function StatusPickerDemo() {
  // Live mode has one project, the toolbar's; the mock has 70 and 71.
  const context = useMemo(() => createDemoContext(), []);
  const client = context.client;
  const projectId = context.projectId;
  const otherProjectId = context.projectFor(71);
  const [inProjectA, setInProjectA] = useState<string | undefined>('ip');
  const [inProjectB, setInProjectB] = useState<string | undefined>('pndad');
  const [shared, setShared] = useState<string | undefined>(undefined);
  const [project, setProject] = useState<string | undefined>('Active');
  const [unknown, setUnknown] = useState<string | undefined>('zz_retired');
  const [switching, setSwitching] = useState<string | undefined>('part');
  const [switchTo, setSwitchTo] = useState(otherProjectId);

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>
          {projectId === otherProjectId
            ? `Version, in project ${projectId}`
            : `Version, in project ${projectId} and in project ${otherProjectId}`}
        </h4>
        <div className={row}>
          <div className={box} data-demo="p70">
            <StatusPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={inProjectA}
              onValueChange={setInProjectA}
            />
          </div>
          <div className={box} data-demo="p71">
            <StatusPicker
              client={client}
              entityType="Version"
              projectId={otherProjectId}
              value={inProjectB}
              onValueChange={setInProjectB}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>The statuses both projects offer</h4>
        <div className={row}>
          <div className={box} data-demo="both">
            <StatusPicker
              client={client}
              entityType="Version"
              projectIds={[projectId, otherProjectId]}
              value={shared}
              onValueChange={setShared}
            />
          </div>
          <span className={readout}>{shared ?? '—'}</span>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Project, whose status field is a plain list with no icons</h4>
        <div className={row}>
          <div className={box} data-demo="project">
            <StatusPicker
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
            <StatusPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={unknown}
              onValueChange={setUnknown}
            />
          </div>
          <div className={box}>
            <StatusPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value="ip"
              showCode
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group} data-demo="switch">
        <h4 className={label}>Switching project drops a status the new one hides</h4>
        <div className={row}>
          <div className={box} data-demo="switching">
            <StatusPicker
              client={client}
              entityType="Version"
              projectId={switchTo}
              value={switching}
              onValueChange={setSwitching}
            />
          </div>
          <button
            type="button"
            className="border-border hover:bg-accent hover:text-accent-foreground h-9 rounded-md border px-2 text-sm transition-colors duration-150 ease-out"
            onClick={() => setSwitchTo(switchTo === projectId ? otherProjectId : projectId)}
          >
            Project {switchTo}
          </button>
          <span className={readout}>{switching ?? '—'}</span>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className={row}>
          <div className={box}>
            <StatusPicker client={client} entityType="Version" projectId={projectId} value="apr" disabled />
          </div>
          <div className={box}>
            <StatusPicker client={client} entityType="Version" projectId={projectId} value="apr" readOnly />
          </div>
          <div className={box}>
            <StatusPicker client={client} entityType="Version" projectId={projectId} value="apr" invalid />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <div className={box}>
            <StatusPicker client={client} entityType="Version" projectId={projectId} value="rev" size="sm" />
          </div>
          <div className={box}>
            <StatusPicker client={client} entityType="Version" projectId={projectId} value="rev" size="md" />
          </div>
          <div className={box}>
            <StatusPicker client={client} entityType="Version" projectId={projectId} value="rev" size="lg" />
          </div>
        </div>
      </section>
    </div>
  );
}
