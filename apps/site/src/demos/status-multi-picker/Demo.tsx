import { useMemo, useState } from 'react';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { createDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-start gap-3';
const box = 'w-64';
const readout = 'text-muted-foreground font-mono text-xs tabular-nums';

const MODES = ['icons', 'names', 'both', 'count'] as const;
const TWO = ['ip', 'apr'];
const FIVE = ['ip', 'apr', 'rev', 'fin', 'vwd'];

export default function StatusMultiPickerDemo() {
  // Live mode has one project, the toolbar's; the mock has 70 and 71.
  const context = useMemo(() => createDemoContext(), []);
  const client = context.client;
  const projectId = context.projectId;
  const otherProjectId = context.projectFor(71);
  const [inProjectA, setInProjectA] = useState<string[]>(['ip', 'apr']);
  const [inProjectB, setInProjectB] = useState<string[]>(['pndad']);
  const [shared, setShared] = useState<string[]>([]);
  const [project, setProject] = useState<string[]>(['Active', 'Bidding']);
  const [unknown, setUnknown] = useState<string[]>(['zz_retired', 'rev']);

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
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={inProjectA}
              onValueChange={setInProjectA}
            />
          </div>
          <div className={box} data-demo="p71">
            <StatusMultiPicker
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
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectIds={[projectId, otherProjectId]}
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
              projectId={projectId}
              value={unknown}
              onValueChange={setUnknown}
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={['ip', 'fin']}
              showCode
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>What the closed trigger shows, with two and with five selected</h4>
        <div className={row}>
          {MODES.map((mode) => (
            <div className={group} key={mode}>
              <span className={readout}>{mode}</span>
              <div className={box} data-demo={`summary-${mode}-2`}>
                <StatusMultiPicker
                  client={client}
                  entityType="Version"
                  projectId={projectId}
                  value={TWO}
                  summary={mode}
                  clearable={false}
                />
              </div>
              <div className={box} data-demo={`summary-${mode}-5`}>
                <StatusMultiPicker
                  client={client}
                  entityType="Version"
                  projectId={projectId}
                  value={FIVE}
                  summary={mode}
                  clearable={false}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Two selected, collapsing above one</h4>
        <div className={row}>
          <div className={box} data-demo="max-one">
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={TWO}
              max={1}
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
              projectId={projectId}
              value={['apr', 'fin']}
              disabled
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={['apr']}
              readOnly
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
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
              projectId={projectId}
              value={['rev']}
              size="sm"
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={['rev']}
              size="md"
            />
          </div>
          <div className={box}>
            <StatusMultiPicker
              client={client}
              entityType="Version"
              projectId={projectId}
              value={['rev']}
              size="lg"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
