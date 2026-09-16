import { useEffect, useState } from 'react';
import { StatusPicker } from '@/registry/sg/components/status-picker';
import { getDemoContext } from '../_shared/client';

/** An invented pipeline stage per code, for the row secondary a caller supplies. */
const STAGE: Record<string, string> = { ip: 'Animation', rev: 'Review', fin: 'Delivery' };
const stageOf = (option: { code: string }) => STAGE[option.code] ?? '';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-start gap-3';
const box = 'w-64';
const readout = 'text-muted-foreground font-mono text-xs tabular-nums';
/** The types the cells pick a status on. */
const TYPES = ['Version', 'Project', 'Note'];

export default function StatusPickerDemo() {
  // The shared context: every picker on the page reads the Status table through it, once.
  // Live mode has one project, the toolbar's; the mock has 70 and 71.
  const context = getDemoContext();
  const projectId = context.projectId;
  const otherProjectId = context.projectFor(71);
  const [inProjectA, setInProjectA] = useState<string | undefined>('ip');
  const [inProjectB, setInProjectB] = useState<string | undefined>('pndad');
  const [shared, setShared] = useState<string | undefined>(undefined);
  const [project, setProject] = useState<string | undefined>('Active');
  const [unknown, setUnknown] = useState<string | undefined>('zz_retired');
  const [note, setNote] = useState<string | undefined>('opn');
  const [switching, setSwitching] = useState<string | undefined>('part');
  const [switchTo, setSwitchTo] = useState(otherProjectId);
  /** Whether each type's status field is mandatory, read from the schema and written on the cells. */
  const [mandatory, setMandatory] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let live = true;
    for (const type of TYPES) {
      void context.schema.statusField(type).then((found) => {
        if (live) setMandatory((was) => ({ ...was, [type]: typeof found !== 'string' && Boolean(found.mandatory) }));
      });
    }
    return () => {
      live = false;
    };
  }, [context]);
  const flag = (type: string) => (type in mandatory ? String(mandatory[type]) : undefined);

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>
          {projectId === otherProjectId
            ? `Version, in project ${projectId}`
            : `Version, in project ${projectId} and in project ${otherProjectId}`}
        </h4>
        <div className={row}>
          <div className={box} data-demo="p70" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={inProjectA}
              onValueChange={setInProjectA}
            />
          </div>
          <div className={box} data-demo="p71" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
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
          <div className={box} data-demo="both" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
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
          <div className={box} data-demo="project" data-field-mandatory={flag('Project')}>
            <StatusPicker
              context={context}
              entityType="Project"
              value={project}
              onValueChange={setProject}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>A mandatory field, which offers no clear</h4>
        <div className={row}>
          <div className={box} data-demo="mandatory" data-field-mandatory={flag('Note')}>
            <StatusPicker
              context={context}
              entityType="Note"
              value={note}
              onValueChange={setNote}
            />
          </div>
          <span className={readout}>{note ?? '—'}</span>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>
          A code the field does not carry, rows without the code, and a secondary of the caller's own
        </h4>
        <div className={row}>
          <div className={box} data-demo="unknown" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={unknown}
              onValueChange={setUnknown}
            />
          </div>
          <div className={box} data-demo="no-code" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value="ip"
              showCode={false}
              clearable={false}
            />
          </div>
          <div className={box} data-demo="own-secondary" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value="ip"
              secondary={stageOf}
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group} data-demo="switch">
        <h4 className={label}>Switching project drops a status the new one hides</h4>
        <div className={row}>
          <div className={box} data-demo="switching" data-field-mandatory={flag('Version')}>
            <StatusPicker
              context={context}
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
            <StatusPicker context={context} entityType="Version" projectId={projectId} value="apr" disabled />
          </div>
          <div className={box}>
            <StatusPicker context={context} entityType="Version" projectId={projectId} value="apr" readonly />
          </div>
          <div className={box}>
            <StatusPicker context={context} entityType="Version" projectId={projectId} value="apr" invalid />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <div className={box}>
            <StatusPicker context={context} entityType="Version" projectId={projectId} value="rev" size="sm" />
          </div>
          <div className={box}>
            <StatusPicker context={context} entityType="Version" projectId={projectId} value="rev" size="md" />
          </div>
          <div className={box}>
            <StatusPicker context={context} entityType="Version" projectId={projectId} value="rev" size="lg" />
          </div>
        </div>
      </section>
    </div>
  );
}
